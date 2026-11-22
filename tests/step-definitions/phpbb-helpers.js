'use strict';

// Shared plumbing of the steps: addresses, opening a page and waiting for the
// board's own signals, the notices the board answers with, its confirmations,
// the users registry and the session cache, the forums and topics found by
// their names, the editor, the control panels, and the mail catcher.
//
// This file registers no step. The board draws its pages on the server; a few
// actions run in the page instead (a bookmark, a vote, a quick moderator
// action, an upload): while one runs the board shows its loading indicator,
// and it answers in an alert or a confirmation over the darkened page. The
// steps wait for those signals, never for a fixed time.
//
// One rule of the board shapes every form: a form sent in the same second in
// which the board made it is refused ("The submitted form was invalid. Try
// submitting again."). A person never is that fast; a step waits until the
// page that holds the form is a second old (`formAge`).

const { request: playwrightRequest } = require('playwright');
const { gotoUrl, friendly } = require('webship-js/tests/step-definitions/webship');

// ---------------------------------------------------------------------------
// Budgets and text
// ---------------------------------------------------------------------------

/** The per-assertion wait budget: `minWaitTime.page` from cucumber.js, at least 10 seconds. */
function budget(world) {
  return Math.max((world && world.minWaitTime && world.minWaitTime.page) || 0, 10000);
}

/** White space collapsed and trimmed; the invisible marks some texts carry removed. */
function clean(text) {
  return String(text === null || text === undefined ? '' : text).replace(/[\u00ad\u200b-\u200f\u202a-\u202e\u2060\ufeff]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * A text as a comparison sees it: cleaned, in lower case, the typographic quotes
 * and apostrophes (“ ” ‘ ’) the same as the straight ones, a closing colon and a
 * required mark ("Title*") dropped.
 */
function normal(text) {
  return clean(text).replace(/[“”„"]/g, '"').replace(/[‘’‚']/g, "'").replace(/["']/g, "'").replace(/\s*\*$/, '').replace(/\s*:$/, '').toLowerCase();
}

/** Whether a text contains another, as `normal` reads them. */
function mentions(text, part) {
  return normal(text).includes(normal(part));
}

/** A list for an error message: `"a", "b", "c"` or `(none)`. */
function listed(values) {
  const items = [...new Set((values || []).map(clean).filter(Boolean))];
  return items.length ? items.map((item) => `"${item}"`).join(', ') : '(none)';
}

/** Escape a literal string for use in a RegExp. */
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A regular expression that matches a whole text as `normal` reads it, letter case aside. */
function exactly(text) {
  return new RegExp(`^\\s*${escapeRegExp(clean(text)).replace(/\\ /g, '\\s+')}\\s*\\*?\\s*$`, 'i');
}

/** The entities the server writes in a page, decoded. */
function decodeEntities(text) {
  return String(text)
    .replace(/&#x([0-9a-f]+);/gi, (m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/** An ordinal number of a step ("1", "2") as an index, or a failure. */
function indexOf(number, what) {
  const n = parseInt(number, 10);
  if (!(n >= 1)) throw friendly({ message: `"${number}" is not a ${what} number.`, hint: `Count ${what}s from 1: the first is 1.` });
  return n - 1;
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

/** The board's root without a trailing slash. */
function siteRoot(world) {
  return String(world.launchUrl || (world.parameters && world.parameters.launchUrl) || '').replace(/\/+$/, '');
}

/** An address of the board from a path the page or a step gave (absolute URLs stay as they are; "./x.php" is under the root). */
function absolute(world, href) {
  if (/^https?:\/\//.test(href)) return href;
  if (/^\/\//.test(href)) return new URL(siteRoot(world)).protocol + href;
  const path = String(href).replace(/^(\.\/)+/, '').replace(/^\.\.\//, '');
  return siteRoot(world) + (path.startsWith('/') ? '' : '/') + path;
}

/** The path of an address of the board, with its query string and without the session id the board adds. */
function pathOf(world, url) {
  try {
    const u = new URL(url, siteRoot(world) + '/');
    u.searchParams.delete('sid');
    const query = u.searchParams.toString();
    return u.pathname + (query ? '?' + query : '');
  } catch (err) {
    return String(url);
  }
}

// ---------------------------------------------------------------------------
// The request the browser cut, opening a page, waiting
// ---------------------------------------------------------------------------

/**
 * Whether the browser shows its own error page instead of the site's answer:
 * Chromium aborts every request in flight when the network of the machine
 * changes (a container starting or stopping on it). Returns a sentence, or ''.
 */
function cutRequest(world) {
  const url = String((world.page && world.page.url()) || '');
  if (url.startsWith('chrome-error://')) {
    return `the browser shows its own error page (${url}): the request was cut before the site answered`;
  }
  return '';
}

/** The hint of a failure where the browser cut the request. */
const CUT_HINT = 'The request was cut, or the site\'s name did not resolve, because the network of the machine changed (a container starting); nothing is wrong with the scenario. Run it again. On a shared machine, run the suite in the project\'s container (cmd-tools-testing.sh <project> --run in the Webship Workspace), where the network of the host does not reach.';

/** The hint for a failure: the cut request's when the browser cut it, else the one given. */
function hintFor(world, hint) {
  return cutRequest(world) ? CUT_HINT : hint;
}

/**
 * Wait until a page is ready to use: the document has loaded, the board's
 * scripts have run (they mark the body `hasjs`), and no request of the page
 * is under way (its loading indicator is hidden).
 */
async function pageReady(world, timeout) {
  const page = world.page;
  const limit = timeout || budget(world);
  await page.waitForLoadState('load', { timeout: limit }).catch(() => {});
  await page.waitForFunction(() => {
    if (document.readyState !== 'complete') return false;
    const loading = document.querySelector('#loading_indicator');
    if (loading && getComputedStyle(loading).display !== 'none') return false;
    return true;
  }, null, { timeout: limit }).catch(() => {});
}

/**
 * Open a URL and wait for the page to be ready. A network change on the
 * machine aborts a navigation once now and then: the step goes again, once.
 *
 * @returns {Promise<import('playwright').Response|null>} the answer of the server, when the browser gives it.
 */
async function open(world, url) {
  const page = world.page;
  const go = () => page.goto(url, { waitUntil: 'domcontentloaded' });
  let response = null;
  try {
    response = await go();
  } catch (err) {
    if (/ERR_NETWORK_CHANGED|chrome-error:\/\/chromewebdata|ERR_ABORTED|frame was detached/.test(String(err && err.message))) {
      await page.waitForTimeout(500);
      response = await go();
    } else {
      // webship-js's own words for a refused connection or an unknown host.
      await gotoUrl(page, url);
    }
  }
  if (cutRequest(world)) {
    await page.waitForTimeout(500);
    response = await go().catch(() => null);
  }
  await pageReady(world);
  return response;
}

/**
 * Wait until the page on screen is a second old. The board refuses a form
 * that comes back in the second in which it made it (its form token carries
 * the time it was made, and "no time at all" is not a person).
 */
async function formAge(world) {
  await world.page.waitForFunction(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const born = nav ? nav.responseStart : 0;
    return performance.now() - born > 1100;
  }, null, { timeout: 5000 }).catch(() => {});
}

/**
 * Run an action that sends a form or follows a link, and wait for the new
 * page: the browser leaves the page it was on and the new one is ready.
 */
async function afterNavigation(world, fn, { cut = 'fail', timeout } = {}) {
  const page = world.page;
  await Promise.all([
    page.waitForNavigation({ timeout: timeout || budget(world) * 2, waitUntil: 'load' }).catch(() => {}),
    fn(),
  ]);
  await pageReady(world);
  if (cut === 'fail' && cutRequest(world)) {
    throw friendly({ message: `The page did not load: ${cutRequest(world)}.`, hint: CUT_HINT });
  }
}

/** Send a form of the board with one of its buttons: once the page is a second old, then the new page. */
async function send(world, button, options) {
  await formAge(world);
  await afterNavigation(world, () => button.click(), options);
}

/** The heading of the page as a person reads it: the title of a forum, a topic, a panel of a control panel, a notice. */
async function heading(page) {
  for (const selector of ['#cp-main h2', '#main h1', 'h2.forum-title', 'h2.topic-title', 'h2.searchresults-title', 'div#message h2', '#page-body h2', 'h2']) {
    const text = clean(await page.locator(selector).first().textContent({ timeout: 300 }).catch(() => ''));
    if (text) return text;
  }
  return '';
}

/** What the page on screen says about itself, for an error message. */
async function pageSummary(world) {
  const cut = cutRequest(world);
  if (cut) return cut;
  const page = world.page;
  const title = clean(await page.title().catch(() => ''));
  const h = await heading(page);
  const said = await notice(page);
  return `the page shows "${h || '(no heading)'}" (title "${title}") at ${pathOf(world, page.url())}${said.text ? `, and says "${said.text.slice(0, 200)}"` : ''}`;
}

/** Poll a reading until it satisfies a check, or fail with the last reading. */
async function eventually(world, read, check, explain, timeout) {
  const deadline = Date.now() + (timeout || budget(world));
  let value;
  for (;;) {
    value = await read();
    if (check(value)) return value;
    if (Date.now() > deadline) throw friendly(await explain(value));
    await world.page.waitForTimeout(150);
  }
}

// ---------------------------------------------------------------------------
// Notices, errors, confirmations and alerts
// ---------------------------------------------------------------------------

/**
 * The notice of the page: the board answers many actions with a page of its
 * own ("Information"), which says what happened and offers links back
 * ("Return to the topic last visited"). Returns its title, its text without
 * the links, and the links.
 *
 * @returns {Promise<{title: string, text: string, links: string[]}>}
 */
async function notice(page) {
  return page.evaluate(() => {
    const box = document.querySelector('div#message, .successbox, .errorbox');
    if (!box) return { title: '', text: '', links: [] };
    const t = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '');
    const copy = box.cloneNode(true);
    const title = t(copy.querySelector('h2, h3'));
    copy.querySelectorAll('h2, h3').forEach((e) => e.remove());
    const links = [...copy.querySelectorAll('a')].map(t).filter(Boolean);
    // The words of the notice end where its links back begin.
    const first = [...copy.querySelectorAll('br')].find((br) => br.nextElementSibling && br.nextElementSibling.tagName === 'BR');
    let text = t(copy);
    for (const link of links.filter((l) => /^(Return|Go|View) /.test(l))) text = text.replace(link, ' ');
    return { title, text: text.replace(/\s+/g, ' ').trim(), links, split: !!first };
  }).catch(() => ({ title: '', text: '', links: [] }));
}

/** The errors a form of the board shows: above the form (`.error`), in the editor, in a control panel. */
async function formErrors(page) {
  const texts = await page.locator('p.error, div.error, dd.error, .errorbox p, #postform .error').evaluateAll((els) => els.map((e) => (e.innerText || e.textContent || '').split(/\n+/)).flat()).catch(() => []);
  return [...new Set(texts.map(clean).filter(Boolean))];
}

/** Wait for the board's notice to say a text, or fail with what the page says instead. */
async function expectNotice(world, expected, hint) {
  return eventually(world, () => notice(world.page), (n) => mentions(n.text, expected) || mentions(n.title, expected), async (n) => ({
    message: `The board did not say "${expected}". ${n.text ? `It says "${n.text}"` : `It shows no notice; ${await pageSummary(world)}`}${(await formErrors(world.page)).length ? `; errors: ${listed(await formErrors(world.page))}` : ''}.`,
    hint: hintFor(world, hint || 'The board answers an action with a notice page ("Information") that says what happened.'),
  }));
}

/** Follow a link back of a notice page ("Return to the topic last visited"), when the page is a notice with such a link. */
async function followNotice(world, pattern) {
  const link = world.page.locator('div#message a').filter({ hasText: pattern }).first();
  if (!(await link.count())) return false;
  await afterNavigation(world, () => link.click());
  return true;
}

/**
 * Answer a confirmation of the board: its own page ("Are you sure…?" with
 * Yes and No), or the same question over the darkened page when the action
 * ran in the page. `fill` gets the form first (a reason, "Delete
 * permanently").
 */
async function confirm(world, { fill, answer = 'yes' } = {}) {
  const page = world.page;
  const which = await eventually(world, async () => {
    if (await page.locator('#phpbb_confirm').evaluate((e) => getComputedStyle(e).display !== 'none' && Number(getComputedStyle(e).opacity) > 0.9).catch(() => false)) return 'overlay';
    if (await page.locator('form#confirm').count()) return 'page';
    return '';
  }, (w) => !!w, async () => ({
    message: `The board asked for no confirmation: ${await pageSummary(world)}.`,
    hint: hintFor(world, 'The board asks "Are you sure…?" before it deletes, locks, moves or approves.'),
  }));
  const form = which === 'overlay' ? page.locator('#phpbb_confirm') : page.locator('form#confirm');
  if (fill) await fill(form);
  const button = form.locator(`input[name="${answer === 'yes' ? 'confirm' : 'cancel'}"]`).first();
  if (which === 'overlay') {
    // The page answers in place, then loads again or goes on.
    await Promise.all([
      page.waitForNavigation({ timeout: budget(world) * 2, waitUntil: 'load' }).catch(() => {}),
      button.click(),
    ]);
    await overlayGone(world);
    await pageReady(world);
  } else {
    await send(world, button);
  }
  return which;
}

/** The alert the board shows over the darkened page (its title and its text), or null when none is open. */
async function alertText(page) {
  return page.evaluate(() => {
    const box = document.querySelector('#phpbb_alert');
    if (!box || getComputedStyle(box).display === 'none') return null;
    const t = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '');
    return { title: t(box.querySelector('.alert_title')), text: t(box.querySelector('.alert_text')) };
  }).catch(() => null);
}

/** Close the alert over the page, when one is open. */
async function closeAlert(world) {
  const page = world.page;
  if (!(await alertText(page))) return;
  await page.locator('#phpbb_alert .alert_close').click().catch(() => {});
  await overlayGone(world);
}

/** Wait until nothing covers the page: no alert, no confirmation, no darkened page, no request under way. */
async function overlayGone(world) {
  await world.page.waitForFunction(() => {
    const shown = (sel) => { const e = document.querySelector(sel); return !!e && getComputedStyle(e).display !== 'none'; };
    return !shown('#darkenwrapper') && !shown('#phpbb_alert') && !shown('#phpbb_confirm') && !shown('#loading_indicator');
  }, null, { timeout: budget(world) }).catch(() => {});
}

/** Open a dropdown of the board (its trigger shows the menu) and return the menu. */
async function openDropdown(world, container) {
  const menu = container.locator('.dropdown').first();
  if (!(await menu.isVisible().catch(() => false))) {
    await container.locator('.dropdown-trigger').first().click();
    await menu.waitFor({ state: 'visible', timeout: budget(world) });
  }
  return menu;
}

// ---------------------------------------------------------------------------
// Accounts and sessions
// ---------------------------------------------------------------------------

/**
 * An account of the users registry in cucumber.js (`worldParameters.users`),
 * by the handle a scenario names it with.
 *
 * @returns {{handle: string, username: string, password: string, email: (string|undefined)}}
 */
function resolveUser(world, handle) {
  const users = (world.parameters && world.parameters.users) || {};
  const entry = users[handle];
  if (!entry) {
    throw friendly({
      message: `The user "${handle}" is not in the users registry. Known users: ${Object.keys(users).join(', ') || '(none)'}.`,
      hint: `Add it to worldParameters.users in cucumber.js: users: { ${handle}: { username: '${handle}', password: process.env.${String(handle).toUpperCase()}_PASSWORD, email: '${handle}@example.com' } }. The account itself is made once by the build of the site, never by a feature.`,
    });
  }
  if (!entry.username || !entry.password) {
    throw friendly({
      message: `The user "${handle}" has no ${entry.username ? 'password' : 'user name'} in the users registry.`,
      hint: `Set worldParameters.users.${handle}.username and .password in cucumber.js, from environment variables.`,
    });
  }
  return { handle, username: entry.username, password: entry.password, email: entry.email };
}

/** A handle of the registry stands for its account; anything else is a user name as it is. */
function accountOf(world, who) {
  const users = (world.parameters && world.parameters.users) || {};
  if (users[who]) return resolveUser(world, who);
  const handle = Object.keys(users).find((h) => [users[h].username, users[h].email].filter(Boolean).some((v) => String(v).toLowerCase() === String(who).toLowerCase()));
  return handle ? resolveUser(world, handle) : { handle: who, username: who, password: '', email: /@/.test(who) ? who : undefined };
}

/** The user name of a handle of the registry; anything else is a user name already. */
function usernameOf(world, who) {
  return accountOf(world, who).username;
}

/** The email address of a handle of the registry; anything else is an address already. */
function addressOf(world, who) {
  const account = accountOf(world, who);
  if (account.email) return account.email;
  if (/@/.test(who)) return who;
  throw friendly({ message: `The user "${who}" has no email address in the users registry.`, hint: `Set worldParameters.users.${who}.email in cucumber.js.` });
}

// The sessions of the accounts that logged in during this run, by board and
// account: the cookies of the browser after a login through the form.
const SESSIONS = new Map();

function sessionKey(world, username) {
  return `${siteRoot(world)}|${String(username).toLowerCase()}`;
}

function reuseSessions(world) {
  return !(world.parameters && world.parameters.reuseSessions === false);
}

function forgetSession(world, username) {
  if (username) SESSIONS.delete(sessionKey(world, username));
  world.__boardUser = null;
}

/**
 * Who the board says is logged in: the user name in the header of the page
 * on screen, or '' for a visitor. The page stays as it is.
 */
async function signedInName(world) {
  return clean(await world.page.locator('#username_logged_in .username, #username_logged_in .username-coloured').first().textContent({ timeout: 1000 }).catch(() => ''));
}

/** The same, asked of the board with the cookies of the browser when the page on screen has no header of the board. */
async function signedInAccount(world) {
  const page = world.page;
  if (await page.locator('#nav-main').count()) return signedInName(world);
  let res;
  try {
    res = await page.request.get(absolute(world, 'index.php'), { failOnStatusCode: false, timeout: budget(world) });
  } catch (err) {
    return '';
  }
  const html = await res.text().catch(() => '');
  const m = html.match(/id="username_logged_in"[\s\S]*?class="username(?:-coloured)?"[^>]*>([^<]+)</);
  return m ? clean(decodeEntities(m[1])) : '';
}

const LOGIN_HINT = 'The login page of the board (ucp.php?mode=login) has the fields "Username" and "Password" and the button "Login". Check launchUrl in cucumber.js, and that the build of the site made the account.';

/** The login form of the board, its fields and its button. */
function loginForm(page) {
  const form = page.locator('form#login').first();
  return {
    form,
    username: form.locator('input[name="username"]'),
    password: form.locator('input[type="password"]').first(),
    submit: form.locator('input[name="login"]').first(),
  };
}

/**
 * Fill in and send the login form of the board, then read its outcome:
 * whether the board shows the account in its header, else the errors of the
 * login page.
 *
 * @returns {Promise<{ok: boolean, errors: string[], cut: boolean}>}
 */
async function submitLogin(world, username, password, { fresh = true, again = true } = {}) {
  const page = world.page;
  if (fresh) {
    await page.context().clearCookies();
    world.__boardUser = null;
    await open(world, absolute(world, 'ucp.php?mode=login'));
  }
  const f = loginForm(page);
  try {
    await f.username.waitFor({ state: 'visible', timeout: budget(world) });
  } catch (err) {
    throw friendly({ message: `The login form did not appear: ${await pageSummary(world)}.`, cause: err, hint: hintFor(world, LOGIN_HINT) });
  }
  await f.username.fill(username);
  await f.password.fill(password);
  await send(world, f.submit, { cut: 'return' });
  if (cutRequest(world)) {
    if (again) return submitLogin(world, username, password, { fresh: true, again: false });
    return { ok: false, errors: [cutRequest(world)], cut: true };
  }
  const name = await signedInName(world);
  if (name) return { ok: true, errors: [], cut: false };
  return { ok: false, errors: await formErrors(page), cut: false };
}

/** Take over the session an account opened earlier in this run. */
async function restoreSession(world, user) {
  const key = sessionKey(world, user.username);
  const cookies = SESSIONS.get(key);
  if (!cookies || !reuseSessions(world)) return false;
  const context = world.page.context();
  await context.clearCookies();
  await context.addCookies(cookies);
  await open(world, absolute(world, 'index.php'));
  if ((await signedInName(world)).toLowerCase() === user.username.toLowerCase()) {
    world.__boardUser = user;
    return true;
  }
  SESSIONS.delete(key);
  await context.clearCookies();
  return false;
}

/**
 * Log in as an account of the users registry, by its handle: take over its
 * session when it has one from earlier in the run, else log in through the
 * form and keep the session for the next scenario. The step ends on the
 * board index.
 */
async function logInAs(world, handle) {
  const user = resolveUser(world, handle);
  if (await restoreSession(world, user)) return user;
  const outcome = await submitLogin(world, user.username, user.password);
  if (!outcome.ok) {
    throw friendly({
      message: `The board refused the login of "${handle}" (${user.username}): ${listed(outcome.errors)}.`,
      hint: outcome.cut ? CUT_HINT : 'Check the user name and the password of the account in worldParameters.users in cucumber.js. The build of the site makes the accounts; the Webship Workspace\'s builder makes them with --add-users.',
    });
  }
  world.__boardUser = user;
  SESSIONS.set(sessionKey(world, user.username), await world.page.context().cookies());
  return user;
}

/**
 * Do something as another account, in a browser page of its own, and come
 * back: what a Given step needs ("there is a topic … by …"). The page of the
 * scenario and its session stay as they are.
 */
async function asAccount(world, handle, fn) {
  const user = resolveUser(world, handle);
  const mainPage = world.page;
  const browser = mainPage.context().browser();
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: mainPage.viewportSize() || undefined });
  const page = await context.newPage();
  // The helpers read world.page: a stand-in world with the other page.
  const actor = Object.create(world);
  actor.page = page;
  actor.__boardUser = null;
  try {
    await logInAs(actor, handle);
    return await fn(actor, user);
  } finally {
    await context.close().catch(() => {});
  }
}

/** The account that moderates for the Given steps (`worldParameters.moderator`, "moderator" by default). */
function moderatorHandle(world) {
  return (world.parameters && world.parameters.moderator) || 'moderator';
}

// ---------------------------------------------------------------------------
// Forums and topics
// ---------------------------------------------------------------------------

/**
 * The address of a forum by its name: its link on the board index (a forum
 * or a subforum listed there), else the list of forums of the advanced
 * search, which holds every forum the account may read.
 */
async function forumAddress(world, name) {
  const page = world.page;
  const onPage = async () => {
    const links = page.locator('a.forumtitle, a.subforum, #jumpbox a.jumpbox-forum-link, #jumpbox a.jumpbox-sub-link, #jumpbox a.jumpbox-cat-link');
    const all = await links.evaluateAll((els) => els.map((a) => ({ text: (a.textContent || '').replace(/[↳\s]+/g, ' ').trim(), href: a.getAttribute('href') })));
    const hit = all.find((l) => normalName(l.text) === normalName(name));
    return hit ? hit.href : '';
  };
  let href = await onPage();
  if (!href) {
    const res = await page.request.get(absolute(world, 'search.php'), { failOnStatusCode: false }).catch(() => null);
    const html = res ? await res.text().catch(() => '') : '';
    const select = (html.match(/<select[^>]*id="search_forum"[\s\S]*?<\/select>/) || [''])[0];
    const known = [];
    for (const m of select.matchAll(/<option value="(\d+)"[^>]*>([\s\S]*?)<\/option>/g)) {
      const text = clean(decodeEntities(m[2]).replace(/[↳ ]/g, ' '));
      known.push(text);
      if (normalName(text) === normalName(name)) href = `viewforum.php?f=${m[1]}`;
    }
    if (!href) {
      throw friendly({
        message: `The board has no forum "${name}" for this account. Its forums: ${listed(known)}.`,
        hint: 'A forum an account may not read is not listed to it. Check the name, and the account of the scenario.',
      });
    }
  }
  return absolute(world, href);
}

/** A name as a comparison sees it: `normal`, without the arrow of a subforum. */
function normalName(text) {
  return normal(String(text).replace(/[↳]/g, ' '));
}

/** Open a forum by its name. */
async function openForum(world, name) {
  const response = await open(world, await forumAddress(world, name));
  return response;
}

/** The title of the forum on screen (its page's heading), or ''. */
async function forumTitle(page) {
  return clean(await page.locator('h2.forum-title').first().textContent({ timeout: 1000 }).catch(() => ''));
}

/** The title of the topic on screen, or ''. */
async function topicTitle(page) {
  return clean(await page.locator('h2.topic-title').first().textContent({ timeout: 1000 }).catch(() => ''));
}

/** The rows of the topics of the forum page on screen: [{title, href, classes, row}], announcements first, as the page shows them. */
async function topicRows(page) {
  return page.locator('ul.topiclist.topics > li.row').evaluateAll((rows) => rows.map((r) => {
    const t = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '');
    const link = r.querySelector('a.topictitle');
    const dl = r.querySelector('dl');
    const poster = r.querySelector('.topic-poster a.username, .topic-poster a.username-coloured, .topic-poster .username, .topic-poster .username-coloured');
    return {
      title: t(link),
      href: link ? link.getAttribute('href') : '',
      row: r.className,
      state: dl ? dl.className : '',
      by: t(poster),
      replies: parseInt(t(r.querySelector('dd.posts')), 10),
      views: parseInt(t(r.querySelector('dd.views')), 10),
      unapproved: !!r.querySelector('a[href*="mode=unapproved_details"], a[href*="mode=approve_details"], .fa-question'),
      reported: !!r.querySelector('a[href*="mode=reports"], .fa-exclamation'),
      poll: !!r.querySelector('.fa-bar-chart'),
      attachment: !!r.querySelector('.fa-paperclip'),
    };
  }));
}

/** The row of a topic on the forum page on screen by its title, looking through the pages of the forum; null when none has it. */
async function findTopicRow(world, title, { pages = 6 } = {}) {
  const page = world.page;
  for (let n = 0; n < pages; n += 1) {
    const rows = await topicRows(page);
    const hit = rows.find((r) => normal(r.title) === normal(title));
    if (hit) return hit;
    const next = page.locator('.action-bar.bar-top .pagination li.next a, .action-bar .pagination li.next a').first();
    if (!(await next.count())) return null;
    await afterNavigation(world, () => next.click());
  }
  return null;
}

/** Open a topic of the forum on screen by its title, or fail with the topics the forum lists. */
async function openTopicOnPage(world, title) {
  const page = world.page;
  const row = await findTopicRow(world, title);
  if (!row) {
    const rows = await topicRows(page);
    throw friendly({
      message: `The forum "${await forumTitle(page)}" lists no topic "${title}". On this page: ${listed(rows.map((r) => r.title).slice(0, 12))}.`,
      hint: hintFor(world, 'Open the forum of the topic first, or name it: When I open the topic "…" in "…". A topic that waits for approval shows only to its author and to the moderators.'),
    });
  }
  await open(world, absolute(world, row.href));
}

/** The posts of the topic page on screen, as a person reads them. */
async function posts(page) {
  return page.locator('#page-body .post').evaluateAll((els) => els.filter((p) => !p.closest('#topicreview') && !p.closest('#preview') && p.id !== 'preview').map((p) => {
    const t = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '');
    const content = p.querySelector('.content');
    return {
      id: p.id,
      author: t(p.querySelector('.postprofile a.username, .postprofile a.username-coloured, .postprofile .username, .postprofile .username-coloured, p.author strong')),
      subject: t(p.querySelector('.postbody h3')),
      text: t(content),
      quotes: content ? [...content.querySelectorAll('blockquote')].map((q) => ({ by: t(q.querySelector('cite a')), text: t(q) })) : [],
      attachments: [...p.querySelectorAll('.attachbox dl.file, .inline-attachment dl.file')].map((f) => t(f)),
      deleted: /\bdeleted\b/.test(p.className),
      classes: p.className,
    };
  }));
}

/** One post of the topic page on screen: by its number on the page (from 1) or the last; fails when the page has no such post. */
async function postAt(world, number) {
  const all = await posts(world.page);
  const index = number === undefined || number === null || number === '' ? all.length - 1 : indexOf(number, 'post');
  if (!all.length || !all[index]) {
    throw friendly({
      message: `${number ? `Post ${number}` : 'The last post'} is not on this page: it shows ${all.length} post${all.length === 1 ? '' : 's'}; ${await pageSummary(world)}.`,
      hint: hintFor(world, 'Posts are counted on the page of the topic on screen, from 1. Open the topic first: When I open the topic "…" in "…"; a long topic has more pages: When I go to page 2.'),
    });
  }
  return { ...all[index], number: index + 1, locator: world.page.locator(`#${all[index].id}`) };
}

// ---------------------------------------------------------------------------
// The editor
// ---------------------------------------------------------------------------

/** The editor of the page on screen (a new topic, a reply, an edit, a private message), or a failure. */
async function editor(world) {
  const page = world.page;
  const form = page.locator('form#postform').first();
  if (!(await form.count())) {
    throw friendly({
      message: `No editor is open: ${await pageSummary(world)}.`,
      hint: hintFor(world, 'Open it first: When I start a new topic in "…", When I start a reply to the topic, When I edit the last post.'),
    });
  }
  return {
    form,
    subject: form.locator('#subject'),
    message: form.locator('#message, textarea[name="message"]').first(),
    preview: form.locator('input[name="preview"]').first(),
    submit: form.locator('input[name="post"]').first(),
    draft: form.locator('input[name="save"]').first(),
  };
}

// ---------------------------------------------------------------------------
// Control panels
// ---------------------------------------------------------------------------

/** The names and addresses of a list of links, for a finder and its error message. */
async function linkList(locator) {
  return locator.evaluateAll((els) => els.map((a) => ({ text: (a.textContent || '').replace(/\(\d+\)\s*$/, '').replace(/\s+/g, ' ').trim(), href: a.getAttribute('href') })).filter((l) => l.text && l.href && !/^javascript:/.test(l.href)));
}

/**
 * Open a page of a control panel as a person does: its tab, then its entry
 * in the menu of the tab.
 */
async function openPanelPage(world, tab, entry, { tabs, menu, what }) {
  const page = world.page;
  const pick = async (selector, name, kind) => {
    const links = await linkList(page.locator(selector));
    const hit = links.find((l) => normal(l.text) === normal(name));
    if (!hit) {
      throw friendly({
        message: `The ${what} has no ${kind} "${name}". Its ${kind}s: ${listed(links.map((l) => l.text))}.`,
        hint: hintFor(world, `Name the ${kind} as the ${what} shows it.`),
      });
    }
    const link = page.locator(selector).filter({ hasText: exactlyStart(name) }).first();
    await afterNavigation(world, () => link.click());
  };
  if (tab) await pick(tabs, tab, 'tab');
  if (entry) await pick(menu, entry, 'page');
}

/** A regular expression for the text of a menu entry: the name, then at most a counter ("Inbox (2)"). */
function exactlyStart(text) {
  return new RegExp(`^\\s*${escapeRegExp(clean(text)).replace(/\\ /g, '\\s+')}\\s*(\\(\\d+\\))?\\s*$`, 'i');
}

/**
 * A setting of a form of a control panel by its label ("Location",
 * "Hide my online status"): the field the label names, or the group of
 * radio buttons beside it.
 *
 * @returns {Promise<{kind: string, value: string, set: function(string): Promise<void>, options: string[]}>}
 */
async function setting(world, label) {
  const page = world.page;
  const found = await page.evaluate((wanted) => {
    const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().replace(/\s*:$/, '').toLowerCase();
    const scope = document.querySelector('#cp-main, #main, #page-body') || document.body;
    const labels = [...scope.querySelectorAll('dl > dt > label, dl > dt label')];
    const all = labels.map((l) => (l.textContent || '').replace(/\s+/g, ' ').trim().replace(/\s*:$/, '')).filter(Boolean);
    const dt = labels.map((l) => l.closest('dt')).find((d) => norm(d.querySelector('label').textContent) === norm(wanted));
    if (!dt) return { all };
    const dl = dt.closest('dl');
    const dd = dl.querySelector('dd');
    const radios = [...dd.querySelectorAll('input[type=radio]')];
    const mark = (el) => { const id = 'ws-' + Math.random().toString(36).slice(2); el.setAttribute('data-ws-setting', id); return id; };
    if (radios.length) {
      const text = (r) => ((r.closest('label') || document.querySelector(`label[for="${r.id}"]`) || {}).textContent || '').replace(/\s+/g, ' ').trim();
      // The label of the setting may point at the first radio button: its own words are beside it.
      const names = radios.map((r) => { const own = r.closest('label'); return own && own.closest('dd') ? own.textContent.replace(/\s+/g, ' ').trim() : text(r); });
      const checked = radios.findIndex((r) => r.checked);
      return { kind: 'radio', value: checked >= 0 ? names[checked] : '', options: names, ids: radios.map(mark), all };
    }
    const field = dd.querySelector('select, textarea, input:not([type=hidden]):not([type=submit]):not([type=button])');
    if (!field) return { kind: 'text', value: (dd.textContent || '').replace(/\s+/g, ' ').trim(), options: [], ids: [], all, readonly: true };
    if (field.tagName === 'SELECT') {
      const options = [...field.options].map((o) => o.textContent.replace(/\s+/g, ' ').trim());
      return { kind: 'select', value: field.selectedIndex >= 0 ? options[field.selectedIndex] : '', options, ids: [mark(field)], all };
    }
    if (field.type === 'checkbox') return { kind: 'checkbox', value: field.checked ? 'Yes' : 'No', options: ['Yes', 'No'], ids: [mark(field)], all };
    return { kind: 'field', value: field.value, options: [], ids: [mark(field)], all };
  }, label);
  if (!found.kind) {
    throw friendly({
      message: `This page has no setting "${label}". Its settings: ${listed(found.all)}; ${await pageSummary(world)}.`,
      hint: hintFor(world, 'Name the setting by its label, without the colon. Open its page first: When I open "…" under "…" in the user control panel.'),
    });
  }
  const at = (i) => page.locator(`[data-ws-setting="${found.ids[i]}"]`);
  return {
    kind: found.kind,
    value: found.value,
    options: found.options,
    async set(value) {
      if (found.readonly) throw friendly({ message: `The setting "${label}" cannot be changed here: the page shows it as text ("${found.value}").`, hint: 'Some settings are only shown.' });
      if (found.kind === 'radio' || found.kind === 'checkbox' || found.kind === 'select') {
        const i = found.options.findIndex((o) => normal(o) === normal(value));
        if (i < 0) throw friendly({ message: `The setting "${label}" has no choice "${value}". Its choices: ${listed(found.options)}.`, hint: 'Name the choice as the page shows it.' });
        if (found.kind === 'radio') await at(i).check();
        else if (found.kind === 'checkbox') await at(0).setChecked(i === 0);
        else await at(0).selectOption({ index: i });
      } else {
        await at(0).fill(value);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// The mailbox: the mail catcher of the site (Mailpit)
// ---------------------------------------------------------------------------

/** The address of the mail catcher (`worldParameters.mailUrl`), without a trailing slash. */
function mailUrl(world) {
  const url = world.parameters && world.parameters.mailUrl;
  if (!url) throw friendly({ message: 'No mailbox is configured.', hint: 'Set worldParameters.mailUrl in cucumber.js to the mail catcher (Mailpit) the site sends its mail to, for example https://your-project.ddev.site:8026.' });
  return String(url).replace(/\/+$/, '');
}

let MAIL_CONTEXT = null;

/** A request context of its own for the mail catcher, which takes the local certificate of the site. */
async function mailContext() {
  if (!MAIL_CONTEXT) MAIL_CONTEXT = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
  return MAIL_CONTEXT;
}

/** The messages of the mailbox to an address, newest first, as Mailpit lists them: [{ ID, Subject, Created, To }]. */
async function mailTo(world, address) {
  const ctx = await mailContext();
  let res;
  try {
    res = await ctx.get(`${mailUrl(world)}/api/v1/search?query=${encodeURIComponent(`to:"${address}"`)}&limit=50`, { failOnStatusCode: false });
  } catch (err) {
    throw friendly({ message: `The mail catcher at ${mailUrl(world)} did not answer.`, cause: err, hint: 'Check worldParameters.mailUrl in cucumber.js and that the mail catcher runs (ddev describe lists it).' });
  }
  if (res.status() !== 200) throw friendly({ message: `The mail catcher at ${mailUrl(world)} answered ${res.status()}.`, hint: 'Check worldParameters.mailUrl in cucumber.js and that the mail catcher runs (ddev describe lists it).' });
  const json = await res.json();
  return (json.messages || []).filter((m) => (m.To || []).some((t) => String(t.Address).toLowerCase() === String(address).toLowerCase()));
}

/** One message of the mailbox, whole: { Subject, Text, HTML, To, From }. */
async function mailMessage(world, id) {
  const ctx = await mailContext();
  return (await ctx.get(`${mailUrl(world)}/api/v1/message/${id}`)).json();
}

/** The links of a message: [{ text, href }], from its HTML (the words of the link) or its plain text (the address itself). */
function mailLinks(message) {
  const links = [];
  for (const m of String(message.HTML || '').matchAll(/<a\b[^>]*href=(["'])([^"']+)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
    links.push({ text: clean(m[3].replace(/<[^>]+>/g, ' ')), href: decodeEntities(m[2]) });
  }
  if (!links.length) for (const m of String(message.Text || '').matchAll(/https?:\/\/[^\s)"<>]+/g)) links.push({ text: m[0], href: m[0] });
  return links;
}

/** The text of a message, plain and HTML, for a reader. */
function mailText(message) {
  return clean(`${message.Text || ''} ${decodeEntities(String(message.HTML || '').replace(/<[^>]+>/g, ' '))}`);
}


module.exports = {
  budget, clean, normal, mentions, listed, escapeRegExp, exactly, exactlyStart, decodeEntities, indexOf,
  siteRoot, absolute, pathOf, cutRequest, CUT_HINT, hintFor,
  pageReady, open, formAge, afterNavigation, send, heading, pageSummary, eventually,
  notice, formErrors, expectNotice, followNotice, confirm, alertText, closeAlert, overlayGone, openDropdown,
  resolveUser, accountOf, usernameOf, addressOf, forgetSession, signedInName, signedInAccount, loginForm, submitLogin, logInAs, asAccount, moderatorHandle, LOGIN_HINT, SESSIONS, sessionKey,
  forumAddress, normalName, openForum, forumTitle, topicTitle, topicRows, findTopicRow, openTopicOnPage, posts, postAt,
  editor, linkList, openPanelPage, setting,
  mailUrl, mailTo, mailMessage, mailLinks, mailText,
};

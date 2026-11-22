'use strict';

// The control panels: the user control panel (profile, preferences,
// signature, drafts), the moderator control panel and the administration
// control panel, their tabs and pages, the settings of a page by their
// labels, the members list, a profile, and the notifications menu.
//
// The administration control panel asks its administrator for the password
// once more ("To administer the board you must re-authenticate yourself.")
// and carries the session in its addresses: it is entered by its link at the
// foot of the board, never by its bare address.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./phpbb-helpers');

const PANELS = {
  user: { what: 'user control panel', tabs: '#tabs li.tab a.tab, #tabs li.tab > a', menu: '#cp-menu #navigation li a' },
  moderator: { what: 'moderator control panel', tabs: '#tabs li.tab a.tab, #tabs li.tab > a', menu: '#cp-menu #navigation li a' },
  administration: { what: 'administration control panel', tabs: '#tabs li.tab a', menu: '#menu li a' },
};

/** Which control panel the page on screen is: user, moderator, administration, or ''. */
async function panelOnScreen(world) {
  const page = world.page;
  if (await page.locator('body.section-ucp #cp-main').count()) return 'user';
  if (await page.locator('body.section-mcp #cp-main').count()) return 'moderator';
  if (/\/adm\/index\.php/.test(page.url()) && (await page.locator('#acp, #main').count()) && !(await page.locator('form#login').count())) return 'administration';
  return '';
}

/** Open a control panel as its account does. */
async function openPanel(world, which) {
  const page = world.page;
  if (which === 'user') {
    await h.open(world, h.absolute(world, 'ucp.php'));
  } else if (which === 'moderator') {
    if (!(await page.locator('#nav-main').count())) await h.open(world, h.absolute(world, 'index.php'));
    const link = page.locator('#nav-main a[href*="mcp.php"]').first();
    if (!(await link.count())) {
      throw friendly({ message: `The board offers this account no moderator control panel ("${(await h.signedInName(world)) || 'a visitor'}"): no "MCP" at the top of the page.`, hint: 'The moderator control panel is for the moderators of a forum and the global moderators.' });
    }
    await h.afterNavigation(world, () => link.click());
  } else {
    if (!(await page.locator('#page-footer a[href*="adm/index.php"]').count())) await h.open(world, h.absolute(world, 'index.php'));
    const link = page.locator('#page-footer a[href*="adm/index.php"], #nav-main a[href*="adm/index.php"]').first();
    if (!(await link.count())) {
      throw friendly({ message: `The board offers this account no administration control panel ("${(await h.signedInName(world)) || 'a visitor'}"): no link to it at the foot of the page.`, hint: 'The administration control panel is for the administrators of the board.' });
    }
    await h.afterNavigation(world, () => link.click());
    // The board asks its administrator for the password once more in each session.
    const form = h.loginForm(page);
    if (await form.password.count()) {
      const user = world.__boardUser || h.accountOf(world, await form.username.inputValue().catch(() => ''));
      if (!user || !user.password) throw friendly({ message: 'The administration control panel asks for the password again, and the account of this browser is not one of the users registry.', hint: 'Log in with a handle of worldParameters.users: Given I am a logged in user with the "administrator" user' });
      await form.password.fill(user.password);
      await h.send(world, form.submit);
      const errors = await h.formErrors(page);
      if (await h.loginForm(page).password.count()) throw friendly({ message: `The administration control panel refused the password of "${user.username}": ${h.listed(errors)}.`, hint: 'Check the password of the account in worldParameters.users in cucumber.js.' });
      // The session of the account now also opens the administration: keep it for the next scenario.
      h.SESSIONS.set(h.sessionKey(world, user.username), await page.context().cookies());
    }
  }
  const now = await panelOnScreen(world);
  if (now !== which) throw friendly({ message: `The ${PANELS[which].what} did not open: ${await h.pageSummary(world)}.`, hint: h.hintFor(world, 'Log in with an account that may use it first.') });
}

/**
 * Open a control panel of the board: the user control panel of the account, the moderator control panel
 * ("MCP" at the top of the page) or the administration control panel (its link at the foot of the page, and
 * the password of the account once more, which the board asks for).
 *
 * Example #1: When I go to the user control panel
 * Example #2: When I go to the moderator control panel
 * Example #3: And we go to the administration control panel
 * Example #4: Given I go to the administration control panel
 * Example #5: And we go to the user control panel
 */
When(/^(?:I|we) go to the (user|moderator|administration) control panel$/, { timeout: 90000 }, async function (which) {
  await openPanel(this, which);
});

/**
 * Open a page of a control panel as a person does: its tab, then its entry in the menu of the tab. Without
 * "under", the entry is one of the tab that is open. The step opens the control panel first when the page is
 * not in it.
 *
 * Example #1: When I open "Edit signature" under "Profile" in the user control panel
 * Example #2: When I open "Edit global settings" under "Board preferences" in the user control panel
 * Example #3: And I open "Posts awaiting approval" under "Moderation queue" in the moderator control panel
 * Example #4: When we open "Board settings" under "General" in the administration control panel
 * Example #5: And I open "Manage drafts" in the user control panel
 */
When(/^(?:I|we) open "([^"]*)"(?: under "([^"]*)")? in the (user|moderator|administration) control panel$/, { timeout: 90000 }, async function (entry, tab, which) {
  if ((await panelOnScreen(this)) !== which) await openPanel(this, which);
  await h.openPanelPage(this, tab, entry, PANELS[which]);
});

/**
 * Assert the page of the control panel on screen, by its heading ("Edit signature", "Board settings",
 * "Topics awaiting approval").
 *
 * Example #1: Then the control panel should show the page "Edit signature"
 * Example #2: Then the control panel should show the page "Board settings"
 * Example #3: And the control panel should show the page "Topics awaiting approval"
 * Example #4: Then the control panel should show the page "Front page"
 * Example #5: And the control panel should show the page "Forum administration"
 */
Then(/^the control panel should show the page "([^"]*)"$/, async function (expected) {
  const which = await panelOnScreen(this);
  if (!which) throw friendly({ message: `The page is not a control panel: ${await h.pageSummary(this)}.`, hint: h.hintFor(this, 'Open one first: When I go to the user control panel') });
  const headings = (await this.page.locator(which === 'administration' ? '#main h1' : '#cp-main h2, #cp-main h3').allTextContents()).map((t) => h.clean(t).replace(/\s*\[.*\]\s*$/, ''));
  if (!headings.some((t) => h.normal(t) === h.normal(expected))) {
    throw friendly({ message: `The ${PANELS[which].what} shows ${h.listed(headings.slice(0, 4))}, not the page "${expected}".`, hint: 'Name the page by its heading.' });
  }
});

/**
 * Assert that a control panel offers a tab or a page of the tab that is open, or does not (what an account may
 * do decides what its control panel offers).
 *
 * Example #1: Then the control panel should offer the tab "Moderation queue"
 * Example #2: Then the control panel should offer the page "Edit signature"
 * Example #3: And the control panel should not offer the tab "Banning"
 * Example #4: And the control panel should offer the tab "Private messages"
 * Example #5: Then the control panel should not offer the page "Edit avatar"
 */
Then(/^the control panel should (not )?offer the (tab|page) "([^"]*)"$/, async function (notCase, kind, name) {
  const which = await panelOnScreen(this);
  if (!which) throw friendly({ message: `The page is not a control panel: ${await h.pageSummary(this)}.`, hint: h.hintFor(this, 'Open one first: When I go to the user control panel') });
  const links = await h.linkList(this.page.locator(kind === 'tab' ? PANELS[which].tabs : PANELS[which].menu));
  const has = links.some((l) => h.normal(l.text) === h.normal(name));
  if (has === !!notCase) throw friendly({ message: `The ${PANELS[which].what} ${has ? 'offers' : 'does not offer'} the ${kind} "${name}". Its ${kind}s: ${h.listed(links.map((l) => l.text))}.`, hint: 'What an account may do decides what its control panel offers.' });
});

/**
 * Change a setting of the page of the control panel on screen, by its label without the colon: a field takes
 * the text, a list or a group of choices the choice named ("Yes", "No", an option). Save the page with the
 * next step.
 *
 * Example #1: When I set the setting "Location" to "Webship test town"
 * Example #2: When I set the setting "Hide my online status" to "Yes"
 * Example #3: And I set the setting "My date format" to "D M d, Y g:i a"
 * Example #4: And we set the setting "Users can contact me by email" to "No"
 * Example #5: When I set the setting "Website" to "https://example.com"
 */
When(/^(?:I|we) set the setting "([^"]*)" to "([^"]*)"$/, async function (label, value) {
  const s = await h.setting(this, label);
  await s.set(value);
});

/**
 * Assert a setting of the page of the control panel on screen, by its label without the colon: the text of a
 * field, the choice of a list or of a group of choices.
 *
 * Example #1: Then the setting "Location" should be "Webship test town"
 * Example #2: Then the setting "Site name" should be "Webship test board"
 * Example #3: And the setting "Hide my online status" should be "No"
 * Example #4: And the setting "Default language" should be "British English"
 * Example #5: Then the setting "Disable board" should be "No"
 */
Then(/^the setting "([^"]*)" should be "([^"]*)"$/, async function (label, expected) {
  const s = await h.setting(this, label);
  if (h.normal(s.value) !== h.normal(expected)) {
    throw friendly({ message: `The setting "${label}" is "${s.value}", not "${expected}"${s.options.length ? ` (its choices: ${h.listed(s.options.slice(0, 12))})` : ''}.`, hint: 'The step reads the page on screen: open the page again after saving it.' });
  }
});

/**
 * Save the page of the user control panel on screen: "Submit". The step expects the board to take it and
 * ends on its notice ("Your profile has been updated.", "Your preferences have been updated.").
 *
 * Example #1: When I save the settings
 * Example #2: When we save the settings
 * Example #3: And I save the settings
 * Example #4: Then I save the settings
 * Example #5: And we save the settings
 */
When(/^(?:I|we) save the settings$/, { timeout: 90000 }, async function () {
  const page = this.page;
  const which = await panelOnScreen(this);
  if (which !== 'user') {
    throw friendly({ message: which ? `The page is the ${PANELS[which].what}: this step saves a page of the user control panel only.` : `The page is not the user control panel: ${await h.pageSummary(this)}.`, hint: 'A suite changes the settings of its own accounts, never those of the board.' });
  }
  await h.send(this, page.locator('#cp-main input[name="submit"]').first());
  const errors = await h.formErrors(page);
  if (errors.length) throw friendly({ message: `The board did not save the page: ${h.listed(errors)}.`, hint: 'The page says what is wrong above its fields.' });
  await h.expectNotice(this, 'updated', 'The board answers with "Your profile has been updated." or "Your preferences have been updated.".');
});

/**
 * Set the signature of the account in its user control panel (Profile, Edit signature): the text in place of
 * what is there, "Submit". An empty text takes the signature away. BBCode is written as it is.
 *
 * Example #1: When I set my signature to "Webship test signature."
 * Example #2: When I set my signature to ""
 * Example #3: And we set my signature to "Webship test signature with [i]italics[/i]."
 * Example #4: And I set my signature to ""
 * Example #5: Then we set my signature to "Webship test signature."
 */
When(/^(?:I|we) set my signature to "([^"]*)"$/, { timeout: 90000 }, async function (text) {
  const page = this.page;
  await h.open(this, h.absolute(this, 'ucp.php?i=ucp_profile&mode=signature'));
  const field = page.locator('#cp-main textarea[name="signature"]').first();
  if (!(await field.count())) throw friendly({ message: `The page to edit the signature did not open: ${await h.pageSummary(this)}.`, hint: h.hintFor(this, 'Signatures can be turned off for the board, and need an account.') });
  await field.fill(text);
  await h.send(this, page.locator('#cp-main input[name="submit"]').first());
  const errors = await h.formErrors(page);
  if (errors.length) throw friendly({ message: `The board did not take the signature: ${h.listed(errors)}.`, hint: 'The board limits the length of a signature.' });
  await h.expectNotice(this, 'profile has been updated', 'The board answers with "Your profile has been updated.".');
});

/**
 * Assert the signature of the account, as its user control panel holds it (Profile, Edit signature): the
 * text as it was written, or none ("").
 *
 * Example #1: Then my signature should be "Webship test signature."
 * Example #2: Then my signature should be ""
 * Example #3: And my signature should be "Webship test signature with [i]italics[/i]."
 * Example #4: And my signature should be ""
 * Example #5: Then my signature should be "Webship test signature."
 */
Then(/^my signature should be "([^"]*)"$/, async function (expected) {
  await h.open(this, h.absolute(this, 'ucp.php?i=ucp_profile&mode=signature'));
  const field = this.page.locator('#cp-main textarea[name="signature"]').first();
  if (!(await field.count())) throw friendly({ message: `The page to edit the signature did not open: ${await h.pageSummary(this)}.`, hint: h.hintFor(this, 'Signatures need an account.') });
  const found = await field.inputValue();
  if (found !== expected) throw friendly({ message: `The signature is "${found}", not "${expected}".`, hint: 'The user control panel holds the signature as it was written, with its BBCode.' });
});

/** The drafts of the account, from its user control panel: [{title, id}]. */
async function drafts(world) {
  await h.open(world, h.absolute(world, 'ucp.php?i=ucp_main&mode=drafts'));
  if (!(await world.page.locator('#cp-main').count())) throw friendly({ message: `The drafts did not open: ${await h.pageSummary(world)}.`, hint: h.hintFor(world, 'Drafts need an account.') });
  return world.page.locator('#cp-main ul.topiclist.cplist > li.row').evaluateAll((rows) => rows.map((r) => ({
    title: ((r.querySelector('a.topictitle') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
    box: ((r.querySelector('input[type="checkbox"]') || {}).name) || '',
  })).filter((d) => d.title));
}

/**
 * Keep the post in the editor that is open as a draft: "Save draft", then the confirmation. The board keeps
 * the subject and the message, and answers "Draft successfully saved.".
 *
 * Example #1: When I save the post as a draft
 * Example #2: When we save the post as a draft
 * Example #3: And I save the post as a draft
 * Example #4: Then I save the post as a draft
 * Example #5: And we save the post as a draft
 */
When(/^(?:I|we) save the post as a draft$/, { timeout: 90000 }, async function () {
  const ed = await h.editor(this);
  if (!(await ed.draft.count())) throw friendly({ message: 'The editor offers no "Save draft".', hint: 'Drafts are for accounts that may save them, in a new topic, a reply or a private message; not while editing a post.' });
  await h.send(this, ed.draft);
  if (await this.page.locator('form#postform').count()) throw friendly({ message: `The board did not save the draft: ${h.listed(await h.formErrors(this.page))}.`, hint: 'A draft needs a subject and a message.' });
  await h.confirm(this);
  await h.expectNotice(this, 'Draft successfully saved', 'The board answers with "Draft successfully saved.".');
});

/**
 * Assert that the drafts of the account (its user control panel, Overview, Manage drafts) list a draft by its
 * subject, or do not.
 *
 * Example #1: Then my drafts should list "Webship test draft"
 * Example #2: Then my drafts should not list "Webship test draft"
 * Example #3: And my drafts should list "Webship test draft"
 * Example #4: And my drafts should not list "Webship test topic"
 * Example #5: Then my drafts should list "Re: Webship test topic"
 */
Then(/^my drafts should (not )?list "([^"]*)"$/, async function (notCase, title) {
  const all = await drafts(this);
  const has = all.some((d) => h.normal(d.title) === h.normal(title));
  if (has === !!notCase) throw friendly({ message: `The drafts ${has ? 'list' : 'do not list'} "${title}". They are: ${h.listed(all.map((d) => d.title))}.`, hint: 'A draft stays until it is deleted or posted.' });
});

/**
 * Open a draft of the account in the editor again ("Load draft" in the list of drafts), or delete it ("Delete
 * marked"), by its subject.
 *
 * Example #1: When I load the draft "Webship test draft"
 * Example #2: When I delete the draft "Webship test draft"
 * Example #3: And we load the draft "Webship test draft"
 * Example #4: And we delete the draft "Webship test draft"
 * Example #5: Then I delete the draft "Re: Webship test topic"
 */
When(/^(?:I|we) (load|delete) the draft "([^"]*)"$/, { timeout: 90000 }, async function (verb, title) {
  const page = this.page;
  const all = await drafts(this);
  const i = all.findIndex((d) => h.normal(d.title) === h.normal(title));
  if (i < 0) throw friendly({ message: `The drafts have no "${title}". They are: ${h.listed(all.map((d) => d.title))}.`, hint: 'Save one first: When I save the post as a draft' });
  const row = page.locator('#cp-main ul.topiclist.cplist > li.row').filter({ has: page.locator('a.topictitle', { hasText: h.exactly(title) }) }).first();
  if (verb === 'load') {
    await h.afterNavigation(this, () => row.locator('a:visible').filter({ hasText: /Load draft/i }).first().click());
    await h.editor(this);
    return;
  }
  await row.locator('input[type="checkbox"]').first().check();
  await h.send(this, page.locator('#cp-main input[name="delete"]').first());
  if (await page.locator('form#confirm').count()) await h.confirm(this);
  await h.expectNotice(this, 'deleted', 'The board answers with "All selected drafts were successfully deleted.".');
});

/**
 * Open the members list of the board.
 *
 * Example #1: When I go to the members list
 * Example #2: When we go to the members list
 * Example #3: And I go to the members list
 * Example #4: Given I go to the members list
 * Example #5: Then we go to the members list
 */
When(/^(?:I|we) go to the members list$/, async function () {
  await h.open(this, h.absolute(this, 'memberlist.php'));
});

/**
 * Assert that the members list on screen lists an account (a handle of the users registry or a user name), or
 * does not.
 *
 * Example #1: Then the members list should list "member"
 * Example #2: Then the members list should not list "webship-test-nobody"
 * Example #3: And the members list should list "administrator"
 * Example #4: And the members list should list "newmember"
 * Example #5: Then the members list should list "moderator"
 */
Then(/^the members list should (not )?list "([^"]*)"$/, async function (notCase, who) {
  const page = this.page;
  if (!(await page.locator('#memberlist').count())) throw friendly({ message: `The page is not the members list: ${await h.pageSummary(this)}.`, hint: h.hintFor(this, 'A board can keep its members list from visitors. Open it first: When I go to the members list') });
  const names = (await page.locator('#memberlist tbody tr td:first-child a.username, #memberlist tbody tr td:first-child a.username-coloured').allTextContents()).map(h.clean);
  const has = names.some((n) => n.toLowerCase() === h.usernameOf(this, who).toLowerCase());
  if (has === !!notCase) throw friendly({ message: `The members list ${has ? 'lists' : 'does not list'} "${h.usernameOf(this, who)}". On this page: ${h.listed(names)}.`, hint: 'The members list shows the active accounts, a page at a time.' });
});

/**
 * Open the profile of an account (a handle of the users registry or a user name), from the members list.
 *
 * Example #1: When I open the profile of "member"
 * Example #2: When we open the profile of "administrator"
 * Example #3: And I open the profile of "moderator"
 * Example #4: Then I open the profile of "newmember"
 * Example #5: And we open the profile of "member"
 */
When(/^(?:I|we) open the profile of "([^"]*)"$/, async function (who) {
  const name = h.usernameOf(this, who);
  await h.open(this, h.absolute(this, `memberlist.php?mode=viewprofile&un=${encodeURIComponent(name)}`));
  if (!(await this.page.locator('form#viewprofile, #viewprofile').count())) {
    throw friendly({ message: `The profile of "${name}" did not open: ${await h.pageSummary(this)}.`, hint: h.hintFor(this, 'A board can keep its profiles from visitors.') });
  }
});

/**
 * Assert what the profile on screen shows: a text (a part of what the page says: a user name, a group, a
 * location, the number of posts).
 *
 * Example #1: Then the profile should show "Username: member"
 * Example #2: Then the profile should show "Registered users"
 * Example #3: And the profile should show "Location: Webship test town"
 * Example #4: And the profile should show "Global moderators"
 * Example #5: Then the profile should show "Administrators"
 */
Then(/^the profile should (not )?show "([^"]*)"$/, async function (notCase, expected) {
  const box = this.page.locator('form#viewprofile, #viewprofile').first();
  if (!(await box.count())) throw friendly({ message: `The page is not a profile: ${await h.pageSummary(this)}.`, hint: 'Open one first: When I open the profile of "…"' });
  const text = h.clean(await box.innerText());
  const has = h.mentions(text, expected);
  if (has === !!notCase) throw friendly({ message: `The profile ${has ? 'shows' : 'does not show'} "${expected}". It reads "${text.slice(0, 400)}".`, hint: 'A profile shows what its account filled in and what the reader may see.' });
});

/**
 * Open the notifications menu at the top of the page (the bell).
 *
 * Example #1: When I open the notifications menu
 * Example #2: When we open the notifications menu
 * Example #3: And I open the notifications menu
 * Example #4: Then I open the notifications menu
 * Example #5: And we open the notifications menu
 */
When(/^(?:I|we) open the notifications menu$/, async function () {
  const page = this.page;
  if (!(await page.locator('#notification_list_button').count())) await h.open(this, h.absolute(this, 'index.php'));
  const button = page.locator('#notification_list_button').first();
  if (!(await button.count())) throw friendly({ message: `The page has no notifications menu: ${await h.pageSummary(this)}.`, hint: h.hintFor(this, 'Notifications are for an account that is logged in.') });
  if (!(await page.locator('#notification_list').isVisible().catch(() => false))) await button.click();
  await page.locator('#notification_list').waitFor({ state: 'visible', timeout: h.budget(this) });
});

/**
 * Assert that the notifications menu lists a notification that says a text (a part of it: who, what, the
 * title it is about), or lists none that does.
 *
 * Example #1: Then the notifications menu should list "Private Message from moderator"
 * Example #2: Then the notifications menu should list "Webship test message"
 * Example #3: And the notifications menu should not list "Webship test message"
 * Example #4: And the notifications menu should list "Post approval"
 * Example #5: Then the notifications menu should list "Quoted by moderator"
 */
Then(/^the notifications menu should (not )?list "([^"]*)"$/, async function (notCase, expected) {
  const page = this.page;
  if (!(await page.locator('#notification_list').isVisible().catch(() => false))) throw friendly({ message: 'The notifications menu is not open.', hint: 'Open it first: When I open the notifications menu' });
  const items = (await page.locator('#notification_list ul li .notification_text').allTextContents()).map(h.clean);
  const has = items.some((i) => h.mentions(i, expected));
  if (has === !!notCase) throw friendly({ message: `The notifications menu ${has ? 'lists' : 'does not list'} "${expected}". It lists: ${h.listed(items)}.`, hint: 'The menu shows the newest notifications of the account.' });
});

/**
 * Assert a figure of the board on the first page of the administration control panel ("Board version",
 * "Database server", "PHP version", "Number of posts"), or a part of it.
 *
 * Example #1: Then the board statistic "Board version" should be "3.3"
 * Example #2: Then the board statistic "Number of users" should be "5"
 * Example #3: And the board statistic "GZip compression" should be "Off"
 * Example #4: And the board statistic "Database server" should be "MySQL"
 * Example #5: Then the board statistic "PHP version" should be "8."
 */
Then(/^the board statistic "([^"]*)" should be "([^"]*)"$/, async function (label, expected) {
  if ((await panelOnScreen(this)) !== 'administration') throw friendly({ message: `The page is not the administration control panel: ${await h.pageSummary(this)}.`, hint: 'Open it first: When I go to the administration control panel' });
  const cells = (await this.page.locator('#main table').first().locator('tbody td').allTextContents()).map(h.clean);
  const figures = {};
  for (let i = 0; i + 1 < cells.length; i += 2) figures[h.normal(cells[i])] = cells[i + 1];
  const found = figures[h.normal(label)];
  if (found == null || !h.mentions(found, expected)) {
    throw friendly({ message: `The board statistic "${label}" is ${found == null ? 'not shown' : `"${found}"`}, not "${expected}". Shown: ${h.listed(cells.filter((c, i) => i % 2 === 0))}.`, hint: 'The first page of the administration control panel lists the figures of the board.' });
  }
});

/**
 * Assert that the forum administration on screen (the administration control panel, Forums) lists a category
 * or a forum of the level it shows, or does not.
 *
 * Example #1: Then the forum administration should list "Community"
 * Example #2: Then the forum administration should list "General discussion"
 * Example #3: And the forum administration should not list "Webship test forum"
 * Example #4: And the forum administration should list "Staff"
 * Example #5: Then the forum administration should list "Help and support"
 */
Then(/^the forum administration should (not )?list "([^"]*)"$/, async function (notCase, name) {
  const names = await forumAdminRows(this);
  const has = names.some((n) => h.normal(n) === h.normal(name));
  if (has === !!notCase) throw friendly({ message: `The forum administration ${has ? 'lists' : 'does not list'} "${name}". It lists: ${h.listed(names)}.`, hint: 'The forum administration shows one level at a time: open a category to see its forums.' });
});

/** The names of the forums the forum administration on screen lists. */
async function forumAdminRows(world) {
  if ((await panelOnScreen(world)) !== 'administration' || !(await world.page.locator('#main form#fselect, #main form#forums').count())) {
    throw friendly({ message: `The page is not the forum administration: ${await h.pageSummary(world)}.`, hint: 'Open it first: When I open "Manage forums" under "Forums" in the administration control panel' });
  }
  return (await world.page.locator('#main table.forums td.forum strong a, #main table td.forum strong a, #main table tr td:nth-child(2) > strong > a').allTextContents()).map(h.clean).filter(Boolean);
}

/**
 * Open a category or a forum in the forum administration on screen, to see the forums it holds.
 *
 * Example #1: When I open "Community" in the forum administration
 * Example #2: When we open "Staff" in the forum administration
 * Example #3: And I open "General discussion" in the forum administration
 * Example #4: Then I open "Your first category" in the forum administration
 * Example #5: And we open "Community" in the forum administration
 */
When(/^(?:I|we) open "([^"]*)" in the forum administration$/, async function (name) {
  const names = await forumAdminRows(this);
  if (!names.some((n) => h.normal(n) === h.normal(name))) throw friendly({ message: `The forum administration lists no "${name}". It lists: ${h.listed(names)}.`, hint: 'The forum administration shows one level at a time.' });
  const link = this.page.locator('#main table td strong a').filter({ hasText: h.exactly(name) }).first();
  await h.afterNavigation(this, () => link.click());
});

/**
 * Assert that the page offers the account the way into a control panel of the staff, or does not: "MCP" at
 * the top of the page for the moderator control panel, the link at the foot of the page for the
 * administration control panel.
 *
 * Example #1: Then I should see the link to the moderator control panel
 * Example #2: Then I should not see the link to the moderator control panel
 * Example #3: And I should see the link to the administration control panel
 * Example #4: And we should not see the link to the administration control panel
 * Example #5: Then we should see the link to the moderator control panel
 */
Then(/^(?:I|we) should (not )?see the link to the (moderator|administration) control panel$/, async function (notCase, which) {
  const page = this.page;
  if (!(await page.locator('#nav-main').count())) throw friendly({ message: `The page is not a page of the board: ${await h.pageSummary(this)}.`, hint: 'Open the board index first: Given I am on the board index' });
  const has = (await page.locator(which === 'moderator' ? '#nav-main a[href*="mcp.php"]' : '#page-footer a[href*="adm/index.php"], #nav-main a[href*="adm/index.php"]').count()) > 0;
  if (has === !!notCase) throw friendly({ message: `The page ${has ? 'offers' : 'does not offer'} "${(await h.signedInName(this)) || 'a visitor'}" the ${which} control panel.`, hint: 'The board shows the way into a control panel to the accounts that may use it.' });
});

module.exports = { openPanel, panelOnScreen, PANELS };

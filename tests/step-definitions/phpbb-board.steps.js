'use strict';

// The board index and a forum: the categories and forums the index lists,
// their counters and marks, a forum's topics (announcements, sticky topics,
// locked ones), its subforums, its pages and its sorting, the breadcrumbs, and
// the notice the board answers an action with.

const { Given, When, Then, AfterStep } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./phpbb-helpers');

// The notice the board answered a step with is kept for the next step: a notice page goes on by itself to the
// page it names after three seconds, so the step that asserts the notice may find the page gone.
AfterStep(async function () {
  const said = this.page ? await h.notice(this.page) : { text: '' };
  this.__noticeOfLastStep = said.text ? said : null;
});

/** The forums of the board index on screen, by category: [{category, title, state, topics, posts, subforums}]. */
async function indexForums(page) {
  return page.locator('.forabg').evaluateAll((blocks) => blocks.flatMap((b) => {
    const t = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '');
    const category = t(b.querySelector('li.header dt'));
    return [...b.querySelectorAll('ul.forums > li.row')].map((r) => ({
      category,
      title: t(r.querySelector('a.forumtitle')),
      state: (r.querySelector('dl') || {}).className || '',
      topics: parseInt(t(r.querySelector('dd.topics')), 10),
      posts: parseInt(t(r.querySelector('dd.posts')), 10),
      subforums: [...r.querySelectorAll('a.subforum')].map(t),
      last: t(r.querySelector('dd.lastpost')),
    }));
  }));
}

/** The forum of the index (or of the subforums of a forum page) by its name, or a failure with the forums listed. */
async function indexForum(world, name) {
  const forums = await indexForums(world.page);
  const hit = forums.find((f) => h.normal(f.title) === h.normal(name));
  if (!hit) {
    throw friendly({
      message: `The page lists no forum "${name}". Its forums: ${h.listed(forums.map((f) => f.title))}; ${await h.pageSummary(world)}.`,
      hint: h.hintFor(world, 'Open the board index first: Given I am on the board index. A forum an account may not read is not listed to it.'),
    });
  }
  return hit;
}

/**
 * Open the board index: the list of the categories and their forums.
 *
 * Example #1: Given I am on the board index
 * Example #2: When I go to the board index
 * Example #3: Given we are on the board index
 * Example #4: And we go to the board index
 * Example #5: When I go to the board index
 */
Given(/^(?:I am|we are|I go|we go) (?:on|to) the board index$/, async function () {
  await h.open(this, h.absolute(this, 'index.php'));
  if (!(await this.page.locator('body.section-index').count())) {
    throw friendly({ message: `The board index did not open: ${await h.pageSummary(this)}.`, hint: h.hintFor(this, 'Check launchUrl in cucumber.js: it is the address of the board, where index.php is.') });
  }
});

/**
 * Assert that the board index lists a forum, or does not; with a category, that the forum is in it. A forum
 * the account may not read is not listed.
 *
 * Example #1: Then the board index should list the forum "General discussion"
 * Example #2: Then the board index should list the forum "Help and support" in the category "Community"
 * Example #3: And the board index should not list the forum "Staff room"
 * Example #4: Then the board index should list the forum "Staff room" in the category "Staff"
 * Example #5: And the board index should list the forum "Your first forum"
 */
Then(/^the board index should (not )?list the forum "([^"]*)"(?: in the category "([^"]*)")?$/, async function (notCase, name, category) {
  const forums = await indexForums(this.page);
  const hit = forums.find((f) => h.normal(f.title) === h.normal(name));
  if (notCase) {
    if (hit) throw friendly({ message: `The board index lists the forum "${name}" (in "${hit.category}").`, hint: 'A forum shows on the index to the accounts that may see it.' });
    if (!forums.length) throw friendly({ message: `The page lists no forum at all: ${await h.pageSummary(this)}.`, hint: h.hintFor(this, 'Open the board index first: Given I am on the board index') });
    return;
  }
  if (!hit) await indexForum(this, name);
  if (category && h.normal(hit.category) !== h.normal(category)) {
    throw friendly({ message: `The forum "${name}" is in the category "${hit.category}", not in "${category}".`, hint: 'The category is the heading of the block the forum is listed in.' });
  }
});

/**
 * Assert the counter of a forum on the board index: its topics or its posts.
 *
 * Example #1: Then the forum "Help and support" on the board index should have 27 topics
 * Example #2: Then the forum "Archive" on the board index should have 1 topic
 * Example #3: And the forum "Archive" on the board index should have 1 post
 * Example #4: Then the forum "Help and support" on the board index should have 27 posts
 * Example #5: And the forum "Your first forum" on the board index should have 1 topic
 */
Then(/^the forum "([^"]*)" on the board index should have (\d+) (topics?|posts?)$/, async function (name, count, what) {
  const forum = await indexForum(this, name);
  const found = /^topic/.test(what) ? forum.topics : forum.posts;
  if (found !== parseInt(count, 10)) {
    throw friendly({ message: `The forum "${name}" has ${found} ${/^topic/.test(what) ? 'topics' : 'posts'} on the board index, not ${count}.`, hint: 'The index counts the approved topics and posts of a forum, without those of its subforums when they are not shown.' });
  }
});

/**
 * Assert a mark of a forum on the board index: locked (no new topics), with unread posts or without, or
 * with a subforum listed under it.
 *
 * Example #1: Then the forum "Archive" on the board index should be locked
 * Example #2: Then the forum "General discussion" on the board index should not be locked
 * Example #3: And the forum "General discussion" on the board index should list the subforum "Introductions"
 * Example #4: Then the forum "Help and support" on the board index should be read
 * Example #5: Then the forum "Help and support" on the board index should be unread
 */
Then(/^the forum "([^"]*)" on the board index should (?:(not )?be (locked|read|unread)|list the subforum "([^"]*)")$/, async function (name, notCase, mark, subforum) {
  const forum = await indexForum(this, name);
  if (subforum) {
    if (!forum.subforums.some((s) => h.normal(s) === h.normal(subforum))) {
      throw friendly({ message: `The forum "${name}" lists no subforum "${subforum}" on the board index. Its subforums: ${h.listed(forum.subforums)}.`, hint: 'The index lists the subforums of a forum under its description.' });
    }
    return;
  }
  const is = mark === 'locked' ? /_locked\b/.test(forum.state) : mark === 'unread' ? /\bforum_unread/.test(forum.state) : /\bforum_read/.test(forum.state);
  if (is === !!notCase) {
    throw friendly({ message: `The forum "${name}" is ${is ? '' : 'not '}${mark} on the board index (its mark is "${forum.state.replace('row-item ', '')}").`, hint: 'The icon of a forum on the index says whether it is locked and whether it has posts the account has not read.' });
  }
});

/**
 * Open a forum by its name: from the board index when it lists it, else from the list of all the forums the
 * account may read. Fails when the account may not read the forum.
 *
 * Example #1: When I open the forum "General discussion"
 * Example #2: When we open the forum "Help and support"
 * Example #3: And I open the forum "Introductions"
 * Example #4: Given I open the forum "Archive"
 * Example #5: When I open the forum "Staff room"
 */
When(/^(?:I|we) open the forum "([^"]*)"$/, async function (name) {
  await h.openForum(this, name);
  const title = await h.forumTitle(this.page);
  if (h.normal(title) !== h.normal(name)) {
    throw friendly({ message: `The forum "${name}" did not open: ${await h.pageSummary(this)}.`, hint: h.hintFor(this, 'An account opens the forums it may read. A visitor is sent to the login page for a forum that needs an account.') });
  }
});

/**
 * Try to open a forum by its address ("/viewforum.php?f=9"), as an account that may not read it would: the
 * step expects nothing. Assert the refusal with the next step.
 *
 * Example #1: When I try to open the forum at "/viewforum.php?f=9"
 * Example #2: When we try to open the forum at "/viewforum.php?f=8"
 * Example #3: And I try to open the forum at "/viewforum.php?f=99999"
 * Example #4: When I try to open the forum at "viewforum.php?f=9"
 * Example #5: When we try to open the forum at "/viewforum.php?f=7"
 */
When(/^(?:I|we) try to open the forum at "([^"]*)"$/, async function (path) {
  await h.open(this, h.absolute(this, path));
});

/**
 * Assert that the page is a forum, by its name in the heading of the page.
 *
 * Example #1: Then I should be in the forum "General discussion"
 * Example #2: Then we should be in the forum "Help and support"
 * Example #3: And I should be in the forum "Introductions"
 * Example #4: Then I should be in the forum "Archive"
 * Example #5: And we should be in the forum "Staff room"
 */
Then(/^(?:I|we) should be in the forum "([^"]*)"$/, async function (name) {
  await h.eventually(this, () => h.forumTitle(this.page), (title) => h.normal(title) === h.normal(name), async (title) => ({
    message: `The page is not the forum "${name}": ${title ? `it is the forum "${title}"` : await h.pageSummary(this)}.`,
    hint: h.hintFor(this, 'Open the forum first: When I open the forum "…"'),
  }));
});

/**
 * Assert that the forum on screen lists a topic, a subforum or an announcement, or does not. The step looks
 * through the pages of the forum for a topic.
 *
 * Example #1: Then the forum should list the topic "Weekend baking thread"
 * Example #2: Then the forum should not list the topic "Webship test topic"
 * Example #3: And the forum should list the subforum "Introductions"
 * Example #4: Then the forum should list the announcement "Board rules"
 * Example #5: And the forum should not list the subforum "Staff room"
 */
Then(/^the forum should (not )?list the (topic|subforum|announcement) "([^"]*)"$/, async function (notCase, what, name) {
  const page = this.page;
  if (!(await h.forumTitle(page))) throw friendly({ message: `The page is not a forum: ${await h.pageSummary(this)}.`, hint: h.hintFor(this, 'Open the forum first: When I open the forum "…"') });
  if (what === 'subforum') {
    const subs = (await indexForums(page)).map((f) => f.title);
    const has = subs.some((s) => h.normal(s) === h.normal(name));
    if (has === !!notCase) throw friendly({ message: `The forum ${has ? 'lists' : 'does not list'} the subforum "${name}". Its subforums: ${h.listed(subs)}.`, hint: 'A forum lists its subforums above its topics.' });
    return;
  }
  const row = await h.findTopicRow(this, name);
  if (notCase) {
    if (row) throw friendly({ message: `The forum "${await h.forumTitle(page)}" lists the topic "${name}".`, hint: 'A topic a scenario made stays until it is deleted: Given there is no topic "…"' });
    return;
  }
  if (!row) {
    const rows = await h.topicRows(page);
    throw friendly({ message: `The forum "${await h.forumTitle(page)}" lists no ${what} "${name}". On this page: ${h.listed(rows.map((r) => r.title).slice(0, 12))}.`, hint: 'A topic that waits for approval shows only to its author and to the moderators.' });
  }
  if (what === 'announcement' && !/\bannounce|\bglobal/.test(row.state)) {
    throw friendly({ message: `"${name}" is a topic of the forum, not an announcement (its mark is "${row.state.replace('row-item ', '')}").`, hint: 'Announcements are listed in a block of their own above the topics.' });
  }
});

/**
 * Assert a mark of a topic in the list of the forum on screen: an announcement, sticky, locked, moved (the
 * shadow a moved topic leaves), waiting for approval, reported, with a poll or an attachment, or by an author.
 *
 * Example #1: Then the topic "Board rules" in the forum should be an announcement
 * Example #2: Then the topic "Start here: how this board works" in the forum should be sticky
 * Example #3: And the topic "Board rules" in the forum should be locked
 * Example #4: Then the topic "Weekend baking thread" in the forum should not be locked
 * Example #5: And the topic "Webship test topic" in the forum should be waiting for approval
 */
Then(/^the topic "([^"]*)" in the forum should (not )?be (an announcement|sticky|locked|moved|waiting for approval|reported|unread)$/, async function (title, notCase, mark) {
  const row = await h.findTopicRow(this, title);
  if (!row) throw friendly({ message: `The forum "${await h.forumTitle(this.page)}" lists no topic "${title}".`, hint: h.hintFor(this, 'Open the forum of the topic first: When I open the forum "…"') });
  const is = {
    'an announcement': /\bannounce|\bglobal/.test(row.state),
    sticky: /\bsticky/.test(row.state),
    locked: /_locked\b/.test(row.state),
    moved: /topic_moved/.test(row.state),
    'waiting for approval': row.unapproved,
    reported: row.reported,
    unread: /_unread/.test(row.state),
  }[mark];
  if (is === !!notCase) {
    throw friendly({ message: `The topic "${title}" is ${is ? '' : 'not '}${mark} in the list of the forum (its mark is "${row.state.replace('row-item ', '')}").`, hint: 'The icon of a topic in the list says its kind and whether it is locked; a small icon beside its title says it waits for approval or was reported, to those who may see that.' });
  }
});

/**
 * Assert the number of replies of a topic, or its author, in the list of the forum on screen.
 *
 * Example #1: Then the topic "Weekend baking thread" in the forum should have 12 replies
 * Example #2: Then the topic "A walk along the river" in the forum should have 0 replies
 * Example #3: And the topic "Weekend baking thread" in the forum should be by "member"
 * Example #4: Then the topic "Board rules" in the forum should be by "administrator"
 * Example #5: And the topic "Webship test topic" in the forum should have 1 reply
 */
Then(/^the topic "([^"]*)" in the forum should (?:have (\d+) repl(?:y|ies)|be by "([^"]*)")$/, async function (title, replies, author) {
  const row = await h.findTopicRow(this, title);
  if (!row) throw friendly({ message: `The forum "${await h.forumTitle(this.page)}" lists no topic "${title}".`, hint: h.hintFor(this, 'Open the forum of the topic first: When I open the forum "…"') });
  if (replies != null && row.replies !== parseInt(replies, 10)) {
    throw friendly({ message: `The topic "${title}" has ${row.replies} replies in the list of the forum, not ${replies}.`, hint: 'The list counts the approved replies of a topic.' });
  }
  if (author != null && row.by.toLowerCase() !== h.usernameOf(this, author).toLowerCase()) {
    throw friendly({ message: `The topic "${title}" is by "${row.by}" in the list of the forum, not by "${h.usernameOf(this, author)}".`, hint: 'The list names the author of a topic under its title.' });
  }
});

/**
 * Assert how many topics the forum on screen says it has, beside the page numbers above its list ("27 topics").
 *
 * Example #1: Then the forum should have 27 topics
 * Example #2: Then the forum should have 1 topic
 * Example #3: And the forum should have 4 topics
 * Example #4: Then the forum should have 0 topics
 * Example #5: And the forum should have 27 topics
 */
Then(/^the forum should have (\d+) topics?$/, async function (count) {
  const text = h.clean(await this.page.locator('.action-bar.bar-top .pagination').first().textContent({ timeout: 2000 }).catch(() => ''));
  const m = text.match(/(\d+)\s+topics?/i);
  if (!m || parseInt(m[1], 10) !== parseInt(count, 10)) {
    throw friendly({ message: `The forum says "${text || '(nothing)'}", not ${count} topic${count === '1' ? '' : 's'}; ${await h.pageSummary(this)}.`, hint: h.hintFor(this, 'The count stands above the list of topics, beside the page numbers; it leaves out the announcements.') });
  }
});

/**
 * Go to a page of what is on screen (a forum's topics, a topic's posts, search results) by its number, with the
 * page numbers above the list.
 *
 * Example #1: When I go to page 2
 * Example #2: When we go to page 1
 * Example #3: And I go to page 2
 * Example #4: When I go to page 3
 * Example #5: Then we go to page 2
 */
When(/^(?:I|we) go to page (\d+)$/, async function (number) {
  const page = this.page;
  const bar = page.locator('.action-bar .pagination').first();
  const current = h.clean(await bar.locator('li.active').first().textContent({ timeout: 2000 }).catch(() => ''));
  if (current === String(number)) return;
  const link = bar.locator('li:not(.arrow) a').filter({ hasText: new RegExp(`^\\s*${number}\\s*$`) }).first();
  if (!(await link.count())) {
    const text = h.clean(await bar.textContent({ timeout: 2000 }).catch(() => ''));
    throw friendly({ message: `The list has no page ${number}: it says "${text || '(no page numbers)'}"; ${await h.pageSummary(this)}.`, hint: h.hintFor(this, 'A forum shows 25 topics on a page and a topic 10 posts, unless the board or the account says otherwise.') });
  }
  await h.afterNavigation(this, () => link.click());
});

/**
 * Assert the page of the list on screen: the number the page numbers mark as the current one.
 *
 * Example #1: Then I should be on page 2
 * Example #2: Then we should be on page 1
 * Example #3: And I should be on page 2
 * Example #4: Then I should be on page 3
 * Example #5: And we should be on page 1
 */
Then(/^(?:I|we) should be on page (\d+)$/, async function (number) {
  const bar = this.page.locator('.action-bar .pagination').first();
  const text = h.clean(await bar.textContent({ timeout: 2000 }).catch(() => ''));
  const current = h.clean(await bar.locator('li.active').first().textContent({ timeout: 1000 }).catch(() => '')) || ((text.match(/Page (\d+) of/) || [])[1] || '');
  if (current !== String(number)) {
    throw friendly({ message: `The list is on page ${current || '(unknown)'}, not on page ${number} ("${text}").`, hint: 'Go to the page first: When I go to page 2' });
  }
});

/**
 * Sort the topics of the forum on screen with its "Display and sorting options": by author, post time,
 * replies, subject or views, ascending or descending.
 *
 * Example #1: When I sort the topics by "Subject" in "Ascending" order
 * Example #2: When we sort the topics by "Replies" in "Descending" order
 * Example #3: And I sort the topics by "Author" in "Ascending" order
 * Example #4: When I sort the topics by "Post time" in "Descending" order
 * Example #5: When I sort the topics by "Views" in "Descending" order
 */
When(/^(?:I|we) sort the topics by "([^"]*)" in "([^"]*)" order$/, async function (key, direction) {
  const page = this.page;
  const tools = page.locator('.sort-tools').first();
  if (!(await tools.count())) throw friendly({ message: `The page has no sorting options: ${await h.pageSummary(this)}.`, hint: h.hintFor(this, 'Open a forum first: When I open the forum "…"') });
  const menu = await h.openDropdown(this, tools);
  const choose = async (selector, value, what) => {
    const select = menu.locator(selector);
    const options = (await select.locator('option').allTextContents()).map(h.clean);
    const i = options.findIndex((o) => h.normal(o) === h.normal(value));
    if (i < 0) throw friendly({ message: `The forum cannot be sorted ${what} "${value}". Its choices: ${h.listed(options)}.`, hint: 'Name the choice as the sorting options show it.' });
    await select.selectOption({ index: i });
  };
  await choose('select[name="sk"]', key, 'by');
  await choose('select[name="sd"]', direction, 'in the order');
  await h.send(this, menu.locator('input[name="sort"]'));
});

/**
 * Assert the first topic of the list of the forum on screen, after its announcements and sticky topics.
 *
 * Example #1: Then the first topic of the forum should be "A walk along the river"
 * Example #2: Then the first topic of the forum should be "Weekend baking thread"
 * Example #3: And the first topic of the forum should be "Question 01: where do I find my drafts?"
 * Example #4: Then the first topic of the forum should be "Which season do you like best?"
 * Example #5: And the first topic of the forum should be "Hello from the member"
 */
Then(/^the first topic of the forum should be "([^"]*)"$/, async function (title) {
  const rows = (await h.topicRows(this.page)).filter((r) => !/\bannounce|\bglobal|\bsticky/.test(r.state));
  if (!rows.length || h.normal(rows[0].title) !== h.normal(title)) {
    throw friendly({ message: `The first topic of the forum is ${rows.length ? `"${rows[0].title}"` : '(none)'}, not "${title}". Its topics: ${h.listed(rows.map((r) => r.title).slice(0, 8))}.`, hint: 'The list shows the topic with the newest post first, unless it is sorted otherwise.' });
  }
});

/**
 * Assert the breadcrumbs at the top of the page: the path from the board index to the page, each step in
 * quotes and in order.
 *
 * Example #1: Then the breadcrumbs should be "Board index", "Community" and "General discussion"
 * Example #2: Then the breadcrumbs should be "Board index"
 * Example #3: And the breadcrumbs should be "Board index", "Community", "General discussion" and "Introductions"
 * Example #4: Then the breadcrumbs should be "Board index" and "Staff"
 * Example #5: And the breadcrumbs should be "Board index", "Community" and "Help and support"
 */
Then(/^the breadcrumbs should be ("[^"]*"(?:(?:, | and )"[^"]*")*)$/, async function (list) {
  const wanted = [...list.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  const found = (await this.page.locator('#nav-breadcrumbs .crumb').allTextContents()).map(h.clean).filter(Boolean);
  if (found.length !== wanted.length || found.some((c, i) => h.normal(c) !== h.normal(wanted[i]))) {
    throw friendly({ message: `The breadcrumbs are ${h.listed(found)}, not ${h.listed(wanted)}.`, hint: 'The breadcrumbs name the category and the forums above the page, from the board index.' });
  }
});

/**
 * Assert the notice of the board: the page it answers an action with ("Information"), which says what
 * happened ("This post has been deleted successfully.", "You are not authorised to read this forum."), or the
 * message of a control panel. A part of the text is enough. A notice page goes on by itself after three seconds:
 * the step also takes the notice the step before ended on.
 *
 * Example #1: Then the board should say "You are not authorised to read this forum."
 * Example #2: Then the board should say "This message has been submitted successfully, but it will need to be approved by a moderator"
 * Example #3: And the board should say "The requested topic does not exist."
 * Example #4: Then the board should say "Your profile has been updated."
 * Example #5: And the board should say "This post has been successfully reported."
 */
Then(/^the board should say "([^"]*)"$/, async function (expected) {
  const now = await h.notice(this.page);
  if (h.mentions(now.text, expected) || h.mentions(now.title, expected)) return;
  // The notice the step before ended on, when its page has gone on since.
  const last = this.__noticeOfLastStep;
  if (last && (h.mentions(last.text, expected) || h.mentions(last.title, expected))) return;
  const said = now.text ? now : last;
  if (said) {
    throw friendly({ message: `The board did not say "${expected}". It ${now.text ? 'says' : 'said'} "${said.text}".`, hint: 'The board answers an action with a notice page ("Information") that says what happened.' });
  }
  await h.expectNotice(this, expected);
});

/**
 * Assert the figures of the board at the foot of its index: "Total posts", "Total topics", "Total members" or
 * "Our newest member".
 *
 * Example #1: Then the board statistics should show "Total members" as "5"
 * Example #2: Then the board statistics should show "Our newest member" as "newmember"
 * Example #3: And the board statistics should show "Total topics" as "36"
 * Example #4: Then the board statistics should show "Total posts" as "48"
 * Example #5: And the board statistics should show "Total members" as "4"
 */
Then(/^the board statistics should show "([^"]*)" as "([^"]*)"$/, async function (label, value) {
  const text = h.clean(await this.page.locator('.stat-block.statistics').first().textContent({ timeout: 2000 }).catch(() => ''));
  if (!text) throw friendly({ message: `The page shows no statistics of the board: ${await h.pageSummary(this)}.`, hint: h.hintFor(this, 'The statistics are at the foot of the board index: Given I am on the board index') });
  const figures = {};
  for (const m of text.replace(/^Statistics\s*/i, '').matchAll(/([A-Za-z ]+?)\s+(\S+)(?:\s*•\s*|$)/g)) figures[h.normal(m[1])] = m[2];
  if (figures[h.normal(label)] !== value) {
    throw friendly({ message: `The board statistics show "${label}" as ${figures[h.normal(label)] === undefined ? '(nothing)' : `"${figures[h.normal(label)]}"`}, not as "${value}". They read: "${text}".`, hint: 'The statistics count the approved posts and topics and the active accounts.' });
  }
});

module.exports = { indexForums };

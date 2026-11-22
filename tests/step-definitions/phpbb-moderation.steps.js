'use strict';

// Moderation: reporting a post, the report queue and the approval queue of
// the moderator control panel, the quick moderator tools of a topic (lock,
// unlock, move, split, delete), and the moderator log.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./phpbb-helpers');
const { onTopic } = require('./phpbb-topic.steps');

/** A quick moderator tool of the topic on screen by its name, with the tools the topic offers. */
async function quickTool(world, pattern, what) {
  const page = world.page;
  await onTopic(world);
  const tools = page.locator('#quickmod').first();
  if (!(await tools.count())) {
    throw friendly({ message: `The topic offers "${(await h.signedInName(world)) || 'a visitor'}" no moderator tools.`, hint: 'The quick moderator tools (the gavel under the posts) show to the moderators of the forum.' });
  }
  const menu = await h.openDropdown(world, tools);
  const link = menu.locator('a').filter({ hasText: pattern }).first();
  if (!(await link.count())) {
    const names = (await menu.locator('a').allTextContents()).map(h.clean);
    throw friendly({ message: `The moderator tools of the topic offer no "${what}". They offer: ${h.listed(names)}.`, hint: 'A locked topic offers "Unlock topic", an open one "Lock topic".' });
  }
  return link;
}

/** Open a list of the moderator control panel by its address, and return its rows: [{title, text}]. */
async function mcpList(world, query, what) {
  const page = world.page;
  await h.open(world, h.absolute(world, `mcp.php?${query}`));
  if (!(await page.locator('body.section-mcp #cp-main').count())) {
    throw friendly({ message: `The ${what} did not open: ${await h.pageSummary(world)}.`, hint: h.hintFor(world, 'The moderator control panel is for the moderators: Given I am a logged in user with the "moderator" user') });
  }
  return page.locator('#cp-main ul.topiclist.cplist > li.row').evaluateAll((rows) => rows.map((r) => ({
    title: ((r.querySelector('a.topictitle') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
    text: (r.textContent || '').replace(/\s+/g, ' ').trim(),
  })).filter((r) => r.title));
}

/** The row of a list of the moderator control panel on screen by its title. */
function mcpRow(page, title) {
  return page.locator('#cp-main ul.topiclist.cplist > li.row').filter({ has: page.locator('a.topictitle', { hasText: h.exactly(title) }) }).first();
}

/** The query of a list of the approval queue. */
function queueQuery(kind) {
  return `i=queue&mode=${kind === 'topic' ? 'unapproved_topics' : 'unapproved_posts'}`;
}

/**
 * Report a post of the topic on screen to the moderators (the post by its number on the page, or the last
 * one): "Report this post", a reason by a part of its text ("off topic", "advertise"), optionally more
 * information, "Submit". The step ends on the topic.
 *
 * Example #1: When I report post 2 as "off topic"
 * Example #2: When I report the last post as "advertise" with "Webship test report: this is advertising."
 * Example #3: And we report post 1 as "does not fit into any other category" with "Webship test report."
 * Example #4: And I report the last post as "off topic"
 * Example #5: When we report post 3 as "illegal or pirated software"
 */
When(/^(?:I|we) report (?:post (\d+)|the last post) as "([^"]*)"(?: with "([^"]*)")?$/, { timeout: 90000 }, async function (number, reason, text) {
  const page = this.page;
  const post = await h.postAt(this, number);
  const button = post.locator.locator('.post-buttons a[href*="/report"]').first();
  if (!(await button.count())) throw friendly({ message: `Post ${post.number} offers no "Report this post" to this account.`, hint: 'Reporting needs an account that may report in the forum.' });
  await h.afterNavigation(this, () => button.click());
  const form = page.locator('form#report');
  if (!(await form.count())) {
    throw friendly({ message: `The board did not open the report form: ${await h.pageSummary(this)}.`, hint: 'A post that was reported and not dealt with yet cannot be reported again ("This post has already been reported.").' });
  }
  const options = (await form.locator('#reason_id option').allTextContents()).map(h.clean);
  const i = options.findIndex((o) => h.mentions(o, reason));
  if (i < 0) throw friendly({ message: `The report form has no reason like "${reason}". Its reasons: ${h.listed(options)}.`, hint: 'Give a part of the text of a reason.' });
  await form.locator('#reason_id').selectOption({ index: i });
  if (text) await form.locator('#report_text').fill(text);
  await h.send(this, form.locator('input[name="submit"]'));
  await h.expectNotice(this, 'successfully reported', 'The board answers with "This post has been successfully reported.".');
  await h.followNotice(this, /topic/i);
});

/**
 * Assert that the open reports of the moderator control panel list a report of a post, by the subject of the
 * post, or do not.
 *
 * Example #1: Then the open reports should list "Re: Webship test topic"
 * Example #2: Then the open reports should not list "Re: Webship test topic"
 * Example #3: And the open reports should list "Webship test topic"
 * Example #4: And the open reports should not list "Webship test topic"
 * Example #5: Then the open reports should list "Re: Weekend baking thread"
 */
Then(/^the open reports should (not )?list "([^"]*)"$/, async function (notCase, subject) {
  const rows = await mcpList(this, 'i=reports&mode=reports', 'reports');
  const has = rows.some((r) => h.normal(r.title) === h.normal(subject));
  if (has === !!notCase) throw friendly({ message: `The open reports ${has ? 'list' : 'do not list'} "${subject}". They list: ${h.listed(rows.map((r) => r.title))}.`, hint: 'A report is listed by the subject of the post it is about, until a moderator closes or deletes it.' });
});

/**
 * Close or delete the open report of a post in the moderator control panel, by the subject of the post: the
 * report marked, "Close reports" or "Delete reports", the confirmation. A closed report moves to the closed
 * reports; a deleted one is gone.
 *
 * Example #1: When I close the report of "Re: Webship test topic"
 * Example #2: When I delete the report of "Re: Webship test topic"
 * Example #3: And we close the report of "Webship test topic"
 * Example #4: And we delete the report of "Webship test topic"
 * Example #5: Then I delete the report of "Re: Weekend baking thread"
 */
When(/^(?:I|we) (close|delete) the report of "([^"]*)"$/, { timeout: 90000 }, async function (verb, subject) {
  const page = this.page;
  const rows = await mcpList(this, 'i=reports&mode=reports', 'reports');
  if (!rows.some((r) => h.normal(r.title) === h.normal(subject))) {
    throw friendly({ message: `The open reports list no report of "${subject}". They list: ${h.listed(rows.map((r) => r.title))}.`, hint: 'Report the post first: When I report the last post as "off topic"' });
  }
  await mcpRow(page, subject).locator('input[name="report_id_list[]"]').first().check();
  await h.send(this, page.locator(`#cp-main input[name="action[${verb}]"]`).first());
  await h.confirm(this);
  await h.expectNotice(this, verb === 'close' ? 'closed successfully' : 'deleted successfully', 'The board answers with "The selected report has been closed successfully.".');
});

/**
 * Assert that the approval queue of the moderator control panel lists a topic or a post that waits for
 * approval, by its subject, or does not.
 *
 * Example #1: Then the approval queue should list the topic "Webship test topic of a new member"
 * Example #2: Then the approval queue should not list the topic "Webship test topic of a new member"
 * Example #3: And the approval queue should list the post "Re: Webship test topic"
 * Example #4: And the approval queue should not list the post "Re: Webship test topic"
 * Example #5: Then the approval queue should not list the topic "Webship test topic"
 */
Then(/^the approval queue should (not )?list the (topic|post) "([^"]*)"$/, async function (notCase, kind, subject) {
  const rows = await mcpList(this, queueQuery(kind), 'approval queue');
  const has = rows.some((r) => h.normal(r.title) === h.normal(subject));
  if (has === !!notCase) throw friendly({ message: `The approval queue ${has ? 'lists' : 'does not list'} the ${kind} "${subject}". Its ${kind}s: ${h.listed(rows.map((r) => r.title))}.`, hint: 'New topics wait under "Topics awaiting approval", replies under "Posts awaiting approval".' });
});

/**
 * Approve or disapprove a topic or a post of the approval queue, by its subject: the entry marked, "Approve"
 * or "Disapprove", the confirmation. An approved post shows to everyone; a disapproved one is deleted.
 *
 * Example #1: When I approve the topic "Webship test topic of a new member"
 * Example #2: When I disapprove the topic "Webship test topic of a new member"
 * Example #3: And we approve the post "Re: Webship test topic"
 * Example #4: And we disapprove the post "Re: Webship test topic"
 * Example #5: Then I approve the topic "Webship test topic of a new member"
 */
When(/^(?:I|we) (approve|disapprove) the (topic|post) "([^"]*)"$/, { timeout: 90000 }, async function (verb, kind, subject) {
  const page = this.page;
  const rows = await mcpList(this, queueQuery(kind), 'approval queue');
  if (!rows.some((r) => h.normal(r.title) === h.normal(subject))) {
    throw friendly({ message: `The approval queue lists no ${kind} "${subject}". Its ${kind}s: ${h.listed(rows.map((r) => r.title))}.`, hint: 'The posts of a newly registered user wait for approval.' });
  }
  await mcpRow(page, subject).locator('input[type="checkbox"]').first().check();
  await h.send(this, page.locator(`#cp-main input[name="action[${verb}]"]`).first());
  await h.confirm(this);
  await h.expectNotice(this, verb === 'approve' ? 'approved' : 'disapproved', 'The board answers with "The selected topic has been approved." or "… disapproved.".');
});

/**
 * Lock or unlock the topic on screen with its quick moderator tools: the tool, then the confirmation the
 * board asks in the page. The page loads again with the topic in its new state.
 *
 * Example #1: When I lock the topic
 * Example #2: When I unlock the topic
 * Example #3: And we lock the topic
 * Example #4: And we unlock the topic
 * Example #5: Then I unlock the topic
 */
When(/^(?:I|we) (lock|unlock) the topic$/, { timeout: 90000 }, async function (verb) {
  const link = await quickTool(this, verb === 'lock' ? /^\s*Lock topic\s*$/i : /^\s*Unlock topic\s*$/i, verb === 'lock' ? 'Lock topic' : 'Unlock topic');
  await link.click();
  await h.confirm(this);
  if (await this.page.locator('div#message').count()) await h.followNotice(this, /topic|previous/i);
});

/**
 * Move the topic on screen to another forum with its quick moderator tools: "Move topic", the forum, the
 * confirmation. With "leaving a shadow topic", the old forum keeps a link to it. The step ends on the topic,
 * in its new forum.
 *
 * Example #1: When I move the topic to "Help and support"
 * Example #2: When I move the topic to "Introductions" leaving a shadow topic
 * Example #3: And we move the topic to "General discussion"
 * Example #4: And we move the topic to "Staff room"
 * Example #5: Then I move the topic to "Archive"
 */
When(/^(?:I|we) move the topic to "([^"]*)"( leaving a shadow topic)?$/, { timeout: 90000 }, async function (forum, shadow) {
  const page = this.page;
  const title = await onTopic(this);
  const address = page.url();
  const link = await quickTool(this, /^\s*Move topic\s*$/i, 'Move topic');
  await h.afterNavigation(this, () => link.click());
  await h.confirm(this, {
    fill: async (form) => {
      const select = form.locator('select[name="to_forum_id"]');
      const options = await select.locator('option').evaluateAll((els) => els.map((o) => ({ value: o.value, text: (o.textContent || '').replace(/[↳ \s]+/g, ' ').trim(), disabled: o.disabled })));
      const hit = options.find((o) => h.normalName(o.text) === h.normalName(forum) && !o.disabled);
      if (!hit) throw friendly({ message: `The topic "${title}" cannot be moved to "${forum}". The forums it can go to: ${h.listed(options.filter((o) => !o.disabled).map((o) => o.text))}.`, hint: 'A topic moves to another forum that takes posts, not to a category nor to the forum it is in.' });
      await select.selectOption(hit.value);
      await form.locator('#move_leave_shadow').setChecked(!!shadow);
    },
  });
  if (await page.locator('div#message').count()) await h.expectNotice(this, 'moved successfully', 'The board answers with "The selected topic has been moved successfully.".');
  await h.open(this, address);
});

/**
 * Split the topic on screen in two with its quick moderator tools: "Split topic", the post from which the new
 * topic starts (by its number on the page), the title of the new topic and, optionally, its forum. The step
 * ends on the new topic.
 *
 * Example #1: When I split the topic from post 2 into "Webship test topic, split"
 * Example #2: When I split the topic from post 3 into "Webship test topic, split" in "Help and support"
 * Example #3: And we split the topic from post 2 into "Webship test topic, split" in "Introductions"
 * Example #4: And we split the topic from post 2 into "Webship test question, split"
 * Example #5: Then I split the topic from post 4 into "Webship test topic, split"
 */
When(/^(?:I|we) split the topic from post (\d+) into "([^"]*)"(?: in "([^"]*)")?$/, { timeout: 90000 }, async function (number, newTitle, forum) {
  const page = this.page;
  const post = await h.postAt(this, number);
  const link = await quickTool(this, /^\s*Split topic\s*$/i, 'Split topic');
  await h.afterNavigation(this, () => link.click());
  const form = page.locator('#cp-main form#mcp').first();
  if (!(await form.locator('#subject').count())) throw friendly({ message: `The board did not open the page to split the topic: ${await h.pageSummary(this)}.`, hint: 'Splitting is for the moderators who may split in the forum.' });
  await form.locator('#subject').fill(newTitle);
  if (forum) {
    const select = form.locator('select[name="to_forum_id"]');
    const options = await select.locator('option').evaluateAll((els) => els.map((o) => ({ value: o.value, text: (o.textContent || '').replace(/[↳ \s]+/g, ' ').trim(), disabled: o.disabled })));
    const hit = options.find((o) => h.normalName(o.text) === h.normalName(forum) && !o.disabled);
    if (!hit) throw friendly({ message: `The new topic cannot go to "${forum}". The forums it can go to: ${h.listed(options.filter((o) => !o.disabled).map((o) => o.text))}.`, hint: 'A topic goes to a forum that takes posts.' });
    await select.selectOption(hit.value);
  }
  const id = String(post.id).replace(/^p/, '');
  const box = form.locator(`#post_id_list_select_${id}, input[name="post_id_list[]"][value="${id}"]`).first();
  if (!(await box.count())) throw friendly({ message: `Post ${post.number} is not on the page to split the topic.`, hint: 'The page to split lists the posts of the topic, a page at a time.' });
  await box.check();
  await form.locator('select[name="action"]').selectOption('split_beyond');
  await h.send(this, form.locator('input[name="mcp_topic_submit"]'));
  await h.confirm(this);
  await h.expectNotice(this, 'split successfully', 'The board answers with "The selected topic has been split successfully.".');
  await h.followNotice(this, /new topic/i);
});

/**
 * Delete the topic on screen with its quick moderator tools: "Delete topic", then the confirmation the board
 * asks in the page. With "permanently" the topic is removed; without, it is deleted softly and stays for the
 * moderators, who can restore it. The step ends on the forum of the topic.
 *
 * Example #1: When I delete the topic
 * Example #2: When I delete the topic permanently
 * Example #3: And we delete the topic
 * Example #4: And we delete the topic permanently
 * Example #5: Then I delete the topic permanently
 */
When(/^(?:I|we) delete the topic( permanently)?$/, { timeout: 90000 }, async function (permanently) {
  const page = this.page;
  const forum = page.locator('#nav-breadcrumbs .crumb a').last();
  const back = h.absolute(this, (await forum.getAttribute('href').catch(() => '')) || 'index.php');
  const link = await quickTool(this, /^\s*Delete topic\s*$/i, 'Delete topic');
  await link.click();
  await h.confirm(this, {
    fill: async (form) => {
      const box = form.locator('#delete_permanent, input[name="delete_permanent"]').first();
      if (await box.count()) await box.setChecked(!!permanently);
    },
  });
  if (await h.topicTitle(page)) await h.open(this, back);
  else if (await page.locator('div#message').count()) await h.followNotice(this, /forum/i);
});

/**
 * Assert that the topic on screen offers the account its quick moderator tools (the gavel under its posts), or
 * does not.
 *
 * Example #1: Then I should see the moderator tools
 * Example #2: Then I should not see the moderator tools
 * Example #3: And we should see the moderator tools
 * Example #4: And we should not see the moderator tools
 * Example #5: Then I should not see the moderator tools
 */
Then(/^(?:I|we) should (not )?see the moderator tools$/, async function (notCase) {
  await onTopic(this);
  const has = (await this.page.locator('#quickmod').count()) > 0;
  if (has === !!notCase) throw friendly({ message: `The topic ${has ? 'offers' : 'does not offer'} "${(await h.signedInName(this)) || 'a visitor'}" the moderator tools.`, hint: 'The quick moderator tools show to the moderators of the forum.' });
});

/**
 * Assert that the moderator log (the moderator control panel, Moderator logs) holds an entry that says a text
 * (a part of it: the action, the title it was about), among its newest.
 *
 * Example #1: Then the moderator log should show "Locked topic"
 * Example #2: Then the moderator log should show "Webship test topic"
 * Example #3: And the moderator log should show "Moved topic"
 * Example #4: And the moderator log should show "Unlocked topic"
 * Example #5: Then the moderator log should show "Closed report"
 */
Then(/^the moderator log should show "([^"]*)"$/, async function (expected) {
  const page = this.page;
  await h.open(this, h.absolute(this, 'mcp.php?i=logs&mode=front'));
  if (!(await page.locator('body.section-mcp #cp-main').count())) throw friendly({ message: `The moderator log did not open: ${await h.pageSummary(this)}.`, hint: h.hintFor(this, 'The moderator control panel is for the moderators.') });
  const entries = (await page.locator('#cp-main table tbody tr').allTextContents()).map(h.clean).filter(Boolean);
  if (!entries.some((e) => h.mentions(e, expected))) {
    throw friendly({ message: `The moderator log shows no entry "${expected}". Its newest: ${h.listed(entries.slice(0, 5).map((e) => e.slice(0, 160)))}.`, hint: 'The log lists what the moderators did, the newest first.' });
  }
});

module.exports = { quickTool, mcpList };

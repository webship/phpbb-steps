'use strict';

// Test content a scenario starts from, made through the board itself as the
// account that owns it: a topic, a reply, and the removal of what a scenario
// made. The board has no interface but its pages, so a Given step opens a
// browser page of its own for the other account and leaves the page of the
// scenario and its session as they are.
//
// What a scenario makes carries a title of its own ("Webship test …") and is
// removed by the scenario itself, or by the next run's "there is no topic".

const { Given } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./phpbb-helpers');
const posting = require('./phpbb-posting.steps');

/** The ids of the topics with a title that the moderating account finds: by the search of titles, in the approval queue, among the deleted topics. */
async function topicIds(actor, title) {
  const page = actor.page;
  const ids = new Set();
  // The search of topic titles, for any of the words of the title (the index of the board leaves out short and
  // very common words, so a search for all of them can miss): the topics with exactly this title are taken.
  const words = h.clean(title).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3 && w.length <= 14);
  await h.open(actor, h.absolute(actor, `search.php?keywords=${encodeURIComponent(words.join(' '))}&terms=any&sf=titleonly&sr=topics&ch=0`));
  for (const row of await page.locator('ul.topiclist.topics > li.row a.topictitle').evaluateAll((els) => els.map((a) => ({ title: (a.textContent || '').replace(/\s+/g, ' ').trim(), href: a.getAttribute('href') })))) {
    const m = String(row.href).match(/[?&]t=(\d+)/);
    if (m && h.normal(row.title) === h.normal(title)) ids.add(m[1]);
  }
  // The moderation queue: topics that wait for approval, and topics deleted softly.
  for (const mode of ['unapproved_topics', 'deleted_topics']) {
    await h.open(actor, h.absolute(actor, `mcp.php?i=queue&mode=${mode}`));
    const rows = await page.locator('#cp-main ul.topiclist.cplist > li.row').evaluateAll((els) => els.map((r) => ({
      title: ((r.querySelector('a.topictitle') || {}).textContent || '').replace(/\s+/g, ' ').trim(),
      id: (r.querySelector('input[name="topic_id_list[]"]') || {}).value,
    })));
    for (const row of rows) if (row.id && h.normal(row.title) === h.normal(title)) ids.add(row.id);
  }
  return [...ids];
}

/** Delete a topic for good as the moderating account, by its id. */
async function deleteTopic(actor, id) {
  const page = actor.page;
  await h.open(actor, h.absolute(actor, `viewtopic.php?t=${id}`));
  const link = page.locator('#quickmod .dropdown-contents a[href*="action=delete_topic"]').first();
  if (!(await link.count())) return false;
  // The address of the quick moderator tool, opened as a page: the board asks on a page of its own.
  await h.open(actor, h.absolute(actor, await link.getAttribute('href')));
  await h.confirm(actor, {
    fill: async (form) => {
      const box = form.locator('#delete_permanent, input[name="delete_permanent"]').first();
      if (await box.count()) await box.check();
    },
  });
  // The board goes back to the forum, or says "The selected topic has been deleted successfully.": the caller
  // looks again for the topic either way.
  return true;
}

/** Remove every topic with a title, as the moderating account. */
async function removeTopics(world, title) {
  await h.asAccount(world, h.moderatorHandle(world), async (actor) => {
    for (let round = 0; round < 5; round += 1) {
      const ids = await topicIds(actor, title);
      if (!ids.length) return;
      for (const id of ids) await deleteTopic(actor, id);
    }
    const left = await topicIds(actor, title);
    if (left.length) {
      throw friendly({
        message: `The topic "${title}" is still there after its deletion (${left.length} of them).`,
        hint: `The account "${h.moderatorHandle(world)}" (worldParameters.moderator in cucumber.js) removes test content: it must be able to moderate every forum.`,
      });
    }
  });
}

/** Post a topic as an account, in a browser page of its own. */
async function makeTopic(world, title, forum, who, text) {
  await h.asAccount(world, who, async (actor) => {
    await posting.startTopic(actor, forum);
    const ed = await h.editor(actor);
    await ed.subject.fill(title);
    await ed.message.fill(text);
    await posting.submitEditorOk(actor);
  });
}

/**
 * Make sure the board has no topic with a title: the moderating account of the suite (`worldParameters.moderator`
 * in cucumber.js) deletes for good every topic that carries it, in whatever forum and state (waiting for
 * approval, deleted softly). Start a scenario that makes a topic with this step, and end it with it.
 *
 * Example #1: Given there is no topic "Webship test topic"
 * Example #2: And there is no topic "Webship test question"
 * Example #3: Given there is no topic "Webship test topic of a new member"
 * Example #4: Then there is no topic "Webship test topic"
 * Example #5: And there is no topic "Webship test topic, split"
 */
Given(/^there is no topic "([^"]*)"$/, { timeout: 180000 }, async function (title) {
  await removeTopics(this, title);
});

/**
 * Make sure a forum has a topic with a title, written by an account of the users registry: when the forum has
 * none, the account posts it (in a browser page of its own, the page of the scenario stays as it is), with a
 * text of the step's own or the one given below it. A topic of a newly registered user waits for approval.
 *
 * Example #1: Given there is a topic "Webship test topic" in "General discussion" by "member"
 * Example #2: And there is a topic "Webship test question" in "Help and support" by "member"
 * Example #3: Given there is a topic "Webship test topic of a new member" in "General discussion" by "newmember"
 * Example #4: Given there is a topic "Webship test notes" in "Staff room" by "moderator"
 * Example #5: And there is a topic "Webship test topic" in "Introductions" by "member"
 */
Given(/^there is a topic "([^"]*)" in "([^"]*)" by "([^"]*)"$/, { timeout: 180000 }, async function (title, forum, who) {
  await removeTopics(this, title);
  await makeTopic(this, title, forum, who, `${title}: the first post of a topic a scenario made.`);
});

/**
 * The same, with the text of the first post given below the step (BBCode as it is written).
 *
 * Example #1: Given there is a topic "Webship test topic" in "General discussion" by "member" with:
 * Example #2: And there is a topic "Webship test question" in "Help and support" by "member" with:
 * Example #3: Given there is a topic "Webship test topic" in "Introductions" by "member" with:
 * Example #4: Given there is a topic "Webship test notes" in "Staff room" by "moderator" with:
 * Example #5: And there is a topic "Webship test topic of a new member" in "General discussion" by "newmember" with:
 */
Given(/^there is a topic "([^"]*)" in "([^"]*)" by "([^"]*)" with:$/, { timeout: 180000 }, async function (title, forum, who, text) {
  await removeTopics(this, title);
  await makeTopic(this, title, forum, who, String(text));
});

/**
 * An account of the users registry replied to a topic of a forum with a text: the account posts the reply (in
 * a browser page of its own, the page of the scenario stays as it is).
 *
 * Example #1: Given "moderator" replied to the topic "Webship test topic" in "General discussion" with "Webship test reply of the moderator."
 * Example #2: And "member" replied to the topic "Webship test topic" in "General discussion" with "Webship test: a second post."
 * Example #3: Given "administrator" replied to the topic "Webship test question" in "Help and support" with "Webship test answer."
 * Example #4: And "member" replied to the topic "Webship test topic" in "Introductions" with "Webship test: a third post."
 * Example #5: Given "newmember" replied to the topic "Webship test topic" in "General discussion" with "Webship test: this reply waits for approval."
 */
Given(/^"([^"]*)" replied to the topic "([^"]*)" in "([^"]*)" with "([^"]*)"$/, { timeout: 180000 }, async function (who, title, forum, text) {
  await h.asAccount(this, who, async (actor) => {
    await h.openForum(actor, forum);
    await h.openTopicOnPage(actor, title);
    await posting.barButton(actor, 'reply', 'Post Reply');
    const ed = await h.editor(actor);
    await ed.message.fill(text);
    await posting.submitEditorOk(actor);
  });
});

module.exports = { removeTopics, makeTopic, topicIds, deleteTopic };

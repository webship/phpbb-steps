'use strict';

// A topic: opening it, its posts (who wrote them, what they say, what they
// quote, their attachments), whether it is locked, its poll, and the
// bookmark and the subscription of the account.

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./phpbb-helpers');

/** The topic on screen, or a failure. */
async function onTopic(world) {
  const title = await h.topicTitle(world.page);
  if (!title) {
    throw friendly({ message: `The page is not a topic: ${await h.pageSummary(world)}.`, hint: h.hintFor(world, 'Open the topic first: When I open the topic "…" in "…"') });
  }
  return title;
}

/** The tools of the topic (the wrench above its posts): subscribe, bookmark, email, print. */
async function topicTool(world, pattern) {
  const page = world.page;
  await onTopic(world);
  const tools = page.locator('.action-bar.bar-top .topic-tools').first();
  if (!(await tools.count())) throw friendly({ message: 'The topic shows no topic tools.', hint: 'The tools of a topic (subscribe, bookmark) show to an account that is logged in.' });
  const menu = await h.openDropdown(world, tools);
  return { menu, link: menu.locator('a').filter({ hasText: pattern }).first(), names: async () => (await menu.locator('a').allTextContents()).map(h.clean) };
}

/**
 * Open a topic by its title: in the list of the forum on screen, or in the forum named. The step looks
 * through the pages of the forum.
 *
 * Example #1: When I open the topic "Weekend baking thread" in "General discussion"
 * Example #2: When I open the topic "Board rules"
 * Example #3: And we open the topic "Hello from the member" in "Introductions"
 * Example #4: When I open the topic "Which season do you like best?" in "General discussion"
 * Example #5: When we open the topic "Old announcements" in "Archive"
 */
When(/^(?:I|we) open the topic "([^"]*)"(?: in "([^"]*)")?$/, async function (title, forum) {
  if (forum) await h.openForum(this, forum);
  else if (!(await h.forumTitle(this.page))) {
    throw friendly({ message: `The page is not a forum: ${await h.pageSummary(this)}.`, hint: h.hintFor(this, 'Name the forum of the topic: When I open the topic "…" in "…"') });
  }
  await h.openTopicOnPage(this, title);
  const found = await h.topicTitle(this.page);
  if (h.normal(found) !== h.normal(title)) {
    throw friendly({ message: `The topic "${title}" did not open: ${await h.pageSummary(this)}.`, hint: h.hintFor(this, 'An account opens the topics of the forums it may read.') });
  }
});

/**
 * Assert that the page is a topic, by its title in the heading of the page.
 *
 * Example #1: Then I should be reading the topic "Weekend baking thread"
 * Example #2: Then we should be reading the topic "Board rules"
 * Example #3: And I should be reading the topic "Webship test topic"
 * Example #4: Then I should be reading the topic "Which season do you like best?"
 * Example #5: And we should be reading the topic "Hello from the member"
 */
Then(/^(?:I|we) should be reading the topic "([^"]*)"$/, async function (title) {
  await h.eventually(this, () => h.topicTitle(this.page), (found) => h.normal(found) === h.normal(title), async (found) => ({
    message: `The page is not the topic "${title}": ${found ? `it is the topic "${found}"` : await h.pageSummary(this)}.`,
    hint: h.hintFor(this, 'Open the topic first: When I open the topic "…" in "…"'),
  }));
});

/**
 * Assert how many posts the topic on screen says it has, beside the page numbers above its posts ("13 posts").
 *
 * Example #1: Then the topic should have 13 posts
 * Example #2: Then the topic should have 1 post
 * Example #3: And the topic should have 2 posts
 * Example #4: Then the topic should have 3 posts
 * Example #5: And the topic should have 13 posts
 */
Then(/^the topic should have (\d+) posts?$/, async function (count) {
  await onTopic(this);
  await h.eventually(this, async () => h.clean(await this.page.locator('.action-bar.bar-top .pagination').first().textContent({ timeout: 2000 }).catch(() => '')), (text) => {
    const m = text.match(/(\d+)\s+posts?/i);
    return !!m && parseInt(m[1], 10) === parseInt(count, 10);
  }, async (text) => ({
    message: `The topic says "${text || '(nothing)'}", not ${count} post${count === '1' ? '' : 's'}.`,
    hint: 'The count stands above the posts, beside the page numbers. It counts the posts the account may see: a moderator also sees the ones that wait for approval or were deleted softly.',
  }), 3000);
});

/**
 * Assert the author of a post of the topic on screen: the post by its number on the page (from 1), or the
 * last one. The author is a handle of the users registry or a user name.
 *
 * Example #1: Then post 1 should be by "member"
 * Example #2: Then the last post should be by "administrator"
 * Example #3: And post 2 should be by "moderator"
 * Example #4: Then the last post should be by "member"
 * Example #5: And post 3 should be by "administrator"
 */
Then(/^(?:post (\d+)|the last post) should be by "([^"]*)"$/, async function (number, who) {
  const post = await h.postAt(this, number);
  const wanted = h.usernameOf(this, who);
  if (post.author.toLowerCase() !== wanted.toLowerCase()) {
    throw friendly({ message: `Post ${post.number} is by "${post.author}", not by "${wanted}". It reads "${post.text.slice(0, 120)}".`, hint: 'Posts are counted on the page on screen, from 1.' });
  }
});

/**
 * Assert what a post of the topic on screen says: a part of its text is enough.
 *
 * Example #1: Then post 1 should read "What is in your oven this weekend?"
 * Example #2: Then the last post should read "Boil them before you bake them."
 * Example #3: And post 2 should read "A tray of cinnamon rolls here."
 * Example #4: Then the last post should read "Webship test reply"
 * Example #5: And post 1 should read "sourdough"
 */
Then(/^(?:post (\d+)|the last post) should read "([^"]*)"$/, async function (number, expected) {
  const post = await h.postAt(this, number);
  if (!h.mentions(post.text, expected)) {
    throw friendly({ message: `Post ${post.number} (by ${post.author}) does not read "${expected}". It reads "${post.text.slice(0, 300)}".`, hint: 'Posts are counted on the page on screen, from 1; a part of the text is enough.' });
  }
});

/**
 * Assert that a post of the topic on screen quotes a text (a part of it), and with an author, whom it quotes.
 *
 * Example #1: Then the last post should quote "What is in your oven this weekend?"
 * Example #2: Then the last post should quote "What is in your oven this weekend?" by "member"
 * Example #3: And post 2 should quote "A tray of cinnamon rolls here." by "moderator"
 * Example #4: Then the last post should quote "Webship test"
 * Example #5: And post 3 should quote "sourdough" by "member"
 */
Then(/^(?:post (\d+)|the last post) should quote "([^"]*)"(?: by "([^"]*)")?$/, async function (number, expected, who) {
  const post = await h.postAt(this, number);
  const quote = post.quotes.find((q) => h.mentions(q.text, expected));
  if (!quote) {
    throw friendly({ message: `Post ${post.number} quotes ${post.quotes.length ? h.listed(post.quotes.map((q) => q.text.slice(0, 120))) : 'nothing'}, not "${expected}".`, hint: 'A quote is the box in a post that repeats another post, with "… wrote:" above it.' });
  }
  if (who && quote.by.toLowerCase() !== h.usernameOf(this, who).toLowerCase()) {
    throw friendly({ message: `Post ${post.number} quotes "${quote.by || '(nobody named)'}", not "${h.usernameOf(this, who)}".`, hint: 'The quote names its author above the quoted text.' });
  }
});

/**
 * Assert that a post of the topic on screen shows an attachment, by its file name.
 *
 * Example #1: Then the last post should show the attachment "webship-test-picture.png"
 * Example #2: Then post 1 should show the attachment "webship-test-picture.png"
 * Example #3: And the last post should show the attachment "webship-test-picture.png"
 * Example #4: Then post 2 should show the attachment "notes.zip"
 * Example #5: And the last post should show the attachment "photo.jpg"
 */
Then(/^(?:post (\d+)|the last post) should show the attachment "([^"]*)"$/, async function (number, name) {
  const post = await h.postAt(this, number);
  if (!post.attachments.some((a) => h.mentions(a, name))) {
    throw friendly({ message: `Post ${post.number} shows ${post.attachments.length ? `the attachments ${h.listed(post.attachments)}` : 'no attachment'}, not "${name}".`, hint: 'A post lists its attachments under its text ("Attachments").' });
  }
});

/**
 * Assert that the topic on screen is locked (its reply button says "Locked") or open.
 *
 * Example #1: Then the topic should be locked
 * Example #2: Then the topic should be open
 * Example #3: And the topic should be locked
 * Example #4: And the topic should be open
 * Example #5: Then the topic should be locked
 */
Then(/^the topic should be (locked|open)$/, async function (state) {
  await onTopic(this);
  const want = state === 'locked';
  await h.eventually(this, async () => (await this.page.locator('.action-bar.bar-top a.button .fa-lock, .action-bar.bar-top a.button[title*="locked"]').count()) > 0, (locked) => locked === want, async (locked) => ({
    message: `The topic "${await h.topicTitle(this.page)}" is ${locked ? 'locked' : 'open'}, not ${state}.`,
    hint: 'A locked topic shows "Locked" where an open one shows "Post Reply". A locked forum locks its topics too.',
  }), 3000);
});

/** The poll of the topic on screen: its question, its options with their votes, the total, and the option the account voted for. */
async function readPoll(world) {
  await onTopic(world);
  const poll = await world.page.evaluate(() => {
    const form = document.querySelector('form.topic_poll');
    if (!form) return null;
    const t = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '');
    return {
      title: t(form.querySelector('.poll-title')),
      total: parseInt(t(form.querySelector('.poll_total_vote_cnt')), 10),
      canVote: !!form.querySelector('input[name="update"]'),
      options: [...form.querySelectorAll('dl[data-poll-option-id]')].map((dl) => ({
        text: t(dl.querySelector('dt')),
        votes: parseInt(t(dl.querySelector('.resultbar div')), 10) || 0,
        mine: /\bvoted\b/.test(dl.className),
      })),
    };
  });
  if (!poll) throw friendly({ message: `The topic "${await h.topicTitle(world.page)}" has no poll.`, hint: 'A poll shows above the first post of its topic.' });
  return poll;
}

/**
 * Assert that the topic on screen has a poll with a question, and with options, those options in order.
 *
 * Example #1: Then the topic should have the poll "Which season do you like best?"
 * Example #2: Then the topic should have the poll "Which season do you like best?" with the options "Spring", "Summer", "Autumn" and "Winter"
 * Example #3: And the topic should have the poll "Which season do you like best?"
 * Example #4: Then the topic should have the poll "Webship test poll" with the options "Yes" and "No"
 * Example #5: And the topic should have the poll "Webship test poll"
 */
Then(/^the topic should have the poll "([^"]*)"(?: with the options ("[^"]*"(?:(?:, | and )"[^"]*")*))?$/, async function (question, list) {
  const poll = await readPoll(this);
  if (h.normal(poll.title) !== h.normal(question)) throw friendly({ message: `The poll of the topic asks "${poll.title}", not "${question}".`, hint: 'The question of a poll is the heading above its options.' });
  if (list) {
    const wanted = [...list.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
    const found = poll.options.map((o) => o.text);
    if (found.length !== wanted.length || found.some((o, i) => h.normal(o) !== h.normal(wanted[i]))) {
      throw friendly({ message: `The poll has the options ${h.listed(found)}, not ${h.listed(wanted)}.`, hint: 'The options are listed in the order the author gave them.' });
    }
  }
});

/**
 * Vote in the poll of the topic on screen for an option, as a person does: the option, then "Submit vote". The
 * board counts the vote in the page and says "Your vote has been cast."; an account that voted before changes
 * its vote, where the poll allows that.
 *
 * Example #1: When I vote for "Summer" in the poll
 * Example #2: When we vote for "Winter" in the poll
 * Example #3: And I vote for "Spring" in the poll
 * Example #4: When I vote for "Autumn" in the poll
 * Example #5: Then we vote for "Summer" in the poll
 */
When(/^(?:I|we) vote for "([^"]*)" in the poll$/, async function (option) {
  const page = this.page;
  const poll = await readPoll(this);
  if (!poll.canVote) throw friendly({ message: `The poll "${poll.title}" takes no vote from this account.`, hint: 'A visitor cannot vote; an account votes once unless the poll allows a change; a poll can run out.' });
  const i = poll.options.findIndex((o) => h.normal(o.text) === h.normal(option));
  if (i < 0) throw friendly({ message: `The poll has no option "${option}". Its options: ${h.listed(poll.options.map((o) => o.text))}.`, hint: 'Name the option as the poll shows it.' });
  const form = page.locator('form.topic_poll');
  await form.locator('dl[data-poll-option-id]').nth(i).locator('input[name="vote_id[]"]').check();
  await h.formAge(this);
  await form.locator('input[name="update"]').click();
  await h.eventually(this, async () => ({ cast: await form.locator('.vote-submitted').isVisible().catch(() => false), alert: await h.alertText(page) }), (s) => s.cast || !!s.alert, async () => ({
    message: `The board did not count the vote for "${option}": ${await h.pageSummary(this)}.`,
    hint: h.hintFor(this, 'The board answers a vote in the page with "Your vote has been cast.".'),
  }));
  const alert = await h.alertText(page);
  if (alert && !/cast/i.test(alert.text)) throw friendly({ message: `The board refused the vote for "${option}": "${alert.text}".`, hint: 'An account votes once unless the poll allows a change.' });
  await h.overlayGone(this);
});

/**
 * Assert the votes of an option of the poll of the topic on screen, or that the account's own vote is for it.
 *
 * Example #1: Then the poll should show 1 vote for "Summer"
 * Example #2: Then the poll should show 0 votes for "Winter"
 * Example #3: And the poll should show my vote for "Summer"
 * Example #4: Then the poll should show 2 votes for "Spring"
 * Example #5: And the poll should show my vote for "Autumn"
 */
Then(/^the poll should show (?:(\d+) votes?|my vote) for "([^"]*)"$/, async function (votes, option) {
  await h.eventually(this, () => readPoll(this), (poll) => {
    const o = poll.options.find((x) => h.normal(x.text) === h.normal(option));
    return !!o && (votes == null ? o.mine : o.votes === parseInt(votes, 10));
  }, async (poll) => ({
    message: votes == null
      ? `The poll does not show the account's vote for "${option}". Its vote: ${h.listed(poll.options.filter((o) => o.mine).map((o) => o.text))}.`
      : `The poll does not show ${votes} vote${votes === '1' ? '' : 's'} for "${option}". It shows: ${poll.options.map((o) => `${o.text} ${o.votes}`).join(', ')} (total ${poll.total}).`,
    hint: 'The poll shows its votes to an account that voted, or to everyone when its author allowed that.',
  }), 4000);
});

/**
 * Bookmark the topic on screen or subscribe to it, with the tools of the topic (the wrench above its posts).
 * The board does it in the page and confirms it; nothing happens when it is so already.
 *
 * Example #1: When I bookmark the topic
 * Example #2: When I subscribe to the topic
 * Example #3: And we bookmark the topic
 * Example #4: And we subscribe to the topic
 * Example #5: Then I bookmark the topic
 */
When(/^(?:I|we) (bookmark|subscribe to) the topic$/, async function (what) {
  const tool = await topicTool(this, what === 'bookmark' ? /^\s*Bookmark topic\s*$/i : /^\s*Subscribe topic\s*$/i);
  if (!(await tool.link.count())) {
    const names = await tool.names();
    if (names.some((n) => (what === 'bookmark' ? /Remove from bookmarks/i : /Unsubscribe topic/i).test(n))) { await this.page.keyboard.press('Escape'); return; }
    throw friendly({ message: `The tools of the topic offer no "${what === 'bookmark' ? 'Bookmark topic' : 'Subscribe topic'}". They offer: ${h.listed(names)}.`, hint: 'The tools of a topic show to an account that is logged in.' });
  }
  await tool.link.click();
  await h.eventually(this, async () => (await tool.names()).join(' | '), (names) => (what === 'bookmark' ? /Remove from bookmarks/i : /Unsubscribe topic/i).test(names), async (names) => ({
    message: `The board did not ${what} the topic: its tools still read ${names}.`,
    hint: h.hintFor(this, 'The board answers in the page ("Bookmarked topic successfully.") and turns the tool into its opposite.'),
  }));
  await h.overlayGone(this);
});

/**
 * Take the bookmark of the topic on screen away, or unsubscribe from it, with the tools of the topic. Nothing
 * happens when there is none.
 *
 * Example #1: When I remove the bookmark of the topic
 * Example #2: When I unsubscribe from the topic
 * Example #3: And we remove the bookmark of the topic
 * Example #4: And we unsubscribe from the topic
 * Example #5: Then I remove the bookmark of the topic
 */
When(/^(?:I|we) (remove the bookmark of|unsubscribe from) the topic$/, async function (what) {
  const bookmark = /bookmark/.test(what);
  const tool = await topicTool(this, bookmark ? /Remove from bookmarks/i : /Unsubscribe topic/i);
  if (!(await tool.link.count())) { await this.page.keyboard.press('Escape'); return; }
  await tool.link.click();
  await h.eventually(this, async () => (await tool.names()).join(' | '), (names) => (bookmark ? /(^|\| )Bookmark topic/i : /(^|\| )Subscribe topic/i).test(names), async (names) => ({
    message: `The board did not ${what} the topic: its tools still read ${names}.`,
    hint: h.hintFor(this, 'The board answers in the page and turns the tool into its opposite.'),
  }));
  await h.overlayGone(this);
});

/**
 * Assert that the topic on screen is bookmarked or subscribed to by the account, or is not: what the tools of
 * the topic offer says so ("Remove from bookmarks", "Unsubscribe topic").
 *
 * Example #1: Then the topic should be bookmarked
 * Example #2: Then the topic should not be bookmarked
 * Example #3: And the topic should be subscribed to
 * Example #4: And the topic should not be subscribed to
 * Example #5: Then the topic should be bookmarked
 */
Then(/^the topic should (not )?be (bookmarked|subscribed to)$/, async function (notCase, what) {
  await onTopic(this);
  const names = (await this.page.locator('.action-bar.bar-top .topic-tools .dropdown a').allTextContents()).map(h.clean);
  const is = names.some((n) => (what === 'bookmarked' ? /Remove from bookmarks/i : /Unsubscribe topic/i).test(n));
  if (is === !!notCase) {
    throw friendly({ message: `The topic is ${is ? '' : 'not '}${what} by this account. Its tools: ${h.listed(names)}.`, hint: 'The tools of a topic offer the opposite of what is: "Remove from bookmarks" on a bookmarked topic.' });
  }
});

module.exports = { onTopic, readPoll };

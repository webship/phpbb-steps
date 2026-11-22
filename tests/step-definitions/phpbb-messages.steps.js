'use strict';

// Private messages: the folders of the account (inbox, outbox, sent
// messages), reading a message, sending one, answering and deleting, and the
// counter of unread messages at the top of the page.
//
// A message a person sends stays in the sender's outbox until its recipient
// reads it; then it moves to the sender's sent messages.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./phpbb-helpers');

const FOLDERS = { inbox: 'inbox', outbox: 'outbox', 'sent messages': 'sentbox' };

/** Open a folder of the private messages of the account. */
async function openFolder(world, folder) {
  await h.open(world, h.absolute(world, `ucp.php?i=pm&folder=${FOLDERS[folder]}`));
  if (!(await world.page.locator('#cp-main').count())) {
    throw friendly({ message: `The private messages did not open: ${await h.pageSummary(world)}.`, hint: h.hintFor(world, 'Private messages need an account: Given I am a logged in user with the "member" user') });
  }
}

/** The messages of the folder on screen: [{title, unread, text, href}]. */
async function folderRows(page) {
  return page.locator('#cp-main ul.topiclist.cplist > li.row').evaluateAll((rows) => rows.map((r) => {
    const t = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '');
    const link = r.querySelector('a.topictitle');
    return { title: t(link), href: link ? link.getAttribute('href') : '', unread: /pm_unread/.test((r.querySelector('dl') || {}).className || ''), text: t(r.querySelector('.list-inner')) };
  }).filter((r) => r.title));
}

/** A message of the folder on screen by its subject, or a failure with the subjects listed. */
async function folderRow(world, subject) {
  const page = world.page;
  if (!(await page.locator('#cp-main').count()) || !/i=(ucp_)?pm/.test(page.url())) {
    throw friendly({ message: `The page is not a folder of private messages: ${await h.pageSummary(world)}.`, hint: h.hintFor(world, 'Open a folder first: When I go to my inbox') });
  }
  const rows = await folderRows(page);
  const row = rows.find((r) => h.normal(r.title) === h.normal(subject));
  if (!row) {
    throw friendly({ message: `The folder "${await h.heading(page)}" lists no message "${subject}". Its messages: ${h.listed(rows.map((r) => r.title))}.`, hint: 'A message a person sent is in the outbox until its recipient reads it, then in the sent messages.' });
  }
  return row;
}

/** The message on screen (its subject, author, text), or a failure. */
async function messageOnScreen(world) {
  const post = world.page.locator('#cp-main .post.pm').first();
  if (!(await post.count())) {
    throw friendly({ message: `No private message is open: ${await h.pageSummary(world)}.`, hint: h.hintFor(world, 'Open one first: When I open the message "…"') });
  }
  return {
    post,
    subject: h.clean(await post.locator('.postbody h3').first().textContent().catch(() => '')),
    author: h.clean(await post.locator('.postprofile a.username, .postprofile a.username-coloured, .postprofile .username, .postprofile .username-coloured').first().textContent().catch(() => '')),
    text: h.clean(await post.locator('.content').first().innerText().catch(() => '')),
  };
}

/** Write and send a private message in the page of a world; returns the errors of the editor, or none. */
async function sendMessage(world, subject, to, text) {
  const page = world.page;
  await h.open(world, h.absolute(world, 'ucp.php?i=pm&mode=compose'));
  const ed = await h.editor(world);
  await page.locator('#username_list').fill(h.usernameOf(world, to));
  await h.send(world, page.locator('#postform input[name="add_to"]'));
  let errors = await h.formErrors(page);
  if (errors.length) return errors;
  await ed.subject.fill(subject);
  await ed.message.fill(text);
  await h.send(world, ed.submit);
  if (await page.locator('form#postform').count()) return h.formErrors(page);
  await h.expectNotice(world, 'sent successfully', 'The board answers with "This message has been sent successfully.".');
  return [];
}

/** Delete the message on screen: "Delete message", then the confirmation. */
async function deleteOpenMessage(world) {
  const page = world.page;
  const m = await messageOnScreen(world);
  const button = m.post.locator('.post-buttons a[href*="action=delete"]').first();
  await h.afterNavigation(world, () => button.click());
  await h.confirm(world);
  await h.expectNotice(world, 'deleted', 'The board answers with "Message successfully deleted.".');
  await h.followNotice(world, /folder|message/i);
  return page;
}

/**
 * Open a folder of the private messages of the account: the inbox, the outbox (what it sent and its recipient
 * has not read yet) or the sent messages.
 *
 * Example #1: When I go to my inbox
 * Example #2: When I go to my outbox
 * Example #3: And we go to my sent messages
 * Example #4: Given I go to my inbox
 * Example #5: And we go to my outbox
 */
When(/^(?:I|we) go to my (inbox|outbox|sent messages)$/, async function (folder) {
  await openFolder(this, folder);
});

/**
 * Assert that the folder of private messages on screen lists a message by its subject, or does not.
 *
 * Example #1: Then my messages should list "Welcome to the board"
 * Example #2: Then my messages should not list "Webship test message"
 * Example #3: And my messages should list "About your first post"
 * Example #4: And my messages should list "Webship test message"
 * Example #5: Then my messages should not list "Welcome to the board"
 */
Then(/^my messages should (not )?list "([^"]*)"$/, async function (notCase, subject) {
  const rows = await folderRows(this.page);
  const has = rows.some((r) => h.normal(r.title) === h.normal(subject));
  if (notCase ? has : !has) {
    if (!notCase) await folderRow(this, subject);
    throw friendly({ message: `The folder "${await h.heading(this.page)}" lists the message "${subject}".`, hint: 'A message a scenario sent stays until both sides delete it: Given "…" has no message "…"' });
  }
});

/**
 * Assert that a message of the folder on screen is unread (in bold, with the mark of a new message) or read.
 *
 * Example #1: Then the message "Webship test message" should be unread
 * Example #2: Then the message "Webship test message" should be read
 * Example #3: And the message "Welcome to the board" should be read
 * Example #4: And the message "About your first post" should be unread
 * Example #5: Then the message "Webship test message" should be read
 */
Then(/^the message "([^"]*)" should be (unread|read)$/, async function (subject, state) {
  const row = await folderRow(this, subject);
  if (row.unread !== (state === 'unread')) {
    throw friendly({ message: `The message "${subject}" is ${row.unread ? 'unread' : 'read'}, not ${state}.`, hint: 'A message is read once its recipient opened it.' });
  }
});

/**
 * Open a message of the folder on screen by its subject.
 *
 * Example #1: When I open the message "Welcome to the board"
 * Example #2: When we open the message "Webship test message"
 * Example #3: And I open the message "About your first post"
 * Example #4: Then I open the message "Webship test message"
 * Example #5: And we open the message "Welcome to the board"
 */
When(/^(?:I|we) open the message "([^"]*)"$/, async function (subject) {
  const row = await folderRow(this, subject);
  await h.open(this, h.absolute(this, row.href));
  await messageOnScreen(this);
});

/**
 * Assert the private message on screen: who sent it (a handle of the users registry or a user name), or what
 * it says (a part of its text).
 *
 * Example #1: Then the message should be from "administrator"
 * Example #2: Then the message should read "Read the board rules first"
 * Example #3: And the message should be from "moderator"
 * Example #4: And the message should read "Webship test: a private message."
 * Example #5: Then the message should be from "member"
 */
Then(/^the message should (?:be from|(read)) "([^"]*)"$/, async function (readCase, expected) {
  const m = await messageOnScreen(this);
  if (readCase) {
    if (!h.mentions(m.text, expected)) throw friendly({ message: `The message "${m.subject}" does not read "${expected}". It reads "${m.text.slice(0, 300)}".`, hint: 'A part of the text is enough.' });
  } else if (m.author.toLowerCase() !== h.usernameOf(this, expected).toLowerCase()) {
    throw friendly({ message: `The message "${m.subject}" is from "${m.author}", not from "${h.usernameOf(this, expected)}".`, hint: 'The sender of a message shows beside it.' });
  }
});

/**
 * Send a private message as a person does: "New PM", the recipient (a handle of the users registry or a user
 * name) added, the subject, the text, "Submit". The step expects the board to send it.
 *
 * Example #1: When I send the message "Webship test message" to "moderator" with "Webship test: a private message."
 * Example #2: When we send the message "Webship test question" to "administrator" with "Webship test: may I ask something?"
 * Example #3: And I send the message "Webship test message" to "member" with "Webship test: an answer."
 * Example #4: When I send the message "Webship test message" to "newmember" with "Webship test: welcome."
 * Example #5: Then we send the message "Webship test message" to "moderator" with "Webship test: thanks."
 */
When(/^(?:I|we) send the message "([^"]*)" to "([^"]*)" with "([^"]*)"$/, { timeout: 90000 }, async function (subject, to, text) {
  const errors = await sendMessage(this, subject, to, text);
  if (errors.length) throw friendly({ message: `The board did not send the message "${subject}" to "${h.usernameOf(this, to)}": ${h.listed(errors)}.`, hint: 'The recipient is a user name of the board; a message needs a subject and a text.' });
});

/**
 * Try to send a private message, expecting nothing: the recipient, the subject and the text as given (an
 * unknown recipient, an empty subject). Assert the error of the editor with the next step.
 *
 * Example #1: When I try to send the message "Webship test message" to "webship-test-nobody" with "Webship test."
 * Example #2: When I try to send the message "" to "moderator" with "Webship test: a message without a subject."
 * Example #3: And we try to send the message "Webship test message" to "moderator" with ""
 * Example #4: When we try to send the message "Webship test message" to "webship-test-nobody" with "Webship test."
 * Example #5: And I try to send the message "" to "administrator" with ""
 */
When(/^(?:I|we) try to send the message "([^"]*)" to "([^"]*)" with "([^"]*)"$/, { timeout: 90000 }, async function (subject, to, text) {
  await sendMessage(this, subject, to, text);
});

/**
 * Answer the private message on screen: "Reply to message", the text, "Submit". The subject is the board's
 * ("Re: …").
 *
 * Example #1: When I reply to the message with "Webship test: an answer."
 * Example #2: When we reply to the message with "Webship test: thank you."
 * Example #3: And I reply to the message with "Webship test: yes."
 * Example #4: Then I reply to the message with "Webship test: an answer."
 * Example #5: And we reply to the message with "Webship test: no."
 */
When(/^(?:I|we) reply to the message with "([^"]*)"$/, { timeout: 90000 }, async function (text) {
  const page = this.page;
  await messageOnScreen(this);
  const button = page.locator('#cp-main a.button[href*="action=reply"], #cp-main .post-buttons a[href*="action=reply"]').first();
  if (!(await button.count())) throw friendly({ message: 'The message offers no "Reply to message".', hint: 'An account answers the messages it received.' });
  await h.afterNavigation(this, () => button.click());
  const ed = await h.editor(this);
  await ed.message.fill(text);
  await h.send(this, ed.submit);
  if (await page.locator('form#postform').count()) throw friendly({ message: `The board did not send the reply: ${h.listed(await h.formErrors(page))}.`, hint: 'A message needs a text.' });
  await h.expectNotice(this, 'sent successfully', 'The board answers with "This message has been sent successfully.".');
});

/**
 * Delete a message of the folder on screen by its subject: the message opened, "Delete message", the
 * confirmation. The message goes from this account's folder; the other side keeps its copy.
 *
 * Example #1: When I delete the message "Webship test message"
 * Example #2: When we delete the message "Re: Webship test message"
 * Example #3: And I delete the message "Webship test message"
 * Example #4: Then I delete the message "Webship test question"
 * Example #5: And we delete the message "Webship test message"
 */
When(/^(?:I|we) delete the message "([^"]*)"$/, { timeout: 90000 }, async function (subject) {
  const row = await folderRow(this, subject);
  await h.open(this, h.absolute(this, row.href));
  await deleteOpenMessage(this);
});

/**
 * Assert the counter of unread private messages at the top of the page, beside "Private messages".
 *
 * Example #1: Then I should have 1 unread message
 * Example #2: Then I should have 0 unread messages
 * Example #3: And we should have 2 unread messages
 * Example #4: And I should have 1 unread message
 * Example #5: Then we should have 0 unread messages
 */
Then(/^(?:I|we) should have (\d+) unread messages?$/, async function (count) {
  const link = this.page.locator('#nav-main a[href*="i=pm"]').first();
  if (!(await link.count())) throw friendly({ message: `The page shows no "Private messages" at its top: ${await h.pageSummary(this)}.`, hint: h.hintFor(this, 'The counter shows to an account that is logged in, on the pages of the board.') });
  const badge = link.locator('.badge').first();
  const hidden = /\bhidden\b/.test((await badge.getAttribute('class').catch(() => '')) || '');
  const found = hidden ? 0 : parseInt(h.clean(await badge.textContent().catch(() => '0')), 10) || 0;
  if (found !== parseInt(count, 10)) throw friendly({ message: `The top of the page counts ${found} unread private message${found === 1 ? '' : 's'}, not ${count}.`, hint: 'The counter is as the page was loaded: open a page after the message was sent.' });
});

/**
 * Make sure an account of the users registry has no private message with a subject (or its answer, "Re: …"),
 * in any of its folders: the account deletes them (in a browser page of its own, the page of the scenario
 * stays as it is). Start and end a scenario that sends a message with this step, for both sides.
 *
 * Example #1: Given "member" has no message "Webship test message"
 * Example #2: And "moderator" has no message "Webship test message"
 * Example #3: Given "administrator" has no message "Webship test question"
 * Example #4: Then "member" has no message "Webship test message"
 * Example #5: And "newmember" has no message "Webship test message"
 */
Given(/^"([^"]*)" has no message "([^"]*)"$/, { timeout: 180000 }, async function (who, subject) {
  await h.asAccount(this, who, async (actor) => {
    const mine = (title) => [subject, `Re: ${subject}`].some((s) => h.normal(title) === h.normal(s));
    for (const folder of Object.keys(FOLDERS)) {
      for (let round = 0; round < 20; round += 1) {
        await openFolder(actor, folder);
        const row = (await folderRows(actor.page)).find((r) => mine(r.title));
        if (!row) break;
        await h.open(actor, h.absolute(actor, row.href));
        await deleteOpenMessage(actor);
      }
    }
  });
});

/**
 * An account of the users registry sent a private message to another (in a browser page of its own, the page
 * of the scenario stays as it is).
 *
 * Example #1: Given "moderator" sent the message "Webship test message" to "member" with "Webship test: a word from the moderator."
 * Example #2: And "administrator" sent the message "Webship test message" to "member" with "Webship test: a word from the administrator."
 * Example #3: Given "member" sent the message "Webship test question" to "moderator" with "Webship test: a question."
 * Example #4: Given "member" sent the message "Webship test message" to "newmember" with "Webship test: hello."
 * Example #5: And "moderator" sent the message "Webship test message" to "administrator" with "Webship test: a note."
 */
Given(/^"([^"]*)" sent the message "([^"]*)" to "([^"]*)" with "([^"]*)"$/, { timeout: 180000 }, async function (from, subject, to, text) {
  await h.asAccount(this, from, async (actor) => {
    const errors = await sendMessage(actor, subject, to, text);
    if (errors.length) throw friendly({ message: `The board did not send the message "${subject}" from "${from}" to "${to}": ${h.listed(errors)}.`, hint: 'Both are accounts of the users registry in cucumber.js.' });
  });
});

'use strict';

// Posting: a new topic, a reply, a quote and an edit in the editor of the
// board, its preview, its errors, attachments, the quick reply under a topic,
// and deleting a post.

const path = require('path');
const fs = require('fs');
const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./phpbb-helpers');

/** Follow a button of the bar above a forum's topics or a topic's posts ("New Topic", "Post Reply"), or say why it cannot be. */
async function barButton(world, mode, what) {
  const page = world.page;
  const button = page.locator(`.action-bar.bar-top a.button[href*="mode=${mode}"]`).first();
  if (!(await button.count())) {
    const shown = (await page.locator('.action-bar.bar-top a.button').evaluateAll((els) => els.map((b) => `${(b.textContent || '').replace(/\s+/g, ' ').trim()}${b.title ? ` (${b.title})` : ''}`))).filter(Boolean);
    throw friendly({
      message: `The page offers no "${what}". Above the list it shows: ${h.listed(shown)}; ${await h.pageSummary(world)}.`,
      hint: h.hintFor(world, 'A locked forum or topic shows "Locked" instead; a visitor and an account without the permission get no button at all.'),
    });
  }
  await h.afterNavigation(world, () => button.click());
  if (!(await page.locator('form#postform').count())) {
    const said = await h.notice(page);
    throw friendly({
      message: `The board opened no editor for "${what}": ${said.text ? `it says "${said.text}"` : await h.pageSummary(world)}.`,
      hint: h.hintFor(world, 'A locked forum or topic takes no new post; an account posts where its permissions allow it.'),
    });
  }
}

/** Open the editor for a new topic in a forum. */
async function startTopic(world, forum) {
  await h.openForum(world, forum);
  await barButton(world, 'post', 'New Topic');
}

/** Send the editor and read what came of it: a topic, a notice, or the editor again with its errors. */
async function submitEditor(world) {
  const page = world.page;
  const ed = await h.editor(world);
  await h.closeAlert(world);
  await h.send(world, ed.submit);
  if (await page.locator('form#postform').count()) return { ok: false, errors: await h.formErrors(page) };
  return { ok: true, errors: [], notice: await h.notice(page) };
}

/** The same, expecting the board to take the post. */
async function submitEditorOk(world) {
  const outcome = await submitEditor(world);
  if (!outcome.ok) {
    throw friendly({
      message: `The board did not take the post: ${outcome.errors.length ? h.listed(outcome.errors) : await h.pageSummary(world)}.`,
      hint: h.hintFor(world, 'The editor says what is missing above its fields: a subject for a new topic, a message.'),
    });
  }
  return outcome;
}

/** A file of the project by the path a step gives (from the folder the suite runs in), or a failure. */
function fixture(file) {
  const full = path.resolve(process.cwd(), file);
  if (!fs.existsSync(full)) {
    throw friendly({ message: `The file "${file}" is not there (${full}).`, hint: 'Give the path from the folder the suite runs in, for example "tests/fixtures/webship-test-picture.png".' });
  }
  return full;
}

/** Give a file to the editor's uploader and wait for its answer: the row of the file, or the alert that refuses it. */
async function attach(world, file) {
  const page = world.page;
  await h.editor(world);
  const full = fixture(file);
  const name = path.basename(full);
  const tab = page.locator('#tabs a[data-subpanel="attach-panel"]').first();
  if (!(await tab.count())) throw friendly({ message: 'The editor has no "Attachments" tab.', hint: 'The board offers attachments where they are on (the administration control panel, Attachment settings) and the account may attach files in the forum.' });
  await tab.click();
  // The uploader of the board keeps its file field beside "Add files".
  const input = page.locator('#attach-panel input[type="file"], input[type="file"][id^="html5_"]').first();
  // The upload carries the form of the editor: it is refused like any form sent in the second it was made.
  await h.formAge(world);
  await input.setInputFiles(full);
  return h.eventually(world, async () => {
    const alert = await h.alertText(page);
    if (alert) return { ok: false, error: alert.text };
    const row = page.locator('#file-list tr.attach-row').filter({ hasText: name }).first();
    if (await row.locator('.file-status.file-uploaded').count()) return { ok: true };
    const failed = row.locator('.file-status.file-error').first();
    if (await failed.count()) return { ok: false, error: h.clean(await failed.getAttribute('data-error-message').catch(() => '')) || 'the upload failed' };
    return null;
  }, (state) => !!state, async () => ({
    message: `The editor did not answer the upload of "${name}": ${await h.pageSummary(world)}.`,
    hint: h.hintFor(world, 'The uploader lists a file under "Attachments" once the board has it, or refuses it in an alert.'),
  }), h.budget(world) * 2);
}

/**
 * Open the editor for a new topic in a forum, as a person does: the forum, then "New Topic".
 *
 * Example #1: When I start a new topic in "General discussion"
 * Example #2: When we start a new topic in "Help and support"
 * Example #3: And I start a new topic in "Introductions"
 * Example #4: When I start a new topic in "Staff room"
 * Example #5: Given I start a new topic in "General discussion"
 */
When(/^(?:I|we) start a new topic in "([^"]*)"$/, async function (forum) {
  await startTopic(this, forum);
});

/**
 * Open the editor for a reply to the topic on screen: "Post Reply".
 *
 * Example #1: When I start a reply to the topic
 * Example #2: When we start a reply to the topic
 * Example #3: And I start a reply to the topic
 * Example #4: Given I start a reply to the topic
 * Example #5: Then we start a reply to the topic
 */
When(/^(?:I|we) start a reply to the topic$/, async function () {
  await barButton(this, 'reply', 'Post Reply');
});

/**
 * Open the editor for a reply that quotes a post of the topic on screen (the post by its number on the page, or
 * the last one): "Reply with quote" on the post. The editor opens with the quote in it.
 *
 * Example #1: When I quote post 1 in a reply
 * Example #2: When I quote the last post in a reply
 * Example #3: And we quote post 2 in a reply
 * Example #4: When we quote the last post in a reply
 * Example #5: And I quote post 3 in a reply
 */
When(/^(?:I|we) quote (?:post (\d+)|the last post) in a reply$/, async function (number) {
  const post = await h.postAt(this, number);
  const button = post.locator.locator('.post-buttons a[href*="mode=quote"]').first();
  if (!(await button.count())) throw friendly({ message: `Post ${post.number} offers no "Reply with quote".`, hint: 'A locked topic takes no reply; a visitor may not reply.' });
  await h.afterNavigation(this, () => button.click());
  await h.editor(this);
});

/**
 * Open the editor on a post of the topic on screen to change it: "Edit post" on the post (the post by its
 * number on the page, or the last one).
 *
 * Example #1: When I edit the last post
 * Example #2: When I edit post 1
 * Example #3: And we edit the last post
 * Example #4: When we edit post 2
 * Example #5: And I edit post 1
 */
When(/^(?:I|we) edit (?:post (\d+)|the last post)$/, async function (number) {
  const post = await h.postAt(this, number);
  const button = post.locator.locator('.post-buttons a[href*="mode=edit"]').first();
  if (!(await button.count())) throw friendly({ message: `Post ${post.number} (by ${post.author}) offers no "Edit post" to this account.`, hint: 'An account edits its own posts while the board allows it; a moderator edits any post.' });
  await h.afterNavigation(this, () => button.click());
  await h.editor(this);
});

/**
 * Write the subject in the editor that is open (the title of a new topic, the subject of a reply or a private
 * message).
 *
 * Example #1: When I write the subject "Webship test topic" in the editor
 * Example #2: When we write the subject "Webship test question" in the editor
 * Example #3: And I write the subject "" in the editor
 * Example #4: And we write the subject "Webship test topic, renamed" in the editor
 * Example #5: When I write the subject "Webship test message" in the editor
 */
When(/^(?:I|we) write the subject "([^"]*)" in the editor$/, async function (subject) {
  const ed = await h.editor(this);
  await ed.subject.fill(subject);
});

/**
 * Write the message in the editor that is open, in place of what it holds; "add" writes after what it holds (a
 * quote, the text of the post being edited). BBCode is written as it is: "[b]bold[/b]".
 *
 * Example #1: When I write "Webship test: the first post of a topic." in the editor
 * Example #2: When I add "Webship test: an answer to the quote." to the editor
 * Example #3: And we write "A [b]bold[/b] word." in the editor
 * Example #4: And we add "Webship test: one more line." to the editor
 * Example #5: When I write "" in the editor
 */
When(/^(?:I|we) (write|add) "([^"]*)" (?:in|to) the editor$/, async function (verb, text) {
  const ed = await h.editor(this);
  if (verb === 'add') {
    const now = await ed.message.inputValue();
    await ed.message.fill(now + (now && !now.endsWith('\n') ? '\n' : '') + text);
  } else {
    await ed.message.fill(text);
  }
});

/**
 * Assert what the editor that is open holds: its subject, or a text in its message (a part of it: the quote a
 * "Reply with quote" starts with, the text of the post being edited).
 *
 * Example #1: Then the editor should have the subject "Re: Weekend baking thread"
 * Example #2: Then the editor should contain "[quote=member"
 * Example #3: And the editor should contain "What is in your oven this weekend?"
 * Example #4: And the editor should have the subject "Webship test topic"
 * Example #5: Then the editor should contain "Webship test"
 */
Then(/^the editor should (?:have the subject|(contain)) "([^"]*)"$/, async function (containCase, expected) {
  const ed = await h.editor(this);
  if (containCase) {
    const text = await ed.message.inputValue();
    if (!text.includes(expected)) throw friendly({ message: `The editor does not contain "${expected}". It holds "${text.slice(0, 300)}".`, hint: 'The editor holds BBCode as it is written: [quote=…]…[/quote].' });
  } else {
    const subject = await ed.subject.inputValue();
    if (subject !== expected) throw friendly({ message: `The editor has the subject "${subject}", not "${expected}".`, hint: 'A reply starts with "Re: " and the title of the topic.' });
  }
});

/**
 * Show the preview of the post in the editor that is open: "Preview". The board draws the post above the
 * editor and keeps what was written.
 *
 * Example #1: When I preview the post
 * Example #2: When we preview the post
 * Example #3: And I preview the post
 * Example #4: Then I preview the post
 * Example #5: And we preview the post
 */
When(/^(?:I|we) preview the post$/, async function () {
  const ed = await h.editor(this);
  await h.send(this, ed.preview);
  if (!(await this.page.locator('#preview').count())) {
    const errors = await h.formErrors(this.page);
    throw friendly({ message: `The board showed no preview: ${errors.length ? h.listed(errors) : await h.pageSummary(this)}.`, hint: h.hintFor(this, 'The preview needs a message; the editor says what is missing above its fields.') });
  }
});

/**
 * Assert what the preview above the editor shows: a text (a part of it), and with "in bold", "in italics", "as a
 * quote" or "as a link", that the BBCode around it was drawn so.
 *
 * Example #1: Then the preview should show "Webship test: the first post of a topic."
 * Example #2: Then the preview should show "bold" in bold
 * Example #3: And the preview should show "slanted" in italics
 * Example #4: And the preview should show "quoted" as a quote
 * Example #5: Then the preview should show "a link" as a link
 */
Then(/^the preview should show "([^"]*)"( in bold| in italics| as a quote| as a link)?$/, async function (expected, how) {
  const preview = this.page.locator('#preview .content').first();
  if (!(await preview.count())) throw friendly({ message: `No preview is on the page: ${await h.pageSummary(this)}.`, hint: 'Show it first: When I preview the post' });
  const text = h.clean(await preview.innerText());
  if (!h.mentions(text, expected)) throw friendly({ message: `The preview does not show "${expected}". It shows "${text.slice(0, 300)}".`, hint: 'The preview draws the post as the topic will show it.' });
  if (how) {
    const selector = { ' in bold': 'strong, b', ' in italics': 'em, i', ' as a quote': 'blockquote', ' as a link': 'a.postlink, a' }[how];
    const drawn = (await preview.locator(selector).allTextContents()).map(h.clean);
    if (!drawn.some((d) => h.mentions(d, expected))) {
      throw friendly({ message: `The preview shows "${expected}", but not${how}. Drawn${how}: ${h.listed(drawn)}.`, hint: 'BBCode is drawn when it is on for the board, the forum and the post ("Disable BBCode" under the editor).' });
    }
  }
});

/**
 * Send the editor that is open: "Submit". The step expects the board to take the post: it ends on the topic,
 * or on the notice of the board when the post waits for approval. "try to" expects nothing: assert the errors
 * of the editor with the next step.
 *
 * Example #1: When I submit the post
 * Example #2: When I try to submit the post
 * Example #3: And we submit the post
 * Example #4: And we try to submit the post
 * Example #5: Then I submit the post
 */
When(/^(?:I|we) (try to )?submit the post$/, { timeout: 90000 }, async function (tryCase) {
  if (tryCase) await submitEditor(this);
  else await submitEditorOk(this);
});

/**
 * Assert an error of the editor that is open, shown above its fields (a part of it is enough).
 *
 * Example #1: Then the editor should show the error "You must specify a subject when posting a new topic."
 * Example #2: Then the editor should show the error "Your message contains too few characters."
 * Example #3: And the editor should show the error "too few characters"
 * Example #4: Then the editor should show the error "You must specify a subject when composing a new message."
 * Example #5: And the editor should show the error "The requested users to be added do not exist."
 */
Then(/^the editor should show the error "([^"]*)"$/, async function (expected) {
  await h.editor(this);
  const errors = await h.formErrors(this.page);
  if (!errors.some((e) => h.mentions(e, expected))) {
    throw friendly({ message: `The editor does not show the error "${expected}". Its errors: ${h.listed(errors)}.`, hint: 'Send the editor first: When I try to submit the post' });
  }
});

/**
 * Attach a file to the post in the editor that is open, with the uploader of its "Attachments" tab. The path
 * is from the folder the suite runs in. The step expects the board to take the file; "try to" expects
 * nothing: assert the refusal with the next step.
 *
 * Example #1: When I attach the file "tests/fixtures/webship-test-picture.png" in the editor
 * Example #2: When I try to attach the file "tests/fixtures/webship-test-notes.txt" in the editor
 * Example #3: And we attach the file "tests/fixtures/webship-test-picture.png" in the editor
 * Example #4: And we try to attach the file "tests/fixtures/webship-test-notes.txt" in the editor
 * Example #5: Then I attach the file "tests/fixtures/webship-test-picture.png" in the editor
 */
When(/^(?:I|we) (try to )?attach the file "([^"]*)" in the editor$/, { timeout: 90000 }, async function (tryCase, file) {
  const outcome = await attach(this, file);
  this.__attachOutcome = outcome;
  if (!tryCase && !outcome.ok) {
    throw friendly({ message: `The board refused the file "${file}": "${outcome.error}".`, hint: 'The board takes the file types of its allowed extension groups, up to its size limit (the administration control panel, Posting, Attachments).' });
  }
});

/**
 * Assert that the board refused the file of the step before with an error (a part of it is enough), which its
 * uploader shows in an alert over the page. The step closes the alert.
 *
 * Example #1: Then the attachment should be refused with "Invalid file extension"
 * Example #2: Then the attachment should be refused with "Invalid file extension: webship-test-notes.txt"
 * Example #3: And the attachment should be refused with "Invalid file extension"
 * Example #4: Then the attachment should be refused with "is too large"
 * Example #5: And the attachment should be refused with "extension"
 */
Then(/^the attachment should be refused with "([^"]*)"$/, async function (expected) {
  const outcome = this.__attachOutcome;
  if (!outcome) throw friendly({ message: 'No file was given to the editor in this scenario.', hint: 'Attach one first: When I try to attach the file "…" in the editor' });
  if (outcome.ok || !h.mentions(outcome.error, expected)) {
    throw friendly({ message: outcome.ok ? 'The board took the file.' : `The board refused the file with "${outcome.error}", not with "${expected}".`, hint: 'The uploader refuses a file type the board does not allow before it sends it.' });
  }
  await h.closeAlert(this);
});

/**
 * Assert that the editor that is open lists an attachment under its "Attachments" tab, by its file name, or
 * does not.
 *
 * Example #1: Then the editor should list the attachment "webship-test-picture.png"
 * Example #2: Then the editor should not list the attachment "webship-test-notes.txt"
 * Example #3: And the editor should list the attachment "webship-test-picture.png"
 * Example #4: And the editor should not list the attachment "webship-test-picture.png"
 * Example #5: Then the editor should list the attachment "photo.jpg"
 */
Then(/^the editor should (not )?list the attachment "([^"]*)"$/, async function (notCase, name) {
  await h.editor(this);
  const names = (await this.page.locator('#file-list tr.attach-row .file-name').allTextContents()).map(h.clean);
  const has = names.some((n) => h.normal(n) === h.normal(name));
  if (has === !!notCase) {
    throw friendly({ message: `The editor ${has ? 'lists' : 'does not list'} the attachment "${name}". Its attachments: ${h.listed(names)}.`, hint: 'The "Attachments" tab under the editor lists the files of the post.' });
  }
});

/**
 * Reply to the topic on screen in one step, as a person does: "Post Reply", the message, "Submit". The step
 * ends on the topic, at the new post, or on the notice of the board when the post waits for approval.
 *
 * Example #1: When I reply to the topic with "Webship test reply."
 * Example #2: When we reply to the topic with "Webship test: a second reply."
 * Example #3: And I reply to the topic with "Webship test reply with [b]bold[/b]."
 * Example #4: And we reply to the topic with "Webship test reply."
 * Example #5: Then I reply to the topic with "Webship test: thanks."
 */
When(/^(?:I|we) reply to the topic with "([^"]*)"$/, { timeout: 90000 }, async function (text) {
  await barButton(this, 'reply', 'Post Reply');
  const ed = await h.editor(this);
  await ed.message.fill(text);
  await submitEditorOk(this);
});

/**
 * Reply to the topic on screen with the quick reply under its posts: the message, "Submit". The step ends on
 * the topic, at the new post.
 *
 * Example #1: When I quick reply with "Webship test quick reply."
 * Example #2: When we quick reply with "Webship test: a short answer."
 * Example #3: And I quick reply with "Webship test quick reply."
 * Example #4: And we quick reply with "Webship test: yes."
 * Example #5: Then I quick reply with "Webship test quick reply."
 */
When(/^(?:I|we) quick reply with "([^"]*)"$/, { timeout: 90000 }, async function (text) {
  const page = this.page;
  const form = page.locator('form#qr_postform').first();
  if (!(await form.count())) {
    throw friendly({ message: `The page has no quick reply: ${await h.pageSummary(this)}.`, hint: h.hintFor(this, 'The quick reply shows under a topic when it is on for the board and the forum, the topic is open and the account may reply.') });
  }
  await form.locator('textarea[name="message"]').fill(text);
  await h.send(this, form.locator('input[name="post"]'));
  if (await page.locator('form#postform').count()) {
    throw friendly({ message: `The board did not take the quick reply: ${h.listed(await h.formErrors(page))}.`, hint: 'The board opens the full editor with the errors of a quick reply it refuses.' });
  }
});

/**
 * Assert that the page offers the quick reply under the topic, or does not (a locked topic, a visitor).
 *
 * Example #1: Then I should see the quick reply
 * Example #2: Then I should not see the quick reply
 * Example #3: And we should see the quick reply
 * Example #4: And we should not see the quick reply
 * Example #5: Then I should not see the quick reply
 */
Then(/^(?:I|we) should (not )?see the quick reply$/, async function (notCase) {
  const has = (await this.page.locator('form#qr_postform').count()) > 0;
  if (has === !!notCase) {
    throw friendly({ message: `The page ${has ? 'offers' : 'does not offer'} the quick reply: ${await h.pageSummary(this)}.`, hint: 'The quick reply shows under a topic when it is on for the board and the forum, the topic is open and the account may reply.' });
  }
});

/**
 * Assert that the forum or the topic on screen takes no new post from the account: it offers no "New Topic"
 * (a forum) or no "Post Reply" (a topic), and with "because it is locked", it shows "Locked" instead.
 *
 * Example #1: Then I should not be able to start a topic
 * Example #2: Then I should not be able to reply
 * Example #3: And I should not be able to start a topic because it is locked
 * Example #4: And we should not be able to reply because it is locked
 * Example #5: Then we should not be able to start a topic
 */
Then(/^(?:I|we) should not be able to (start a topic|reply)( because it is locked)?$/, async function (what, lockedCase) {
  const page = this.page;
  const mode = what === 'reply' ? 'reply' : 'post';
  // "Post Reply" and "New Topic" stay as links for an account that may not post, and lead to a refusal: the
  // lock shows in the button itself.
  const button = page.locator(`.action-bar.bar-top a.button[href*="mode=${mode}"]`).first();
  const locked = (await page.locator('.action-bar.bar-top a.button .fa-lock').count()) > 0;
  if (lockedCase) {
    if (!locked) throw friendly({ message: `The page does not show "Locked": ${await h.pageSummary(this)}.`, hint: 'A locked forum or topic shows "Locked" where an open one shows "New Topic" or "Post Reply".' });
    return;
  }
  if (locked || !(await button.count())) return;
  await h.afterNavigation(this, () => button.click());
  if (await page.locator('form#postform').count()) {
    throw friendly({ message: `The account can ${what}: the editor opened; ${await h.pageSummary(this)}.`, hint: 'An account posts where its permissions allow it and the forum and the topic are open.' });
  }
});

/**
 * Delete a post of the topic on screen (the post by its number on the page, or the last one): "Delete post" on
 * the post, then the confirmation. With "permanently" the post is removed; without, it is deleted softly: it
 * stays for the moderators, who can restore it. The step ends on the topic, or on the forum when the topic
 * went with its only post.
 *
 * Example #1: When I delete the last post
 * Example #2: When I delete the last post permanently
 * Example #3: And we delete post 2
 * Example #4: And we delete post 2 permanently
 * Example #5: Then I delete the last post permanently
 */
When(/^(?:I|we) delete (?:post (\d+)|the last post)( permanently)?$/, { timeout: 90000 }, async function (number, permanently) {
  const page = this.page;
  const post = await h.postAt(this, number);
  const button = post.locator.locator('.post-buttons a[href*="mode=soft_delete"], .post-buttons a[href*="mode=delete"]').first();
  if (!(await button.count())) throw friendly({ message: `Post ${post.number} (by ${post.author}) offers no "Delete post" to this account.`, hint: 'An account deletes its own post while it is the last of the topic; a moderator deletes any post.' });
  await h.afterNavigation(this, () => button.click());
  await h.confirm(this, {
    fill: async (form) => {
      const box = form.locator('#delete_permanent, input[name="delete_permanent"]').first();
      if (permanently) {
        if (await box.count()) await box.check();
      } else if (await box.count()) {
        await box.uncheck();
      }
    },
  });
  await h.expectNotice(this, 'deleted successfully', 'The board answers a deletion with "This post has been deleted successfully.".');
  if (!(await h.followNotice(this, /topic/i))) await h.followNotice(this, /forum/i);
});

module.exports = { startTopic, submitEditor, submitEditorOk, barButton, attach };

<p align="center"><img src="https://raw.githubusercontent.com/webship/phpbb-steps/2.0.x/assets/logo.svg" alt="phpBB logo" width="96"></p>

# phpbb-steps

[![Test](https://github.com/webship/phpbb-steps/actions/workflows/test.yml/badge.svg)](https://github.com/webship/phpbb-steps/actions/workflows/test.yml)

Cucumber step definitions for phpBB boards, with [webship-js](https://webship.co/docs/webship-js/2.0.x), a BDD
browser automation harness built on Playwright and Cucumber-js.

Every phpBB board has the same pages, whatever its forums are about: the board index, a forum and its topics, a topic
and its posts, the editor, private messages, the search, and the three control panels (the user's, the moderator's,
the administrator's). `@webship-js/phpbb-steps` covers them, on the default style:

- **the session**: the login page and its refusals (a wrong password, an unknown user name, an empty password),
  logging in by a handle of the users registry or taking over an account's session from earlier in the run, logging
  out, who is logged in, the pages an account may not open, the password reset through the mail, and the refusals
  of the registration form (a suite never completes a registration);
- **the board index and a forum**: the categories and the forums an account sees, their counters and marks
  (locked, unread, a subforum), a forum's announcements, sticky topics and topics, their replies and authors, its
  pages and its sorting, the breadcrumbs, the figures of the board, and the notice the board answers an action with;
- **a topic**: its posts by their number on the page (who wrote them, what they say, what they quote, their
  attachments), whether it is locked, its poll (the options, a vote, a vote changed), the bookmark and the
  subscription of the account;
- **posting**: a new topic, a reply, a quote and an edit in the editor, its preview with the BBCode drawn, its
  errors, an attachment the board takes and one it refuses, the quick reply, a post deleted softly or for good;
- **private messages**: the inbox, the outbox and the sent messages, a message read, sent, answered and deleted,
  and the counter of unread messages;
- **search**: the search box, the advanced search (as posts or topics, by an author, in a forum), the results and
  their highlights, and the quick links (your posts, unanswered topics, active topics);
- **the user control panel**: its tabs and pages, a setting by its label (a field, a list, a group of choices), the
  profile, the preferences, the signature, drafts kept, loaded again and deleted, the members list, a profile, and
  the notifications menu;
- **the moderator control panel**: the approval queue (the posts of a newly registered user wait there), a topic
  approved or disapproved, a post reported and its report closed or deleted, the quick moderator tools of a topic
  (lock, unlock, move, split, delete), and the moderator log;
- **the administration control panel**, read only: its way in (the password asked once more), its tabs and pages,
  the board settings by their labels, the forum administration, and the figures of the board;
- **test content**: a topic and a reply a scenario starts from, posted by the account that owns them, a private
  message from another account, and their removal.

No step phrase names the platform: a scenario reads `When I start a new topic in "General discussion"` and
`Then the approval queue should list the topic "Webship test topic of a new member"`.

CI builds a real board with [DDEV](https://ddev.com) on the runner, from the release package with its own
command-line installer, on two PHP lines, and runs the suite twice on every push and pull request, then the
assertions that must fail; see [The test site](#the-test-site) and
[`.github/workflows/test.yml`](.github/workflows/test.yml).

## From nothing to a green run

What the machine needs: Docker, [DDEV](https://ddev.com), git, Python 3, and Node.js 24 or later with npm. The board
is installed and run in its containers, with the PHP of its web image: no PHP on the machine, no public domain and no
account anywhere.

**1. The site.** The pack's own build script (the one CI runs) makes a DDEV project with a board at the current
release (phpBB 3.3.19), its default style, four accounts and the test content (see [The test site](#the-test-site)).
It takes about a minute and a half.

```bash
git clone https://github.com/webship/phpbb-steps.git
SITE_DIR="$PWD/phpbb-site" phpbb-steps/.github/scripts/build-ddev-site.sh
```

The board answers at `https://phpbbsteps.ddev.site`, its mail catcher at `https://phpbbsteps.ddev.site:8026`. The
accounts are `administrator` (a founder), `moderator` (a global moderator), `member` (a registered user) and
`newmember` (a newly registered user, whose posts wait for approval), each logging in with its user name and the
password `dD.123123ddd`.

In the [Webship Workspace](https://github.com/webship/workspace), its phpBB plugin builds the same board instead, in a
sites folder of the workspace (`dev/` here, the one `--with-needs` adds to a new workspace; `test/`, `sandboxes/`
and `demos/` work the same):

```bash
bash core/scripts/plugins.sh --require phpbb --with-needs
bash core/scripts/plugins.sh --activate phpbb --with-needs
bash core/scripts/plugins.sh --install phpbb
bash dev/cmd-phpbb-project.sh phpbbsite --install --add-users --sample-content
```

That board answers at `https://phpbbsite.ddev.site`. Its accounts are the plugin's: the same four, at `example.com`,
with the workspace's shared password `dD.123123ddd`, and the workspace account as the founder the installer makes.
Without `--sample-content` the board has only what its installer makes ("Your first forum" with its welcome topic):
the first feature below runs there too, the features of this repository need the test content.

**2. A test project.**

```bash
mkdir phpbb-tests && cd phpbb-tests
npm init -y
npm install --save-dev webship-js @webship-js/phpbb-steps
npx init-webship-js
```

`npx init-webship-js` writes `cucumber.js`, `playwright.config.ts`, the `tests/` folders with a first feature and the
`npm test` scripts, and installs Chromium. npm usually runs it already when it installs webship-js; a second run
changes nothing. Its first feature opens the board's index: it passes, and can stay.

**3. `cucumber.js`.** Replace the file with the wiring of the pack: the step files of webship-js and of the pack,
the tags that keep the assertions that must fail out of a normal run, the mail catcher, the account that removes
test content, and the accounts (the JSON of [Test users](#test-users)). The first lines are the starter's own: a
feature named on the command line runs alone (step 5).

```javascript
// A feature file or a scenario (file:line) named on the command line runs alone:
// cucumber-js 12 would add it to the paths below, so `paths` is left empty then.
const OPTIONS_WITH_A_VALUE = new Set([
  '-c', '--config', '-f', '--format', '--format-options', '--i18n-keywords',
  '-i', '--import', '-l', '--loader', '--language', '--name', '--order',
  '-p', '--profile', '--parallel', '--plugin', '--plugin-options',
  '-r', '--require', '--require-module', '--retry', '--retry-tag-filter',
  '--shard', '-t', '--tags', '--world-parameters',
]);

function commandLinePaths() {
  if (!/cucumber(-js|\.js)?$/.test(String(process.argv[1] || ''))) return [];
  const args = process.argv.slice(2);
  const paths = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i].startsWith('-')) {
      if (OPTIONS_WITH_A_VALUE.has(args[i])) i += 1;
    } else {
      paths.push(args[i]);
    }
  }
  return paths;
}

const launchUrl = (process.env.LAUNCH_URL || 'https://phpbbsteps.ddev.site').replace(/\/+$/, '');

module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: [
      'node_modules/webship-js/tests/step-definitions/**/*.js',
      'node_modules/@webship-js/phpbb-steps/tests/step-definitions/**/*.js',
      'tests/step-definitions/**/*.js',
    ],
    paths: commandLinePaths().length ? [] : ['tests/features/**/*.feature'],
    // Work in progress and the assertions that must fail stay out of a normal run.
    tags: 'not @wip and not @must-fail',
    format: ['@cucumber/pretty-formatter', 'json:tests/reports/cucumber_report.json'],
    worldParameters: {
      launchUrl,
      // The mail catcher the board sends its mail to.
      mailUrl: `${launchUrl}:8026`,
      // The account that prepares and removes test content for the Given steps: one that moderates every forum.
      moderator: 'moderator',
      // Browser messages: the board's own pages raise none. The browser logs every error status it gets ("Failed
      // to load resource: … 403", "… 404"): the scenarios of a refusal the board answers with one carry @js-off.
      javascript: { mode: 'warn', levels: ['error'], beforeScenario: false, afterScenario: true },
      minWaitTime: { page: 3000, before_scenario: 0, after_scenario: 0, before_step: 0, after_step: 0 },
      users: {
        administrator: { username: 'administrator', password: 'dD.123123ddd', email: 'administrator@example.com' },
        moderator: { username: 'moderator', password: 'dD.123123ddd', email: 'moderator@example.com' },
        member: { username: 'member', password: 'dD.123123ddd', email: 'member@example.com' },
        newmember: { username: 'newmember', password: 'dD.123123ddd', email: 'newmember@example.com' },
      },
    },
  },
};
```

On the board from the Webship Workspace (step 1) the accounts are the same; its address goes in `LAUNCH_URL`
(step 5), and the mail catcher follows it.

**4. A first feature**, `tests/features/first-run.feature`:

```gherkin
Feature: First run
  Scenario: A visitor sees the first forum of the board, and the member logs in
    Given I am not logged in
    Then the board index should list the forum "Your first forum" in the category "Your first category"
    When I log in as "member" with the login form
    Then I should be logged in as "member"
    And I should not see the link to the moderator control panel

  Scenario: The moderator has the moderator control panel
    Given I am a logged in user with the "moderator" user
    When I go to the moderator control panel
    Then the control panel should offer the tab "Moderation queue"
    And the approval queue should not list the topic "Webship test topic that is not there"
```

**5. Run it.** Set `LAUNCH_URL` to the address of the board: `https://phpbbsteps.ddev.site` for the build script's
site, `https://phpbbsite.ddev.site` for the Workspace's.

```bash
LAUNCH_URL=https://phpbbsteps.ddev.site npm test
```

A green first run prints every step, then the summary (the scenarios above and the starter's, passed) and the HTML
report it wrote:

```
3 scenarios (3 passed)
11 steps (11 passed)
0m06.323s (executing steps: 0m06.284s)
[webship-js] HTML report → …/phpbb-tests/tests/reports/cucumber_report.html
```

One feature runs alone when the command line names it (a scenario too, with its line):

```bash
LAUNCH_URL=https://phpbbsteps.ddev.site npx cucumber-js tests/features/first-run.feature
```

From there, copy the features of [`tests/features/`](tests/features/), which ship in the package, and the two
files they attach (the steps read them from the folder the suite runs in):

```bash
cp node_modules/@webship-js/phpbb-steps/tests/features/*.feature tests/features/
mkdir -p tests/fixtures && cp node_modules/@webship-js/phpbb-steps/tests/fixtures/* tests/fixtures/
```

They use every step of the pack, run as they are on the board of either way of step 1 (the Workspace's with
`--sample-content`), and take away what they make. Their names say what they hold (`board.feature`,
`posting.feature`, `moderation.feature`, …): none is called like the first feature a test project or the Workspace
starts with (`check-homepage.feature`, `first-run.feature`, `site.feature`), so copying them replaces nothing.

For your own board, point `launchUrl` at it, `mailUrl` at the mail catcher its mail goes to, `moderator` at an
account that may moderate every forum, and `users` at its test accounts (`username` and `password`; `email` for the
mail steps). The steps read what the board draws the same way on every site with the default style; a board with
another style or another language is read with webship-js's `I should see "…"` where its words differ. Two settings
of a board matter to a suite, which posts far faster than a person: the waiting time between two posts (the flood
interval) and the limit of failed logins; see [The test site](#the-test-site).

### What the suite tests

The features of this repository run every step of the pack against a real board, on two PHP lines, twice in a row
in CI on every change:

- `tests/features/` (51 scenarios): the login of an account, a session taken over, the refusals of the login form
  (a wrong password, an unknown user name, an empty password), a visitor sent to the login page for a forum of the
  staff and on to it after the login, the pages a member may not open; the password reset through its mail and its
  link, and no mail for an unknown address; the refusals of the registration form (a taken user name and address,
  two passwords that differ, an empty form); the board index as a visitor and as a moderator see it, the counters
  and marks of its forums; a forum's announcement, sticky topic, topics and subforum, its two pages, its sorting; a
  topic of two pages, a locked topic and a locked forum, what a visitor may not do, a poll voted in and the vote
  changed, a bookmark and a subscription set and taken back, a topic written with BBCode; a topic started with its
  preview, a quote, the quick reply, an edit, a post deleted, an attachment the board takes and one it refuses;
  private messages read, sent, answered and deleted on both sides, with their counter and their notification, and
  the errors of a message without a recipient, a subject or a text; the search box, the advanced search, what a
  search hides from a member, the quick links; the pages of the user control panel, the profile, a preference and
  the signature changed and put back, a draft kept, loaded and deleted, the members list and a profile; the
  moderator control panel, the topic of a new member approved and another disapproved, a post reported and the
  report closed, a topic locked, unlocked, moved, split and deleted, the moderator log; the administration control
  panel: who is offered it, its first page, the board settings, the forum administration;
- `tests/must-fail/` (103 scenarios): an assertion that is not true for each kind of step, which must fail with its
  message and a hint.

Not tested: styles other than the default one and languages other than British English (the steps read the board's
words: "New Topic", "Post Reply", "Topics awaiting approval"), extensions, a completed registration and the
activation of an account, the visual confirmation (CAPTCHA), avatars, user groups and their management, friends and
foes, warnings, bans and user notes, merging topics and moving single posts, the reports of private messages,
feeds, the contact page, and everything the administration control panel changes: it is read, never written.

## Requirements

- Node.js 24 or later
- A webship-js 2.0 test project (webship-js 2.0.16 or later)
- A phpBB 3.3 board with its default style in British English, its accounts for the suite, and a mail catcher for
  the mail steps

## Install

```bash
npm install --save-dev @webship-js/phpbb-steps
```

## The test site

[`.github/scripts/build-ddev-site.sh`](.github/scripts/build-ddev-site.sh) builds the board the suite of this
repository runs against:

- [phpBB](https://www.phpbb.com) (GPL-2.0) from its release package (`PHPBB_VERSION`: 3.3.19 by default), checked
  against the sum its publisher gives beside it, installed with its own command-line installer
  (`install/phpbbcli.php install`) on the project's database; the folder of the installer is removed after the
  install, as the board asks;
- a PHP DDEV project (`PHP_VERSION`: 8.3 by default, the newest the release supports; CI also runs 8.1) served by
  Apache with the release's own rules, MariaDB from DDEV, the mail catcher of DDEV for the board's mail (SMTP on
  `localhost:1025`), Node.js 24 for a suite run in the container;
- the default style and British English, as the release ships them; the extension the release bundles and its
  installer turns on (a link service of a company) is turned off and taken out of the database: the suite runs on
  the board itself, with no outside service;
- the settings of a test run, set by [`site/phpbb-site.php`](site/phpbb-site.php) with the board's own code: no
  waiting time between two posts, two messages or two searches, no limit of failed logins and no visual
  confirmation on the registration form (every request of a run comes from one address), mail sent at once instead
  of in batches, the quick reply on, and a newly registered user kept in that group whatever the number of its
  posts;
- the accounts of [Test users](#test-users), made through the board's own functions;
- the test content: the category "Community" with the forums "General discussion" (an announcement, a sticky
  topic, a topic of 13 posts, a poll, a subforum "Introductions"), "Help and support" (27 topics: two pages) and
  "Archive" (locked), the category "Staff" with "Staff room" (moderators and administrators only), and two private
  messages to `member`. The forum and the topic the installer makes stay as they are.

Run again with `ACCOUNTS_ONLY=1` and the same `SITE_DIR`, the build script puts the accounts back as they were made;
with `TIDY_ONLY=1` it removes what a run that was stopped half way left (the test content a scenario makes is titled
"Webship test …").

## How the steps find things and wait

- **By what a person reads.** A forum, a topic and a message by their titles, a post by its number on the page, a
  page of a control panel by its tab and its entry in the menu, a setting by its label, an account by a handle of
  the users registry. What the board draws the same way on every site with the default style is the fallback: the
  rows of its lists (`li.row`, `a.forumtitle`, `a.topictitle`) and their marks (`topic_read_locked`, `sticky_read`,
  `announce_read`), the posts (`.post`, `.postprofile`, `.content`), the editor (`form#postform`), the notice
  (`#message`), the panels (`#cp-main`, `#tabs`).
- **The board's own signals, no fixed sleeps.** The pages are drawn on the server: a step that acts waits for the
  page it leads to. The few things that happen in the page (a vote, a bookmark, a quick moderator tool, an upload)
  are waited for by what the board shows: its loading indicator, its alert or its confirmation over the darkened
  page, the row of an uploaded file marked as uploaded, the tool turned into its opposite.
- **A form is not sent in the second it was made.** The board refuses such a form ("The submitted form was invalid.
  Try submitting again."): its form token carries the time it was made, and no time at all is not a person. A step
  that sends a form waits until the page that holds it is a second old, by the browser's own timing of the page.
- **The notice of an action is kept for the next step.** The board answers many actions with a notice page
  ("Information"), which goes on by itself after three seconds to the page it names. `the board should say "…"`
  reads the notice on screen, or the one the step before ended on.
- **Who is logged in** is what the board shows at the top of its pages.
- **The administration control panel** is entered by its link at the foot of the board, with the password of the
  account once more, as the board asks: its addresses carry the session, and its bare address leads back to the
  board index.
- **The mail** is read from the mail catcher's API (`mailUrl`, a Mailpit): only the mail that came since the scenario
  began.
- **Test content comes and goes.** A scenario names what it makes "Webship test …", starts from a board without it
  (`Given there is no topic "…"`, `Given "member" has no message "…"`) and takes it away. A Given step that needs
  another account (`there is a topic "…" in "…" by "member"`) works in a browser page of its own: the page of the
  scenario and its session stay as they are.
- **Failures say what was found.** `The forum "General discussion" lists no topic "Sourdough". On this page: "Board
  rules", "Start here: how this board works", …`, `The moderator tools of the topic offer no "Unlock topic". They
  offer: "Lock topic", "Delete topic", …`, with a hint on where to look.

## Accounts

The suite never creates or deletes an account. Accounts are configuration: list the ones the board has in
`worldParameters.users`, by a handle the scenarios use, each with its `username` and `password`, and its `email` for
the mail steps. An account that logged in once keeps its session for the rest of the run (`reuseSessions: false`
turns it off); a logout ends it. Registration is tested only through the refusals of its form.

## Test users

The accounts this repository's suite logs in as, exactly as `cucumber.js` lists them in `worldParameters.users` (the
default values; the `<HANDLE>_PASSWORD` variables replace them). The build script makes them; the Workspace's phpBB
plugin makes the same four.

```json
{
  "administrator": { "username": "administrator", "password": "dD.123123ddd", "email": "administrator@example.com" },
  "moderator": { "username": "moderator", "password": "dD.123123ddd", "email": "moderator@example.com" },
  "member": { "username": "member", "password": "dD.123123ddd", "email": "member@example.com" },
  "newmember": { "username": "newmember", "password": "dD.123123ddd", "email": "newmember@example.com" }
}
```

`administrator` is a founder: it administers the board, and moderates every forum. `moderator` is a global
moderator: it has the moderator control panel, in every forum. `member` is a registered user. `newmember` is a newly
registered user: its posts wait for a moderator's approval. They are accounts of a throwaway test site, with a
placeholder password, not accounts of any real one.

## Steps

### `phpbb-session.steps.js` (15)

- `Given I am a logged in user with the "member" user`
- `When I log in as "member" with the login form`
- `When I log in with the username "nobody" and the password "Wrong-password-1"`
- `Then the login should be refused with "You have specified an incorrect password."`
- `Given I am not logged in`
- `When I log out`
- `Then I should be logged in as "member"`
- `Then I should be logged in`
- `Then I should be on the login page`
- `Then I should not be allowed to open "/mcp.php"`
- `When I ask for a password reset link for "member"`
- `When I set the password of "member" on the reset page`
- `When I open the registration form`
- `When I try to register with the username "member", the email "someone@example.com" and the passwords "dD.123123ddd" and "dD.123123ddd"`
- `Then the registration should be refused with "The username you entered is already in use, please select an alternative."`

### `phpbb-board.steps.js` (18)

- `Given I am on the board index`
- `Then the board index should list the forum "General discussion"`
- `Then the forum "Help and support" on the board index should have 27 topics`
- `Then the forum "Archive" on the board index should be locked`
- `When I open the forum "General discussion"`
- `When I try to open the forum at "/viewforum.php?f=9"`
- `Then I should be in the forum "General discussion"`
- `Then the forum should list the topic "Weekend baking thread"`
- `Then the topic "Board rules" in the forum should be an announcement`
- `Then the topic "Weekend baking thread" in the forum should have 12 replies`
- `Then the forum should have 27 topics`
- `When I go to page 2`
- `Then I should be on page 2`
- `When I sort the topics by "Subject" in "Ascending" order`
- `Then the first topic of the forum should be "A walk along the river"`
- `Then the breadcrumbs should be "Board index", "Community" and "General discussion"`
- `Then the board should say "You are not authorised to read this forum."`
- `Then the board statistics should show "Total members" as "5"`

### `phpbb-topic.steps.js` (14)

- `When I open the topic "Weekend baking thread" in "General discussion"`
- `Then I should be reading the topic "Weekend baking thread"`
- `Then the topic should have 13 posts`
- `Then post 1 should be by "member"`
- `Then post 1 should read "What is in your oven this weekend?"`
- `Then the last post should quote "What is in your oven this weekend?"`
- `Then the last post should show the attachment "webship-test-picture.png"`
- `Then the topic should be locked`
- `Then the topic should have the poll "Which season do you like best?"`
- `When I vote for "Summer" in the poll`
- `Then the poll should show 1 vote for "Summer"`
- `When I bookmark the topic`
- `When I remove the bookmark of the topic`
- `Then the topic should be bookmarked`

### `phpbb-posting.steps.js` (19)

- `When I start a new topic in "General discussion"`
- `When I start a reply to the topic`
- `When I quote post 1 in a reply`
- `When I edit the last post`
- `When I write the subject "Webship test topic" in the editor`
- `When I write "Webship test: the first post of a topic." in the editor`
- `Then the editor should have the subject "Re: Weekend baking thread"`
- `When I preview the post`
- `Then the preview should show "Webship test: the first post of a topic."`
- `When I submit the post`
- `Then the editor should show the error "You must specify a subject when posting a new topic."`
- `When I attach the file "tests/fixtures/webship-test-picture.png" in the editor`
- `Then the attachment should be refused with "Invalid file extension"`
- `Then the editor should list the attachment "webship-test-picture.png"`
- `When I reply to the topic with "Webship test reply."`
- `When I quick reply with "Webship test quick reply."`
- `Then I should see the quick reply`
- `Then I should not be able to start a topic`
- `When I delete the last post`

### `phpbb-messages.steps.js` (12)

- `When I go to my inbox`
- `Then my messages should list "Welcome to the board"`
- `Then the message "Webship test message" should be unread`
- `When I open the message "Welcome to the board"`
- `Then the message should be from "administrator"`
- `When I send the message "Webship test message" to "moderator" with "Webship test: a private message."`
- `When I try to send the message "Webship test message" to "webship-test-nobody" with "Webship test."`
- `When I reply to the message with "Webship test: an answer."`
- `When I delete the message "Webship test message"`
- `Then I should have 1 unread message`
- `Given "member" has no message "Webship test message"`
- `Given "moderator" sent the message "Webship test message" to "member" with "Webship test: a word from the moderator."`

### `phpbb-search.steps.js` (8)

- `When I search for "sourdough"`
- `When I search the posts for "sourdough"`
- `Then the search should find 2 matches`
- `Then the search results should show "Weekend baking thread"`
- `Then the search results should highlight "sourdough"`
- `When I open the search result "Weekend baking thread"`
- `When I open the quick link "Your posts"`
- `Then the search page should be "Your posts"`

### `phpbb-panels.steps.js` (22)

- `When I go to the user control panel`
- `When I open "Edit signature" under "Profile" in the user control panel`
- `Then the control panel should show the page "Edit signature"`
- `Then the control panel should offer the tab "Moderation queue"`
- `When I set the setting "Location" to "Webship test town"`
- `Then the setting "Location" should be "Webship test town"`
- `When I save the settings`
- `When I set my signature to "Webship test signature."`
- `Then my signature should be "Webship test signature."`
- `When I save the post as a draft`
- `Then my drafts should list "Webship test draft"`
- `When I load the draft "Webship test draft"`
- `When I go to the members list`
- `Then the members list should list "member"`
- `When I open the profile of "member"`
- `Then the profile should show "Username: member"`
- `When I open the notifications menu`
- `Then the notifications menu should list "Private Message from moderator"`
- `Then the board statistic "Board version" should be "3.3"`
- `Then the forum administration should list "Community"`
- `When I open "Community" in the forum administration`
- `Then I should see the link to the moderator control panel`

### `phpbb-moderation.steps.js` (11)

- `When I report post 2 as "off topic"`
- `Then the open reports should list "Re: Webship test topic"`
- `When I close the report of "Re: Webship test topic"`
- `Then the approval queue should list the topic "Webship test topic of a new member"`
- `When I approve the topic "Webship test topic of a new member"`
- `When I lock the topic`
- `When I move the topic to "Help and support"`
- `When I split the topic from post 2 into "Webship test topic, split"`
- `When I delete the topic`
- `Then I should see the moderator tools`
- `Then the moderator log should show "Locked topic"`

### `phpbb-mail.steps.js` (4)

- `Then an email with the subject "Account password reset" should be sent to "member"`
- `Then no email should be sent to "nobody@example.com"`
- `Then the email with the subject "Account password reset" to "member" should contain "Hello member"`
- `When I open the link of the email with the subject "Account password reset" to "member"`

### `phpbb-content.steps.js` (4)

- `Given there is no topic "Webship test topic"`
- `Given there is a topic "Webship test topic" in "General discussion" by "member"`
- `Given there is a topic "Webship test topic" in "General discussion" by "member" with:`
- `Given "moderator" replied to the topic "Webship test topic" in "General discussion" with "Webship test reply of the moderator."`

Text, links, buttons, fields and status codes are webship-js's own steps (`I should see "…"`, `I press "…"`,
`I go to "…"`, `the response status code should be 404`); this pack adds what the board decides. Some steps take
more than their first example shows: `I open the topic "…" in "…"`, `the last post should quote "…" by "…"`,
`I report the last post as "…" with "…"`, `I move the topic to "…" leaving a shadow topic`,
`I split the topic from post 3 into "…" in "…"`, `I delete the topic permanently`,
`the poll should show my vote for "…"`, `I should be on the login page saying "…"`; the JSDoc of each step lists
five.

## Phrases shared with other packs

The session phrases are the ones every platform pack has, so a feature reads the same on every system (one
`cucumber.js` profile per system; the platform packs are not meant to be loaded together). The phrases of a forum
(a topic, its posts, a reply, a quote, messages, the notifications menu) are those of the other forum pack
(Discourse), so a scenario of a forum reads the same on both. Loaded beside each of the 39 other packs, these phrases
of this pack also match one of theirs:

| Phrase of this pack | Also in |
| --- | --- |
| `I am a logged in user with the "…" user` | aspnet-core, codeigniter, discourse, django, django-cms, drupal-core, joomla, keycloak, laravel, mediawiki, moodle, nextcloud, nextjs, odoo, payload, spring-boot, strapi, symfony, typo3, wagtail, wordpress |
| `I log out` | aspnet-core, codeigniter, discourse, django, django-cms, drupal-core, keycloak, laravel, mediawiki, moodle, nextcloud, nextjs, odoo, payload, spring-boot, strapi, symfony, typo3, wagtail, wordpress |
| `I should be logged in` | aspnet-core, codeigniter, discourse, django, django-cms, drupal-core, keycloak, laravel, mediawiki, moodle, nextcloud, nextjs, odoo, payload, spring-boot, strapi, symfony, typo3, wagtail, wordpress |
| `I should be logged in as "…"` | aspnet-core, backdrop-cms, codeigniter, discourse, django, keycloak, laravel, mediawiki, moodle, nextcloud, nextjs, odoo, payload, spring-boot, strapi, symfony, typo3, wagtail |
| `I am not logged in` | aspnet-core, discourse, django, django-cms, drupal-core, joomla, keycloak, nextcloud, odoo, payload, spring-boot, strapi, typo3, wagtail, wordpress |
| `I log in as "…" with the login form` | aspnet-core, codeigniter, discourse, django, keycloak, laravel, mediawiki, moodle, nextcloud, nextjs, payload, spring-boot, strapi, symfony, wagtail |
| `the login should be refused with "…"` | aspnet-core, discourse, django, keycloak, mediawiki, nextcloud, payload, spring-boot, strapi, wagtail |
| `I log in with the username "…" and the password "…"` | aspnet-core, discourse, keycloak, moodle, nextcloud, spring-boot, symfony, wagtail |
| `I should not be allowed to open "…"` | aspnet-core, discourse, django, django-cms, payload, spring-boot, strapi, wagtail |
| `no email should be sent to "…"` | aspnet-core, codeigniter, keycloak, laravel, nextcloud, symfony, wagtail, woocommerce |
| `I should be on the login page` | aspnet-core, discourse, keycloak, nextcloud, spring-boot, wagtail, wordpress |
| `an email with the subject "…" should be sent to "…"` | aspnet-core, codeigniter, keycloak, laravel, symfony, wagtail, woocommerce |
| `the email with the subject "…" to "…" should contain "…"` | aspnet-core, codeigniter, keycloak, laravel, symfony, wagtail, woocommerce |
| `I ask for a password reset link for "…"` | aspnet-core, keycloak, laravel, nextcloud, wagtail |
| `I search for "…"` | discourse, docusaurus, drupal-core, mediawiki, wordpress |
| `I open the search result "…"` | docusaurus, hubspot-cms, joomla, nextcloud |
| `the preview should show "…"` | craft-cms, ghost, mediawiki, wagtail |
| `the breadcrumbs should be "…"` | docusaurus, magento, woocommerce |
| `I open the link of the email with the subject "…" to "…"` | wagtail |
| `I open the notifications menu` | discourse |
| `I open the profile of "…"` | discourse |
| `I open the topic "…"` | discourse |
| `I preview the post` | ghost |
| `I quote post 1 in a reply` | discourse |
| `I reply to the topic with "…"` | discourse |
| `I save the post as a draft` | wordpress |
| `I save the settings` | wordpress |
| `I send the message "…" to "…" with "…"` | discourse |
| `I set the password of "…" on the reset page` | wagtail |
| `I should be reading the topic "…"` | discourse |
| `I write "…" in the editor` | ghost |
| `my messages should list "…"` | discourse |
| `post 1 should be by "…"` | discourse |
| `post 1 should read "…"` | discourse |
| `the editor should contain "…"` | ghost |
| `the last post should quote "…"` | discourse |
| `the notifications menu should list "…"` | discourse |
| `the profile should show "…"` | discourse |
| `the search results should show "…"` | discourse |
| `the setting "…" should be "…"` | moodle |
| `the topic should be open` | discourse |
| `the topic should have 13 posts` | discourse |
| `there is a topic "…" in "…" by "…"` | discourse |
| `there is a topic "…" in "…" by "…" with:` | discourse |
| `there is no topic "…"` | discourse |

None matches a webship-js step, and none matches a phrase of the component pack (Bootstrap), of the Diffy pack or
of the Shopify pack, which can be loaded beside this one.

## Testing this package

```bash
npm ci
npm run test:examples    # every step's JSDoc examples match it and nothing else; every feature step resolves
npm run test:paths       # a feature named on the command line runs alone
npx cucumber-js --dry-run
SITE_DIR="$PWD/../phpbb-site" .github/scripts/build-ddev-site.sh
npx cucumber-js          # the whole suite
npm run test:must-fail   # the assertions that must fail, each with its message and a hint
PHP_VERSION=8.1 SITE_DIR="$PWD/../phpbb-site" .github/scripts/build-ddev-site.sh
npx cucumber-js
```

## How the steps were written

Every step was written from a round of manual testing of the real local board in the browser first: each screen it
touches was opened as the account the step works as, its lists, labels and messages noted, and the signal it gives
while it works found (the alert and the confirmation over the darkened page, the row of an upload, the tool that
turns into its opposite). The failures of the first runs went back to the browser before the step changed: a login
refused as "invalid" because the form came back within the second it was made, an upload refused for the same
reason, a notice page gone on to the next page before the next step read it, the administration control panel
sending its bare address back to the board index, a search of all the words of a title that found nothing because
the index leaves short words out, a "New Topic" button that stays a link in a locked forum and leads to "Forum
locked".

## License

MIT, see [LICENSE](LICENSE).

## Logo

The logo in this README is the phpBB logo from Simple Icons 16.37.0 (CC0-1.0), filled with the colour the set lists
for the brand. The phpBB name and logo are trademarks of their owner; this pack is not affiliated with or endorsed by
them.

'use strict';

// The session: logging in to the board by a handle of the users registry or
// with a user name and a password, the refusals of the login form, logging
// out, who is logged in, the pages an account may not open, and the password
// reset the login page offers.
//
// Accounts are configuration, not test data: they are listed in cucumber.js
// (`worldParameters.users`) and made once by the build of the site. A feature
// never creates or deletes an account.

const { Given, When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./phpbb-helpers');

/**
 * Log in to the board as an account of the users registry (`worldParameters.users` in cucumber.js), by its
 * handle. An account that logged in earlier in the run takes its session over; otherwise the step logs in
 * through the login form. The step ends on the board index.
 *
 * Example #1: Given I am a logged in user with the "member" user
 * Example #2: Given we are a logged in user with the "administrator" user
 * Example #3: Given I am a logged in user with "moderator"
 * Example #4: And I am a logged in user with the "newmember" user
 * Example #5: Given we are a logged in user with the "moderator" user
 */
Given(/^(I am |we are )*a logged in user with( the)* "([^"]*)"( user)*$/, { timeout: 120000 }, async function (pronounCase, theCase, handle, userCase) {
  await h.logInAs(this, handle);
});

/**
 * Log in through the login form as an account of the users registry, as a person does: a new session, never
 * one taken over. For the scenarios that test the form itself; the step fails when the board refuses the login.
 * On the login page a visitor was sent to, the step uses that form, so the board goes on to the page asked for.
 *
 * Example #1: When I log in as "member" with the login form
 * Example #2: When we log in as "moderator" with the login form
 * Example #3: And I log in as "administrator" with the login form
 * Example #4: When I log in as "newmember" with the login form
 * Example #5: Then we log in as "member" with the login form
 */
When(/^(I |we )*log in as "([^"]*)" with the login form$/, { timeout: 120000 }, async function (pronounCase, handle) {
  const user = h.resolveUser(this, handle);
  const onLogin = (await h.loginForm(this.page).username.count()) > 0 && !(await h.signedInName(this));
  const outcome = await h.submitLogin(this, user.username, user.password, { fresh: !onLogin });
  if (!outcome.ok) {
    throw friendly({
      message: `The login form refused "${handle}" (${user.username}): ${h.listed(outcome.errors)}.`,
      hint: outcome.cut ? h.CUT_HINT : 'Check the user name and the password of the account in worldParameters.users in cucumber.js.',
    });
  }
  this.__boardUser = user;
});

/**
 * Send the login form with a user name and a password. The step does not expect the login to succeed: assert
 * the outcome with the next step.
 *
 * Example #1: When I log in with the username "nobody" and the password "Wrong-password-1"
 * Example #2: When we log in with the username "member" and the password "Not-the-password-2"
 * Example #3: And I log in with the username "member" and the password ""
 * Example #4: When I log in with the username "" and the password ""
 * Example #5: When we log in with the username "moderator" and the password "wrong"
 */
When(/^(I |we )*log in with the username "([^"]*)" and the password "([^"]*)"$/, { timeout: 120000 }, async function (pronounCase, username, password) {
  const onLogin = (await h.loginForm(this.page).username.count()) > 0 && !(await h.signedInName(this));
  const outcome = await h.submitLogin(this, username || '', password || '', { fresh: !onLogin });
  this.__loginOutcome = outcome;
  if (outcome.ok) this.__boardUser = h.accountOf(this, username);
});

/**
 * Assert that the login page refused the login with an error (or a part of it), and that nobody is logged in.
 * The board says which of the two was wrong ("You have specified an incorrect password.", "… an incorrect
 * username."), and "You cannot login without a password." for an empty one.
 *
 * Example #1: Then the login should be refused with "You have specified an incorrect password."
 * Example #2: Then the login should be refused with "You have specified an incorrect username."
 * Example #3: And the login should be refused with "incorrect password"
 * Example #4: Then the login should be refused with "You cannot login without a password."
 * Example #5: Then the login should be refused with "Please check your username and try again."
 */
Then(/^the login should be refused with "([^"]*)"$/, async function (expected) {
  const page = this.page;
  const name = await h.signedInName(this);
  const errors = await h.formErrors(page);
  if (name || !errors.some((e) => h.mentions(e, expected))) {
    throw friendly({
      message: name
        ? `The login was not refused: "${name}" is logged in; ${await h.pageSummary(this)}.`
        : `The login page did not refuse the login with "${expected}". Its errors: ${h.listed(errors)}; ${await h.pageSummary(this)}.`,
      hint: h.hintFor(this, 'Send the form first (When I log in with the username "…" and the password "…"); the board writes its error above the form.'),
    });
  }
});

/**
 * Start as a visitor of the board: no session (the cookies of the browser cleared), on the board index.
 *
 * Example #1: Given I am not logged in
 * Example #2: Given we are not logged in
 * Example #3: And I am not logged in
 * Example #4: Given I am not logged in
 * Example #5: When we are not logged in
 */
Given(/^(I am |we are )*not logged in$/, async function (pronounCase) {
  await this.page.context().clearCookies();
  h.forgetSession(this);
  await h.open(this, h.absolute(this, 'index.php'));
});

/**
 * Log out as a person does: "Logout" in the menu under the user name at the top of the page; the board answers
 * with its index, as a visitor sees it. On a page without that menu, the step opens the board index first.
 *
 * Example #1: When I log out
 * Example #2: When we log out
 * Example #3: And I log out
 * Example #4: Then I log out
 * Example #5: Given I log out
 */
When(/^(I |we )*log out$/, { timeout: 90000 }, async function (pronounCase) {
  const page = this.page;
  h.forgetSession(this, this.__boardUser && this.__boardUser.username);
  if (!(await page.locator('#nav-main').count())) await h.open(this, h.absolute(this, 'index.php'));
  const name = await h.signedInName(this);
  if (!name) return; // nobody is logged in
  h.forgetSession(this, name);
  const menu = await h.openDropdown(this, page.locator('#username_logged_in'));
  await h.afterNavigation(this, () => menu.locator('a[href*="mode=logout"]').first().click());
  const still = await h.signedInName(this);
  if (still) throw friendly({ message: `The board did not log "${still}" out: ${await h.pageSummary(this)}.`, hint: h.hintFor(this, 'The menu under the user name at the top of the page holds "Logout".') });
});

/**
 * Assert who is logged in to the board: a handle of the users registry (its user name) or a user name, as
 * the board shows it at the top of its pages.
 *
 * Example #1: Then I should be logged in as "member"
 * Example #2: Then we should be logged in as "administrator"
 * Example #3: And I should be logged in as "moderator"
 * Example #4: Then I should be logged in as "newmember"
 * Example #5: And we should be logged in as "member"
 */
Then(/^(I |we )*should be logged in as "([^"]*)"$/, async function (pronounCase, who) {
  const wanted = h.usernameOf(this, who);
  const found = await h.signedInAccount(this);
  if (found.toLowerCase() !== wanted.toLowerCase()) {
    throw friendly({
      message: found ? `"${found}" is logged in, not "${wanted}".` : `Nobody is logged in: the board shows "Login" at the top of the page; ${await h.pageSummary(this)}.`,
      hint: h.hintFor(this, 'Log in first: Given I am a logged in user with the "member" user'),
    });
  }
});

/**
 * Assert that someone is, or nobody is, logged in to the board (the top of the page shows a user name, or
 * "Login").
 *
 * Example #1: Then I should be logged in
 * Example #2: Then I should not be logged in
 * Example #3: And we should be logged in
 * Example #4: And we should not be logged in
 * Example #5: Then I should not be logged in
 */
Then(/^(I |we )*should( not)* be logged in$/, async function (pronounCase, notCase) {
  const found = await h.signedInAccount(this);
  if (notCase && found) throw friendly({ message: `"${found}" is logged in.`, hint: 'Log out first: When I log out' });
  if (!notCase && !found) throw friendly({ message: `Nobody is logged in: ${await h.pageSummary(this)}.`, hint: h.hintFor(this, 'Log in first: Given I am a logged in user with the "member" user') });
});

/**
 * Assert that the page is the login page of the board (the form with "Username" and "Password"), which a
 * visitor is sent to for a page that needs an account. With a text, the page also says it ("The board requires
 * you to be registered and logged in to view this forum.").
 *
 * Example #1: Then I should be on the login page
 * Example #2: Then we should be on the login page
 * Example #3: And I should be on the login page saying "The board requires you to be registered and logged in to view this forum."
 * Example #4: Then I should be on the login page saying "you must re-authenticate yourself"
 * Example #5: And we should be on the login page
 */
Then(/^(?:I|we) should be on the login page(?: saying "([^"]*)")?$/, async function (expected) {
  await h.eventually(this, async () => (await h.loginForm(this.page).password.count()) > 0, (on) => on, async () => ({
    message: `The page is not the login page: ${await h.pageSummary(this)}.`,
    hint: h.hintFor(this, 'A visitor who opens a page that needs an account is sent to the login page.'),
  }));
  if (expected) {
    const text = h.clean(await h.loginForm(this.page).form.innerText().catch(() => ''));
    if (!h.mentions(text, expected)) throw friendly({ message: `The login page does not say "${expected}". It says "${text.slice(0, 200)}".`, hint: 'The login page says why it asks, above its fields.' });
  }
});

/**
 * Assert that the account of this browser may not open a page of the board: the board answers "You are not
 * authorised …" (403), sends a visitor to the login page, or sends the account back to the board index (the
 * administration control panel does that).
 *
 * Example #1: Then I should not be allowed to open "/mcp.php"
 * Example #2: Then we should not be allowed to open "/adm/index.php"
 * Example #3: And I should not be allowed to open "/viewforum.php?f=9"
 * Example #4: Then I should not be allowed to open "/ucp.php?i=pm"
 * Example #5: Then I should not be allowed to open "/memberlist.php?mode=email&u=2"
 */
Then(/^(I |we )*should not be allowed to open "([^"]*)"$/, async function (pronounCase, path) {
  const wanted = h.absolute(this, path);
  const response = await h.open(this, wanted);
  const status = response ? response.status() : 0;
  const said = await h.notice(this.page);
  const toLogin = (await h.loginForm(this.page).password.count()) > 0;
  const elsewhere = h.pathOf(this, this.page.url()).split('?')[0] !== h.pathOf(this, wanted).split('?')[0];
  if (status === 403 || toLogin || /not authorised|do not have permission|not allowed/i.test(said.text) || elsewhere) return;
  throw friendly({
    message: `${path} opened for this account: ${await h.pageSummary(this)} (answer ${status}).`,
    hint: 'The board refuses a page an account has no permission for with "You are not authorised …".',
  });
});

/**
 * Ask for a password reset as a person does: "I forgot my password" on the login page, the email address of an
 * account of the users registry (or an address), "Submit". The board answers every address alike ("If your
 * account exists, a password reset link was sent to your registered email address.").
 *
 * Example #1: When I ask for a password reset link for "member"
 * Example #2: When we ask for a password reset link for "moderator"
 * Example #3: And I ask for a password reset link for "nobody@example.com"
 * Example #4: When I ask for a password reset link for "newmember"
 * Example #5: When I ask for a password reset link for "member@example.com"
 */
When(/^(I |we )*ask for a password reset link for "([^"]*)"$/, { timeout: 90000 }, async function (pronounCase, who) {
  const page = this.page;
  const address = h.addressOf(this, who);
  await page.context().clearCookies();
  h.forgetSession(this);
  await h.open(this, h.absolute(this, 'ucp.php?mode=login'));
  const link = page.locator('form#login a[href*="forgot_password"]').first();
  if (!(await link.count())) throw friendly({ message: `The login page has no "I forgot my password" link: ${await h.pageSummary(this)}.`, hint: 'The board offers the password reset when its email is on and accounts may change their password.' });
  await h.afterNavigation(this, () => link.click());
  await page.locator('form#reset_password #email').fill(address);
  await h.send(this, page.locator('form#reset_password input[name="submit"]'));
  await h.expectNotice(this, 'a password reset link was sent', 'The board answers a reset request with "If your account exists, a password reset link was sent to your registered email address.".');
});

/**
 * On the page a reset link opens ("Reset password"), set the password of an account of the users registry as
 * its new password, as a person does: "New password", "Confirm password", "Submit". The account keeps the
 * password the registry knows, so the suite can go on logging in with it; no password is written in the
 * feature.
 *
 * Example #1: When I set the password of "member" on the reset page
 * Example #2: When we set the password of "moderator" on the reset page
 * Example #3: And I set the password of "member" on the reset page
 * Example #4: When I set the password of "newmember" on the reset page
 * Example #5: When we set the password of "member" on the reset page
 */
When(/^(?:I|we) set the password of "([^"]*)" on the reset page$/, { timeout: 90000 }, async function (handle) {
  const page = this.page;
  const user = h.resolveUser(this, handle);
  const form = page.locator('form#reset_password');
  if (!(await form.locator('#new_password').count())) {
    throw friendly({ message: `The page is not the page of a reset link: ${await h.pageSummary(this)}.`, hint: 'Open the link of the reset mail first: When I open the "reset_password" link of the email with the subject "Account password reset" to "…"' });
  }
  await form.locator('#new_password').fill(user.password);
  await form.locator('#new_password_confirm').fill(user.password);
  await h.send(this, form.locator('input[name="submit"]'));
  const errors = await h.formErrors(page);
  if (errors.length) throw friendly({ message: `The new password was refused: ${h.listed(errors)}.`, hint: 'A reset link works once; the board\'s password rules apply to the new password.' });
  await h.expectNotice(this, 'password', 'The board answers a new password with "Your password has been successfully reset.".');
  h.forgetSession(this, user.username);
});

/**
 * Open the registration form as a visitor does: "Register", then "I agree to these terms" under the terms of
 * the board. The step fills in nothing: the suite never completes a registration.
 *
 * Example #1: When I open the registration form
 * Example #2: When we open the registration form
 * Example #3: And I open the registration form
 * Example #4: Given I open the registration form
 * Example #5: Given we open the registration form
 */
When(/^(?:I|we) open the registration form$/, { timeout: 90000 }, async function () {
  const page = this.page;
  await page.context().clearCookies();
  h.forgetSession(this);
  await h.open(this, h.absolute(this, 'ucp.php?mode=register'));
  const agree = page.locator('form#agreement input[name="agreed"]').first();
  if (!(await agree.count())) throw friendly({ message: `The board did not show the terms of the registration: ${await h.pageSummary(this)}.`, hint: 'The registration starts with the terms of the board and "I agree to these terms". A board can turn registration off.' });
  await h.send(this, agree);
  if (!(await page.locator('form#register #username').count())) throw friendly({ message: `The registration form did not open: ${await h.pageSummary(this)}.`, hint: h.hintFor(this, 'After the terms the board shows "Username", "Password", "Confirm password" and "Email address".') });
});

/**
 * Fill in the registration form and send it, expecting the board to refuse it: a taken user name or address,
 * two passwords that differ, a missing field. Assert the refusal with the next step. The step fails when the
 * board accepts the registration, since a suite never makes an account.
 *
 * Example #1: When I try to register with the username "member", the email "someone@example.com" and the passwords "dD.123123ddd" and "dD.123123ddd"
 * Example #2: When I try to register with the username "webship-test-nobody", the email "member@example.com" and the passwords "dD.123123ddd" and "dD.123123ddd"
 * Example #3: When we try to register with the username "webship-test-nobody", the email "someone@example.com" and the passwords "dD.123123ddd" and "different-9"
 * Example #4: And I try to register with the username "", the email "" and the passwords "" and ""
 * Example #5: When I try to register with the username "ab", the email "not-an-address" and the passwords "short" and "short"
 */
When(/^(?:I|we) try to register with the username "([^"]*)", the email "([^"]*)" and the passwords "([^"]*)" and "([^"]*)"$/, { timeout: 90000 }, async function (username, email, password, confirmation) {
  const page = this.page;
  const form = page.locator('form#register');
  if (!(await form.locator('#username').count())) throw friendly({ message: `The registration form is not open: ${await h.pageSummary(this)}.`, hint: 'Open it first: When I open the registration form' });
  await form.locator('#username').fill(username);
  await form.locator('#email').fill(email);
  await form.locator('#new_password').fill(password);
  await form.locator('#password_confirm').fill(confirmation);
  // The browser's own check of the address ("not-an-address") would keep the form from being sent.
  await form.evaluate((f) => { f.noValidate = true; });
  await h.send(this, form.locator('input[name="submit"]'));
  if (!(await page.locator('form#register #username').count())) {
    throw friendly({
      message: `The board did not refuse the registration of "${username}": ${await h.pageSummary(this)}.`,
      hint: 'A suite never completes a registration: this step is for the refusals of the form. If an account was made, delete it (the administration control panel, Users and Groups).',
    });
  }
});

/**
 * Assert that the registration form was refused with an error (or a part of it), shown above its fields.
 *
 * Example #1: Then the registration should be refused with "The username you entered is already in use, please select an alternative."
 * Example #2: Then the registration should be refused with "The entered email address is already in use."
 * Example #3: And the registration should be refused with "The passwords you entered do not match."
 * Example #4: Then the registration should be refused with "The email address you entered is invalid."
 * Example #5: Then the registration should be refused with "already in use"
 */
Then(/^the registration should be refused with "([^"]*)"$/, async function (expected) {
  const errors = await h.formErrors(this.page);
  if (!errors.some((e) => h.mentions(e, expected))) {
    throw friendly({
      message: `The registration form did not say "${expected}". Its errors: ${h.listed(errors)}; ${await h.pageSummary(this)}.`,
      hint: h.hintFor(this, 'Send the form first: When I try to register with the username "…", the email "…" and the passwords "…" and "…"'),
    });
  }
});

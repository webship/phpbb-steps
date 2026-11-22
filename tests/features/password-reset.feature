@session @mail
Feature: The password reset
  As a member who forgot the password
  I want a link to set a new one
  So that I get back into my account

  Scenario: A member asks for a reset link and sets the password again
    When I ask for a password reset link for "member"
    Then an email with the subject "Account password reset" should be sent to "member"
    And the email with the subject "Account password reset" to "member" should contain "Hello member"
    When I open the "reset_password" link of the email with the subject "Account password reset" to "member"
    And I set the password of "member" on the reset page
    Then the board should say "Your password has been successfully reset."
    When I log in as "member" with the login form
    Then I should be logged in as "member"

  Scenario: The board answers an unknown address alike, and sends nothing
    When I ask for a password reset link for "webship-test-nobody@example.com"
    Then no email should be sent to "webship-test-nobody@example.com"

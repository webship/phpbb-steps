@session
Feature: The session
  As a member of the board
  I want to log in and out
  So that the board knows who I am

  Scenario: A member logs in with the login form and logs out
    Given I am not logged in
    Then I should not be logged in
    When I log in as "member" with the login form
    Then I should be logged in as "member"
    When I log out
    Then I should not be logged in

  Scenario: An account takes its session over
    Given I am a logged in user with the "moderator" user
    Then I should be logged in as "moderator"
    And I should be logged in

  Scenario: The login form says which of the two was wrong
    Given I am not logged in
    When I log in with the username "member" and the password "Not-the-password-2"
    Then the login should be refused with "You have specified an incorrect password."
    When I log in with the username "webship-test-nobody" and the password "Not-the-password-2"
    Then the login should be refused with "You have specified an incorrect username."
    When I log in with the username "member" and the password ""
    Then the login should be refused with "You cannot login without a password."
    And I should not be logged in

  @js-off
  Scenario: A visitor is sent to the login page for a forum of the staff, and goes on to it after the login
    Given I am not logged in
    When I try to open the forum at "/viewforum.php?f=9"
    Then I should be on the login page saying "The board requires you to be registered and logged in to view this forum."
    When I log in as "moderator" with the login form
    Then I should be in the forum "Staff room"

  @js-off
  Scenario: A member may not open the pages of the staff
    Given I am a logged in user with the "member" user
    Then I should not be allowed to open "/mcp.php"
    And I should not be allowed to open "/adm/index.php"
    When I try to open the forum at "/viewforum.php?f=9"
    Then the board should say "You are not authorised to read this forum."

@must-fail @session
Feature: Assertions of the session and the board that must fail
  Each scenario asserts something that is not true on the test site. Its last step must fail with the message
  its description announces, and a hint (tests/check-must-fail.js runs them). They only read: the site is left as
  it was.

  Scenario: A login that worked is not a refused one
    Fails with: The login was not refused
    Given I am not logged in
    When I log in with the username "member" and the password "dD.123123ddd"
    Then the login should be refused with "incorrect password"

  Scenario: A wrong password is not an unknown user name
    Fails with: The login page did not refuse the login with "You have specified an incorrect username."
    Given I am not logged in
    When I log in with the username "member" and the password "Not-the-password-2"
    Then the login should be refused with "You have specified an incorrect username."

  Scenario: The member is not the moderator
    Fails with: "member" is logged in, not "moderator"
    Given I am a logged in user with the "member" user
    Then I should be logged in as "moderator"

  Scenario: An account that is logged in is not logged out
    Fails with: "member" is logged in.
    Given I am a logged in user with the "member" user
    Then I should not be logged in

  Scenario: Nobody is logged in to a visitor's browser
    Fails with: Nobody is logged in
    Given I am not logged in
    Then I should be logged in

  Scenario: The board index is not the login page
    Fails with: The page is not the login page
    Given I am on the board index
    Then I should be on the login page

  Scenario: An account not in the users registry
    Fails with: The user "nobody" is not in the users registry
    Given I am a logged in user with the "nobody" user

  Scenario: A moderator may open the moderator control panel
    Fails with: /mcp.php opened for this account
    Given I am a logged in user with the "moderator" user
    Then I should not be allowed to open "/mcp.php"

  Scenario: The registration form does not refuse a free user name as taken
    Fails with: The registration form did not say "The username you entered is already in use
    When I open the registration form
    And I try to register with the username "webship-test-nobody", the email "webship-test-nobody@example.com" and the passwords "dD.123123ddd" and "different-9"
    Then the registration should be refused with "The username you entered is already in use, please select an alternative."

  Scenario: A forum the board does not have
    Fails with: The page lists no forum "Recipes"
    Given I am on the board index
    Then the board index should list the forum "Recipes"

  Scenario: A forum of another category
    Fails with: The forum "General discussion" is in the category "Community", not in "Staff"
    Given I am on the board index
    Then the board index should list the forum "General discussion" in the category "Staff"

  Scenario: A forum the index lists
    Fails with: The board index lists the forum "Archive"
    Given I am on the board index
    Then the board index should not list the forum "Archive"

  Scenario: The counter of a forum
    Fails with: The forum "Help and support" has 27 topics on the board index, not 3
    Given I am on the board index
    Then the forum "Help and support" on the board index should have 3 topics

  Scenario: An open forum is not locked
    Fails with: The forum "General discussion" is not locked on the board index
    Given I am on the board index
    Then the forum "General discussion" on the board index should be locked

  Scenario: A forum without that subforum
    Fails with: The forum "Help and support" lists no subforum "Introductions" on the board index
    Given I am on the board index
    Then the forum "Help and support" on the board index should list the subforum "Introductions"

  Scenario: A forum a visitor may not read
    Fails with: The board has no forum "Staff room" for this account
    Given I am not logged in
    When I open the forum "Staff room"

  Scenario: Another forum
    Fails with: The page is not the forum "Archive": it is the forum "General discussion"
    Given I am not logged in
    When I open the forum "General discussion"
    Then I should be in the forum "Archive"

  Scenario: A topic the forum does not list
    Fails with: The forum "General discussion" lists no topic "Webship test topic that is not there"
    Given I am not logged in
    When I open the forum "General discussion"
    Then the forum should list the topic "Webship test topic that is not there"

  Scenario: A topic the forum lists
    Fails with: The forum "General discussion" lists the topic "Weekend baking thread"
    Given I am not logged in
    When I open the forum "General discussion"
    Then the forum should not list the topic "Weekend baking thread"

  Scenario: A topic is not an announcement
    Fails with: "Weekend baking thread" is a topic of the forum, not an announcement
    Given I am not logged in
    When I open the forum "General discussion"
    Then the forum should list the announcement "Weekend baking thread"

  Scenario: An open topic is not locked in the list
    Fails with: The topic "Weekend baking thread" is not locked in the list of the forum
    Given I am not logged in
    When I open the forum "General discussion"
    Then the topic "Weekend baking thread" in the forum should be locked

  Scenario: The replies of a topic in the list
    Fails with: The topic "Weekend baking thread" has 12 replies in the list of the forum, not 3
    Given I am not logged in
    When I open the forum "General discussion"
    Then the topic "Weekend baking thread" in the forum should have 3 replies

  Scenario: The author of a topic in the list
    Fails with: The topic "Weekend baking thread" is by "member" in the list of the forum, not by "moderator"
    Given I am not logged in
    When I open the forum "General discussion"
    Then the topic "Weekend baking thread" in the forum should be by "moderator"

  Scenario: The number of topics of a forum
    Fails with: not 3 topics
    Given I am not logged in
    When I open the forum "Help and support"
    Then the forum should have 3 topics

  Scenario: A page the list does not have
    Fails with: The list has no page 9
    Given I am not logged in
    When I open the forum "Help and support"
    And I go to page 9

  Scenario: The page of the list
    Fails with: The list is on page 1, not on page 2
    Given I am not logged in
    When I open the forum "Help and support"
    Then I should be on page 2

  Scenario: The first topic of a forum
    Fails with: The first topic of the forum is "Hello from the member", not "Board rules"
    Given I am not logged in
    When I open the forum "Introductions"
    Then the first topic of the forum should be "Board rules"

  Scenario: The breadcrumbs of a forum
    Fails with: The breadcrumbs are "Board index", "Community", "General discussion", not "Board index", "Staff"
    Given I am not logged in
    When I open the forum "General discussion"
    Then the breadcrumbs should be "Board index" and "Staff"

  @js-off
  Scenario: The notice of the board says something else
    Fails with: The board did not say "The requested topic does not exist.". It says "You are not authorised to read this forum."
    Given I am a logged in user with the "member" user
    When I try to open the forum at "/viewforum.php?f=9"
    Then the board should say "The requested topic does not exist."

  Scenario: A page without a notice
    Fails with: The board did not say "Your profile has been updated.". It shows no notice
    Given I am on the board index
    Then the board should say "Your profile has been updated."

  Scenario: The figures of the board
    Fails with: The board statistics show "Our newest member" as "newmember", not as "member"
    Given I am on the board index
    Then the board statistics should show "Our newest member" as "member"

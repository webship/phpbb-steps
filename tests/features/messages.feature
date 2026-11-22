@messages
Feature: Private messages
  As a member of the board
  I want to write to another member in private
  So that we can talk outside the forums

  Scenario: The inbox of a member
    Given I am a logged in user with the "member" user
    When I go to my inbox
    Then my messages should list "Welcome to the board"
    And my messages should list "About your first post"
    When I open the message "Welcome to the board"
    Then the message should be from "administrator"
    And the message should read "Read the board rules first"

  Scenario: A message is sent, read, answered and deleted on both sides
    Given "member" has no message "Webship test message"
    And "moderator" has no message "Webship test message"
    And I am a logged in user with the "member" user
    When I send the message "Webship test message" to "moderator" with "Webship test: a private message."
    And I go to my outbox
    Then my messages should list "Webship test message"
    Given I am a logged in user with the "moderator" user
    Then I should have 1 unread message
    When I open the notifications menu
    Then the notifications menu should list "Webship test message"
    When I go to my inbox
    Then the message "Webship test message" should be unread
    When I open the message "Webship test message"
    Then the message should be from "member"
    And the message should read "Webship test: a private message."
    When I reply to the message with "Webship test: an answer."
    And I go to my inbox
    Then the message "Webship test message" should be read
    And I should have 0 unread messages
    Given I am a logged in user with the "member" user
    When I go to my sent messages
    Then my messages should list "Webship test message"
    When I go to my inbox
    And I open the message "Re: Webship test message"
    Then the message should be from "moderator"
    And the message should read "Webship test: an answer."
    When I go to my inbox
    And I delete the message "Re: Webship test message"
    And I go to my inbox
    Then my messages should not list "Re: Webship test message"
    And "member" has no message "Webship test message"
    And "moderator" has no message "Webship test message"

  Scenario: A message needs a recipient the board knows, a subject and a text
    Given I am a logged in user with the "member" user
    When I try to send the message "Webship test message" to "webship-test-nobody" with "Webship test."
    Then the editor should show the error "The requested users to be added do not exist."
    When I try to send the message "" to "moderator" with "Webship test: a message without a subject."
    Then the editor should show the error "You must specify a subject when composing a new message."
    When I try to send the message "Webship test message" to "moderator" with ""
    Then the editor should show the error "Your message contains too few characters."
    And "member" has no message "Webship test message"

  Scenario: A message from the staff shows in the inbox with its counter
    Given "member" has no message "Webship test message"
    And "moderator" has no message "Webship test message"
    And "moderator" sent the message "Webship test message" to "member" with "Webship test: a word from the moderator."
    And I am a logged in user with the "member" user
    When I go to my inbox
    Then the message "Webship test message" should be unread
    When I delete the message "Webship test message"
    And I go to my inbox
    Then my messages should not list "Webship test message"
    And "moderator" has no message "Webship test message"

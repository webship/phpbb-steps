@topic
Feature: Reading a topic
  As a member of the board
  I want to read a topic, vote in its poll and keep it for later
  So that I follow what interests me

  Scenario: A visitor reads a topic of two pages
    Given I am not logged in
    When I open the topic "Weekend baking thread" in "General discussion"
    Then I should be reading the topic "Weekend baking thread"
    And the topic should have 13 posts
    And the topic should be open
    And post 1 should be by "member"
    And post 1 should read "What is in your oven this weekend?"
    And post 2 should be by "moderator"
    And post 2 should read "A tray of cinnamon rolls here."
    When I go to page 2
    Then I should be on page 2
    And the last post should be by "administrator"
    And the last post should read "Boil them before you bake them."

  Scenario: An announcement is locked
    Given I am a logged in user with the "member" user
    When I open the forum "General discussion"
    And I open the topic "Board rules"
    Then the topic should be locked
    And I should not see the quick reply
    And I should not be able to reply because it is locked

  Scenario: A locked forum takes no new topic
    Given I am a logged in user with the "member" user
    When I open the forum "Archive"
    Then I should not be able to start a topic because it is locked

  Scenario: A visitor may not post
    Given I am not logged in
    When I open the forum "General discussion"
    Then I should not be able to start a topic
    When I open the topic "A walk along the river" in "General discussion"
    Then I should not see the quick reply
    And I should not be able to reply

  Scenario: A member votes in a poll and changes the vote
    Given I am a logged in user with the "member" user
    When I open the topic "Which season do you like best?" in "General discussion"
    Then the topic should have the poll "Which season do you like best?" with the options "Spring", "Summer", "Autumn" and "Winter"
    When I vote for "Summer" in the poll
    Then the poll should show my vote for "Summer"
    And the poll should show 1 vote for "Summer"
    When I vote for "Winter" in the poll
    Then the poll should show my vote for "Winter"
    And the poll should show 1 vote for "Winter"
    And the poll should show 0 votes for "Summer"

  Scenario: A member bookmarks a topic and subscribes to it
    Given I am a logged in user with the "member" user
    When I open the topic "A walk along the river" in "General discussion"
    And I remove the bookmark of the topic
    And I unsubscribe from the topic
    Then the topic should not be bookmarked
    And the topic should not be subscribed to
    When I bookmark the topic
    And I subscribe to the topic
    Then the topic should be bookmarked
    And the topic should be subscribed to
    When I remove the bookmark of the topic
    And I unsubscribe from the topic
    Then the topic should not be bookmarked
    And the topic should not be subscribed to

  Scenario: A topic written with BBCode is drawn
    Given there is a topic "Webship test topic" in "Introductions" by "member" with:
      """
      Webship test: three things to pack.

      [list=1][*]A map[*]A [b]warm[/b] coat[*]Tea[/list]
      """
    And I am not logged in
    When I open the topic "Webship test topic" in "Introductions"
    Then post 1 should be by "member"
    And post 1 should read "Webship test: three things to pack."
    And post 1 should read "A warm coat"
    And the breadcrumbs should be "Board index", "Community", "General discussion" and "Introductions"
    And there is no topic "Webship test topic"

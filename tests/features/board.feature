@board
Feature: The board index and its forums
  As a visitor of the board
  I want to see its forums and their topics
  So that I find what I came to read

  Scenario: A visitor sees the public forums, by category
    Given I am not logged in
    Then the board index should list the forum "General discussion" in the category "Community"
    And the board index should list the forum "Help and support" in the category "Community"
    And the board index should not list the forum "Staff room"
    And the forum "Help and support" on the board index should have 27 topics
    And the forum "Archive" on the board index should have 1 post
    And the forum "Archive" on the board index should be locked
    And the forum "General discussion" on the board index should not be locked
    And the forum "General discussion" on the board index should list the subforum "Introductions"
    And the board statistics should show "Our newest member" as "newmember"

  Scenario: A moderator also sees the forum of the staff
    Given I am a logged in user with the "moderator" user
    When I go to the board index
    Then the board index should list the forum "Staff room" in the category "Staff"

  Scenario: A forum lists its announcement, its sticky topic, its topics and its subforum
    Given I am not logged in
    When I open the forum "General discussion"
    Then I should be in the forum "General discussion"
    And the breadcrumbs should be "Board index", "Community" and "General discussion"
    And the forum should list the announcement "Board rules"
    And the topic "Board rules" in the forum should be locked
    And the topic "Start here: how this board works" in the forum should be sticky
    And the forum should list the topic "Weekend baking thread"
    And the topic "Weekend baking thread" in the forum should have 12 replies
    And the topic "Weekend baking thread" in the forum should be by "member"
    And the topic "Weekend baking thread" in the forum should not be locked
    And the forum should list the subforum "Introductions"
    And the forum should not list the topic "Webship test topic that is not there"

  Scenario: A forum of two pages
    Given I am not logged in
    When I open the forum "Help and support"
    Then the forum should have 27 topics
    And I should be on page 1
    When I go to page 2
    Then I should be on page 2
    And the forum should list the topic "Question 01: where do I find my drafts?"

  Scenario: The topics of a forum sorted by their subject
    Given I am not logged in
    When I open the forum "Help and support"
    And I sort the topics by "Subject" in "Ascending" order
    Then the first topic of the forum should be "Question 01: where do I find my drafts?"
    When I sort the topics by "Subject" in "Descending" order
    Then the first topic of the forum should be "Question 27: where do I find my drafts?"

  Scenario: A subforum
    Given I am not logged in
    When I open the forum "Introductions"
    Then the breadcrumbs should be "Board index", "Community", "General discussion" and "Introductions"
    And the forum should have 1 topic
    And the first topic of the forum should be "Hello from the member"

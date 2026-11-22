@search
Feature: Search
  As a visitor of the board
  I want to search its posts
  So that I find a discussion again

  Scenario: The search box finds the posts with a word and highlights it
    Given I am on the board index
    When I search for "sourdough"
    Then the search should find 2 matches
    And the search page should be "Search found 2 matches: sourdough"
    And the search results should show "Weekend baking thread"
    And the search results should show "The sourdough came out well"
    And the search results should highlight "sourdough"
    When I open the search result "Weekend baking thread"
    Then I should be reading the topic "Weekend baking thread"

  Scenario: A word nobody wrote
    Given I am on the board index
    When I search for "zzzunfindable"
    Then the search should find 0 matches
    And the search results should show "No suitable matches were found."

  Scenario: The advanced search: as topics, by an author, in a forum
    Given I am not logged in
    When I search the topics for "sourdough"
    Then the search should find 1 match
    And the search results should show "Weekend baking thread"
    When I search the posts for "flour" by "member"
    Then the search should find 1 match
    And the search results should show "A strong white flour with a fifth of rye."
    When I search the posts for "flour" by "moderator"
    Then the search should find 1 match
    And the search results should show "Which flour do you use?"
    When I search the topics for "drafts" in "Help and support"
    Then the search should find 27 matches
    When I search the topics for "drafts" in "General discussion"
    Then the search should find 0 matches

  Scenario: The search leaves out what an account may not read
    Given I am a logged in user with the "member" user
    When I search for "moderators"
    Then the search results should not show "Moderation notes"
    Given I am a logged in user with the "moderator" user
    When I search for "moderators"
    Then the search results should show "Moderation notes"

  Scenario: The quick links of a member
    Given I am a logged in user with the "member" user
    When I open the quick link "Your posts"
    Then the search page should be "Your posts"
    And the search results should show "Weekend baking thread"
    When I open the quick link "Unanswered topics"
    Then the search page should be "Unanswered topics"
    And the search results should show "A walk along the river"
    And the search results should not show "Weekend baking thread"

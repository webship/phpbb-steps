@moderation
Feature: Moderation
  As a moderator of the board
  I want to review what new members post and what members report
  So that the forums stay in order

  Scenario: A member has no moderator tools
    Given I am a logged in user with the "member" user
    Then I should not see the link to the moderator control panel
    When I open the topic "A walk along the river" in "General discussion"
    Then I should not see the moderator tools

  Scenario: The moderator control panel
    Given I am a logged in user with the "moderator" user
    Then I should see the link to the moderator control panel
    When I go to the moderator control panel
    Then the control panel should offer the tab "Moderation queue"
    And the control panel should offer the tab "Reported messages"
    And the control panel should offer the tab "Moderator logs"
    When I open "Topics awaiting approval" under "Moderation queue" in the moderator control panel
    Then the control panel should show the page "Topics awaiting approval"
    When I open "Open reports" under "Reported messages" in the moderator control panel
    Then the control panel should show the page "Open reports"

  Scenario: The topic of a new member waits for approval, and a moderator approves it
    Given there is no topic "Webship test topic of a new member"
    And I am a logged in user with the "newmember" user
    When I start a new topic in "General discussion"
    And I write the subject "Webship test topic of a new member" in the editor
    And I write "Webship test: this post waits for approval." in the editor
    And I submit the post
    Then the board should say "This message has been submitted successfully, but it will need to be approved by a moderator before it is publicly viewable."
    Given I am a logged in user with the "member" user
    When I open the forum "General discussion"
    Then the forum should not list the topic "Webship test topic of a new member"
    Given I am a logged in user with the "moderator" user
    Then the approval queue should list the topic "Webship test topic of a new member"
    When I open the forum "General discussion"
    Then the topic "Webship test topic of a new member" in the forum should be waiting for approval
    When I approve the topic "Webship test topic of a new member"
    Then the board should say "The selected topic has been approved."
    And the approval queue should not list the topic "Webship test topic of a new member"
    Given I am a logged in user with the "member" user
    When I open the topic "Webship test topic of a new member" in "General discussion"
    Then post 1 should be by "newmember"
    And there is no topic "Webship test topic of a new member"

  Scenario: A moderator disapproves the topic of a new member
    Given there is a topic "Webship test topic of a new member" in "General discussion" by "newmember"
    And I am a logged in user with the "moderator" user
    When I disapprove the topic "Webship test topic of a new member"
    Then the board should say "The selected topic has been disapproved."
    And the approval queue should not list the topic "Webship test topic of a new member"
    When I open the forum "General discussion"
    Then the forum should not list the topic "Webship test topic of a new member"

  Scenario: A member reports a post, and a moderator closes the report
    Given there is a topic "Webship test topic" in "General discussion" by "member"
    And "moderator" replied to the topic "Webship test topic" in "General discussion" with "Webship test reply of the moderator."
    And I am a logged in user with the "member" user
    When I open the topic "Webship test topic" in "General discussion"
    And I report the last post as "off topic" with "Webship test report."
    Then I should be reading the topic "Webship test topic"
    Given I am a logged in user with the "moderator" user
    Then the open reports should list "Re: Webship test topic"
    When I open the forum "General discussion"
    Then the topic "Webship test topic" in the forum should be reported
    When I close the report of "Re: Webship test topic"
    Then the board should say "The selected report has been closed successfully."
    And the open reports should not list "Re: Webship test topic"
    And the moderator log should show "Closed report"
    And there is no topic "Webship test topic"

  Scenario: A moderator locks a topic, moves it, splits it and deletes it
    Given there is a topic "Webship test topic" in "General discussion" by "member"
    And there is no topic "Webship test topic, split"
    And "member" replied to the topic "Webship test topic" in "General discussion" with "Webship test: a second post."
    And "member" replied to the topic "Webship test topic" in "General discussion" with "Webship test: a third post."
    And I am a logged in user with the "moderator" user
    When I open the topic "Webship test topic" in "General discussion"
    Then I should see the moderator tools
    When I lock the topic
    Then the topic should be locked
    And the moderator log should show "Locked topic"
    When I open the topic "Webship test topic" in "General discussion"
    And I unlock the topic
    Then the topic should be open
    When I move the topic to "Help and support"
    Then the breadcrumbs should be "Board index", "Community" and "Help and support"
    When I open the forum "General discussion"
    Then the forum should not list the topic "Webship test topic"
    When I open the topic "Webship test topic" in "Help and support"
    And I split the topic from post 3 into "Webship test topic, split" in "General discussion"
    Then I should be reading the topic "Webship test topic, split"
    And the topic should have 1 post
    And post 1 should read "Webship test: a third post."
    And the breadcrumbs should be "Board index", "Community" and "General discussion"
    When I delete the topic permanently
    Then the forum should not list the topic "Webship test topic, split"
    When I open the topic "Webship test topic" in "Help and support"
    Then the topic should have 2 posts
    When I delete the topic permanently
    Then the forum should not list the topic "Webship test topic"

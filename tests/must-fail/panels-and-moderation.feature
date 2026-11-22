@must-fail @panels
Feature: Assertions of the control panels and of moderation that must fail
  Each scenario asserts something that is not true on the test site. Its last step must fail with the message
  its description announces, and a hint (tests/check-must-fail.js runs them). They only read: the site is left as
  it was.

  Scenario: A member has no moderator control panel
    Fails with: The board offers this account no moderator control panel ("member")
    Given I am a logged in user with the "member" user
    When I go to the moderator control panel

  Scenario: A moderator has no administration control panel
    Fails with: The board offers this account no administration control panel ("moderator")
    Given I am a logged in user with the "moderator" user
    When I go to the administration control panel

  Scenario: A page the user control panel does not have
    Fails with: The user control panel has no page "Edit the board"
    Given I am a logged in user with the "member" user
    When I open "Edit the board" under "Profile" in the user control panel

  Scenario: A tab the user control panel does not have
    Fails with: The user control panel has no tab "Banning"
    Given I am a logged in user with the "member" user
    When I open "Ban users by username" under "Banning" in the user control panel

  Scenario: The page of the control panel
    Fails with: not the page "Edit signature"
    Given I am a logged in user with the "member" user
    When I open "Edit profile" under "Profile" in the user control panel
    Then the control panel should show the page "Edit signature"

  Scenario: The user control panel has no tab of the moderators
    Fails with: The user control panel does not offer the tab "Moderation queue"
    Given I am a logged in user with the "member" user
    When I go to the user control panel
    Then the control panel should offer the tab "Moderation queue"

  Scenario: The board index is not a control panel
    Fails with: The page is not a control panel
    Given I am on the board index
    Then the control panel should show the page "Front page"

  Scenario: A setting the page does not have
    Fails with: This page has no setting "Shoe size"
    Given I am a logged in user with the "member" user
    When I open "Edit profile" under "Profile" in the user control panel
    Then the setting "Shoe size" should be "42"

  Scenario: The value of a setting
    Fails with: The setting "Hide my online status" is "No", not "Yes"
    Given I am a logged in user with the "member" user
    When I open "Edit global settings" under "Board preferences" in the user control panel
    Then the setting "Hide my online status" should be "Yes"

  Scenario: A choice a setting does not have
    Fails with: The setting "Hide my online status" has no choice "Maybe"
    Given I am a logged in user with the "member" user
    When I open "Edit global settings" under "Board preferences" in the user control panel
    And I set the setting "Hide my online status" to "Maybe"

  Scenario: The settings of the board are not saved by a suite
    Fails with: this step saves a page of the user control panel only
    Given I am a logged in user with the "administrator" user
    When I open "Board settings" under "General" in the administration control panel
    And I save the settings

  Scenario: The signature of a member
    Fails with: The signature is "", not "Webship test signature."
    Given I am a logged in user with the "member" user
    Then my signature should be "Webship test signature."

  Scenario: A draft the member does not have
    Fails with: The drafts do not list "Webship test draft that is not there"
    Given I am a logged in user with the "member" user
    Then my drafts should list "Webship test draft that is not there"

  Scenario: An account the members list does not have
    Fails with: The members list does not list "webship-test-nobody"
    Given I am a logged in user with the "member" user
    When I go to the members list
    Then the members list should list "webship-test-nobody"

  Scenario: The group of a member
    Fails with: The profile does not show "Global moderators"
    Given I am a logged in user with the "member" user
    When I open the profile of "member"
    Then the profile should show "Global moderators"

  Scenario: A notification nobody sent
    Fails with: The notifications menu does not list "Webship test notification that is not there"
    Given I am a logged in user with the "member" user
    When I open the notifications menu
    Then the notifications menu should list "Webship test notification that is not there"

  Scenario: A figure of the board
    Fails with: The board statistic "Board version" is "3.3.
    Given I am a logged in user with the "administrator" user
    When I go to the administration control panel
    Then the board statistic "Board version" should be "9.9"

  Scenario: The setting of the board
    Fails with: The setting "Site name" is "Webship test board", not "Another board"
    Given I am a logged in user with the "administrator" user
    When I open "Board settings" under "General" in the administration control panel
    Then the setting "Site name" should be "Another board"

  Scenario: A forum the forum administration does not list at its first level
    Fails with: The forum administration does not list "General discussion"
    Given I am a logged in user with the "administrator" user
    When I open "Manage forums" under "Forums" in the administration control panel
    Then the forum administration should list "General discussion"

  Scenario: A moderator is offered no administration control panel
    Fails with: The page does not offer "moderator" the administration control panel
    Given I am a logged in user with the "moderator" user
    Then I should see the link to the administration control panel

  Scenario: A member has no moderator tools
    Fails with: The topic does not offer "member" the moderator tools
    Given I am a logged in user with the "member" user
    When I open the topic "Weekend baking thread" in "General discussion"
    Then I should see the moderator tools

  Scenario: A member cannot lock a topic
    Fails with: The topic offers "member" no moderator tools
    Given I am a logged in user with the "member" user
    When I open the topic "Weekend baking thread" in "General discussion"
    And I lock the topic

  Scenario: An open topic cannot be unlocked
    Fails with: The moderator tools of the topic offer no "Unlock topic"
    Given I am a logged in user with the "moderator" user
    When I open the topic "Weekend baking thread" in "General discussion"
    And I unlock the topic

  Scenario: A topic that waits for nothing
    Fails with: The approval queue does not list the topic "Weekend baking thread"
    Given I am a logged in user with the "moderator" user
    Then the approval queue should list the topic "Weekend baking thread"

  Scenario: A topic the approval queue does not have cannot be approved
    Fails with: The approval queue lists no topic "Weekend baking thread"
    Given I am a logged in user with the "moderator" user
    When I approve the topic "Weekend baking thread"

  Scenario: A post nobody reported
    Fails with: The open reports do not list "Re: Weekend baking thread"
    Given I am a logged in user with the "moderator" user
    Then the open reports should list "Re: Weekend baking thread"

  Scenario: A report that is not there cannot be closed
    Fails with: The open reports list no report of "Re: Weekend baking thread"
    Given I am a logged in user with the "moderator" user
    When I close the report of "Re: Weekend baking thread"

  Scenario: A reason the report form does not have
    Fails with: The report form has no reason like "it is raining"
    Given I am a logged in user with the "member" user
    When I open the topic "Weekend baking thread" in "General discussion"
    And I report post 2 as "it is raining"

  Scenario: The moderator log has no such entry
    Fails with: The moderator log shows no entry "Webship test entry that is not there"
    Given I am a logged in user with the "moderator" user
    Then the moderator log should show "Webship test entry that is not there"

  Scenario: A member has no approval queue
    Fails with: The approval queue did not open
    Given I am a logged in user with the "member" user
    Then the approval queue should list the topic "Weekend baking thread"

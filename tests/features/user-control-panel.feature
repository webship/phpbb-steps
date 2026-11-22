@ucp
Feature: The user control panel
  As a member of the board
  I want to keep my profile, my preferences and my signature
  So that the board shows me as I want

  Scenario: The pages of the user control panel
    Given I am a logged in user with the "member" user
    When I go to the user control panel
    Then the control panel should show the page "Front page"
    And the control panel should offer the tab "Profile"
    And the control panel should offer the tab "Board preferences"
    And the control panel should offer the tab "Private messages"
    And the control panel should offer the page "Manage drafts"
    When I open "Edit signature" under "Profile" in the user control panel
    Then the control panel should show the page "Edit signature"
    When I open "Edit global settings" under "Board preferences" in the user control panel
    Then the control panel should show the page "Edit global settings"

  Scenario: A member fills in the profile, and takes it back
    Given I am a logged in user with the "member" user
    When I open "Edit profile" under "Profile" in the user control panel
    And I set the setting "Location" to "Webship test town"
    And I save the settings
    Then the board should say "Your profile has been updated."
    When I open the profile of "member"
    Then the profile should show "Username: member"
    And the profile should show "Registered users"
    And the profile should show "Location: Webship test town"
    When I open "Edit profile" under "Profile" in the user control panel
    Then the setting "Location" should be "Webship test town"
    When I set the setting "Location" to ""
    And I save the settings
    And I open the profile of "member"
    Then the profile should not show "Webship test town"

  Scenario: A member changes a preference, and takes it back
    Given I am a logged in user with the "member" user
    When I open "Edit global settings" under "Board preferences" in the user control panel
    Then the setting "Hide my online status" should be "No"
    When I set the setting "Hide my online status" to "Yes"
    And I save the settings
    Then the board should say "Your preferences have been updated."
    When I open "Edit global settings" under "Board preferences" in the user control panel
    Then the setting "Hide my online status" should be "Yes"
    When I set the setting "Hide my online status" to "No"
    And I save the settings
    And I open "Edit global settings" under "Board preferences" in the user control panel
    Then the setting "Hide my online status" should be "No"

  Scenario: A signature
    Given I am a logged in user with the "member" user
    When I set my signature to "Webship test signature with [i]italics[/i]."
    Then the board should say "Your profile has been updated."
    And my signature should be "Webship test signature with [i]italics[/i]."
    When I set my signature to ""
    Then my signature should be ""

  Scenario: A draft is kept, loaded again and deleted
    Given I am a logged in user with the "member" user
    When I start a new topic in "General discussion"
    And I write the subject "Webship test draft" in the editor
    And I write "Webship test: a draft kept for later." in the editor
    And I save the post as a draft
    Then the board should say "Draft successfully saved."
    And my drafts should list "Webship test draft"
    When I load the draft "Webship test draft"
    Then the editor should have the subject "Webship test draft"
    And the editor should contain "Webship test: a draft kept for later."
    When I delete the draft "Webship test draft"
    Then my drafts should not list "Webship test draft"

  Scenario: The members list and a profile
    Given I am a logged in user with the "member" user
    When I go to the members list
    Then the members list should list "member"
    And the members list should list "administrator"
    And the members list should not list "webship-test-nobody"
    When I open the profile of "moderator"
    Then the profile should show "Global moderators"

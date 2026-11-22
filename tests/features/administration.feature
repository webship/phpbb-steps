@administration
Feature: The administration control panel
  As an administrator of the board
  I want to see its settings and its forums
  So that I know how the board is set up

  Scenario: Only an administrator is offered the administration control panel
    Given I am a logged in user with the "moderator" user
    Then I should not see the link to the administration control panel
    Given I am a logged in user with the "administrator" user
    Then I should see the link to the administration control panel

  Scenario: The first page of the administration control panel
    Given I am a logged in user with the "administrator" user
    When I go to the administration control panel
    Then the control panel should offer the tab "General"
    And the control panel should offer the tab "Forums"
    And the control panel should offer the tab "Users and Groups"
    And the control panel should offer the tab "Permissions"
    And the board statistic "Board version" should be "3.3"
    And the board statistic "Database server" should be "MySQL"

  Scenario: The board settings
    Given I am a logged in user with the "administrator" user
    When I open "Board settings" under "General" in the administration control panel
    Then the control panel should show the page "Board settings"
    And the setting "Disable board" should be "No"
    And the setting "Default language" should be "British English"
    And the setting "Default style" should be "prosilver"
    And the setting "Override user style" should be "No"

  Scenario: The forum administration lists the categories and their forums
    Given I am a logged in user with the "administrator" user
    When I open "Manage forums" under "Forums" in the administration control panel
    Then the control panel should show the page "Forum administration"
    And the forum administration should list "Community"
    And the forum administration should list "Staff"
    And the forum administration should not list "General discussion"
    When I open "Community" in the forum administration
    Then the forum administration should list "General discussion"
    And the forum administration should list "Help and support"
    And the forum administration should list "Archive"

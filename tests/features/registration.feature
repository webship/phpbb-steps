@registration
Feature: The refusals of the registration form
  As the owner of the board
  I want the registration form to refuse what it must
  So that accounts are made properly

  # A suite never makes an account: these scenarios only send what the board refuses.

  Scenario: A user name and an address that are taken
    When I open the registration form
    And I try to register with the username "member", the email "member@example.com" and the passwords "dD.123123ddd" and "dD.123123ddd"
    Then the registration should be refused with "The username you entered is already in use, please select an alternative."
    And the registration should be refused with "The entered email address is already in use."

  Scenario: Two passwords that differ
    When I open the registration form
    And I try to register with the username "webship-test-nobody", the email "webship-test-nobody@example.com" and the passwords "dD.123123ddd" and "different-9"
    Then the registration should be refused with "The passwords you entered do not match."

  Scenario: An empty form
    When I open the registration form
    And I try to register with the username "", the email "" and the passwords "" and ""
    Then the registration should be refused with "The username you entered is too short."

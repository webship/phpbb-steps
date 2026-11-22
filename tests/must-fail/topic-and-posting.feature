@must-fail @topic
Feature: Assertions of a topic, the editor, messages and search that must fail
  Each scenario asserts something that is not true on the test site. Its last step must fail with the message
  its description announces, and a hint (tests/check-must-fail.js runs them). They only read: the site is left as
  it was.

  Scenario: A topic the forum does not have
    Fails with: The forum "General discussion" lists no topic "Webship test topic that is not there"
    Given I am not logged in
    When I open the topic "Webship test topic that is not there" in "General discussion"

  Scenario: Another topic
    Fails with: The page is not the topic "Board rules": it is the topic "Weekend baking thread"
    Given I am not logged in
    When I open the topic "Weekend baking thread" in "General discussion"
    Then I should be reading the topic "Board rules"

  Scenario: A forum is not a topic
    Fails with: The page is not a topic
    Given I am not logged in
    When I open the forum "General discussion"
    Then the topic should have 1 post

  Scenario: The posts of a topic
    Fails with: The topic says "13 posts 1 2 Next", not 5 posts
    Given I am not logged in
    When I open the topic "Weekend baking thread" in "General discussion"
    Then the topic should have 5 posts

  Scenario: The author of a post
    Fails with: Post 1 is by "member", not by "moderator"
    Given I am not logged in
    When I open the topic "Weekend baking thread" in "General discussion"
    Then post 1 should be by "moderator"

  Scenario: The text of a post
    Fails with: Post 2 (by moderator) does not read "Boil them before you bake them."
    Given I am not logged in
    When I open the topic "Weekend baking thread" in "General discussion"
    Then post 2 should read "Boil them before you bake them."

  Scenario: A post the page does not have
    Fails with: Post 40 is not on this page: it shows 10 posts
    Given I am not logged in
    When I open the topic "Weekend baking thread" in "General discussion"
    Then post 40 should read "anything"

  Scenario: A post without a quote
    Fails with: Post 1 quotes nothing, not "cinnamon"
    Given I am not logged in
    When I open the topic "Weekend baking thread" in "General discussion"
    Then post 1 should quote "cinnamon"

  Scenario: A post without an attachment
    Fails with: Post 1 shows no attachment, not "webship-test-picture.png"
    Given I am not logged in
    When I open the topic "Weekend baking thread" in "General discussion"
    Then post 1 should show the attachment "webship-test-picture.png"

  Scenario: An open topic is not locked
    Fails with: The topic "Weekend baking thread" is open, not locked
    Given I am not logged in
    When I open the topic "Weekend baking thread" in "General discussion"
    Then the topic should be locked

  Scenario: A locked topic is not open
    Fails with: The topic "Board rules" is locked, not open
    Given I am not logged in
    When I open the topic "Board rules" in "General discussion"
    Then the topic should be open

  Scenario: A topic without a poll
    Fails with: The topic "Weekend baking thread" has no poll
    Given I am not logged in
    When I open the topic "Weekend baking thread" in "General discussion"
    Then the topic should have the poll "Which season do you like best?"

  Scenario: The options of a poll
    Fails with: The poll has the options "Spring", "Summer", "Autumn", "Winter", not "Yes", "No"
    Given I am not logged in
    When I open the topic "Which season do you like best?" in "General discussion"
    Then the topic should have the poll "Which season do you like best?" with the options "Yes" and "No"

  Scenario: A visitor cannot vote
    Fails with: The poll "Which season do you like best?" takes no vote from this account
    Given I am not logged in
    When I open the topic "Which season do you like best?" in "General discussion"
    And I vote for "Summer" in the poll

  Scenario: A topic the member did not bookmark
    Fails with: The topic is not bookmarked by this account
    Given I am a logged in user with the "member" user
    When I open the topic "Start here: how this board works" in "General discussion"
    Then the topic should be bookmarked

  Scenario: A visitor has no topic tools to subscribe with
    Fails with: The tools of the topic offer no "Subscribe topic"
    Given I am not logged in
    When I open the topic "Weekend baking thread" in "General discussion"
    And I subscribe to the topic

  Scenario: A locked forum offers no new topic
    Fails with: The board opened no editor for "New Topic": it says "Forum locked"
    Given I am a logged in user with the "member" user
    When I start a new topic in "Archive"

  Scenario: No editor is open
    Fails with: No editor is open
    Given I am a logged in user with the "member" user
    When I write "Webship test" in the editor

  Scenario: The subject of the editor
    Fails with: The editor has the subject "Re: Weekend baking thread", not "Weekend baking thread"
    Given I am a logged in user with the "member" user
    When I open the topic "Weekend baking thread" in "General discussion"
    And I start a reply to the topic
    Then the editor should have the subject "Weekend baking thread"

  Scenario: The editor of a quote holds the quote
    Fails with: The editor does not contain "cinnamon rolls"
    Given I am a logged in user with the "member" user
    When I open the topic "Weekend baking thread" in "General discussion"
    And I quote post 1 in a reply
    Then the editor should contain "cinnamon rolls"

  Scenario: The preview shows what was written
    Fails with: The preview shows "plain", but not in bold
    Given I am a logged in user with the "member" user
    When I open the topic "Weekend baking thread" in "General discussion"
    And I start a reply to the topic
    And I write "Webship test: a plain word." in the editor
    And I preview the post
    Then the preview should show "plain" in bold

  Scenario: An empty reply is not taken
    Fails with: The board did not take the post: "Your message contains too few characters."
    Given I am a logged in user with the "member" user
    When I open the topic "Weekend baking thread" in "General discussion"
    And I start a reply to the topic
    And I submit the post

  Scenario: The error of the editor
    Fails with: The editor does not show the error "You must specify a subject when posting a new topic."
    Given I am a logged in user with the "member" user
    When I open the topic "Weekend baking thread" in "General discussion"
    And I start a reply to the topic
    And I try to submit the post
    Then the editor should show the error "You must specify a subject when posting a new topic."

  Scenario: A file type the board does not take
    Fails with: The board refused the file "tests/fixtures/webship-test-notes.txt": "Invalid file extension: webship-test-notes.txt"
    Given I am a logged in user with the "member" user
    When I open the topic "Weekend baking thread" in "General discussion"
    And I start a reply to the topic
    And I attach the file "tests/fixtures/webship-test-notes.txt" in the editor

  Scenario: A file that is not there
    Fails with: The file "tests/fixtures/not-there.png" is not there
    Given I am a logged in user with the "member" user
    When I open the topic "Weekend baking thread" in "General discussion"
    And I start a reply to the topic
    And I attach the file "tests/fixtures/not-there.png" in the editor

  Scenario: A locked topic has no quick reply
    Fails with: The page has no quick reply
    Given I am a logged in user with the "member" user
    When I open the topic "Board rules" in "General discussion"
    And I quick reply with "Webship test quick reply."

  Scenario: A member may start a topic in an open forum
    Fails with: The account can start a topic: the editor opened
    Given I am a logged in user with the "member" user
    When I open the forum "General discussion"
    Then I should not be able to start a topic

  Scenario: A member may not edit the post of another
    Fails with: Post 2 (by moderator) offers no "Edit post" to this account
    Given I am a logged in user with the "member" user
    When I open the topic "Weekend baking thread" in "General discussion"
    And I edit post 2

  Scenario: A message the inbox does not have
    Fails with: lists no message "Webship test message that is not there"
    Given I am a logged in user with the "member" user
    When I go to my inbox
    And I open the message "Webship test message that is not there"

  Scenario: A message the inbox has
    Fails with: lists the message "Welcome to the board"
    Given I am a logged in user with the "member" user
    When I go to my inbox
    Then my messages should not list "Welcome to the board"

  Scenario: The sender of a message
    Fails with: The message "Welcome to the board" is from "administrator", not from "moderator"
    Given I am a logged in user with the "member" user
    When I go to my inbox
    And I open the message "Welcome to the board"
    Then the message should be from "moderator"

  Scenario: The text of a message
    Fails with: The message "Welcome to the board" does not read "I moved your first post"
    Given I am a logged in user with the "member" user
    When I go to my inbox
    And I open the message "Welcome to the board"
    Then the message should read "I moved your first post"

  Scenario: A message to nobody is not sent
    Fails with: The board did not send the message "Webship test message" to "webship-test-nobody": "The requested users to be added do not exist."
    Given I am a logged in user with the "member" user
    When I send the message "Webship test message" to "webship-test-nobody" with "Webship test."

  Scenario: A visitor has no private messages
    Fails with: The private messages did not open
    Given I am not logged in
    When I go to my inbox

  Scenario: The number of matches of a search
    Fails with: The search says "Search found 2 matches: sourdough", not 5 matches
    Given I am on the board index
    When I search for "sourdough"
    Then the search should find 5 matches

  Scenario: A result the search does not show
    Fails with: The search results do not show "Board rules"
    Given I am on the board index
    When I search for "sourdough"
    Then the search results should show "Board rules"

  Scenario: A result the search shows
    Fails with: The search results show "Weekend baking thread"
    Given I am on the board index
    When I search for "sourdough"
    Then the search results should not show "Weekend baking thread"

  Scenario: A word the search did not look for
    Fails with: The search results highlight "sourdough", not "bagels"
    Given I am on the board index
    When I search for "sourdough"
    Then the search results should highlight "bagels"

  Scenario: The search hides the forum of the staff from a member
    Fails with: The search results do not show "Moderation notes"
    Given I am a logged in user with the "member" user
    When I search for "moderators"
    Then the search results should show "Moderation notes"

  Scenario: A forum the search does not know
    Fails with: The search knows no forum "Staff room"
    Given I am not logged in
    When I search the topics for "notes" in "Staff room"

  Scenario: A quick link a visitor does not get
    Fails with: The quick links have no "Your posts"
    Given I am not logged in
    When I open the quick link "Your posts"

  Scenario: The board index is not a page of search results
    Fails with: The page is not a page of search results
    Given I am on the board index
    Then the search should find 1 match

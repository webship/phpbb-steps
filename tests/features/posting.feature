@posting
Feature: Posting
  As a member of the board
  I want to start topics and answer them
  So that I take part in the discussion

  Scenario: A member starts a topic, with a preview first
    Given there is no topic "Webship test topic"
    And I am a logged in user with the "member" user
    When I start a new topic in "General discussion"
    And I try to submit the post
    Then the editor should show the error "You must specify a subject when posting a new topic."
    And the editor should show the error "Your message contains too few characters."
    When I write the subject "Webship test topic" in the editor
    And I write "Webship test: a [b]bold[/b] word, a [i]slanted[/i] one and [url=https://example.com]a link[/url]." in the editor
    And I preview the post
    Then the preview should show "Webship test: a bold word"
    And the preview should show "bold" in bold
    And the preview should show "slanted" in italics
    And the preview should show "a link" as a link
    And the editor should have the subject "Webship test topic"
    When I submit the post
    Then I should be reading the topic "Webship test topic"
    And the topic should have 1 post
    And post 1 should be by "member"
    And post 1 should read "Webship test: a bold word, a slanted one and a link."
    And there is no topic "Webship test topic"

  Scenario: Replies: the full editor, a quote, the quick reply, an edit and a deletion
    Given there is a topic "Webship test topic" in "General discussion" by "member"
    And "moderator" replied to the topic "Webship test topic" in "General discussion" with "Webship test reply of the moderator."
    And I am a logged in user with the "member" user
    When I open the topic "Webship test topic" in "General discussion"
    Then the topic should have 2 posts
    And the last post should be by "moderator"
    When I quote the last post in a reply
    Then the editor should have the subject "Re: Webship test topic"
    And the editor should contain "[quote=moderator"
    When I add "Webship test: an answer to the quote." to the editor
    And I submit the post
    Then the topic should have 3 posts
    And the last post should quote "Webship test reply of the moderator." by "moderator"
    And the last post should read "Webship test: an answer to the quote."
    When I quick reply with "Webship test quick reply."
    Then the topic should have 4 posts
    And the last post should read "Webship test quick reply."
    When I edit the last post
    And I write "Webship test quick reply, changed." in the editor
    And I submit the post
    Then the last post should read "Webship test quick reply, changed."
    When I delete the last post permanently
    Then the topic should have 3 posts
    When I reply to the topic with "Webship test: the last word."
    Then the last post should be by "member"
    And the last post should read "Webship test: the last word."
    And there is no topic "Webship test topic"

  Scenario: An attachment the board allows, and one it refuses
    Given there is a topic "Webship test topic" in "General discussion" by "member"
    And I am a logged in user with the "member" user
    When I open the topic "Webship test topic" in "General discussion"
    And I start a reply to the topic
    And I write "Webship test: a reply with a picture." in the editor
    And I try to attach the file "tests/fixtures/webship-test-notes.txt" in the editor
    Then the attachment should be refused with "Invalid file extension: webship-test-notes.txt"
    And the editor should not list the attachment "webship-test-notes.txt"
    When I attach the file "tests/fixtures/webship-test-picture.png" in the editor
    Then the editor should list the attachment "webship-test-picture.png"
    When I submit the post
    Then the last post should show the attachment "webship-test-picture.png"
    And there is no topic "Webship test topic"

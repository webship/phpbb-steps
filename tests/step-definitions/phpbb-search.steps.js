'use strict';

// Search: the search box at the top of the page, the advanced search (posts
// or topics, by author, in a forum), the results and their highlights, and
// the quick links of the board (your posts, unanswered topics, active topics).

const { When, Then } = require('@cucumber/cucumber');
const { friendly } = require('webship-js/tests/step-definitions/webship');
const h = require('./phpbb-helpers');

/** The results of the search page on screen: posts or topics, with the heading of the page. */
async function results(world) {
  const page = world.page;
  if (!(await page.locator('body.section-search').count())) {
    throw friendly({ message: `The page is not a page of search results: ${await h.pageSummary(world)}.`, hint: h.hintFor(world, 'Search first: When I search for "…"') });
  }
  return page.evaluate(() => {
    const t = (e) => (e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '');
    const heading = t(document.querySelector('h2.searchresults-title, #page-body h2'));
    const count = t(document.querySelector('.action-bar .pagination'));
    const posts = [...document.querySelectorAll('.search.post')].map((p) => ({
      title: t(p.querySelector('h3')),
      text: t(p.querySelector('.content')),
      meta: t(p.querySelector('.postprofile')),
      highlights: [...p.querySelectorAll('.posthilit')].map(t),
      href: (p.querySelector('h3 a, .searchresults a') || { getAttribute() { return ''; } }).getAttribute('href'),
    }));
    const topics = [...document.querySelectorAll('ul.topiclist.topics > li.row')].map((r) => ({
      title: t(r.querySelector('a.topictitle')),
      text: t(r.querySelector('.list-inner')),
      meta: t(r.querySelector('.list-inner')),
      highlights: [...r.querySelectorAll('.posthilit')].map(t),
      href: (r.querySelector('a.topictitle') || { getAttribute() { return ''; } }).getAttribute('href'),
    }));
    return { heading, count, items: posts.length ? posts : topics, kind: posts.length ? 'posts' : 'topics', none: /No suitable matches were found/.test(t(document.querySelector('#page-body'))) };
  });
}

/**
 * Search the board with the search box at the top of the page: the keywords, then its button. The board
 * lists the posts that match.
 *
 * Example #1: When I search for "sourdough"
 * Example #2: When we search for "bagels"
 * Example #3: And I search for "webship-test-nothing-to-find"
 * Example #4: When I search for "drafts"
 * Example #5: Then we search for "cinnamon rolls"
 */
When(/^(?:I|we) search for "([^"]*)"$/, async function (keywords) {
  const page = this.page;
  if (!(await page.locator('#search-box form#search').count())) await h.open(this, h.absolute(this, 'index.php'));
  const form = page.locator('#search-box form#search').first();
  if (!(await form.count())) throw friendly({ message: `The page has no search box: ${await h.pageSummary(this)}.`, hint: h.hintFor(this, 'The search box is at the top of the pages of the board, for the accounts that may search.') });
  await form.locator('input[name="keywords"]').fill(keywords);
  await h.afterNavigation(this, () => form.locator('button[type="submit"]').click());
});

/**
 * Search with the advanced search: the keywords, shown as posts or as topics, and optionally by an author (a
 * handle of the users registry or a user name) and in a forum.
 *
 * Example #1: When I search the posts for "sourdough"
 * Example #2: When I search the topics for "sourdough"
 * Example #3: And we search the posts for "flour" by "member"
 * Example #4: When I search the topics for "drafts" in "Help and support"
 * Example #5: When we search the posts for "weekend" by "moderator" in "General discussion"
 */
When(/^(?:I|we) search the (posts|topics) for "([^"]*)"(?: by "([^"]*)")?(?: in "([^"]*)")?$/, async function (kind, keywords, author, forum) {
  const page = this.page;
  await h.open(this, h.absolute(this, 'search.php'));
  const form = page.locator('#page-body form[action*="search.php"]').filter({ has: page.locator('#search_forum') }).first();
  if (!(await form.count())) throw friendly({ message: `The advanced search did not open: ${await h.pageSummary(this)}.`, hint: h.hintFor(this, 'A board can keep the search from visitors.') });
  await form.locator('#keywords').fill(keywords);
  if (author) await form.locator('#author').fill(h.usernameOf(this, author));
  if (forum) {
    const options = await form.locator('#search_forum option').evaluateAll((els) => els.map((o) => ({ value: o.value, text: (o.textContent || '').replace(/[↳ \s]+/g, ' ').trim() })));
    const hit = options.find((o) => h.normalName(o.text) === h.normalName(forum));
    if (!hit) throw friendly({ message: `The search knows no forum "${forum}". Its forums: ${h.listed(options.map((o) => o.text))}.`, hint: 'The search lists the forums the account may read.' });
    await form.locator('#search_forum').selectOption(hit.value);
  }
  await form.locator(kind === 'topics' ? '#show_results2' : '#show_results1').check();
  await h.afterNavigation(this, () => form.locator('input[name="submit"]').first().click());
});

/**
 * Assert how many matches the search found, as the heading of the results says ("Search found 2 matches").
 *
 * Example #1: Then the search should find 2 matches
 * Example #2: Then the search should find 1 match
 * Example #3: And the search should find 0 matches
 * Example #4: Then the search should find 27 matches
 * Example #5: And the search should find 3 matches
 */
Then(/^the search should find (\d+) match(?:es)?$/, async function (count) {
  const r = await results(this);
  const m = `${r.heading} ${r.count}`.match(/Search found (\d+) match/i);
  if (!m || parseInt(m[1], 10) !== parseInt(count, 10)) {
    throw friendly({ message: `The search says "${r.heading || r.count || '(nothing)'}", not ${count} match${count === '1' ? '' : 'es'}. Its results: ${h.listed(r.items.map((i) => i.title).slice(0, 8))}.`, hint: 'The search counts posts, or topics when the results are shown as topics. It leaves out very common words.' });
  }
});

/**
 * Assert that the search results on screen show a text (in the title or the text of a result), or do not.
 *
 * Example #1: Then the search results should show "Weekend baking thread"
 * Example #2: Then the search results should not show "Board rules"
 * Example #3: And the search results should show "The sourdough came out well"
 * Example #4: And the search results should not show "Moderation notes"
 * Example #5: Then the search results should show "No suitable matches were found."
 */
Then(/^the search results should (not )?show "([^"]*)"$/, async function (notCase, expected) {
  const r = await results(this);
  const has = r.items.some((i) => h.mentions(i.title, expected) || h.mentions(i.text, expected)) || (r.none && h.mentions('No suitable matches were found.', expected));
  if (has === !!notCase) {
    throw friendly({ message: `The search results ${has ? 'show' : 'do not show'} "${expected}". They are: ${r.none ? '"No suitable matches were found."' : h.listed(r.items.map((i) => i.title).slice(0, 10))} (${r.heading}).`, hint: 'The search finds what the account may read.' });
  }
});

/**
 * Assert that the search results on screen mark a word as found (the board highlights the keywords in the text
 * of each result).
 *
 * Example #1: Then the search results should highlight "sourdough"
 * Example #2: Then the search results should highlight "bagels"
 * Example #3: And the search results should highlight "drafts"
 * Example #4: And the search results should highlight "flour"
 * Example #5: Then the search results should highlight "rye"
 */
Then(/^the search results should highlight "([^"]*)"$/, async function (word) {
  const r = await results(this);
  const marks = r.items.flatMap((i) => i.highlights);
  if (!marks.some((m) => h.normal(m) === h.normal(word))) {
    throw friendly({ message: `The search results highlight ${h.listed(marks)}, not "${word}".`, hint: 'The board highlights the keywords in results shown as posts.' });
  }
});

/**
 * Open a result of the search on screen by its title (the first that carries it): the post or the topic.
 *
 * Example #1: When I open the search result "Weekend baking thread"
 * Example #2: When we open the search result "Re: Weekend baking thread"
 * Example #3: And I open the search result "Question 01: where do I find my drafts?"
 * Example #4: Then I open the search result "Weekend baking thread"
 * Example #5: And we open the search result "Hello from the member"
 */
When(/^(?:I|we) open the search result "([^"]*)"$/, async function (title) {
  const r = await results(this);
  const item = r.items.find((i) => h.normal(i.title) === h.normal(title));
  if (!item || !item.href) throw friendly({ message: `The search results have no "${title}". They are: ${h.listed(r.items.map((i) => i.title).slice(0, 10))}.`, hint: 'Name the result by its title, as the results show it.' });
  await h.open(this, h.absolute(this, item.href));
});

/**
 * Open a quick link of the board, from the "Quick links" menu at the top of the page: "Your posts", "New
 * posts", "Unread posts", "Unanswered topics", "Active topics", "Members", "The team".
 *
 * Example #1: When I open the quick link "Your posts"
 * Example #2: When we open the quick link "Unanswered topics"
 * Example #3: And I open the quick link "Active topics"
 * Example #4: When I open the quick link "The team"
 * Example #5: And we open the quick link "Members"
 */
When(/^(?:I|we) open the quick link "([^"]*)"$/, async function (name) {
  const page = this.page;
  if (!(await page.locator('#quick-links').count())) await h.open(this, h.absolute(this, 'index.php'));
  const menu = await h.openDropdown(this, page.locator('#quick-links'));
  const links = await h.linkList(menu.locator('a'));
  const hit = links.find((l) => h.normal(l.text) === h.normal(name));
  if (!hit) throw friendly({ message: `The quick links have no "${name}". They are: ${h.listed(links.map((l) => l.text))}.`, hint: 'A visitor gets fewer quick links than an account.' });
  await h.afterNavigation(this, () => menu.locator('a').filter({ hasText: h.exactly(name) }).first().click());
});

/**
 * Assert the heading of the page of search results or of a quick link ("Your posts", "Unanswered topics").
 *
 * Example #1: Then the search page should be "Your posts"
 * Example #2: Then the search page should be "Unanswered topics"
 * Example #3: And the search page should be "Active topics"
 * Example #4: Then the search page should be "Search found 2 matches: sourdough"
 * Example #5: And the search page should be "New posts"
 */
Then(/^the search page should be "([^"]*)"$/, async function (expected) {
  const r = await results(this);
  if (h.normal(r.heading) !== h.normal(expected)) throw friendly({ message: `The page is "${r.heading}", not "${expected}".`, hint: 'The heading of a page of results names the search or the quick link.' });
});

module.exports = { results };

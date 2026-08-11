import { describe, expect, it } from "vitest";
import { extractHeadings } from "./learn-content";

describe("extractHeadings", () => {
  it("takes the anchor verbatim from the id rehype-slug emitted", () => {
    // Each of these ids differs from a naive re-slug of the text: kept hyphen,
    // kept underscore, one dash per space, and a preserved trailing dash.
    const html = [
      '<h2 id="test-driven-development">Test-Driven Development</h2>',
      '<h2 id="snake_case_name">Snake_case_name</h2>',
      '<h2 id="multi---space">Multi   Space</h2>',
      '<h2 id="trailing-dash--">Trailing Dash -</h2>',
    ].join("\n");

    expect(extractHeadings(html).map((h) => h.anchor)).toEqual([
      "test-driven-development",
      "snake_case_name",
      "multi---space",
      "trailing-dash--",
    ]);
  });

  it("records the heading level", () => {
    const html = '<h2 id="a">A</h2><h3 id="b">B</h3>';
    expect(extractHeadings(html).map((h) => h.level)).toEqual([2, 3]);
  });

  it("keeps document order", () => {
    const html = '<h3 id="one">One</h3><h2 id="two">Two</h2>';
    expect(extractHeadings(html).map((h) => h.anchor)).toEqual(["one", "two"]);
  });

  it("strips inline markup from the display text", () => {
    const html = '<h2 id="x">Use <code>git rebase</code> and <em>care</em></h2>';
    expect(extractHeadings(html)[0]?.text).toBe("Use git rebase and care");
  });

  it("decodes entities, and decodes an ampersand only once", () => {
    const html = [
      '<h2 id="a">APIs &#x26; SDKs</h2>',
      '<h2 id="b">A &amp;amp; B</h2>',
      '<h2 id="c">&lt;script&gt; &quot;q&quot; &#39;s&#39;</h2>',
    ].join("");
    expect(extractHeadings(html).map((h) => h.text)).toEqual([
      "APIs & SDKs",
      "A &amp; B",
      "<script> \"q\" \'s\'",
    ]);
  });

  it("ignores h1 and h4, matching the old table-of-contents scope", () => {
    const html = '<h1 id="t">T</h1><h2 id="a">A</h2><h4 id="d">D</h4>';
    expect(extractHeadings(html).map((h) => h.anchor)).toEqual(["a"]);
  });

  it("returns nothing for HTML with no headings", () => {
    expect(extractHeadings("<p>Body.</p>")).toEqual([]);
  });
});

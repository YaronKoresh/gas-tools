const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const EscapeHtml = new Function(`${source.match(/function EscapeHtml\b[\s\S]*?\n}\n/)[0]}; return EscapeHtml;`)();

test("EscapeHtml escapes the five html characters", () => {
  assert.strictEqual(EscapeHtml(`<a href="x" title='y'>&</a>`), "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
});

test("EscapeHtml escapes the ampersand first so entities are not escaped twice", () => {
  assert.strictEqual(EscapeHtml("a&b<c"), "a&amp;b&lt;c");
});

test("EscapeHtml turns other values into text", () => {
  assert.strictEqual(EscapeHtml(12), "12");
  assert.strictEqual(EscapeHtml("שלום"), "שלום");
});

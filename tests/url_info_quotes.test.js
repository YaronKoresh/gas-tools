const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const start = source.indexOf("function UrlInfo");
const end = source.indexOf("function RelativeToAbsoluteUrl");
const domainSource = source.match(/const domain = .*;/)[0];

function run(html) {
  const env = {
    FinalUrl: (u) => u,
    GetSync: () => ({ getContent: () => [...Buffer.from(html)] }),
    Utilities: { newBlob: (bytes) => ({ getDataAsString: () => Buffer.from(bytes).toString() }) },
    Html: (s) => s,
    Out: (s) => s,
    RelativeToAbsoluteUrl: (u, r) => r,
  };
  const UrlInfo = new Function(...Object.keys(env), `${domainSource}${source.slice(start, end)}; return UrlInfo;`)(...Object.values(env));
  const orig = console.log;
  console.log = () => {};
  try {
    return String(UrlInfo("example.com"));
  } finally {
    console.log = orig;
  }
}

const page = (body) => `<html><head><title>t</title></head><body>${body}</body></html>`;

test("an apostrophe in the text does not swallow the rest of the page", () => {
  const out = run(page("<p>it's fine</p><p>second</p>"));
  assert.ok(out.includes("<p>it's fine</p><p>second</p>"), out);
});

test("several apostrophes in the text keep every paragraph as markup", () => {
  const out = run(page("<p>it's</p><p>don't</p><p>third</p>"));
  assert.ok(out.includes("<p>it's</p><p>don't</p><p>third</p>"), out);
  assert.ok(!out.includes("&lt;/p&gt;"));
});

test("an apostrophe inside a double quoted attribute does not open a quote", () => {
  const out = run(page(`<p title="it's">x</p><p>it's fine</p><p>last</p>`));
  assert.ok(out.includes(`<p title="it's">x</p><p>it's fine</p><p>last</p>`), out);
});

test("a less-than sign in the text is escaped and the page stays intact", () => {
  const out = run(page("<p>1 < 2</p><p>next</p>"));
  assert.ok(out.includes("<p>1 &lt; 2</p><p>next</p>"), out);
});

test("a quote inside a script string does not hide the markup after the script", () => {
  const out = run(`<html><head><script>var a = "it's"; var b = 'say "x"';</script></head><body><div>ok</div><p>after</p></body></html>`);
  assert.ok(out.includes("<div>ok</div><p>after</p>"), out);
});

test("an HTML comment is dropped instead of showing up as text", () => {
  const out = run(page("<!-- hidden note --><p>x</p>"));
  assert.ok(!out.includes("hidden note"), out);
  assert.ok(!out.includes("--"), out);
  assert.ok(out.includes("<p>x</p>"), out);
});

test("a comment with tags and quotes inside does not disturb the page", () => {
  const out = run(page(`<!-- <div class="a"> it's --><p>x</p><p>y</p>`));
  assert.ok(out.includes("<p>x</p><p>y</p>"), out);
  assert.ok(!out.includes("class"), out);
});

test("a page without a body tag keeps its content", () => {
  const out = run("<p>just text</p><p>more</p>");
  assert.ok(out.includes("<body><p>just text</p><p>more</p></body>"), out);
});

test("content after the head of a page without a body tag is kept", () => {
  const out = run("<!doctype html><html><head><title>t</title></head><p>after head</p></html>");
  assert.ok(out.includes("<body><p>after head</p></body>"), out);
});

test("a page with a body tag is not wrapped twice", () => {
  const out = run(page("<p>x</p>"));
  assert.strictEqual((out.match(/<body>/g) || []).length, 1, out);
});

test("escaped angle brackets in the text stay text and do not become tags", () => {
  const out = run(page("<p>Use &lt;div&gt; tags</p><p>after</p>"));
  assert.ok(out.includes("<p>Use &lt;div&gt; tags</p><p>after</p>"), out);
});

test("escaped markup in an attribute value is not turned into a tag", () => {
  const out = run(page('<p title="&lt;b&gt;bold&lt;/b&gt;">x</p><p>y</p>'));
  assert.ok(out.includes("<p>y</p>"), out);
  assert.ok(!out.includes("<b>"), out);
});

test("spaces around inline elements are kept so words do not stick together", () => {
  const out = run(page("<p>Hello <b>big</b> <i>world</i> again</p>"));
  assert.ok(out.includes("<p>Hello <b>big</b> <i>world</i> again</p>"), out);
});

test("a space between two links is kept", () => {
  const out = run(page("<p><a>x</a> <a>y</a></p>"));
  assert.ok(out.includes("<p><a>x</a> <a>y</a></p>"), out);
});

test("text inside pre keeps its line breaks and indentation", () => {
  const out = run(page("<pre>  a\n    b</pre><p>after text</p>"));
  assert.ok(out.includes("<pre>  a\n    b</pre><p>after text</p>"), out);
});

test("text after a pre block is trimmed again", () => {
  const out = run(page("<pre>x</pre><p>  spaced  </p>"));
  assert.ok(out.includes("<p> spaced </p>"), out);
});

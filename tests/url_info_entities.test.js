const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const start = source.indexOf("function UrlInfo");
const end = source.indexOf("function RelativeToAbsoluteUrl");
const domainSource = source.match(/const domain = .*;/)[0];
const relativeSource = source.match(/function RelativeToAbsoluteUrl[\s\S]*\n}\n/)[0];

function run(html, address = "http://example.com/dir/page.html") {
  const env = {
    FinalUrl: (u) => u,
    GetSync: () => ({ getContent: () => [...Buffer.from(html)] }),
    Utilities: { newBlob: (bytes) => ({ getDataAsString: () => Buffer.from(bytes).toString() }) },
    Html: (s) => s,
    Out: (s) => s,
  };
  const UrlInfo = new Function(...Object.keys(env), `${domainSource}${source.slice(start, end)}${relativeSource}; return UrlInfo;`)(...Object.values(env));
  const orig = console.log;
  console.log = () => {};
  try {
    return String(UrlInfo(address)).replace(/redirect_\d+/g, "R");
  } finally {
    console.log = orig;
  }
}

const page = (body, head = "") => `<html><head>${head}</head><body>${body}</body></html>`;

test("escaped markup in the text of a page stays escaped", () => {
  const out = run(page("<p>&amp;lt;b&amp;gt; and a &amp; b &lt; c</p>"));
  assert.ok(out.includes("<p>&amp;lt;b&amp;gt; and a &amp; b &lt; c</p>"), out);
});

test("an ampersand entity in an inline script is not changed", () => {
  const out = run(page('<p>x</p><script>var s = "a &amp;&amp; b";</script>'));
  assert.ok(out.includes('var s = "a &amp;&amp; b";'), out);
});

test("an ampersand entity in a plain attribute stays an entity", () => {
  const out = run(page('<p title="t &amp; u">x</p>'));
  assert.ok(out.includes('<p title="t &amp; u">x</p>'), out);
});

test("ampersand entities in link and style urls are still decoded inside the redirect value", () => {
  const out = run(page('<a href="x?a=1&amp;b=2">l</a><div style="background:url(a.png?x=1&amp;y=2)">z</div>'));
  assert.ok(out.includes('href="http://localhost:8000?R=http://example.com/dir/x?a=1%26b=2"'), out);
  assert.ok(out.includes("a.png?x=1%26y=2"), out);
});

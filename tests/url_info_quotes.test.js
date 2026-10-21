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

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

test("a script that holds a comment opener in a string does not remove the rest of the page", () => {
  const out = run(page('<p>one</p><script>var s = "<!-- not a comment";</script><p>two</p>'));
  assert.ok(out.includes("<p>one</p>"), out);
  assert.ok(out.includes("<p>two</p>"), out);
});

test("a style that holds a comment opener does not remove the rest of the page", () => {
  const out = run(page("<p>k</p>", "<style>/* <!-- */ p{color:red}</style>"));
  assert.ok(out.includes("p{color:red}"), out);
  assert.ok(out.includes("<p>k</p>"), out);
});

test("a textarea keeps the comment text it holds", () => {
  const out = run(page("<textarea><!-- keep --></textarea>"));
  assert.ok(out.includes("keep --></textarea>"), out);
});

test("real comments are still removed, also when they hide a script", () => {
  const out = run(page("<p>a<!--[if IE]><p>hidden<![endif]-->b</p><!-- <script>x</script> --><p>c</p>"));
  assert.ok(out.includes("<p>ab</p><p>c</p>"), out);
  assert.ok(!out.includes("hidden"), out);
});

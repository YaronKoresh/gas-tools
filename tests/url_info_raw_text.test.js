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

test("angle brackets inside script strings reach the output unchanged", () => {
  const out = run(page('<p>one</p>', '<script>var h = "<b>x</b>"; if (1 > 0 && a < b) {}</script>'));
  assert.ok(out.includes('<script>var h = "<b>x</b>"; if (1 > 0 && a < b) {}</script>'), out);
});

test("angle brackets inside style strings reach the output unchanged", () => {
  const out = run(page("<p>one</p>", '<style>a[title=">"]{color:red} p::after{content:"<"}</style>'));
  assert.ok(out.includes('<style>a[title=">"]{color:red} p::after{content:"<"}</style>'), out);
});

test("a script and a style in the body do not turn their text into page elements", () => {
  const out = run(page('<p>one</p><script>var h = "<b>x</b>";</script><style>p::after{content:"<i>"}</style>'));
  assert.ok(!out.includes("<b></b>"), out);
  assert.ok(!out.includes("<i></i>"), out);
  assert.ok(out.includes('<p>one</p>'), out);
  assert.ok(out.includes('content:"<i>"'), out);
});

test("angle brackets in normal text and attributes are still escaped", () => {
  const out = run(page('<p title="a > b">5 < 6</p>'));
  assert.ok(out.includes('<p title="a &gt; b">5 &lt; 6</p>'), out);
});

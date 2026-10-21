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

const count = (text, part) => text.split(part).length - 1;

test("a style block inside the body is written once and its urls are rewritten", () => {
  const out = run('<html><head></head><body><style>@import "/a.css";p{background:url(/in.png)}</style><p>x</p></body></html>');
  assert.strictEqual(count(out, "<style>"), 1, out);
  assert.ok(!out.includes('url(/in.png)'), out);
  assert.ok(!out.includes('"/a.css"'), out);
  assert.ok(out.includes("url(http://localhost:8000?R=http://example.com/in.png)"), out);
  assert.ok(out.includes("<p>x</p>"), out);
});

test("a meta tag inside the body is written once", () => {
  const out = run('<html><head></head><body><p>x</p><meta name="a" content="/b"></body></html>');
  assert.strictEqual(count(out, "<meta name=\"a\""), 1, out);
  assert.ok(out.includes('content="http://localhost:8000?R=http://example.com/b"'), out);
});

test("text and elements after a body style block are kept", () => {
  const out = run('<html><head></head><body><p>one</p><style>p{color:red}</style><p>two <b>three</b></p></body></html>');
  assert.ok(out.includes("<p>one</p>"), out);
  assert.ok(out.includes("<p>two <b>three</b></p>"), out);
  assert.strictEqual(count(out, "p{color:red}"), 1, out);
});

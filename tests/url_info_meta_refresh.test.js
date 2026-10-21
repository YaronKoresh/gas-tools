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

test("a meta refresh is not copied because it would move the clone to another page", () => {
  const out = run(page("<p>x</p>", '<meta http-equiv="refresh" content="0; url=/next"><meta name="description" content="d">'));
  assert.ok(!out.toLowerCase().includes("refresh"), out);
  assert.ok(out.includes('<meta name="description" content="d">'), out);
});

test("a meta refresh with single quotes and different case is not copied", () => {
  const out = run(page("<p>x</p>", "<meta HTTP-EQUIV='Refresh' content='5'>"));
  assert.ok(!out.toLowerCase().includes("refresh"), out);
});

test("other http-equiv meta tags are kept", () => {
  const out = run(page("<p>x</p>", '<meta http-equiv="content-type" content="text/html">'));
  assert.ok(out.includes('http-equiv="content-type"'), out);
});

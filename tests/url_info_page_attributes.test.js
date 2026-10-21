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

const page = (body, head = "", htmlAttributes = "", bodyAttributes = "") => `<html${htmlAttributes}><head>${head}</head><body${bodyAttributes}>${body}</body></html>`;

test("the direction and language of the page are kept", () => {
  const out = run(page("<p>x</p>", "", ' lang="he" dir=rtl', ' dir="rtl"'));
  assert.ok(out.includes('<html lang="he" dir="rtl"><head>'), out);
  assert.ok(out.includes('<body dir="rtl"><p>x</p>'), out);
});

test("class, id and style of the body are kept and the style urls go through the redirect", () => {
  const out = run(page("<p>x</p>", "", "", ' class="dark x" id=top style="background:url(b.png)"'));
  assert.ok(out.includes('<body class="dark x" id="top" style="background:url(http://localhost:8000?R=http://example.com/dir/b.png)">'), out);
});

test("event handlers and other attributes of the body are not copied", () => {
  const out = run(page("<p>x</p>", "", ' onclick="evil()"', ' onload="evil()" data-x="1"'));
  assert.ok(!out.includes("evil"), out);
  assert.ok(out.includes("<body><p>x</p>"), out);
  assert.ok(out.includes("<html><head>"), out);
});

test("a page without html and body attributes gets plain tags", () => {
  const out = run("<p>fragment</p>");
  assert.ok(out.includes("<html><head>"), out);
  assert.ok(out.includes("<body><p>fragment</p>"), out);
});

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

test("a link with several query values stays inside the redirect value", () => {
  const out = run(page('<a href="x?a=1&amp;b=2">l</a>'));
  assert.ok(out.includes('href="http://localhost:8000?R=http://example.com/dir/x?a=1%26b=2"'), out);
});

test("plus signs of a link are escaped in the redirect value", () => {
  const out = run(page('<a href="x?q=a+b">l</a>'));
  assert.ok(out.includes('href="http://localhost:8000?R=http://example.com/dir/x?q=a%2Bb"'), out);
});

test("images and stylesheet urls keep their whole query in the redirect value", () => {
  const out = run(page('<img src="i.png?w=1&amp;h=2"><div style="background:url(b.png?x=1&y=2)"></div>'));
  assert.ok(out.includes('src="http://localhost:8000?R=http://example.com/dir/i.png?w=1%26h=2"'), out);
  assert.ok(out.includes("b.png?x=1%26y=2"), out);
});

test("a link without special characters is unchanged", () => {
  const out = run(page('<a href="x.html">l</a>'));
  assert.ok(out.includes('href="http://localhost:8000?R=http://example.com/dir/x.html"'), out);
});

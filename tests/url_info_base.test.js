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

const page = (head, body) => `<html><head>${head}</head><body>${body}</body></html>`;

test("relative links resolve against the base tag of the page", () => {
  const out = run(page('<base href="/sub/">', '<a href="x.html">l</a><img src="i.png">'));
  assert.ok(out.includes('href="http://localhost:8000?R=http://example.com/sub/x.html"'), out);
  assert.ok(out.includes('src="http://localhost:8000?R=http://example.com/sub/i.png"'), out);
});

test("an absolute base href moves relative links to that host", () => {
  const out = run(page("<base href='https://cdn.example.org/assets/'>", '<img src="i.png">'));
  assert.ok(out.includes('src="http://localhost:8000?R=https://cdn.example.org/assets/i.png"'), out);
});

test("a page without a base tag still resolves against its own address", () => {
  const out = run(page("", '<a href="x.html">l</a>'));
  assert.ok(out.includes('href="http://localhost:8000?R=http://example.com/dir/x.html"'), out);
});

test("a base tag inside a comment is ignored", () => {
  const out = run(page("<!-- <base href='/old/'> -->", '<a href="x.html">l</a>'));
  assert.ok(out.includes('href="http://localhost:8000?R=http://example.com/dir/x.html"'), out);
});

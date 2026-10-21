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

test("links and images whose path starts with a digit go through the redirect", () => {
  const out = run(page('<a href="2024/post.html">y</a><img src="1.png"><a href="404.html">n</a>'));
  assert.ok(out.includes('href="http://localhost:8000?R=http://example.com/dir/2024/post.html"'), out);
  assert.ok(out.includes('src="http://localhost:8000?R=http://example.com/dir/1.png"'), out);
  assert.ok(out.includes('href="http://localhost:8000?R=http://example.com/dir/404.html"'), out);
});

test("a stylesheet link in the head whose path starts with a digit goes through the redirect", () => {
  const out = run(page("<p>x</p>", '<link rel="stylesheet" href="2.css">'));
  assert.ok(out.includes('href="http://localhost:8000?R=http://example.com/dir/2.css"'), out);
});

test("a url with a space keeps the whole path and the space is escaped", () => {
  const out = run(page('<img src="a b.png"><a href="x y">s</a>'));
  assert.ok(out.includes('src="http://localhost:8000?R=http://example.com/dir/a%20b.png"'), out);
  assert.ok(out.includes('href="http://localhost:8000?R=http://example.com/dir/x%20y"'), out);
});

test("srcset still picks the last candidate and skips the descriptors", () => {
  const out = run(page('<img srcset="a.png 1x, b.png 2x"><img srcset="s.png 100w, l.png 200w">'));
  assert.ok(out.includes('src="http://localhost:8000?R=http://example.com/dir/b.png"'), out);
  assert.ok(out.includes('src="http://localhost:8000?R=http://example.com/dir/l.png"'), out);
});

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const domainSource = source.match(/const domain = .*;/)[0];
const fnSource = source.match(/function RelativeToAbsoluteUrl[\s\S]*\n}\n/)[0];
const resolve = new Function(`${domainSource}${fnSource}; return RelativeToAbsoluteUrl;`)();

const cases = [
  ["https://a.com/dir/page.html", "img.png", "https://a.com/dir/img.png"],
  ["https://a.com/dir/page.html", "./img.png", "https://a.com/dir/img.png"],
  ["https://a.com/dir/page.html", "../img.png", "https://a.com/img.png"],
  ["https://a.com/dir/page.html", "../../img.png", "https://a.com/img.png"],
  ["https://a.com/dir/", "img.png", "https://a.com/dir/img.png"],
  ["https://a.com/dir/page.html?x=1", "img.png", "https://a.com/dir/img.png"],
  ["https://a.com", "img.png", "https://a.com/img.png"],
  ["https://a.com/p", "//cdn.com/x.js", "https://cdn.com/x.js"],
  ["http://a.com/p", "//cdn.com/x.js", "http://cdn.com/x.js"],
  ["https://a.com/p/q", "/r", "https://a.com/r"],
  ["https://a.com/p?x=1", "?y=2", "https://a.com/p?y=2"],
  ["https://a.com/p#a", "#b", "https://a.com/p#b"],
  ["https://a.com:8080/p/q.html", "z.js", "https://a.com:8080/p/z.js"],
  ["https://a.com/dir/sub", "x.css", "https://a.com/dir/x.css"],
  ["https://a.com/dir/page.html", "img.png?v=2#top", "https://a.com/dir/img.png?v=2#top"],
  ["https://a.com/dir/page.html", "https://b.org/x", "https://b.org/x"],
  ["https://a.com/dir/page.html", "mailto:x@y.z", "mailto:x@y.z"],
  ["https://a.com/dir/page.html", "tel:+123", "tel:+123"],
  ["https://a.com/dir/page.html", "data:image/png;base64,AAA", "data:image/png;base64,AAA"],
  ["https://a.com/dir/page.html", "/q?a=1&amp;b=2", "https://a.com/q?a=1&b=2"],
];

for (const [base, rel, expected] of cases) {
  test(`${base} + ${rel}`, () => {
    assert.strictEqual(resolve(base, rel), expected);
  });
}

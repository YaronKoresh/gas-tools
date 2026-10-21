const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const domainSource = source.match(/const domain = .*;/)[0];
const fnSource = source.match(/function FinalUrl[\s\S]*?\n}\n/)[0];

function load(map) {
  const UrlFetchApp = { fetch: (u) => ({ getHeaders: () => ({ Location: map[u] }) }) };
  return new Function("UrlFetchApp", `${domainSource}${fnSource}; return FinalUrl;`)(UrlFetchApp);
}

test("FinalUrl follows a path-only Location", () => {
  const f = load({ "https://a.example.com/x": "/y" });
  assert.strictEqual(f("https://a.example.com/x"), "https://a.example.com/y");
});

test("FinalUrl follows a chain of absolute and path-only redirects", () => {
  const f = load({
    "https://a.example.com/x": "/y",
    "https://a.example.com/y": "https://b.example.org/z",
    "https://b.example.org/z": "/final",
  });
  assert.strictEqual(f("https://a.example.com/x"), "https://b.example.org/final");
});

test("FinalUrl returns the url when there is no redirect", () => {
  const f = load({});
  assert.strictEqual(f("https://a.example.com/x"), "https://a.example.com/x");
});

test("FinalUrl keeps the port of the current host for a path-only Location", () => {
  const f = load({ "http://a.example.com:8080/x": "/y" });
  assert.strictEqual(f("http://a.example.com:8080/x"), "http://a.example.com:8080/y");
});

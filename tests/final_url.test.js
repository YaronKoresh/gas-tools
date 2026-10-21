const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const domainSource = source.match(/const domain = .*;/)[0];
const fnSource = source.match(/function FinalUrl[\s\S]*?\n}\n/)[0];
const relativeSource = source.match(/function RelativeToAbsoluteUrl[\s\S]*?\n}\n/)[0];

function load(map) {
  const UrlFetchApp = { fetch: (u) => ({ getHeaders: () => ({ Location: map[u] }) }) };
  return new Function("UrlFetchApp", `${domainSource}${relativeSource}${fnSource}; return FinalUrl;`)(UrlFetchApp);
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

function loadWithRelative(map) {
  const UrlFetchApp = { fetch: (u) => ({ getHeaders: () => map[u] || {} }) };
  return new Function(
    "UrlFetchApp",
    `${domainSource}${relativeSource}${fnSource}; return FinalUrl;`,
  )(UrlFetchApp);
}

test("FinalUrl follows a protocol-relative Location with the scheme of the current url", () => {
  const f = loadWithRelative({ "https://a.example.com/x": { Location: "//cdn.example.org/y" } });
  assert.strictEqual(f("https://a.example.com/x"), "https://cdn.example.org/y");
});

test("FinalUrl follows a Location relative to the current path", () => {
  const f = loadWithRelative({ "https://a.example.com/dir/x": { Location: "y?q=1" } });
  assert.strictEqual(f("https://a.example.com/dir/x"), "https://a.example.com/dir/y?q=1");
});

test("FinalUrl follows a Location header sent in lower case", () => {
  const f = loadWithRelative({ "https://a.example.com/x": { location: "https://b.example.org/z" } });
  assert.strictEqual(f("https://a.example.com/x"), "https://b.example.org/z");
});

test("FinalUrl throws a clear error when the redirects never end", () => {
  const loop = { "https://a.example.com/x": { Location: "/x" } };
  const f = loadWithRelative(loop);
  assert.throws(() => f("https://a.example.com/x"), /redirect/i);
});

test("GetType returns null when the redirects never end", () => {
  const getTypeSource = source.match(/function GetType[\s\S]*?\n}\n/)[0];
  const env = {
    FinalUrl: () => {
      throw new Error("Too many redirects");
    },
    UrlFetchApp: { fetch: () => assert.fail("must not fetch") },
  };
  const GetType = new Function(...Object.keys(env), `${getTypeSource}; return GetType;`)(...Object.values(env));
  const orig = console.log;
  console.log = () => {};
  try {
    assert.strictEqual(GetType("http://x/y"), null);
  } finally {
    console.log = orig;
  }
});

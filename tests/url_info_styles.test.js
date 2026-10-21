const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const start = source.indexOf("function UrlInfo");
const end = source.indexOf("function RelativeToAbsoluteUrl");
const domainSource = source.match(/const domain = .*;/)[0];

function run(html) {
  const env = {
    FinalUrl: (u) => u,
    GetSync: () => ({ getContent: () => [...Buffer.from(html)] }),
    Utilities: { newBlob: (bytes) => ({ getDataAsString: () => Buffer.from(bytes).toString() }) },
    Html: (s) => s,
    Out: (s) => s,
    RelativeToAbsoluteUrl: (u, r) => r,
    Blob: undefined,
    Worker: undefined,
  };
  const UrlInfo = new Function(...Object.keys(env), `${domainSource}${source.slice(start, end)}; return UrlInfo;`)(...Object.values(env));
  const orig = console.log;
  console.log = () => {};
  try {
    return String(UrlInfo("example.com"));
  } finally {
    console.log = orig;
  }
}

const page = (head) => `<html><head><title>t</title>${head}</head><body><p>hi</p></body></html>`;

test("UrlInfo keeps the page style without a browser-only Worker", () => {
  const out = run(page("<style>body{color:red}</style>"));
  assert.match(out, /<style>[^]*body\{color:red\}[^]*<\/style>/);
});

test("UrlInfo keeps every style block in order", () => {
  const out = run(page("<style>a{x:1}</style><style>b{y:2}</style>"));
  assert.ok(out.indexOf("a{x:1}") !== -1 && out.indexOf("b{y:2}") > out.indexOf("a{x:1}"));
  assert.strictEqual((out.match(/<style>/g) || []).length, 1);
});

test("UrlInfo works for a page without styles", () => {
  const out = run(page(""));
  assert.ok(out.includes("hi"));
});

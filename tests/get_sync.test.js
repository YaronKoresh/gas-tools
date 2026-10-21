const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function load() {
  const calls = [];
  const UrlFetchApp = { fetch: (url, options) => (calls.push({ url, options }), { ok: true }) };
  const GetSync = new Function("UrlFetchApp", `${grab("ObjectToQueryString")}${grab("GetSync")}; return GetSync;`)(UrlFetchApp);
  return { GetSync, calls };
}

test("GetSync adds the parameters after a question mark", () => {
  const { GetSync, calls } = load();
  GetSync("https://a.example.com/x", { a: 1, b: "c d" });
  assert.strictEqual(calls[0].url, "https://a.example.com/x?a=1&b=c%20d");
});

test("GetSync leaves the url untouched when there are no parameters", () => {
  const { GetSync, calls } = load();
  GetSync("https://a.example.com/x");
  assert.strictEqual(calls[0].url, "https://a.example.com/x");
});

test("GetSync appends with an ampersand when the url already has a query", () => {
  const { GetSync, calls } = load();
  GetSync("https://a.example.com/x?k=1", { a: 2 });
  assert.strictEqual(calls[0].url, "https://a.example.com/x?k=1&a=2");
});

test("GetSync keeps a url that ends with a question mark valid", () => {
  const { GetSync, calls } = load();
  GetSync("https://a.example.com/x?", { a: 2 });
  assert.strictEqual(calls[0].url, "https://a.example.com/x?a=2");
});

test("GetSync puts the parameters before a fragment", () => {
  const { GetSync, calls } = load();
  GetSync("https://a.example.com/x#top", { a: 1 });
  GetSync("https://a.example.com/x?p=1#top", { a: 1 });
  GetSync("https://a.example.com/x#top");
  assert.strictEqual(calls[0].url, "https://a.example.com/x?a=1#top");
  assert.strictEqual(calls[1].url, "https://a.example.com/x?p=1&a=1#top");
  assert.strictEqual(calls[2].url, "https://a.example.com/x#top");
});

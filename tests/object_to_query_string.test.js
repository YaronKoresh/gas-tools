const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const fnSource = source.match(/function ObjectToQueryString[\s\S]*?\n}\n/)[0];
const ObjectToQueryString = new Function(`${fnSource}; return ObjectToQueryString;`)();

test("returns pairs without a leading question mark", () => {
  assert.strictEqual(ObjectToQueryString({ a: 1, b: "x" }), "a=1&b=x");
});

test("empty object gives an empty string", () => {
  assert.strictEqual(ObjectToQueryString({}), "");
});

test("escapes ampersand, equals and spaces inside values", () => {
  assert.strictEqual(ObjectToQueryString({ q: "a&b=c d" }), "q=a%26b%3Dc%20d");
});

test("nested object as first key is not prefixed", () => {
  assert.strictEqual(ObjectToQueryString({ a: { x: 1, y: 2 }, b: 3 }), "a%5Bx%5D=1&a%5By%5D=2&b=3");
});

test("GetSync and ExportPdf add the question mark once", () => {
  assert.ok(source.includes('path + "?" + ObjectToQueryString('));
  assert.ok(source.includes("export?${ObjectToQueryString("));
});

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const GetQs = new Function(`${source.match(/function GetQs[\s\S]*?\n}\n/)[0]}; return GetQs;`)();

test("GetQs escapes ampersand and spaces in values", () => {
  assert.strictEqual(GetQs(["q", "a&b", "x", "1 2"]), "q=a%26b&x=1%202");
});

test("GetQs escapes keys and non-ascii text", () => {
  assert.strictEqual(GetQs(["a=b", "שלום"]), "a%3Db=%D7%A9%D7%9C%D7%95%D7%9D");
});

test("GetQs keeps simple pairs unchanged", () => {
  assert.strictEqual(GetQs(["a", "b", "c", 3]), "a=b&c=3");
});

test("GetQs gives an empty string for an empty list", () => {
  assert.strictEqual(GetQs([]), "");
});

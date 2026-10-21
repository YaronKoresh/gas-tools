const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const Unique = new Function(`${source.match(/^function Unique[\s\S]*?\n}\n/m)[0]}; return Unique;`)();

test("Unique removes duplicates and keeps order", () => {
  assert.deepStrictEqual(Unique([3, 1, 3, 2, 1]), [3, 1, 2]);
});

test("Unique keeps null and undefined when there is no minimum length", () => {
  assert.deepStrictEqual(Unique([1, null, 1, undefined, null]), [1, null, undefined]);
});

test("Unique drops empty values when a minimum length is given", () => {
  assert.deepStrictEqual(Unique([1, null, "ab", "", undefined], 1), [1, "ab"]);
});

test("Unique honours the minimum length for strings", () => {
  assert.deepStrictEqual(Unique(["a", "bb", "bb", "ccc"], 2), ["bb", "ccc"]);
});

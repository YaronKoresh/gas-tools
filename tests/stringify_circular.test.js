const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];
const { Stringify } = new Function(`${grab("Stringify")}; return { Stringify };`)();

const message = /circular structure/;

test("Stringify rejects an object that holds itself", () => {
  const a = {};
  a.a = a;
  assert.throws(() => Stringify(a), message);
  assert.throws(() => Stringify(a, true), message);
});

test("Stringify rejects a cycle through arrays and nested objects", () => {
  const list = [];
  const holder = { list };
  list.push(1, holder);
  assert.throws(() => Stringify(holder), message);
  assert.throws(() => Stringify(list), message);
});

test("Stringify rejects a Map or Set that holds itself in code mode", () => {
  const map = new Map();
  map.set("self", map);
  assert.throws(() => Stringify(map, true), message);
  const set = new Set();
  set.add(set);
  assert.throws(() => Stringify(set, true), message);
});

test("Stringify accepts the same object used twice without a cycle", () => {
  const shared = { n: 1 };
  assert.strictEqual(Stringify({ a: shared, b: shared, c: [shared, shared] }), '{"a":{"n":1},"b":{"n":1},"c":[{"n":1},{"n":1}]}');
});

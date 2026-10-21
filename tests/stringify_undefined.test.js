const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function load() {
  const store = {};
  const cache = {
    get: (k) => (k in store ? store[k] : null),
    put: (k, v) => {
      store[k] = v;
    },
  };
  return new Function(
    "cache",
    `${grab("Stringify")}${grab("Parse")}${grab("WriteToCache")}${grab("ReadFromCache")}; return { Stringify, Parse, WriteToCache, ReadFromCache };`,
  )(cache);
}

test("Stringify omits undefined object values", () => {
  const { Stringify, Parse } = load();
  assert.strictEqual(Stringify({ a: undefined, b: 1, c: undefined }), '{"b":1}');
  assert.deepStrictEqual(Parse(Stringify({ a: undefined, b: 1 })), { b: 1 });
  assert.strictEqual(Stringify({ a: undefined }), "{}");
});

test("Stringify writes undefined array cells and a bare undefined as null", () => {
  const { Stringify, Parse } = load();
  assert.strictEqual(Stringify([1, undefined, 2]), "[1,null,2]");
  assert.strictEqual(Stringify(undefined), "null");
  assert.deepStrictEqual(Parse(Stringify({ list: [undefined] })), { list: [null] });
});

test("an undefined value does not block later cache reads and writes", () => {
  const { WriteToCache, ReadFromCache } = load();
  WriteToCache("n", "a", undefined);
  WriteToCache("n", "b", 1);
  assert.strictEqual(ReadFromCache("n", "a"), null);
  assert.strictEqual(ReadFromCache("n", "b"), 1);
});

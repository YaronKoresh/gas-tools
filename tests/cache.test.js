const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function load(initial = {}) {
  const store = { ...initial };
  const puts = [];
  const cache = {
    get: (name) => (name in store ? store[name] : null),
    put: (name, text, time) => {
      store[name] = text;
      puts.push([name, time]);
    },
  };
  const code = `${grab("Stringify")}${grab("Parse")}${grab("WriteToCache")}${grab("ReadFromCache")}; return { WriteToCache, ReadFromCache };`;
  const fns = new Function("cache", code)(cache);
  return { ...fns, store, puts };
}

test("WriteToCache creates the entry and ReadFromCache reads the key back", () => {
  const { WriteToCache, ReadFromCache, puts } = load();
  WriteToCache("n", "k", { a: 1 });
  assert.deepStrictEqual(ReadFromCache("n", "k"), { a: 1 });
  assert.deepStrictEqual(puts, [["n", 21600]]);
});

test("WriteToCache keeps the other keys of the entry and uses the given time", () => {
  const { WriteToCache, ReadFromCache, puts } = load();
  WriteToCache("n", "a", 1);
  WriteToCache("n", "b", 2, 60);
  assert.strictEqual(ReadFromCache("n", "a"), 1);
  assert.strictEqual(ReadFromCache("n", "b"), 2);
  assert.deepStrictEqual(puts[1], ["n", 60]);
});

test("ReadFromCache returns null for a missing entry or key", () => {
  const { WriteToCache, ReadFromCache } = load();
  assert.strictEqual(ReadFromCache("none", "k"), null);
  WriteToCache("n", "a", 1);
  assert.strictEqual(ReadFromCache("n", "other"), null);
});

test("WriteToCache replaces an entry that is not valid json", () => {
  const { WriteToCache, ReadFromCache } = load({ n: "garbage" });
  WriteToCache("n", "k", 5);
  assert.strictEqual(ReadFromCache("n", "k"), 5);
});

test("ReadFromCache returns null for an entry that is not valid json", () => {
  const { ReadFromCache } = load({ n: "garbage" });
  assert.strictEqual(ReadFromCache("n", "k"), null);
});

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function load(entries, failFor = []) {
  const state = { writes: [], removed: [] };
  const env = {
    cache: {
      getAll: () => entries,
      removeAll: (names) => state.removed.push(...names),
    },
    Flatten: (arr) => arr.flat(Infinity),
    Parse: (text) => JSON.parse(text),
    AddToDatabase: (db, sheet, key, value) => {
      if (failFor.includes(sheet)) throw new Error("write failed");
      state.writes.push([db, sheet, key, value]);
    },
  };
  const fn = new Function(...Object.keys(env), `${grab("MoveCacheToDatabase")}; return MoveCacheToDatabase;`)(...Object.values(env));
  const orig = console.log;
  const run = (...args) => {
    console.log = () => {};
    try {
      fn(...args);
    } finally {
      console.log = orig;
    }
  };
  return { run, state };
}

test("MoveCacheToDatabase writes every key and then removes the cache entries", () => {
  const { run, state } = load({ a: '{"x":1,"y":2}', b: '[{"z":3}]' });
  run("db", "a", "b");
  assert.deepStrictEqual(state.writes, [
    ["db", "a", "x", 1],
    ["db", "a", "y", 2],
    ["db", "b", "z", 3],
  ]);
  assert.deepStrictEqual(state.removed, ["a", "b"]);
});

test("MoveCacheToDatabase keeps in the cache the entries that failed", () => {
  const { run, state } = load({ a: '{"x":1}', b: '{"z":3}' }, ["b"]);
  run("db", "a", "b");
  assert.deepStrictEqual(state.removed, ["a"]);
});

test("MoveCacheToDatabase keeps an entry that is not valid json", () => {
  const { run, state } = load({ a: "not json", b: '{"z":3}' });
  run("db", "a", "b");
  assert.deepStrictEqual(state.removed, ["b"]);
});

test("MoveCacheToDatabase does nothing for an empty cache", () => {
  const { run, state } = load({});
  run("db", "a");
  assert.deepStrictEqual(state.writes, []);
  assert.deepStrictEqual(state.removed, []);
});

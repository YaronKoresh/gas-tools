const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const Random = new Function(`${source.match(/function Random[\s\S]*?\n}\n/)[0]}; return Random;`)();
const uuidSource = source.match(/function Uuid\([\s\S]*?\n}\n/)[0];

test("Random includes both bounds and stays inside them", () => {
  const seen = new Set();
  for (let i = 0; i < 5000; i++) {
    const v = Random(1, 6);
    assert.ok(Number.isInteger(v) && v >= 1 && v <= 6);
    seen.add(v);
  }
  assert.deepStrictEqual([...seen].sort(), [1, 2, 3, 4, 5, 6]);
});

test("Random is roughly uniform", () => {
  const counts = [0, 0, 0, 0, 0, 0];
  const n = 60000;
  for (let i = 0; i < n; i++) counts[Random(1, 6) - 1]++;
  for (const c of counts) assert.ok(Math.abs(c - n / 6) < n / 6 * 0.1);
});

test("Random with equal bounds returns that value", () => {
  assert.strictEqual(Random(5, 5), 5);
  assert.strictEqual(Random(0, 0), 0);
});

test("Random with reversed bounds still returns a value in range", () => {
  for (let i = 0; i < 200; i++) {
    const v = Random(6, 1);
    assert.ok(v >= 1 && v <= 6);
  }
});

test("Uuid can use the last character of its charset", () => {
  const chars = ["a", "b", "c"];
  const Uuid = new Function("Random", "UuidCharset", `${uuidSource}; return Uuid;`)(Random, () => chars);
  const seen = new Set();
  for (let i = 0; i < 300; i++) for (const ch of Uuid(5)) seen.add(ch);
  assert.deepStrictEqual([...seen].sort(), ["a", "b", "c"]);
  assert.strictEqual(Uuid(7).length, 7);
});

test("Random throws for bounds that are not finite numbers instead of returning NaN", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
  const R = new Function(`${src.match(/function Random\b[\s\S]*?\n}\n/)[0]}; return Random;`)();
  assert.throws(() => R(NaN, 3), /finite/);
  assert.throws(() => R(0, Infinity), /finite/);
  assert.strictEqual(R(2, 2), 2);
});

test("Uuid throws for an infinite length instead of never ending", () => {
  const U = new Function("Random", "UuidCharset", `${uuidSource}; return Uuid;`)(Random, () => ["a", "b"]);
  assert.throws(() => U(Infinity), /finite/);
  assert.strictEqual(U(4).length, 4);
});

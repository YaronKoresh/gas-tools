const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const fnSource = source.match(/function Locker[\s\S]*?\n}\n/)[0];

function load() {
  const state = { released: 0, flushed: 0 };
  const env = {
    LockService: { getScriptLock: () => ({ tryLock() {}, releaseLock: () => state.released++ }) },
    SpreadsheetApp: { flush: () => state.flushed++ },
  };
  const Locker = new Function(...Object.keys(env), `${fnSource}; return Locker;`)(...Object.values(env));
  return { Locker, state };
}

test("Locker returns the value of the function and releases the lock", () => {
  const { Locker, state } = load();
  assert.strictEqual(Locker(() => 5), 5);
  assert.deepStrictEqual(state, { released: 1, flushed: 1 });
});

test("Locker releases the lock and rethrows when the function throws", () => {
  const { Locker, state } = load();
  assert.throws(
    () =>
      Locker(() => {
        throw new Error("boom");
      }),
    /boom/,
  );
  assert.deepStrictEqual(state, { released: 1, flushed: 1 });
});

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function load() {
  const created = [];
  const env = {
    LockService: {
      getScriptLock: () => {
        const lock = { id: created.length, released: 0, tryLock: () => true, releaseLock() { this.released++; } };
        created.push(lock);
        return lock;
      },
    },
    SpreadsheetApp: { flush() {} },
    Random: () => 5,
    locks: [],
  };
  const { Lock, Unlock } = new Function(...Object.keys(env), `${grab("Lock")}${grab("Unlock")}; return { Lock, Unlock };`)(...Object.values(env));
  return { Lock, Unlock, created };
}

test("two open locks get different ids and are both released once", () => {
  const { Lock, Unlock, created } = load();
  const a = Lock();
  const b = Lock();
  assert.notStrictEqual(a, b);
  Unlock(a);
  Unlock(b);
  assert.deepStrictEqual(created.map((l) => l.released), [1, 1]);
});

test("nested locks can be released in any order", () => {
  const { Lock, Unlock, created } = load();
  const a = Lock();
  const b = Lock();
  Unlock(b);
  Unlock(a);
  assert.deepStrictEqual(created.map((l) => l.released), [1, 1]);
});

test("a released slot can be used again", () => {
  const { Lock, Unlock, created } = load();
  const a = Lock();
  Unlock(a);
  const b = Lock();
  assert.strictEqual(a, b);
  Unlock(b);
  assert.deepStrictEqual(created.map((l) => l.released), [1, 1]);
});

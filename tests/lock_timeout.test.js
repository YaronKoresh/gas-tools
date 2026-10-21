const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`(?:async )?function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function load(acquired) {
  const state = { ran: 0, released: 0, flushed: 0, locks: [] };
  const env = {
    LockService: {
      getScriptLock: () => ({ tryLock: () => acquired, releaseLock: () => state.released++ }),
      getDocumentLock: () => ({ tryLock: () => acquired, releaseLock: () => state.released++ }),
    },
    SpreadsheetApp: { flush: () => state.flushed++ },
    ScriptApp: { getOAuthToken: () => "t" },
    ExportCurrentCellPhoto: async () => {
      state.ran++;
      return "id";
    },
    ShareFile() {},
    DriveIdToUrl: (id) => "u" + id,
    GetType: () => "text/plain",
    locks: state.locks,
  };
  const body = `${grab("Locker")}${grab("Lock")}${grab("Unlock")}${grab("PhotoDataUrl")}; return { Locker, Lock, Unlock, PhotoDataUrl };`;
  return { ...new Function(...Object.keys(env), body)(...Object.values(env)), state };
}

test("Locker runs the function when the lock is acquired", () => {
  const { Locker, state } = load(true);
  assert.strictEqual(Locker(() => 7), 7);
  assert.strictEqual(state.released, 1);
});

test("Locker throws without running the function when the lock times out", () => {
  const { Locker, state } = load(false);
  let ran = false;
  assert.throws(() => Locker(() => (ran = true)), /lock/i);
  assert.strictEqual(ran, false);
  assert.strictEqual(state.released, 0);
});

test("Lock throws and frees its slot when the lock times out", () => {
  const { Lock, state } = load(false);
  assert.throws(() => Lock(), /lock/i);
  assert.strictEqual(state.locks.filter(Boolean).length, 0);
  assert.strictEqual(state.released, 0);
});

test("PhotoDataUrl throws without exporting when the lock times out", async () => {
  const { PhotoDataUrl, state } = load(false);
  await assert.rejects(() => PhotoDataUrl(), /lock/i);
  assert.strictEqual(state.ran, 0);
  assert.strictEqual(state.released, 0);
});

test("Unlock ignores a slot that was already released", () => {
  const { Lock, Unlock, state } = load(true);
  const n = Lock();
  Unlock(n);
  assert.doesNotThrow(() => Unlock(n));
  assert.doesNotThrow(() => Unlock(99));
  assert.strictEqual(state.released, 1);
});

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function load({ driveThrows = false } = {}) {
  const state = { released: 0, nowCalls: 0, writes: [] };
  const rangeOf = (sheetName) => (a) => ({
    getValues: () => [[""]],
    setValue: (v) => state.writes.push([sheetName, a, v]),
    setValues: (v) => state.writes.push([sheetName, a, v]),
  });
  const dataSheet = { deleteColumns() {}, getRange: rangeOf("data") };
  const dataSs = {
    getId: () => "data-id",
    getSheetByName: (n) => (n === "Logs" ? dataSheet : null),
    insertSheet: () => dataSheet,
    deleteSheet() {},
  };
  const mainSheet = { getRange: rangeOf("main") };
  const mainSs = { getName: () => "Database db", getSheetByName: () => mainSheet };
  const folder = {
    getFoldersByName: () => ({ next: () => folder }),
    getFilesByName: () => ({ next: () => ({ moveTo() {} }) }),
  };
  const env = {
    LockService: { getScriptLock: () => ({ tryLock() {}, releaseLock: () => state.released++ }) },
    SpreadsheetApp: {
      flush() {},
      open: () => mainSs,
      setActiveSpreadsheet() {},
      create: () => dataSs,
      openById: () => dataSs,
    },
    Random: () => 3,
    locks: [],
    Now: () => {
      state.nowCalls++;
      return "21/10/2026 10:00:00";
    },
    DriveApp: {
      getRootFolder: () => {
        if (driveThrows) throw new Error("no drive");
        return { ...folder, getFilesByName: () => ({ next: () => ({ moveTo() {} }) }) };
      },
    },
    Flatten: (arr) => arr.flat(Infinity),
    Stringify: (v) => JSON.stringify(v),
  };
  const code = `${grab("Lock")}${grab("Unlock")}${grab("AddToDatabase")}; return AddToDatabase;`;
  const AddToDatabase = new Function(...Object.keys(env), code)(...Object.values(env));
  return { AddToDatabase, state };
}

test("AddToDatabase releases the lock when a service call throws", () => {
  const { AddToDatabase, state } = load({ driveThrows: true });
  assert.throws(() => AddToDatabase("db", "Logs", "k", 1), /no drive/);
  assert.strictEqual(state.released, 1);
});

test("AddToDatabase reads the clock once and releases the lock after writing", () => {
  const { AddToDatabase, state } = load();
  AddToDatabase("db", "Logs", "k", { a: 1 });
  assert.strictEqual(state.nowCalls, 1);
  assert.strictEqual(state.released, 1);
  const dataWrites = state.writes.filter((w) => w[0] === "data").map((w) => w[2]);
  assert.ok(dataWrites.includes("k"));
  assert.ok(dataWrites.includes('{"a":1}'));
});

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function load({ driveThrows = false, dataColumn = [[""]] } = {}) {
  const state = { released: 0, nowCalls: 0, writes: [], deleted: [] };
  const rangeOf = (sheetName) => (a) => ({
    getValues: () => (sheetName === "data" ? dataColumn : [[""]]),
    setValue: (v) => state.writes.push([sheetName, a, v]),
    setValues: (v) => state.writes.push([sheetName, a, v]),
  });
  const dataSheet = { getSheetId: () => 2, deleteColumns() {}, getRange: rangeOf("data") };
  const defaultSheet = { getSheetId: () => 1, deleteColumns() {}, getRange: rangeOf("default") };
  const dataSs = {
    getId: () => "data-id",
    getSheetByName: (n) => (n === "Logs" ? dataSheet : null),
    getSheets: () => [defaultSheet, dataSheet],
    insertSheet: () => dataSheet,
    deleteSheet: (sheet) => state.deleted.push(sheet.getSheetId()),
  };
  const mainSheet = { getRange: rangeOf("main") };
  const mainSs = { getName: () => "Database db", getSheets: () => [mainSheet], getSheetByName: () => null };
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

test("AddToDatabase writes after the last used row even when values repeat", () => {
  const { AddToDatabase, state } = load({ dataColumn: [["5"], ["5"]] });
  AddToDatabase("db", "Logs", "k", 1);
  const addresses = state.writes.filter((w) => w[0] === "data").map((w) => w[1]);
  assert.deepStrictEqual(addresses, ["A3:A3", "B3:B3", "C3:C3"]);
});

test("AddToDatabase writes to the first row of an empty sheet", () => {
  const { AddToDatabase, state } = load({ dataColumn: [[""], [""]] });
  AddToDatabase("db", "Logs", "k", 1);
  const addresses = state.writes.filter((w) => w[0] === "data").map((w) => w[1]);
  assert.deepStrictEqual(addresses, ["A1:A1", "B1:B1", "C1:C1"]);
});

test("AddToDatabase finds the main sheet when it is not called Sheet1 and removes the default sheet of a new shard", () => {
  const { AddToDatabase, state } = load();
  AddToDatabase("db", "Logs", "k", 1);
  assert.deepStrictEqual(state.deleted, [1]);
  assert.ok(state.writes.some((w) => w[0] === "main"));
});

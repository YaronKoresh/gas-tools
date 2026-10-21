const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function load({ driveThrows = false, dataColumn = [[""]], stringify = (v) => JSON.stringify(v) } = {}) {
  const state = { activated: 0, created: 0, locked: 0, released: 0, nowCalls: 0, writes: [], formats: [], moved: [], deleted: [] };
  const rangeOf = (sheetName) => (a) => {
    const range = {
      getValues: () => (sheetName === "data" ? dataColumn : [[""]]),
      setNumberFormat: (f) => {
        state.formats.push([sheetName, a, f]);
        return range;
      },
      setValue: (v) => state.writes.push([sheetName, a, v]),
      setValues: (v) => state.writes.push([sheetName, a, v]),
    };
    return range;
  };
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
    getFoldersByName: () => ({ hasNext: () => true, next: () => folder }),
    getFilesByName: () => ({ hasNext: () => true, next: () => ({ moveTo() {} }) }),
  };
  const env = {
    LockService: { getScriptLock: () => ({ tryLock: () => (state.locked++, true), releaseLock: () => state.released++ }) },
    SpreadsheetApp: {
      flush() {},
      open: () => mainSs,
      setActiveSpreadsheet: () => state.activated++,
      create: () => {
        state.created++;
        return dataSs;
      },
      openById: () => dataSs,
    },
    Random: () => 3,
    locks: [],
    Now: () => {
      state.nowCalls++;
      return "21/10/2026 10:00:00";
    },
    DriveApp: {
      getFileById: (id) => ({ moveTo: () => state.moved.push(id) }),
      getRootFolder: () => {
        if (driveThrows) throw new Error("no drive");
        return { ...folder, getFilesByName: () => ({ hasNext: () => true, next: () => ({ moveTo() {} }) }) };
      },
    },
    Flatten: (arr) => arr.flat(Infinity),
    Stringify: stringify,
  };
  const code = `${grab("Lock")}${grab("Unlock")}${grab("GetDatabaseFile")}${grab("AddToDatabase")}; return AddToDatabase;`;
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

test("AddToDatabase stores the key and the value as plain text so Sheets cannot reinterpret them", () => {
  const { AddToDatabase, state } = load();
  AddToDatabase("db", "Logs", "007", { a: 1 });
  const formats = state.formats.filter((f) => f[0] === "data").map((f) => [f[1], f[2]]);
  assert.deepStrictEqual(formats, [["B1:B1", "@"], ["C1:C1", "@"]]);
  assert.ok(state.writes.some((w) => w[0] === "data" && w[2] === "007"));
});

test("AddToDatabase keeps the shard stamps and ids of the main sheet as plain text", () => {
  const { AddToDatabase, state } = load();
  AddToDatabase("db", "Logs", "k", 1);
  const mainFormats = state.formats.filter((f) => f[0] === "main");
  const mainWrites = state.writes.filter((w) => w[0] === "main");
  assert.deepStrictEqual(mainFormats.map((f) => f[2]), ["@", "@"]);
  assert.deepStrictEqual(mainFormats.map((f) => f[1]).sort(), mainWrites.map((w) => w[1]).sort());
  assert.deepStrictEqual(mainWrites[0][2], [["21/10/2026 10:00:00"]]);
});

test("AddToDatabase moves the new shard by its id and not by a name lookup in the root", () => {
  const { AddToDatabase, state } = load();
  AddToDatabase("db", "Logs", "k", 1);
  assert.deepStrictEqual(state.moved, ["data-id"]);
});

test("AddToDatabase rejects a value that cannot be stored before it creates a shard or takes the lock", () => {
  const { AddToDatabase, state } = load({
    stringify: () => {
      throw new Error("Could not convert Promise into String!");
    },
  });
  assert.throws(() => AddToDatabase("db", "Logs", "k", Promise.resolve(1)), /Promise/);
  assert.strictEqual(state.created, 0);
  assert.strictEqual(state.locked, 0);
  assert.deepStrictEqual(state.writes, []);
});

test("AddToDatabase stores a missing key as the text of the key", () => {
  const { AddToDatabase, state } = load();
  AddToDatabase("db", "Logs", undefined, 1);
  const dataWrites = state.writes.filter((w) => w[0] === "data").map((w) => w[2]);
  assert.ok(dataWrites.includes("undefined"));
});

test("AddToDatabase does not change the active spreadsheet of the caller", () => {
  const { AddToDatabase, state } = load();
  AddToDatabase("db", "Logs", "k", 1);
  assert.strictEqual(state.activated, 0);
});

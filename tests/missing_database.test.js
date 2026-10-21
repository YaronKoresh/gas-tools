const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function iterator(items) {
  let i = 0;
  return {
    hasNext: () => i < items.length,
    next: () => {
      if (i >= items.length) throw new Error("Cannot retrieve the next object: iterator has reached the end.");
      return items[i++];
    },
  };
}

function load({ folders, files }) {
  const folder = { getFilesByName: () => iterator(files) };
  const env = {
    DriveApp: { getRootFolder: () => ({ getFoldersByName: () => iterator(folders.map(() => folder)) }) },
    SpreadsheetApp: { flush() {}, open() { throw new Error("should not open"); }, setActiveSpreadsheet() {} },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    locks: [],
    Now: () => "21/10/2026 10:00:00",
    Flatten: (a) => a.flat(Infinity),
    Parse: JSON.parse,
    Stringify: JSON.stringify,
  };
  const code = `${grab("Lock")}${grab("Unlock")}${grab("GetDatabaseFile")}${grab("CountFromDatabase")}${grab("ReadFromDatabase")}${grab("AddToDatabase")}; return { CountFromDatabase, ReadFromDatabase, AddToDatabase };`;
  return new Function(...Object.keys(env), code)(...Object.values(env));
}

test("a missing [DB] folder gives a clear error in Read, Count and Add", () => {
  const api = load({ folders: [], files: [] });
  assert.throws(() => api.ReadFromDatabase("db", "S", "k"), /\[DB\] folder was not found/);
  assert.throws(() => api.CountFromDatabase("db", "S", "k"), /\[DB\] folder was not found/);
  assert.throws(() => api.AddToDatabase("db", "S", "k", 1), /\[DB\] folder was not found/);
});

test("a missing database file names the database", () => {
  const api = load({ folders: [1], files: [] });
  assert.throws(() => api.ReadFromDatabase("shop", "S", "k"), /Database not found: Database shop/);
  assert.throws(() => api.CountFromDatabase("shop", "S", "k"), /Database not found: Database shop/);
  assert.throws(() => api.AddToDatabase("shop", "S", "k", 1), /Database not found: Database shop/);
});

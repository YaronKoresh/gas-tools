const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function sheet(rows) {
  return {
    getRange(a) {
      const col = { A: 0, B: 1, C: 2 }[a[0]];
      return { getValues: () => rows.map((r) => [r[col]]) };
    },
  };
}

function load(shardRows) {
  const shard = sheet(shardRows);
  const main = sheet([["21.10.2026 10:00:00", "SHARD"]]);
  const DriveApp = {
    getRootFolder: () => ({ getFoldersByName: () => ({ next: () => ({ getFilesByName: () => ({ next: () => ({}) }) }) }) }),
  };
  const SpreadsheetApp = {
    open: () => ({ getSheets: () => [main], getSheetByName: () => main }),
    setActiveSpreadsheet() {},
    openById: () => ({ getSheetByName: (n) => (n === "Logs" ? shard : null) }),
  };
  const code = `${grab("Flatten")}${grab("Parse")}${grab("CountFromDatabase")}${grab("ReadFromDatabase")}; return { CountFromDatabase, ReadFromDatabase };`;
  return new Function("DriveApp", "SpreadsheetApp", code)(DriveApp, SpreadsheetApp);
}

// Google Sheets turns the text "5" that AddToDatabase writes into the number 5.
const rows = [[0, 5, '{"v":1}'], [0, "a", '{"v":2}'], [0, 5, '{"v":3}']];

test("CountFromDatabase finds a key that was written as text and read back as a number", () => {
  const { CountFromDatabase } = load(rows);
  assert.strictEqual(CountFromDatabase("db", "Logs", "5"), 2);
  assert.strictEqual(CountFromDatabase("db", "Logs", 5), 2);
});

test("ReadFromDatabase finds a key that was written as text and read back as a number", () => {
  const { ReadFromDatabase } = load(rows);
  assert.deepStrictEqual(ReadFromDatabase("db", "Logs", "5"), { v: 3 });
  assert.deepStrictEqual(ReadFromDatabase("db", "Logs", 5), { v: 3 });
});

test("the database lookups still tell different keys apart", () => {
  const { CountFromDatabase, ReadFromDatabase } = load(rows);
  assert.strictEqual(CountFromDatabase("db", "Logs", "6"), 0);
  assert.strictEqual(ReadFromDatabase("db", "Logs", "6"), null);
  assert.deepStrictEqual(ReadFromDatabase("db", "Logs", "a"), { v: 2 });
});

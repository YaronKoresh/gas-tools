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
    open: () => ({ getSheetByName: () => main }),
    setActiveSpreadsheet() {},
    openById: () => ({ getSheetByName: (n) => (n === "Logs" ? shard : null) }),
  };
  return new Function("DriveApp", "SpreadsheetApp", `${grab("Flatten")}${grab("CountFromDatabase")}; return CountFromDatabase;`)(
    DriveApp,
    SpreadsheetApp,
  );
}

test("CountFromDatabase counts every saved row of the key", () => {
  const count = load([["500", "k", "1"], ["900", "k", "2"], ["100", "x", "3"]]);
  assert.strictEqual(count("db", "Logs", "k"), 2);
});

test("CountFromDatabase returns 0 for a key that was never saved", () => {
  const count = load([["500", "k", "1"]]);
  assert.strictEqual(count("db", "Logs", "missing"), 0);
});

test("CountFromDatabase does not leak current_ts as a global", () => {
  const count = load([["500", "k", "1"]]);
  count("db", "Logs", "k");
  assert.strictEqual(typeof globalThis.current_ts, "undefined");
});

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function setup() {
  const state = { activated: 0 };
  const sheet = {
    getRange: (a) => ({ getValues: () => (a[0] === "A" ? [["21.10.2026 10:00:00"]] : a[0] === "B" ? [["SHARD"]] : [[""]]) }),
    deleteColumns() {},
  };
  const shard = {
    getRange: (a) => ({ getValues: () => (a[0] === "A" ? [["500"]] : a[0] === "B" ? [["k"]] : [["1"]]) }),
  };
  const file = { moveTo() {} };
  const folder = {
    getFoldersByName: () => ({ hasNext: () => true, next: () => folder }),
    getFilesByName: () => ({ hasNext: () => true, next: () => file }),
  };
  const DriveApp = {
    getRootFolder: () => folder,
    getFileById: () => file,
  };
  const SpreadsheetApp = {
    open: () => ({ getSheets: () => [sheet], getSheetByName: () => sheet }),
    openById: () => ({ getSheetByName: () => shard }),
    setActiveSpreadsheet: () => state.activated++,
  };
  return { state, DriveApp, SpreadsheetApp };
}

function build(names, fn) {
  const { state, DriveApp, SpreadsheetApp } = setup();
  const env = { DriveApp, SpreadsheetApp, Parse: (v) => v };
  const code = `${["Flatten", "GetDatabaseFile", ...names].map(grab).join("")}; return ${fn};`;
  return { state, run: new Function(...Object.keys(env), code)(...Object.values(env)) };
}

test("CountFromDatabase and ReadFromDatabase leave the active spreadsheet alone", () => {
  const count = build(["CountFromDatabase"], "CountFromDatabase");
  count.run("db", "Logs", "k");
  assert.strictEqual(count.state.activated, 0);
  const read = build(["ReadFromDatabase"], "ReadFromDatabase");
  read.run("db", "Logs", "k");
  assert.strictEqual(read.state.activated, 0);
});

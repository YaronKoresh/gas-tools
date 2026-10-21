const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (re) => source.match(re)[0];

function run(start, end) {
  const state = { url: null };
  const env = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({ getSheetByName: () => ({ getSheetId: () => 7 }), getId: () => "SS" }),
      getActiveSheet: () => ({ getSheetId: () => 7 }),
    },
    ScriptApp: { getOAuthToken: () => "tok" },
    UrlFetchApp: {
      fetch: (u) => {
        state.url = u;
        return { getBlob: () => ({ setName() {} }) };
      },
    },
    TimeNow: () => "10:00:00",
    DateNow: () => "21/10/2026",
    SaveFile: () => "id",
    GetColumnsCount: () => 28,
    GetRowsCount: () => 100,
  };
  const code = [
    grab(/function ColumnToLetter[\s\S]*?\n}\n/),
    grab(/function ObjectToQueryString[\s\S]*?\n}\n/),
    grab(/function LettersToColumn[\s\S]*?\n}\n/),
    grab(/function ParseCellLocation[\s\S]*?\n}\n/),
    grab(/function ExportPdf[\s\S]*?\n}\n/),
    "return ExportPdf;",
  ].join("\n");
  const ExportPdf = new Function(...Object.keys(env), code)(...Object.values(env));
  const orig = console.log;
  console.log = () => {};
  try {
    ExportPdf("S", start, end);
  } finally {
    console.log = orig;
  }
  const q = new URL(state.url).searchParams;
  return { c1: q.get("c1"), r1: q.get("r1"), c2: q.get("c2"), r2: q.get("r2") };
}

test("ExportPdf reads multi-letter columns", () => {
  assert.deepStrictEqual(run("AB3", "AD10"), { c1: "27", r1: "2", c2: "30", r2: "10" });
});

test("ExportPdf keeps single-letter ranges working", () => {
  assert.deepStrictEqual(run("A1", "B2"), { c1: "0", r1: "0", c2: "2", r2: "2" });
});

test("ExportPdf default end covers all columns and rows", () => {
  assert.deepStrictEqual(run("A1", null), { c1: "0", r1: "0", c2: "28", r2: "100" });
});

test("ExportPdf rejects a malformed location", () => {
  assert.throws(() => run("1A", "B2"), /Invalid cell location/);
});

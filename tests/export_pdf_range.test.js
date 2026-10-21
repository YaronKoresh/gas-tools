const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (re) => source.match(re)[0];

function run(start, end, sheetName = "S", options = {}, full = false) {
  const state = { url: null, saved: null, name: null };
  const env = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({ getSheetByName: (n) => (n === "S" ? { getSheetId: () => 7 } : null), getId: () => "SS" }),
      getActiveSheet: () => ({ getSheetId: () => 7 }),
    },
    ScriptApp: { getOAuthToken: () => "tok" },
    UrlFetchApp: {
      fetch: (u) => {
        state.url = u;
        return { getBlob: () => ({ setName: (n) => (state.name = n) }) };
      },
    },
    TimeNow: () => "10:00:00",
    DateNow: () => "21/10/2026",
    SaveFile: (blob, p) => ((state.saved = p), "id"),
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
    ExportPdf(sheetName, start, end, options);
  } finally {
    console.log = orig;
  }
  const q = new URL(state.url).searchParams;
  if (full === "saved") {
    return { name: state.name, path: state.saved };
  }
  if (full) {
    return q;
  }
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

test("ExportPdf names the sheet that does not exist", () => {
  assert.throws(() => run("A1", "B2", "Missing"), /Sheet not found: Missing/);
});

test("ExportPdf uses the active sheet when no name is given", () => {
  assert.deepStrictEqual(run("A1", "B2", null), { c1: "0", r1: "0", c2: "2", r2: "2" });
});

test("ExportPdf does not send the name and path options to the export url", () => {
  const q = run("A1", "B2", "S", { name: "report", path: "/Reports", size: "A3" }, true);
  assert.strictEqual(q.has("name"), false);
  assert.strictEqual(q.has("path"), false);
  assert.strictEqual(q.get("size"), "A3");
});

test("ExportPdf names the file after the time and the name option and saves it under the path and date", () => {
  assert.deepStrictEqual(run("A1", "B2", "S", { name: "report", path: "/Reports" }, "saved"), {
    name: "10-00-00 report.pdf",
    path: "/Reports/21-10-2026",
  });
});

test("ExportPdf uses export as the default name and the root as the default path", () => {
  assert.deepStrictEqual(run("A1", "B2", "S", {}, "saved"), { name: "10-00-00 export.pdf", path: "//21-10-2026" });
});

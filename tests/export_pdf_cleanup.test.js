const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`async function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function load(failAt) {
  const trashed = [];
  const blob = { setName() {} };
  const pdf = { getBlob: () => ({}), setTrashed: (v) => trashed.push(["pdf", v]) };
  const cell = { getColumn: () => 2, getRow: () => 3 };
  const env = {
    ExportPdf: () => "pdf-id",
    DriveApp: { getFileById: () => pdf },
    PdfToPng: async () => {
      if (failAt === "png") throw new Error("png failed");
      return [blob];
    },
    SaveFile: () => {
      if (failAt === "save") throw new Error("save failed");
      return "img-id";
    },
    TrashFile: (id) => trashed.push([id]),
    TimeNow: () => "10:00:00",
    DateNow: () => "21/10/2026",
    GetActiveSheetName: () => "S",
    GetCellLocation: () => "B3",
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getActiveSheet: () => ({ getActiveCell: () => cell }) }) },
  };
  const body = `${grab("ExportCurrentCellPhoto")}${grab("ExportCellPhoto")}${grab("ExportRangeAsPng")}; return { ExportCurrentCellPhoto, ExportCellPhoto, ExportRangeAsPng };`;
  const fns = new Function(...Object.keys(env), body)(...Object.values(env));
  return { fns, trashed };
}

for (const failAt of ["png", "save"]) {
  test(`ExportCurrentCellPhoto trashes the temporary pdf when ${failAt} fails`, async () => {
    const { fns, trashed } = load(failAt);
    await assert.rejects(() => fns.ExportCurrentCellPhoto(), /failed/);
    assert.deepStrictEqual(trashed, [["pdf", true]]);
  });

  test(`ExportCellPhoto trashes the temporary pdf when ${failAt} fails`, async () => {
    const { fns, trashed } = load(failAt);
    await assert.rejects(() => fns.ExportCellPhoto("S", "B3"), /failed/);
    assert.deepStrictEqual(trashed, [["pdf", true]]);
  });

  test(`ExportRangeAsPng trashes the temporary pdf when ${failAt} fails`, async () => {
    const { fns, trashed } = load(failAt);
    const orig = console.log;
    console.log = () => {};
    try {
      await assert.rejects(() => fns.ExportRangeAsPng("S", "A1", "B2"), /failed/);
    } finally {
      console.log = orig;
    }
    assert.deepStrictEqual(trashed, [["pdf-id"]]);
  });
}

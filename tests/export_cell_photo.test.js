const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const fnSource = source.match(/async function ExportCellPhoto[\s\S]*?\n}\n/)[0];

function load() {
  const names = [];
  const trashed = [];
  const calls = [];
  const blob = { setName: (n) => names.push(n) };
  const pdf = { getBlob: () => ({}), setTrashed: (v) => trashed.push(v) };
  const env = {
    ExportPdf: (...args) => (calls.push(args), "pdf-id"),
    DriveApp: { getFileById: () => pdf },
    PdfToPng: async () => [blob],
    SaveFile: () => "img-id",
  };
  const fn = new Function(...Object.keys(env), `${fnSource}; return ExportCellPhoto;`)(...Object.values(env));
  return { fn, names, trashed, calls };
}

test("ExportCellPhoto names the image after sheet and cell and returns its id", async () => {
  const { fn, names } = load();
  assert.strictEqual(await fn("Sheet1", "B2"), "img-id");
  assert.deepStrictEqual(names, ["Sheet1_B2.png"]);
});

test("ExportCellPhoto trashes the temporary pdf", async () => {
  const { fn, trashed } = load();
  await fn("Sheet1", "B2");
  assert.deepStrictEqual(trashed, [true]);
});

test("ExportCellPhoto exports the cell without margins, freeze rows or page number", async () => {
  const { fn, calls } = load();
  await fn("Sheet1", "B2");
  assert.deepStrictEqual(calls[0], [
    "Sheet1",
    "B2",
    "B2",
    { fzr: false, size: "2x2", bottom_margin: 0, left_margin: 0, right_margin: 0, top_margin: 0, pagenum: false },
  ]);
});

test("ExportCurrentCellPhoto also removes the top margin", () => {
  const current = source.match(/async function ExportCurrentCellPhoto[\s\S]*?\n}\n/)[0];
  assert.ok(current.includes("top_margin: 0"));
});

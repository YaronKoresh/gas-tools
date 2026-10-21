const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const fnSource = source.match(/async function ExportCellPhoto[\s\S]*?\n}\n/)[0];

function load() {
  const names = [];
  const trashed = [];
  const blob = { setName: (n) => names.push(n) };
  const pdf = { getBlob: () => ({}), setTrashed: (v) => trashed.push(v) };
  const env = {
    ExportPdf: () => "pdf-id",
    DriveApp: { getFileById: () => pdf },
    PdfToPng: async () => [blob],
    SaveFile: () => "img-id",
  };
  const fn = new Function(...Object.keys(env), `${fnSource}; return ExportCellPhoto;`)(...Object.values(env));
  return { fn, names, trashed };
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

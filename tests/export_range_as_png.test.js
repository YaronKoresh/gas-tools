const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const fnSource = source.match(/async function ExportRangeAsPng[\s\S]*?\n}\n/)[0];

function load() {
  const names = [];
  const blob = { setName: (n) => names.push(n) };
  const env = {
    ExportPdf: () => "pdf-id",
    DriveApp: { getFileById: () => ({ getBlob: () => ({}) }) },
    PdfToPng: async () => [blob],
    SaveFile: () => "img-id",
    TrashFile() {},
    TimeNow: () => "10:00:00",
    DateNow: () => "21/10/2026",
  };
  const fn = new Function(...Object.keys(env), `${fnSource}; return ExportRangeAsPng;`)(...Object.values(env));
  return { fn, names };
}

test("ExportRangeAsPng uses the default name when none is given", async () => {
  const { fn, names } = load();
  const orig = console.log;
  console.log = () => {};
  try {
    await fn("S", "A1", "B2");
  } finally {
    console.log = orig;
  }
  assert.ok(!names[0].includes("undefined"));
  assert.ok(names[0].endsWith("טווח בטבלה.png"));
});

test("ExportRangeAsPng uses the given name and does not leak a global", async () => {
  const { fn, names } = load();
  const orig = console.log;
  console.log = () => {};
  try {
    await fn("S", "A1", "B2", { name: "My" });
  } finally {
    console.log = orig;
  }
  assert.strictEqual(names[0], "10-00-00 My.png");
  assert.strictEqual(Object.prototype.hasOwnProperty.call(globalThis, "name"), false);
});

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const fnSource = source.match(/async function PdfToPng[\s\S]*?\n}\n/)[0];

function load(failOnPage) {
  const state = { created: [], trashed: [] };
  let n = 0;
  const env = {
    PDFLib: {
      PDFDocument: {
        load: async () => ({ getPageCount: () => 3 }),
        create: async () => ({
          copyPages: async () => [{}],
          addPage: async () => {},
          save: async () => new Uint8Array([1, 2]),
        }),
      },
    },
    Utilities: { newBlob: () => ({}) },
    MimeType: { PDF: "application/pdf" },
    DriveApp: {
      createFile: () => {
        const id = "f" + ++n;
        state.created.push(id);
        return { getId: () => id };
      },
      getFileById: (id) => ({ setTrashed: () => state.trashed.push(id) }),
    },
    TryRepeatedly: (attempts, fn, id) => {
      if (id === failOnPage) throw new Error("no thumbnail");
      return "https://x/y=s220";
    },
    Drive: {},
    UrlFetchApp: { fetch: () => ({ getBlob: () => ({ setName() {} }) }) },
  };
  const PdfToPng = new Function(...Object.keys(env), `${fnSource}; return PdfToPng;`)(...Object.values(env));
  return { PdfToPng, state };
}

test("PdfToPng returns one image per page and trashes its temporary files", async () => {
  const { PdfToPng, state } = load(null);
  const orig = console.log;
  console.log = () => {};
  try {
    assert.strictEqual((await PdfToPng({ getBytes: () => [] })).length, 3);
  } finally {
    console.log = orig;
  }
  assert.deepStrictEqual(state.trashed, state.created);
});

test("PdfToPng trashes the temporary files created before a page fails", async () => {
  const { PdfToPng, state } = load("f2");
  const orig = console.log;
  console.log = () => {};
  try {
    await assert.rejects(() => PdfToPng({ getBytes: () => [] }), /no thumbnail/);
  } finally {
    console.log = orig;
  }
  assert.deepStrictEqual(state.created, ["f1", "f2"]);
  assert.deepStrictEqual(state.trashed, ["f1", "f2"]);
});

test("PdfToPng gives up on a thumbnail after a bounded number of attempts", async () => {
  const { PdfToPng } = load(null);
  const src = fnSource;
  assert.ok(/TryRepeatedly\(\d+,/.test(src));
  assert.ok(!src.includes("TryEndlessly"));
});

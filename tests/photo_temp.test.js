const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (re) => source.match(re)[0];

function run() {
  const state = { set: [], released: 0, trashed: [] };
  const cell = { setValue: (v) => state.set.push(v) };
  const env = {
    ExportCurrentCellPhoto: async () => "img",
    ShareFile() {},
    DriveIdToUrl: (id) => `url-${id}`,
    TrashFile: (id) => state.trashed.push(id),
    UrlFetchApp: { fetch: () => ({ getContentText: () => '{"image_url":"http://x/y.png"}' }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({ getActiveSheet: () => ({ getActiveCell: () => cell }) }),
      flush() {},
    },
    LockService: { getScriptLock: () => ({ tryLock() {}, releaseLock: () => state.released++ }) },
    Random: () => 7,
    locks: [],
  };
  const code = `${grab(/function Lock\(\)[\s\S]*?\n}\n/)}${grab(/function Unlock[\s\S]*?\n}\n/)}${grab(/async function PhotoTemp[\s\S]*?\n}\n/)}; return PhotoTemp;`;
  const PhotoTemp = new Function(...Object.keys(env), code)(...Object.values(env));
  return { PhotoTemp, state };
}

test("PhotoTemp writes the uploaded image url into the active cell", async () => {
  const { PhotoTemp, state } = run();
  const orig = console.log;
  console.log = () => {};
  try {
    await PhotoTemp("key");
  } finally {
    console.log = orig;
  }
  assert.deepStrictEqual(state.set, ["http://x/y.png"]);
});

test("PhotoTemp releases the lock it took and trashes the temporary image", async () => {
  const { PhotoTemp, state } = run();
  const orig = console.log;
  console.log = () => {};
  try {
    await PhotoTemp("key");
  } finally {
    console.log = orig;
  }
  assert.strictEqual(state.released, 1);
  assert.deepStrictEqual(state.trashed, ["img"]);
});

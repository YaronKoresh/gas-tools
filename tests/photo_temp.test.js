const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (re) => source.match(re)[0];

function run(reply = { code: 200, body: '{"image_url":"http://x/y.png"}' }) {
  const state = { set: [], released: 0, trashed: [] };
  const cell = { setValue: (v) => state.set.push(v) };
  const env = {
    ExportCurrentCellPhoto: async () => "img",
    ShareFile() {},
    DriveIdToUrl: (id) => `url-${id}`,
    TrashFile: (id) => state.trashed.push(id),
    UrlFetchApp: { fetch: () => ({ getContentText: () => reply.body, getResponseCode: () => reply.code }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({ getActiveSheet: () => ({ getActiveCell: () => cell }) }),
      flush() {},
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => state.released++ }) },
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

test("PhotoTemp throws and leaves the cell alone when the service rejects the image", async () => {
  const { PhotoTemp, state } = run({ code: 401, body: '{"message":"Invalid API key"}' });
  const orig = console.log;
  console.log = () => {};
  try {
    await assert.rejects(() => PhotoTemp("secret-key"), (e) => /401.*Invalid API key/.test(e.message) && !e.message.includes("secret-key"));
  } finally {
    console.log = orig;
  }
  assert.deepStrictEqual(state.set, []);
  assert.deepStrictEqual(state.trashed, ["img"]);
  assert.strictEqual(state.released, 0);
});

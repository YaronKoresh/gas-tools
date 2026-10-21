const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const fnSource = source.match(/async function CurrentPhotoIntoUrl[\s\S]*?\n}\n/)[0];

function load() {
  const state = { set: [], short: [], unlocked: [] };
  const cell = { setValue: (v) => state.set.push(v) };
  const env = {
    ExportCurrentCellPhoto: async () => "img",
    ShareFile() {},
    DriveIdToUrl: (id) => `url:${id}`,
    ShortUrl: (...a) => {
      state.short.push(a);
      return "short";
    },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getActiveSheet: () => ({ getActiveCell: () => cell }) }) },
    Lock: () => 42,
    Unlock: (n) => state.unlocked.push(n),
  };
  const fn = new Function(...Object.keys(env), `${fnSource}; return CurrentPhotoIntoUrl;`)(...Object.values(env));
  return { fn, state };
}

test("CurrentPhotoIntoUrl passes key, group and the drive url to ShortUrl", async () => {
  const { fn, state } = load();
  await fn("key", "guid");
  assert.deepStrictEqual(state.short, [["key", "guid", "url:img"]]);
});

test("CurrentPhotoIntoUrl writes the short url into the cell and unlocks", async () => {
  const { fn, state } = load();
  assert.strictEqual(await fn("key", "guid"), "short");
  assert.deepStrictEqual(state.set, ["short"]);
  assert.deepStrictEqual(state.unlocked, [42]);
});

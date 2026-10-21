const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const fnSource = source.match(/async function CurrentPhotoIntoUrl[\s\S]*?\n}\n/)[0];

function load(shortFails = false) {
  const state = { set: [], short: [], unlocked: [], trashed: [] };
  const cell = { setValue: (v) => state.set.push(v) };
  const env = {
    ExportCurrentCellPhoto: async () => "img",
    ShareFile() {},
    TrashFile: (id) => state.trashed.push(id),
    DriveIdToUrl: (id) => `url:${id}`,
    ShortUrl: (...a) => {
      state.short.push(a);
      if (shortFails) throw new Error("bitly down");
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

test("CurrentPhotoIntoUrl trashes the shared image when the short url cannot be made", async () => {
  const { fn, state } = load(true);
  await assert.rejects(() => fn("key", "guid"), /bitly down/);
  assert.deepStrictEqual(state.trashed, ["img"]);
  assert.deepStrictEqual(state.set, []);
});

test("CurrentPhotoIntoUrl keeps the shared image when the short url was made", async () => {
  const { fn, state } = load();
  await fn("key", "guid");
  assert.deepStrictEqual(state.trashed, []);
});

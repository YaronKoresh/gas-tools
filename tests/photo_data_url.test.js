const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const fnSource = source.match(/async function PhotoDataUrl[\s\S]*?\n}\n/)[0];

function load({ type = "image/png", exportThrows = false } = {}) {
  const state = { released: 0, trashed: [] };
  const env = {
    LockService: { getDocumentLock: () => ({ tryLock: () => true, releaseLock: () => state.released++ }) },
    ScriptApp: { getOAuthToken: () => "tok" },
    ExportCurrentCellPhoto: async () => {
      if (exportThrows) throw new Error("export failed");
      return "id";
    },
    ShareFile() {},
    TrashFile: (id) => state.trashed.push(id),
    DriveIdToUrl: (id) => `url:${id}`,
    GetType: () => type,
    ParseUrlContent: () => [1, 2, 3],
    PackContent: () => ({ getBytes: () => [1, 2, 3] }),
    Utilities: { base64Encode: () => "AQID" },
  };
  const fn = new Function(...Object.keys(env), `${fnSource}; return PhotoDataUrl;`)(...Object.values(env));
  return { fn, state };
}

test("PhotoDataUrl returns the data url and releases the lock", async () => {
  const { fn, state } = load();
  assert.strictEqual(await fn(), "data:image/png;base64,AQID");
  assert.strictEqual(state.released, 1);
});

test("PhotoDataUrl releases the lock for a file that is not an image", async () => {
  const { fn, state } = load({ type: "application/pdf" });
  assert.strictEqual(await fn(), undefined);
  assert.strictEqual(state.released, 1);
});

test("PhotoDataUrl releases the lock when the export fails", async () => {
  const { fn, state } = load({ exportThrows: true });
  await assert.rejects(() => fn(), /export failed/);
  assert.strictEqual(state.released, 1);
});

test("PhotoDataUrl trashes the shared temporary image after reading it", async () => {
  const { fn, state } = load();
  await fn();
  assert.deepStrictEqual(state.trashed, ["id"]);
});

test("PhotoDataUrl trashes the shared temporary image when it is not an image", async () => {
  const { fn, state } = load({ type: "application/pdf" });
  await fn();
  assert.deepStrictEqual(state.trashed, ["id"]);
});

test("PhotoDataUrl returns nothing and trashes the image when its type cannot be read", async () => {
  const { fn, state } = load({ type: null });
  assert.strictEqual(await fn(), undefined);
  assert.deepStrictEqual(state.trashed, ["id"]);
  assert.strictEqual(state.released, 1);
});

test("PhotoDataUrl trashes nothing when the export fails", async () => {
  const { fn, state } = load({ exportThrows: true });
  await assert.rejects(() => fn(), /export failed/);
  assert.deepStrictEqual(state.trashed, []);
});

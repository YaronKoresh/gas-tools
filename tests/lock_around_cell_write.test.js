const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (re) => source.match(re)[0];

function env(cellThrows) {
  const state = { unlocked: 0, locked: 0 };
  const cell = {
    setValue: () => {
      if (cellThrows) throw new Error("protected cell");
    },
  };
  return {
    state,
    env: {
      Lock: () => (state.locked++, 1),
      Unlock: () => state.unlocked++,
      SpreadsheetApp: {
        newCellImage: () => ({ setSourceUrl: () => ({ build: () => "img" }) }),
        getActiveSpreadsheet: () => ({
          getSheetByName: () => ({ getRange: () => cell }),
          getActiveSheet: () => ({ getActiveCell: () => cell }),
        }),
      },
      ExportCurrentCellPhoto: async () => "img",
      ShareFile() {},
      DriveIdToUrl: (id) => `url:${id}`,
      TrashFile() {},
      UrlFetchApp: { fetch: () => ({ getContentText: () => '{"image_url":"u"}' }) },
      ShortUrl: () => "short",
    },
  };
}

const quiet = async (fn) => {
  const orig = console.log;
  console.log = () => {};
  try {
    return await fn();
  } finally {
    console.log = orig;
  }
};

test("InsertImage releases the lock when the cell write fails", () => {
  const { env: e, state } = env(true);
  const fn = new Function(...Object.keys(e), `${grab(/function InsertImage[\s\S]*?\n}\n/)}; return InsertImage;`)(...Object.values(e));
  assert.throws(() => fn("S", "A1", "id"), /protected cell/);
  assert.deepStrictEqual(state, { unlocked: 1, locked: 1 });
});

test("PhotoTemp releases the lock when the cell write fails", async () => {
  const { env: e, state } = env(true);
  const fn = new Function(...Object.keys(e), `${grab(/async function PhotoTemp[\s\S]*?\n}\n/)}; return PhotoTemp;`)(...Object.values(e));
  await assert.rejects(() => quiet(() => fn("key")), /protected cell/);
  assert.deepStrictEqual(state, { unlocked: 1, locked: 1 });
});

test("CurrentPhotoIntoUrl releases the lock when the cell write fails", async () => {
  const { env: e, state } = env(true);
  const fn = new Function(...Object.keys(e), `${grab(/async function CurrentPhotoIntoUrl[\s\S]*?\n}\n/)}; return CurrentPhotoIntoUrl;`)(...Object.values(e));
  await assert.rejects(() => fn("k", "g"), /protected cell/);
  assert.deepStrictEqual(state, { unlocked: 1, locked: 1 });
});

test("the three functions still unlock once on success", async () => {
  const { env: e, state } = env(false);
  const code = `${grab(/function InsertImage[\s\S]*?\n}\n/)}${grab(/async function PhotoTemp[\s\S]*?\n}\n/)}${grab(/async function CurrentPhotoIntoUrl[\s\S]*?\n}\n/)}; return { InsertImage, PhotoTemp, CurrentPhotoIntoUrl };`;
  const fns = new Function(...Object.keys(e), code)(...Object.values(e));
  fns.InsertImage("S", "A1", "id");
  await quiet(() => fns.PhotoTemp("key"));
  assert.strictEqual(await fns.CurrentPhotoIntoUrl("k", "g"), "short");
  assert.deepStrictEqual(state, { unlocked: 3, locked: 3 });
});

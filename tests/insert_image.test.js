const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function load() {
  const state = { set: [], urls: [], locked: 0, released: 0 };
  const range = { setValue: (v) => state.set.push(v) };
  const env = {
    SpreadsheetApp: {
      newCellImage: () => ({ setSourceUrl: (u) => (state.urls.push(u), { build: () => "image" }) }),
      getActiveSpreadsheet: () => ({ getSheetByName: (n) => (n === "S" ? { getRange: () => range } : null) }),
    },
    Lock: () => (state.locked++, 0),
    Unlock: () => state.released++,
  };
  const InsertImage = new Function(...Object.keys(env), `${grab("InsertImage")}; return InsertImage;`)(...Object.values(env));
  return { InsertImage, state };
}

test("InsertImage puts the drive image into the cell and releases the lock", () => {
  const { InsertImage, state } = load();
  InsertImage("S", "A1", "abc");
  assert.deepStrictEqual(state.set, ["image"]);
  assert.deepStrictEqual(state.urls, ["https://drive.google.com/uc?id=abc"]);
  assert.strictEqual(state.released, 1);
});

test("InsertImage names the missing sheet and takes no lock", () => {
  const { InsertImage, state } = load();
  assert.throws(() => InsertImage("Nope", "A1", "abc"), /Sheet not found: Nope/);
  assert.strictEqual(state.locked, 0);
});

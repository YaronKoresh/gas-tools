const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function load(rows, columns) {
  const sheet = {
    getRange: (a) => ({
      getNumRows: () => (a === "A1:A" ? rows : 0),
      getNumColumns: () => (a === "A1:1" ? columns : 0),
    }),
  };
  const fns = new Function(`${grab("GetRowsCount")}${grab("GetColumnsCount")}; return { GetRowsCount, GetColumnsCount };`)();
  return { ...fns, sheet };
}

test("GetRowsCount and GetColumnsCount read the size of the sheet", () => {
  const { GetRowsCount, GetColumnsCount, sheet } = load(1000, 26);
  assert.strictEqual(GetRowsCount(sheet), 1000);
  assert.strictEqual(GetColumnsCount(sheet), 26);
});

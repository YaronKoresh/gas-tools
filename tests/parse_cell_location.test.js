const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];
const ParseCellLocation = new Function(`${grab("LettersToColumn")}${grab("ParseCellLocation")}; return ParseCellLocation;`)();

test("ParseCellLocation reads column and row", () => {
  assert.deepStrictEqual(ParseCellLocation("AB12"), { column: 28, row: 12 });
  assert.deepStrictEqual(ParseCellLocation(" b3 "), { column: 2, row: 3 });
});

test("ParseCellLocation rejects row zero", () => {
  assert.throws(() => ParseCellLocation("A0"), /Invalid cell location: A0/);
  assert.throws(() => ParseCellLocation("B00"), /Invalid cell location/);
});

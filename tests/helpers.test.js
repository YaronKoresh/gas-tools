const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function load(env = {}) {
  const names = ["Range", "Flatten", "ColumnToLetter", "LettersToColumn", "GetObject", "DriveIdToUrl", "ShareFile", "UnshareFile", "GetCellLocation"];
  return new Function(...Object.keys(env), `${names.map(grab).join("")}; return { ${names.join(", ")} };`)(...Object.values(env));
}

test("Range lists the numbers from min to max including both", () => {
  const { Range } = load();
  assert.deepStrictEqual(Range(1, 4), [1, 2, 3, 4]);
  assert.deepStrictEqual(Range(3, 3), [3]);
  assert.deepStrictEqual(Range(5, 4), []);
});

test("Flatten flattens nested arrays and keeps the input array", () => {
  const { Flatten } = load();
  const input = [1, [2, [3, [4]]], []];
  assert.deepStrictEqual(Flatten(input), [1, 2, 3, 4]);
  assert.deepStrictEqual(input, [1, [2, [3, [4]]], []]);
});

test("ColumnToLetter and LettersToColumn are inverse for many columns", () => {
  const { ColumnToLetter, LettersToColumn } = load();
  assert.strictEqual(ColumnToLetter(1), "A");
  assert.strictEqual(ColumnToLetter(26), "Z");
  assert.strictEqual(ColumnToLetter(27), "AA");
  assert.strictEqual(ColumnToLetter(702), "ZZ");
  assert.strictEqual(ColumnToLetter(703), "AAA");
  for (let n = 1; n <= 1500; n++) {
    assert.strictEqual(LettersToColumn(ColumnToLetter(n)), n);
  }
  assert.strictEqual(LettersToColumn("ab"), 28);
});

test("GetObject builds an object from key and value pairs", () => {
  const { GetObject } = load();
  assert.deepStrictEqual(GetObject(["a", 1, "b", 2]), { a: 1, b: 2 });
  assert.deepStrictEqual(GetObject([]), {});
});

test("GetCellLocation joins the column letter and the row", () => {
  const { GetCellLocation } = load();
  assert.strictEqual(GetCellLocation({ getColumn: () => 28, getRow: () => 5 }), "AB5");
});

test("DriveIdToUrl builds the view link of the file", () => {
  const { DriveIdToUrl } = load();
  assert.strictEqual(DriveIdToUrl("abc"), "https://drive.google.com/file/d/abc/view");
});

test("ShareFile gives view access to anyone with the link and UnshareFile makes it private", () => {
  const calls = [];
  const env = {
    DriveApp: {
      Access: { ANYONE_WITH_LINK: "link", PRIVATE: "private" },
      Permission: { VIEW: "view" },
      getFileById: (id) => ({ setSharing: (access, permission) => calls.push([id, access, permission]) }),
    },
  };
  const { ShareFile, UnshareFile } = load(env);
  ShareFile("f1");
  UnshareFile("f2");
  assert.deepStrictEqual(calls, [
    ["f1", "link", "view"],
    ["f2", "private", "view"],
  ]);
});

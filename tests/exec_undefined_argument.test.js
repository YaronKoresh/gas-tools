const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];
const { Exec } = new Function(`${grab("Stringify")}${grab("Exec")}; return { Exec };`)();

test("Exec hands an undefined argument to the code as undefined", () => {
  assert.strictEqual(Exec("return typeof _1;", undefined), "undefined");
});

test("Exec still passes objects with their defined values", () => {
  assert.deepStrictEqual(Exec("return _1;", { a: 1, b: undefined }), { a: 1 });
  assert.strictEqual(Exec("return _1 + _2;", 2, 3), 5);
});

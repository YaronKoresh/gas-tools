const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];
const { Stringify } = new Function(`${grab("Stringify")}; return { Stringify };`)();

test("Stringify writes boxed numbers, strings and booleans as their values", () => {
  assert.strictEqual(Stringify(new Number(5)), "5");
  assert.strictEqual(Stringify(new String("s")), '"s"');
  assert.strictEqual(Stringify(new Boolean(false)), "false");
});

test("Stringify keeps boxed values inside objects and arrays", () => {
  assert.strictEqual(Stringify({ n: new Number(1), s: new String("x") }), '{"n":1,"s":"x"}');
  assert.strictEqual(Stringify([new Boolean(true), new Number(2)]), "[true,2]");
});

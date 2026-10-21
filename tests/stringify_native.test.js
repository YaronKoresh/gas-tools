const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];
const { Stringify, Parse } = new Function(`${grab("Stringify")}${grab("Parse")}; return { Stringify, Parse };`)();

test("Stringify writes null for native functions inside arrays and objects", () => {
  assert.strictEqual(Stringify([Math.max, 1]), "[null,1]");
  assert.strictEqual(Stringify({ f: Math.max, g: parseInt }), '{"f":null,"g":null}');
  assert.strictEqual(Stringify({ f: function () {}.bind(null) }), '{"f":null}');
  assert.deepStrictEqual(Parse(Stringify({ f: Symbol, n: 2 })), { f: null, n: 2 });
});

test("Stringify writes null for a native function given on its own", () => {
  assert.strictEqual(Stringify(Math.max), "null");
});

test("Stringify keeps the source of user functions", () => {
  const add = function add(a, b) { return a + b; };
  assert.strictEqual(Stringify(add), add.toString());
  assert.strictEqual(Stringify([add]), "[" + add.toString() + "]");
});

test("Stringify writes null for symbols", () => {
  assert.strictEqual(Stringify(Symbol("x")), "null");
  assert.strictEqual(Stringify([Symbol("a"), 1]), "[null,1]");
  assert.strictEqual(Stringify({ s: Symbol("x"), n: 1 }), '{"s":null,"n":1}');
});

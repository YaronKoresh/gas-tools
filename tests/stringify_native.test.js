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
  assert.strictEqual(Stringify([add], true), "[" + add.toString() + "]");
});

test("Stringify writes null for symbols", () => {
  assert.strictEqual(Stringify(Symbol("x")), "null");
  assert.strictEqual(Stringify([Symbol("a"), 1]), "[null,1]");
  assert.strictEqual(Stringify({ s: Symbol("x"), n: 1 }), '{"s":null,"n":1}');
});

const { Exec } = new Function(`${grab("Stringify")}${grab("Exec")}; return { Exec };`)();

test("Exec receives objects that hold method shorthand", () => {
  const arg = {
    plain() { return 1; },
    async later(a) { return a; },
    *gen() { yield 2; },
    arrow: (x) => x + 1,
    asyncArrow: async (x) => x,
    declared: function named() { return 3; },
  };
  assert.strictEqual(Exec("return _1.plain()", arg), 1);
  assert.strictEqual(Exec("return _1.gen().next().value", arg), 2);
  assert.strictEqual(Exec("return _1.arrow(1)", arg), 2);
  assert.strictEqual(Exec("return _1.declared()", arg), 3);
  assert.ok(Exec("return _1.later(5)", arg) instanceof Promise);
  assert.ok(Exec("return _1.asyncArrow(5)", arg) instanceof Promise);
});

test("Exec receives an object with a toJSON method", () => {
  assert.strictEqual(Exec("return _1.a.toJSON()", { a: { toJSON() { return 5; } } }), 5);
});

test("Exec receives a method given on its own", () => {
  const obj = { twice(n) { return n * 2; } };
  assert.strictEqual(Exec("return _1(4)", obj.twice), 8);
});

test("Stringify stores nested functions as text that Parse revives", () => {
  const text = Stringify({ add: (a, b) => a + b, nested: [function twice(n) { return n * 2; }], plain() { return 9; } });
  assert.doesNotThrow(() => JSON.parse(text));
  const back = Parse(text);
  assert.strictEqual(back.add(1, 2), 3);
  assert.strictEqual(back.nested[0](4), 8);
  assert.strictEqual(back.plain(), 9);
});

test("Stringify keeps nested native functions as null in both modes", () => {
  assert.strictEqual(Stringify({ f: Math.max }), '{"f":null}');
  assert.strictEqual(Stringify({ f: Math.max }, true), '{"f":null}');
});

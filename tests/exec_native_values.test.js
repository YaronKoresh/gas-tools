const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];
const { Exec, Stringify } = new Function(`${grab("Stringify")}${grab("Exec")}; return { Exec, Stringify };`)();

test("Exec hands a regular expression to the code as a regular expression", () => {
  const re = Exec("return _1;", /a+\/b/gi);
  assert.ok(re instanceof RegExp);
  assert.strictEqual(re.source, "a+\\/b");
  assert.strictEqual(re.flags, "gi");
});

test("Exec hands a Map and a Set to the code with their content", () => {
  const map = Exec("return _1;", new Map([["a", 1], [2, { b: /x/ }]]));
  assert.ok(map instanceof Map);
  assert.strictEqual(map.get("a"), 1);
  assert.ok(map.get(2).b instanceof RegExp);
  const set = Exec("return _1;", new Set([1, "two", [3]]));
  assert.ok(set instanceof Set);
  assert.deepStrictEqual([...set], [1, "two", [3]]);
});

test("Exec hands NaN, Infinity, negative zero and BigInt to the code unchanged", () => {
  assert.ok(Number.isNaN(Exec("return _1;", NaN)));
  assert.strictEqual(Exec("return _1;", Infinity), Infinity);
  assert.strictEqual(Exec("return _1;", -Infinity), -Infinity);
  assert.ok(Object.is(Exec("return _1;", -0), -0));
  assert.strictEqual(Exec("return _1;", 12n), 12n);
  const nested = Exec("return _1;", { a: [NaN, Infinity], r: /x/ });
  assert.ok(Number.isNaN(nested.a[0]));
  assert.strictEqual(nested.a[1], Infinity);
  assert.ok(nested.r instanceof RegExp);
});

test("Stringify without the code flag keeps its JSON-like output", () => {
  assert.strictEqual(Stringify({ a: NaN, b: Infinity, c: /x/, d: new Map(), e: new Set() }), '{"a":null,"b":null,"c":{},"d":{},"e":{}}');
  assert.strictEqual(Stringify([-0]), "[0]");
});

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const Parse = new Function(`${source.match(/function Parse\b[\s\S]*?\n}\n/)[0]}; return Parse;`)();

test("Parse keeps strings that name globals as text", () => {
  const r = Parse('{"a":"Date","b":"parseInt","c":"2+3","d":"name","e":"alert"}');
  assert.deepStrictEqual(r, { a: "Date", b: "parseInt", c: "2+3", d: "name", e: "alert" });
});

test("Parse revives arrow and function sources", () => {
  const r = Parse('{"f":"function(x){return x+1}","g":"(x)=>x*2","h":"x=>x*3","i":"async (x) => x"}');
  assert.strictEqual(r.f(2), 3);
  assert.strictEqual(r.g(2), 4);
  assert.strictEqual(r.h(2), 6);
  assert.strictEqual(typeof r.i, "function");
});

test("Parse keeps plain data, numbers and arrays", () => {
  assert.deepStrictEqual(Parse('{"a":1,"b":[true,null,"x"],"c":{"d":"text"}}'), { a: 1, b: [true, null, "x"], c: { d: "text" } });
});

test("Parse does not run text that only looks like code", () => {
  globalThis.__ran = false;
  const r = Parse('{"x":"globalThis.__ran = true"}');
  assert.strictEqual(r.x, "globalThis.__ran = true");
  assert.strictEqual(globalThis.__ran, false);
  delete globalThis.__ran;
});

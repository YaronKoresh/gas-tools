const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];
const { Stringify, Parse } = new Function(`${grab("Stringify")}${grab("Parse")}; return { Stringify, Parse };`)();

test("Stringify stores a Date as an ISO string", () => {
  const d = new Date("2026-01-02T03:04:05Z");
  assert.strictEqual(Stringify(d), '"2026-01-02T03:04:05.000Z"');
});

test("Stringify handles Dates inside objects and arrays", () => {
  const d = new Date("2026-01-02T03:04:05Z");
  const text = Stringify({ name: "A", timestamp: d, list: [d, 1] });
  assert.deepStrictEqual(Parse(text), {
    name: "A",
    timestamp: "2026-01-02T03:04:05.000Z",
    list: ["2026-01-02T03:04:05.000Z", 1],
  });
});

test("Stringify still rejects a Promise", () => {
  assert.throws(() => Stringify(Promise.resolve(1)), /Promise/);
});

test("Stringify keeps plain data and null", () => {
  assert.strictEqual(Stringify({ a: 1, b: null, c: [true, "x"] }), '{"a":1,"b":null,"c":[true,"x"]}');
});

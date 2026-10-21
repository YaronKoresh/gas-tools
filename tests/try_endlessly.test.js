const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const fnSource = source.match(/function TryEndlessly[\s\S]*?\n}\n/)[0];

function load() {
  const sleeps = [];
  const env = { Utilities: { sleep: (ms) => sleeps.push(ms) } };
  const TryEndlessly = new Function(...Object.keys(env), `${fnSource}; return TryEndlessly;`)(...Object.values(env));
  return { TryEndlessly, sleeps };
}

function quiet(fn) {
  const orig = console.log;
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.log = orig;
  }
}

test("TryEndlessly passes the arguments and returns the value", () => {
  const { TryEndlessly, sleeps } = load();
  assert.strictEqual(quiet(() => TryEndlessly((a, b) => a * b, 3, 4)), 12);
  assert.deepStrictEqual(sleeps, []);
});

test("TryEndlessly keeps trying with a pause until the function succeeds", () => {
  const { TryEndlessly, sleeps } = load();
  let calls = 0;
  const value = quiet(() =>
    TryEndlessly(() => {
      if (++calls < 4) throw new Error("later");
      return "done";
    }),
  );
  assert.strictEqual(value, "done");
  assert.deepStrictEqual(sleeps, [500, 500, 500]);
});

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const fnSource = source.match(/function TryRepeatedly[\s\S]*?\n}\n/)[0];

function load() {
  const state = { sleeps: [] };
  const env = { Utilities: { sleep: (ms) => state.sleeps.push(ms) } };
  const TryRepeatedly = new Function(...Object.keys(env), `${fnSource}; return TryRepeatedly;`)(...Object.values(env));
  return { TryRepeatedly, state };
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

test("TryRepeatedly returns the value of the first successful call", () => {
  const { TryRepeatedly, state } = load();
  assert.strictEqual(quiet(() => TryRepeatedly(3, (a, b) => a + b, 1, 2)), 3);
  assert.deepStrictEqual(state.sleeps, []);
});

test("TryRepeatedly retries after a failure and waits between attempts", () => {
  const { TryRepeatedly, state } = load();
  let calls = 0;
  const value = quiet(() =>
    TryRepeatedly(5, () => {
      if (++calls < 3) throw new Error("not yet");
      return "ok";
    }),
  );
  assert.strictEqual(value, "ok");
  assert.strictEqual(calls, 3);
  assert.deepStrictEqual(state.sleeps, [500, 500]);
});

test("TryRepeatedly throws the last error after the attempts run out", () => {
  const { TryRepeatedly } = load();
  let calls = 0;
  assert.throws(
    () =>
      quiet(() =>
        TryRepeatedly(3, () => {
          throw new Error("fail " + ++calls);
        }),
      ),
    /fail 3/,
  );
  assert.strictEqual(calls, 3);
});

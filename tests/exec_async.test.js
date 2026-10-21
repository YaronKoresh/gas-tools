const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const ExecAsync = new Function(`${source.match(/function ExecAsync[\s\S]*?\n}\n/)[0]}; return ExecAsync;`)();

function quiet(fn) {
  const orig = console.log;
  console.log = () => {};
  return fn().finally(() => {
    console.log = orig;
  });
}

test("ExecAsync returns the result of a plain function", async () => {
  assert.strictEqual(await ExecAsync((a, b) => a + b, 2, 3), 5);
});

test("ExecAsync returns the resolved value of an async function", async () => {
  assert.strictEqual(await ExecAsync(async (a) => a * 2, 4), 8);
});

test("ExecAsync returns null when the function throws", async () => {
  assert.strictEqual(
    await quiet(() =>
      ExecAsync(() => {
        throw new Error("x");
      }),
    ),
    null,
  );
});

test("ExecAsync returns null when an async function rejects", async () => {
  assert.strictEqual(
    await quiet(() =>
      ExecAsync(async () => {
        throw new Error("y");
      }),
    ),
    null,
  );
});

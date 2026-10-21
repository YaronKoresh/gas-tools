const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function load() {
  const env = {
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    setTimeout,
    console: { error() {} },
  };
  return new Function(...Object.keys(env), `${grab("Sleep")}${grab("WaitUntil")}; return WaitUntil;`)(...Object.values(env));
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("WaitUntil calls Success once the test passes", async () => {
  const WaitUntil = load();
  let calls = 0;
  let succeeded = 0;
  WaitUntil(2, () => ++calls >= 3, () => succeeded++, () => assert.fail("must not time out"));
  await wait(500);
  assert.strictEqual(succeeded, 1);
});

test("WaitUntil calls Fail when the test never passes within the timeout", async () => {
  const WaitUntil = load();
  let failed = 0;
  WaitUntil(0.2, () => false, () => assert.fail("must not succeed"), () => failed++);
  await wait(800);
  assert.strictEqual(failed, 1);
});

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const Sleep = new Function("setTimeout", `${source.match(/function Sleep\b[\s\S]*?\n}\n/)[0]}; return Sleep;`)(setTimeout);

test("Sleep returns a promise that resolves after the given milliseconds", async () => {
  const start = Date.now();
  const promise = Sleep(60);
  assert.ok(promise instanceof Promise);
  await promise;
  assert.ok(Date.now() - start >= 50);
});

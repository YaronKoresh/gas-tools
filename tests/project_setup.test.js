const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

test("package.json defines the npm test command that runs every test file", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.strictEqual(pkg.scripts.test, "node --test tests/*.test.js");
});

test("a workflow runs npm test on push and pull request", () => {
  const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "test.yml"), "utf8");
  assert.ok(/^on:/m.test(workflow));
  assert.ok(workflow.includes("push:"));
  assert.ok(workflow.includes("pull_request:"));
  assert.ok(/run: npm test/.test(workflow));
});

test("the README explains how to run the tests", () => {
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  assert.ok(readme.includes("npm test"));
});

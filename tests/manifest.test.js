const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");

test("the manifest file has the name Apps Script expects", () => {
  assert.ok(fs.existsSync(path.join(root, "appsscript.json")));
  assert.ok(!fs.existsSync(path.join(root, "appscript.json")));
});

test("the file named in the README exists", () => {
  assert.ok(readme.includes("appsscript.json file in this repository"));
  assert.ok(fs.existsSync(path.join(root, "appsscript.json")));
});

test("the manifest lists every oauth scope once", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "appsscript.json"), "utf8"));
  assert.strictEqual(new Set(manifest.oauthScopes).size, manifest.oauthScopes.length);
});

test("the README lists the scopes of the manifest", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "appsscript.json"), "utf8"));
  for (const scope of manifest.oauthScopes) {
    assert.ok(readme.includes(scope), scope);
  }
});

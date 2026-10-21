const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const readme = fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8");
const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");

test("the README awaits the async ExportRangeAsPng", () => {
  assert.ok(/async function ExportRangeAsPng/.test(source));
  assert.ok(/async function exportChart\(\)/.test(readme));
  assert.ok(/await ExportRangeAsPng\(/.test(readme));
});

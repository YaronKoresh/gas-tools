const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");

test("the pdf-lib script that is evaluated at load time is pinned to an exact version", () => {
  const url = source.match(/const pdf_lib_url = "([^"]+)";/)[1];
  assert.match(url, /^https:\/\/cdn\.jsdelivr\.net\/npm\/pdf-lib@\d+\.\d+\.\d+\/dist\/pdf-lib\.min\.js$/);
  assert.ok(source.includes("eval(UrlFetchApp.fetch(pdf_lib_url).getContentText());"));
});

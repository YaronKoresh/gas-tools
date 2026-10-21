const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function run(id) {
  const state = { html: null };
  const env = {
    Html: (s) => ({ setHeight: () => ({ setWidth: () => (state.html = s) }) }),
    SpreadsheetApp: { getUi: () => ({ showModelessDialog() {} }) },
  };
  const OpenFile = new Function(...Object.keys(env), `${grab("EscapeHtml")}${grab("DriveIdToUrl")}${grab("OpenFile")}; return OpenFile;`)(...Object.values(env));
  OpenFile(id);
  return state.html;
}

test("OpenFile links to the drive view page of the id", () => {
  assert.ok(run("abc123").includes('href="https://drive.google.com/file/d/abc123/view"'));
});

test("OpenFile keeps a quote of the id inside the href attribute", () => {
  const html = run('a"b');
  assert.ok(html.includes('href="https://drive.google.com/file/d/a&quot;b/view"'));
});

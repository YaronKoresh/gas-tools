const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function run(msg) {
  const state = { html: null, dialog: null };
  const env = {
    Html: (str) => {
      state.html = str;
      return { setWidth: () => ({ setHeight: () => "dialog" }) };
    },
    SpreadsheetApp: { getUi: () => ({ showModelessDialog: (d, title) => (state.dialog = [d, title]) }) },
  };
  const Alert = new Function(...Object.keys(env), `${grab("EscapeHtml")}${grab("Alert")}; return Alert;`)(...Object.values(env));
  Alert(msg);
  return state;
}

test("Alert escapes angle brackets, ampersands and quotes", () => {
  const { html } = run(`a < b & c > d "e" 'f'`);
  assert.ok(html.includes("a &lt; b &amp; c &gt; d &quot;e&quot; &#39;f&#39;"));
  assert.ok(!html.includes("a < b"));
});

test("Alert leaves plain text and Hebrew unchanged", () => {
  const { html } = run("שלום עולם 123");
  assert.ok(html.includes("שלום עולם 123"));
});

test("Alert shows the dialog", () => {
  const { dialog } = run("x");
  assert.deepStrictEqual(dialog, ["dialog", "שימו לב"]);
});

test("Alert accepts a non-string message", () => {
  const { html } = run(42);
  assert.ok(html.includes("42"));
});

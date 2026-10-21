const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function load(env, names) {
  return new Function(...Object.keys(env), `${names.map(grab).join("")}; return { ${names.join(", ")} };`)(...Object.values(env));
}

test("SendMail sends an html mail with an empty plain body", () => {
  const sent = [];
  const { SendMail } = load({ MailApp: { sendEmail: (...args) => sent.push(args) } }, ["SendMail"]);
  SendMail("a@example.com", "Hi", "<b>x</b>");
  assert.deepStrictEqual(sent, [["a@example.com", "Hi", "", { htmlBody: "<b>x</b>" }]]);
});

test("Html and Out wrap the text with the right services", () => {
  const { Html, Out } = load(
    {
      HtmlService: { createHtmlOutput: (s) => ({ html: s }) },
      ContentService: { createTextOutput: (s) => ({ text: s }) },
    },
    ["Html", "Out"],
  );
  assert.deepStrictEqual(Html("<p>"), { html: "<p>" });
  assert.deepStrictEqual(Out("t"), { text: "t" });
});

test("GetEmail, GetActiveSheetName and Flush call the matching services", () => {
  const state = { flushed: 0 };
  const env = {
    Session: { getEffectiveUser: () => ({ getEmail: () => "me@example.com" }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({ getActiveSheet: () => ({ getName: () => "Sheet9" }) }),
      flush: () => state.flushed++,
    },
  };
  const { GetEmail, GetActiveSheetName, Flush } = load(env, ["GetEmail", "GetActiveSheetName", "Flush"]);
  assert.strictEqual(GetEmail(), "me@example.com");
  assert.strictEqual(GetActiveSheetName(), "Sheet9");
  Flush();
  assert.strictEqual(state.flushed, 1);
});

test("GetScriptAuthHeaders and GetScriptIdentityHeaders send a bearer token", () => {
  const env = { ScriptApp: { getOAuthToken: () => "oauth", getIdentityToken: () => "identity" } };
  const { GetScriptAuthHeaders, GetScriptIdentityHeaders } = load(env, ["GetScriptAuthHeaders", "GetScriptIdentityHeaders"]);
  assert.deepStrictEqual(GetScriptAuthHeaders(), { headers: { Authorization: "Bearer oauth" } });
  assert.deepStrictEqual(GetScriptIdentityHeaders(), { headers: { Authorization: "Bearer identity" } });
});

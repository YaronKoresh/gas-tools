const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const fnSource = source.match(/function GetType[\s\S]*?\n}\n/)[0];

function load(response) {
  const sent = [];
  const env = {
    FinalUrl: (u) => u,
    UrlFetchApp: {
      fetch: (url, params) => {
        sent.push([url, params]);
        return response;
      },
    },
  };
  const GetType = new Function(...Object.keys(env), `${fnSource}; return GetType;`)(...Object.values(env));
  return { GetType, sent };
}

const reply = (headers, code = 200) => ({ getHeaders: () => headers, getResponseCode: () => code });

test("GetType sends the headers it was given", () => {
  const { GetType, sent } = load(reply({ "Content-Type": "image/png" }));
  assert.strictEqual(GetType("http://x/y", { headers: { Authorization: "Bearer t" } }), "image/png");
  assert.deepStrictEqual(sent[0][1].headers, { Authorization: "Bearer t" });
  assert.strictEqual(sent[0][1].followRedirects, false);
});

test("GetType cuts the charset", () => {
  const { GetType } = load(reply({ "Content-Type": "text/html; charset=utf-8" }));
  assert.strictEqual(GetType("http://x/y"), "text/html");
});

test("GetType reads a lower case header name", () => {
  const { GetType } = load(reply({ "content-type": "application/pdf" }));
  assert.strictEqual(GetType("http://x/y"), "application/pdf");
});

test("GetType gives application/unknown when the content type is missing or empty", () => {
  assert.strictEqual(load(reply({})).GetType("http://x/y"), "application/unknown");
  assert.strictEqual(load(reply({ "Content-Type": "" })).GetType("http://x/y"), "application/unknown");
});

test("GetType returns null for an error status", () => {
  assert.strictEqual(load(reply({ "Content-Type": "text/html" }, 404)).GetType("http://x/y"), null);
});

test("GetType returns the media type in lower case without surrounding spaces", () => {
  const { GetType } = load(reply({ "Content-Type": " Image/PNG ; charset=binary" }));
  assert.strictEqual(GetType("http://x/y"), "image/png");
});

test("GetType treats a blank content type as unknown", () => {
  const { GetType } = load(reply({ "Content-Type": "   " }));
  assert.strictEqual(GetType("http://x/y"), "application/unknown");
});

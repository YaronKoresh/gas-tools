const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const fnSource = source.match(/function ParseUrlContent[\s\S]*?\n}\n/)[0];

function load(code) {
  const sent = [];
  const env = {
    FinalUrl: (u) => u,
    UrlFetchApp: {
      fetch: (url, params) => {
        sent.push([url, params]);
        return { getResponseCode: () => code, getBlob: () => ({ getBytes: () => [1, 2, 3] }) };
      },
    },
  };
  const ParseUrlContent = new Function(...Object.keys(env), `${fnSource}; return ParseUrlContent;`)(...Object.values(env));
  return { ParseUrlContent, sent };
}

test("ParseUrlContent returns the bytes of a successful response", () => {
  const { ParseUrlContent, sent } = load(200);
  assert.deepStrictEqual(ParseUrlContent("http://x/y", { headers: { A: "b" } }), [1, 2, 3]);
  assert.deepStrictEqual(sent[0][1].headers, { A: "b" });
});

test("ParseUrlContent throws with the status and url for an error response", () => {
  const { ParseUrlContent } = load(404);
  assert.throws(() => ParseUrlContent("http://x/missing"), /404.*http:\/\/x\/missing/);
});

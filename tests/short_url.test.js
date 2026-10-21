const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const fnSource = source.match(/function ShortUrl[\s\S]*?\n}\n/)[0];

function load(code, body) {
  const sent = [];
  const env = {
    UrlFetchApp: {
      fetch: (url, options) => {
        sent.push([url, options]);
        return { getContentText: () => body, getResponseCode: () => code };
      },
    },
  };
  const fn = new Function(...Object.keys(env), `${fnSource}; return ShortUrl;`)(...Object.values(env));
  const run = (...args) => {
    const orig = console.log;
    console.log = () => {};
    try {
      return fn(...args);
    } finally {
      console.log = orig;
    }
  };
  return { run, sent };
}

test("ShortUrl returns the link of a successful response", () => {
  const { run, sent } = load(200, '{"link":"https://bit.ly/x"}');
  assert.strictEqual(run("key", "guid", "https://example.com/long"), "https://bit.ly/x");
  assert.strictEqual(JSON.parse(sent[0][1].payload).long_url, "https://example.com/long");
});

test("ShortUrl throws with the status and message when Bitly rejects the request", () => {
  const { run } = load(403, '{"message":"FORBIDDEN"}');
  assert.throws(() => run("secret-key", "guid", "u"), /403.*FORBIDDEN/);
});

test("ShortUrl does not put the api key in the error", () => {
  const { run } = load(403, '{"message":"FORBIDDEN"}');
  try {
    run("secret-key", "guid", "u");
    assert.fail("should throw");
  } catch (e) {
    assert.ok(!String(e.message).includes("secret-key"));
  }
});

test("ShortUrl throws a clear error for a reply that is not json", () => {
  const { run } = load(502, "<html>bad gateway</html>");
  assert.throws(() => run("k", "g", "u"), /502/);
});

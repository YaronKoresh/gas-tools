const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const start = source.indexOf("function UrlInfo");
const end = source.indexOf("function RelativeToAbsoluteUrl");
const fnSource = source.slice(start, end);

function firstFetchedUrl(input) {
  const env = {
    FinalUrl: (u) => {
      throw new Error(`FINAL:${u}`);
    },
  };
  const UrlInfo = new Function(...Object.keys(env), `${fnSource}; return UrlInfo;`)(...Object.values(env));
  const orig = console.log;
  console.log = () => {};
  try {
    UrlInfo(input);
  } catch (e) {
    return e.message.replace(/^FINAL:/, "");
  } finally {
    console.log = orig;
  }
  return null;
}

test("UrlInfo adds http to a bare host", () => {
  assert.strictEqual(firstFetchedUrl("example.com"), "http://example.com");
});

test("UrlInfo adds http to a host with a path", () => {
  assert.strictEqual(firstFetchedUrl("example.com/a/b"), "http://example.com/a/b");
});

test("UrlInfo keeps the scheme of a full url", () => {
  assert.strictEqual(firstFetchedUrl("https://example.com/a?b=1"), "https://example.com/a?b=1");
});

test("UrlInfo keeps an http full url", () => {
  assert.strictEqual(firstFetchedUrl("http://example.com"), "http://example.com");
});

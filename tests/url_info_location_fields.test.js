const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const start = source.indexOf("function UrlInfo");
const end = source.indexOf("function RelativeToAbsoluteUrl");
const fnSource = source.slice(start, end);

function render(input) {
  const env = {
    FinalUrl: (u) => u,
    GetSync: () => ({ getContent: () => Buffer.from("<html><body><p>x</p></body></html>") }),
    Utilities: { newBlob: (b) => ({ getDataAsString: () => Buffer.from(b).toString("utf8") }) },
    Out: (s) => s,
    RelativeToAbsoluteUrl: (u, r) => r,
  };
  const UrlInfo = new Function(...Object.keys(env), `${fnSource}; return UrlInfo;`)(...Object.values(env));
  const orig = console.log;
  console.log = () => {};
  try {
    return UrlInfo(input);
  } finally {
    console.log = orig;
  }
}

function location(html) {
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const assignment = script.match(/window\.(_\d+) = (\{[\s\S]*?\n\s*\});/);
  return new Function(`return ${assignment[2]}`)();
}

test("the fake location has the standard fields of a plain url", () => {
  const loc = location(render("example.com/a"));
  assert.strictEqual(loc.pathname, "/");
  assert.strictEqual(loc.protocol, "https:");
  assert.strictEqual(loc.port, "");
  assert.strictEqual(loc.hash, "");
  assert.strictEqual(loc.hostname, "example.com");
  assert.strictEqual(typeof loc.assign, "function");
  assert.strictEqual(String(loc), "https://example.com/");
  assert.strictEqual(loc.assign("/x"), undefined);
});

test("the fake location keeps the port out of the hostname", () => {
  const loc = location(render("example.com:8080/a"));
  assert.strictEqual(loc.host, "example.com:8080");
  assert.strictEqual(loc.hostname, "example.com");
  assert.strictEqual(loc.port, "8080");
});

test("the fake location handles an IPv6 host with a port", () => {
  const loc = location(render("http://[::1]:3000/a"));
  assert.strictEqual(loc.hostname, "[::1]");
  assert.strictEqual(loc.port, "3000");
  assert.strictEqual(location(render("[::1]/a")).port, "");
});

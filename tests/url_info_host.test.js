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

test("UrlInfo fills the fake location with the host of a plain url", () => {
  const loc = location(render("example.com/a"));
  assert.strictEqual(loc.host, "example.com");
  assert.strictEqual(loc.href, "https://example.com/");
  assert.strictEqual(loc.origin, "https://example.com");
});

test("UrlInfo keeps a host that has a quote character as text in the fake location", () => {
  const html = render('exa"mple.com/a');
  const loc = location(html);
  assert.strictEqual(loc.host, 'exa"mple.com');
  assert.strictEqual(loc.hostname, 'exa"mple.com');
  assert.strictEqual(loc.href, 'https://exa"mple.com/');
});

test("UrlInfo writes a less-than sign of the host as an escape in the inline script", () => {
  const html = render("example.com<b/a");
  const inline = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.ok(!inline.includes("com<"));
  assert.strictEqual(location(html).host, "example.com<b");
});

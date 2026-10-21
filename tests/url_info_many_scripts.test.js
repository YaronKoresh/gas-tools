const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const start = source.indexOf("function UrlInfo");
const end = source.indexOf("function RelativeToAbsoluteUrl");
const domainSource = source.match(/const domain = .*;/)[0];
const relativeSource = source.match(/function RelativeToAbsoluteUrl[\s\S]*\n}\n/)[0];

function run(html, address = "http://example.com/dir/page.html") {
  const env = {
    FinalUrl: (u) => u,
    GetSync: () => ({ getContent: () => [...Buffer.from(html)] }),
    Utilities: { newBlob: (bytes) => ({ getDataAsString: () => Buffer.from(bytes).toString() }) },
    Html: (s) => s,
    Out: (s) => s,
  };
  const UrlInfo = new Function(...Object.keys(env), `${domainSource}${source.slice(start, end)}${relativeSource}; return UrlInfo;`)(...Object.values(env));
  const orig = console.log;
  console.log = () => {};
  try {
    return String(UrlInfo(address)).replace(/redirect_\d+/g, "R");
  } finally {
    console.log = orig;
  }
}

const page = (body, head = "") => `<html><head>${head}</head><body>${body}</body></html>`;

test("every external script in the head is sent through the redirect", () => {
  const out = run(page("<p>x</p>", '<script src="a.js"></script><script src="b.js"></script><script type="module" src="c.js"></script>'));
  for (const name of ["a.js", "b.js", "c.js"]) {
    assert.ok(out.includes(`src="http://localhost:8000?R=http://example.com/dir/${name}"`), out);
  }
});

test("an inline script between two external scripts stays intact and the external ones are rewritten", () => {
  const out = run(page("<p>x</p>", '<script src="a.js"></script><script>var x = 1; // note\n</script><script src="b.js"></script>'));
  assert.ok(out.includes("<script>var x = 1; // note\n</script>"), out);
  assert.ok(out.includes('src="http://localhost:8000?R=http://example.com/dir/a.js"'), out);
  assert.ok(out.includes('src="http://localhost:8000?R=http://example.com/dir/b.js"'), out);
});

test("inline scripts with strings, comments and comparisons are copied whole", () => {
  const code = 'var s = "a</b>c"; /* x */ if (1 > 0) {}';
  const out = run(page("<p>x</p>", `<script>${code}</script>`));
  assert.ok(out.includes(`<script>${code}</script>`), out);
});

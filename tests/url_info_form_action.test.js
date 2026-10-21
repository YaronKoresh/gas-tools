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

test("the action of a form and the formaction of a button go through the redirect", () => {
  const out = run(page('<form action="/s?x=1" method="post"><button formaction="go/2">b</button></form>'));
  assert.ok(out.includes('action="http://localhost:8000?R=http://example.com/s?x=1"'), out);
  assert.ok(out.includes('formaction="http://localhost:8000?R=http://example.com/dir/go/2"'), out);
});

test("attributes that only contain the word action are not rewritten", () => {
  const out = run(page('<div data-action="x" title="action">t</div>'));
  assert.ok(out.includes('<div data-action="x" title="action">t</div>'), out);
});

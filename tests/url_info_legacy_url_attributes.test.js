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

test("background, cite and longdesc urls go through the redirect", () => {
  const out = run('<html><head></head><body><table background="/bg.png"><tr><td background="t.png">1</td></tr></table><blockquote cite="/q">b</blockquote><img src="a.png" longdesc="/ld.html"></body></html>');
  assert.ok(out.includes('<table background="http://localhost:8000?R=http://example.com/bg.png">'), out);
  assert.ok(out.includes('<td background="http://localhost:8000?R=http://example.com/dir/t.png">'), out);
  assert.ok(out.includes('<blockquote cite="http://localhost:8000?R=http://example.com/q">'), out);
  assert.ok(out.includes('longdesc="http://localhost:8000?R=http://example.com/ld.html"'), out);
});

test("the background of the body is kept and goes through the redirect", () => {
  const out = run('<html><head></head><body background="img/bg.gif" class="c"><p>x</p></body></html>');
  assert.ok(out.includes('<body background="http://localhost:8000?R=http://example.com/dir/img/bg.gif" class="c">'), out);
});

test("a data url in a background attribute is left alone", () => {
  const out = run('<html><head></head><body><table background="data:image/gif;base64,AAAA"><tr><td>1</td></tr></table></body></html>');
  assert.ok(out.includes('background="data:image/gif;base64,AAAA"'), out);
});

test("attributes that only contain the word background are not changed", () => {
  const out = run('<html><head></head><body><p data-background="x" title="a">t</p></body></html>');
  assert.ok(out.includes('title="a"'), out);
  assert.ok(out.includes('data-background="x"'), out);
});

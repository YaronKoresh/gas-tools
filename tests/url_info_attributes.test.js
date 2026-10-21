const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const start = source.indexOf("function UrlInfo");
const end = source.indexOf("function RelativeToAbsoluteUrl");
const domainSource = source.match(/const domain = .*;/)[0];

function run(html) {
  const env = {
    FinalUrl: (u) => u,
    GetSync: () => ({ getContent: () => [...Buffer.from(html)] }),
    Utilities: { newBlob: (bytes) => ({ getDataAsString: () => Buffer.from(bytes).toString() }) },
    Html: (s) => s,
    Out: (s) => s,
    RelativeToAbsoluteUrl: (u, r) => "ABS" + r,
  };
  const UrlInfo = new Function(...Object.keys(env), `${domainSource}${source.slice(start, end)}; return UrlInfo;`)(...Object.values(env));
  const orig = console.log;
  console.log = () => {};
  try {
    return String(UrlInfo("example.com")).replace(/redirect_\d+/g, "R");
  } finally {
    console.log = orig;
  }
}

const page = (body) => `<html><head><title>t</title></head><body>${body}</body></html>`;

test("an unquoted href is rewritten to the redirect and keeps its other attributes", () => {
  const out = run(page("<a href=/x class=big>l</a>"));
  assert.ok(out.includes('<a href="http://localhost:8000?R=ABS/x" class="big">l</a>'), out);
});

test("an unquoted src is rewritten", () => {
  const out = run(page("<img src=a.png>"));
  assert.ok(out.includes('<img src="http://localhost:8000?R=ABSa.png">'), out);
});

test("an unquoted value that contains an equals sign stays in one piece", () => {
  const out = run(page("<a href=/p?a=b>l</a>"));
  assert.ok(out.includes("?R=ABS/p?a=b\">l</a>"), out);
});

test("upper case attribute names are rewritten too", () => {
  const out = run(page('<A HREF="/x">l</A><IMG SRC="a.png">'));
  assert.ok(out.includes('href="http://localhost:8000?R=ABS/x"'), out);
  assert.ok(out.includes('src="http://localhost:8000?R=ABSa.png"'), out);
  assert.ok(!out.includes('HREF="/x"') && !out.includes('SRC="a.png"'), out);
});

test("quoted values with equals signs and spaces are left alone", () => {
  const out = run(page('<p title="a=b c=d" data-x=\'y z\'>t</p>'));
  assert.ok(out.includes('<p title="a=b c=d" data-x=\'y z\'>t</p>'), out);
});

test("an unquoted link in the head is rewritten", () => {
  const out = run("<html><head><link rel=stylesheet href=/a.css></head><body><p>x</p></body></html>");
  assert.ok(out.includes('<link rel="stylesheet" href="http://localhost:8000?R=ABS/a.css">'), out);
});

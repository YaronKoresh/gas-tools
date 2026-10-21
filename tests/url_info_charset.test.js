const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const start = source.indexOf("function UrlInfo");
const end = source.indexOf("function RelativeToAbsoluteUrl");
const domainSource = source.match(/const domain = .*;/)[0];
const relativeSource = source.match(/function RelativeToAbsoluteUrl[\s\S]*\n}\n/)[0];

function run(bytes, headers, address = "http://example.com/dir/page.html") {
  const response = { getContent: () => [...bytes] };
  if (headers) {
    response.getHeaders = () => headers;
  }
  const env = {
    FinalUrl: (u) => u,
    GetSync: () => response,
    Utilities: { newBlob: (b) => ({ getDataAsString: (charset) => new TextDecoder(charset || "utf-8").decode(Uint8Array.from(b)) }) },
    Html: (s) => s,
    Out: (s) => s,
  };
  const UrlInfo = new Function(...Object.keys(env), `${domainSource}${source.slice(start, end)}${relativeSource}; return UrlInfo;`)(...Object.values(env));
  const orig = console.log;
  console.log = () => {};
  try {
    return String(UrlInfo(address));
  } finally {
    console.log = orig;
  }
}

// "shalom" in windows-1255
const hebrew = [0xf9, 0xec, 0xe5, 0xed];
const page = (head) => Buffer.concat([Buffer.from(`<html><head>${head}</head><body><p>`), Buffer.from(hebrew), Buffer.from("</p></body></html>")]);

test("a charset in the content type header is used to decode the page", () => {
  const out = run(page(""), { "Content-Type": "text/html; charset=windows-1255" });
  assert.ok(out.includes("<p>\u05e9\u05dc\u05d5\u05dd</p>"), out);
});

test("a charset in a meta tag is used to decode the page", () => {
  const out = run(page('<meta charset="windows-1255">'), {});
  assert.ok(out.includes("<p>\u05e9\u05dc\u05d5\u05dd</p>"), out);
  const old = run(page('<meta http-equiv="Content-Type" content="text/html; charset=windows-1255">'));
  assert.ok(old.includes("<p>\u05e9\u05dc\u05d5\u05dd</p>"), old);
});

test("a page without a declaration or with utf-8 is still read as utf-8", () => {
  const utf8 = Buffer.from("<html><head></head><body><p>\u05e9\u05dc\u05d5\u05dd</p></body></html>");
  assert.ok(run(utf8, { "content-type": "text/html" }).includes("<p>\u05e9\u05dc\u05d5\u05dd</p>"));
  assert.ok(run(utf8, { "content-type": "text/html; charset=UTF-8" }).includes("<p>\u05e9\u05dc\u05d5\u05dd</p>"));
});

test("an unknown charset name falls back to utf-8 without failing", () => {
  const utf8 = Buffer.from("<html><head></head><body><p>ok</p></body></html>");
  assert.ok(run(utf8, { "Content-Type": "text/html; charset=no-such-charset" }).includes("<p>ok</p>"));
});

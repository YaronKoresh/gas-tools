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

test("a style attribute with a url wrapped in quote entities is rewritten as one url", () => {
  const out = run(page('<div style="background-image: url(&quot;a.png&quot;)">x</div>'));
  assert.ok(out.includes('url(&quot;http://localhost:8000?R=http://example.com/dir/a.png&quot;)'), out);
  assert.ok(!out.includes("%26quot"), out);
});

test("a style attribute with a url wrapped in numeric quote entities is rewritten", () => {
  const out = run(page("<div style=\"background:url(&#39;b.png&#39;)\">y</div>"));
  assert.ok(out.includes("url(&#39;http://localhost:8000?R=http://example.com/dir/b.png&#39;)"), out);
});

test("plain and quoted css urls are still rewritten", () => {
  const out = run(page('<div style="background:url(c.png)">z</div>', '<style>.x{background:url("d.png")} .y{background:url(e.png)}</style>'));
  assert.ok(out.includes("url(http://localhost:8000?R=http://example.com/dir/c.png)"), out);
  assert.ok(out.includes('url("http://localhost:8000?R=http://example.com/dir/d.png")'), out);
  assert.ok(out.includes("url(http://localhost:8000?R=http://example.com/dir/e.png)"), out);
});

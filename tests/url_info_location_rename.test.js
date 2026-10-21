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
    return String(UrlInfo(address)).replace(/redirect_\d+/g, "R").replace(/_\d{6,}/g, "_ID");
  } finally {
    console.log = orig;
  }
}

const script = (code) => {
  const out = run(`<html><head><script>${code}</script></head><body><p>x</p></body></html>`);
  const from = out.lastIndexOf("<script>") + "<script>".length;
  return out.slice(from, out.indexOf("</script></head>", from));
};

test("location, window.location and document.location are replaced", () => {
  const out = script('location.reload(); window.location.href = "/x"; document.location = "/y"; self.location.hash;');
  assert.strictEqual(out, "_ID.reload(); window._ID.href = \"/x\"; document._ID = \"/y\"; self._ID.hash;");
});

test("words that only contain location are not changed", () => {
  const code = "navigator.geolocation.getCurrentPosition(f); var relocation = 1; var locations = []; var $location = 2;";
  assert.strictEqual(script(code), code);
});

test("location inside strings, comments and other objects is not changed", () => {
  const code = 'var msg = "Share your location"; var n = \'location\'; // location\n/* location */ var d = data.location; var e = a . location;';
  assert.strictEqual(script(code), code);
});

test("location inside a template expression is replaced and the template text is kept", () => {
  assert.strictEqual(script("var s = `at ${location.href} in location`;"), "var s = `at ${_ID.href} in location`;");
});

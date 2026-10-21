const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const start = source.indexOf("function UrlInfo");
const end = source.indexOf("function RelativeToAbsoluteUrl");
const domainSource = source.match(/const domain = .*;/)[0];
const relativeSource = source.match(/function RelativeToAbsoluteUrl[\s\S]*\n}\n/)[0];
function load() {
  const fetched = [];
  const env = {
    FinalUrl: (u) => u,
    GetSync: (u) => {
      fetched.push(u);
      return { getContent: () => [...Buffer.from("<html><body><p>x</p></body></html>")] };
    },
    Utilities: { newBlob: (b) => ({ getDataAsString: () => Buffer.from(b).toString() }) },
    Html: (s) => s,
    Out: (s) => s,
  };
  const UrlInfo = new Function(...Object.keys(env), `${domainSource}${source.slice(start, end)}${relativeSource}; return UrlInfo;`)(...Object.values(env));
  return { UrlInfo, fetched };
}

test("UrlInfo throws for a missing or blank address and does not fetch", () => {
  const { UrlInfo, fetched } = load();
  for (const value of [undefined, null, "", "   ", {}, 42]) {
    assert.throws(() => UrlInfo(value), /UrlInfo needs a page address/);
  }
  assert.deepStrictEqual(fetched, []);
});

test("UrlInfo trims spaces around a valid address", () => {
  const { UrlInfo, fetched } = load();
  const orig = console.log;
  console.log = () => {};
  try {
    UrlInfo("  example.com/a  ");
  } finally {
    console.log = orig;
  }
  assert.deepStrictEqual(fetched, ["http://example.com/a"]);
});

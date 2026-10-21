const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const fnSource = source.match(/function Qr[\s\S]*?\n}\n/)[0];

function run(txt, options) {
  const state = { url: null, names: [] };
  const env = {
    UrlFetchApp: {
      fetch: (u) => {
        state.url = u;
        return { getBlob: () => ({ setName: (n) => state.names.push(n) }) };
      },
    },
    TimeNow: () => "10:00:00",
    DateNow: () => "21/10/2026",
    SaveFile: () => "file-id",
  };
  const Qr = new Function(...Object.keys(env), `${fnSource}; return Qr;`)(...Object.values(env));
  const orig = console.log;
  console.log = () => {};
  try {
    state.id = Qr(txt, options);
  } finally {
    console.log = orig;
  }
  return state;
}

test("Qr sends the whole text including ampersand, hash, equals and plus", () => {
  const { url } = run("a&b#c=d+e f");
  assert.strictEqual(new URL(url).searchParams.get("data"), "a&b#c=d+e f");
});

test("Qr keeps non-latin text intact", () => {
  const { url } = run("שלום עולם");
  assert.strictEqual(new URL(url).searchParams.get("data"), "שלום עולם");
});

test("Qr returns the saved file id and names the image", () => {
  const { id, names } = run("x", { name: "My" });
  assert.strictEqual(id, "file-id");
  assert.strictEqual(names[0], "10-00-00 My.png");
});

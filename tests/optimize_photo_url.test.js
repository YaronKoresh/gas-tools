const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const fnSource = source.match(/function OptimizePhotoUrl[\s\S]*?\n}\n/)[0];

function load(size, codes = [200, 200]) {
  const original = { kind: "original-blob" };
  const resized = { kind: "resized-blob" };
  const calls = [];
  const env = {
    FinalUrl: (u) => u,
    UrlFetchApp: { fetch: () => ({ getBlob: () => original, getResponseCode: () => codes[0] }) },
    ImgApp: { getSize: () => size },
    GetSync: (url, params) => {
      calls.push([url, params]);
      return { getBlob: () => resized, getResponseCode: () => codes[1] };
    },
  };
  const fn = new Function(...Object.keys(env), `${fnSource}; return OptimizePhotoUrl;`)(...Object.values(env));
  return { fn, original, resized, calls };
}

test("OptimizePhotoUrl returns the resized blob for a large image", () => {
  const { fn, resized, calls } = load({ width: 1000, height: 500 });
  assert.strictEqual(fn("http://x/y.png", 50, 120), resized);
  assert.deepStrictEqual(calls[0][1], { imageUrl: "http://x/y.png", width: "120", height: "60", quality: 50 });
});

test("OptimizePhotoUrl returns the original blob for a small image", () => {
  const { fn, original, calls } = load({ width: 100, height: 50 });
  assert.strictEqual(fn("http://x/y.png", 50, 120), original);
  assert.strictEqual(calls.length, 0);
});

test("OptimizePhotoUrl throws when the image cannot be downloaded", () => {
  const { fn, calls } = load({ width: 1000, height: 500 }, [404, 200]);
  assert.throws(() => fn("http://x/y.png", 50, 120), /404/);
  assert.strictEqual(calls.length, 0);
});

test("OptimizePhotoUrl throws when the resize service fails instead of returning its error page", () => {
  const { fn } = load({ width: 1000, height: 500 }, [200, 500]);
  assert.throws(() => fn("http://x/y.png", 50, 120), /500/);
});

test("OptimizePhotoUrl never asks the service for a side of zero pixels", () => {
  const { fn, calls } = load({ width: 1000, height: 1 });
  fn("http://x/y.png", 50, 120);
  assert.deepStrictEqual(calls[0][1], { imageUrl: "http://x/y.png", width: "120", height: "1", quality: 50 });
});

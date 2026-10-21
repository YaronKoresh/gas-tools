const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const fnSource = source.match(/function OptimizePhotoId[\s\S]*?\n}\n/)[0];

function load(size) {
  const original = { kind: "original-blob" };
  const resized = { kind: "resized-blob" };
  const calls = [];
  const env = {
    DriveApp: { getFileById: () => ({ getBlob: () => original }) },
    ImgApp: {
      getSize: () => size,
      doResize: (id, width) => {
        calls.push([id, width]);
        return { blob: resized };
      },
    },
  };
  const fn = new Function(...Object.keys(env), `${fnSource}; return OptimizePhotoId;`)(...Object.values(env));
  return { fn, original, resized, calls };
}

test("OptimizePhotoId resizes a large image to the requested size", () => {
  const { fn, resized, calls } = load({ width: 1000, height: 500 });
  assert.strictEqual(fn("id1", 120), resized);
  assert.deepStrictEqual(calls, [["id1", "120"]]);
});

test("OptimizePhotoId returns the original blob for a small image", () => {
  const { fn, original, calls } = load({ width: 100, height: 50 });
  assert.strictEqual(fn("id1", 120), original);
  assert.strictEqual(calls.length, 0);
});

test("OptimizePhotoId never asks for a width of zero pixels", () => {
  const { fn, calls } = load({ width: 1, height: 1000 });
  fn("id1", 120);
  assert.deepStrictEqual(calls, [["id1", "1"]]);
});

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const fnSource = source.match(/function OptimizePhotoId[\s\S]*?\n}\n/)[0];

function load(size) {
  const original = { kind: "original" };
  const resized = { kind: "resized" };
  const calls = [];
  const env = {
    DriveApp: { getFileById: () => ({ getBlob: () => original }) },
    ImgApp: { getSize: () => size, doResize: (id, width) => (calls.push([id, width]), { blob: resized }) },
  };
  const fn = new Function(...Object.keys(env), `${fnSource}; return OptimizePhotoId;`)(...Object.values(env));
  return { fn, original, resized, calls };
}

test("OptimizePhotoId returns the original blob when the image is not larger than the target", () => {
  const { fn, original, calls } = load({ width: 100, height: 60 });
  assert.strictEqual(fn("id1", 120), original);
  assert.strictEqual(calls.length, 0);
});

test("OptimizePhotoId resizes a large image so that its longest side matches the target", () => {
  const { fn, resized, calls } = load({ width: 1200, height: 600 });
  assert.strictEqual(fn("id1", 120), resized);
  assert.deepStrictEqual(calls, [["id1", "120"]]);
});

test("OptimizePhotoId uses 120 pixels when no size is given", () => {
  const { fn, calls } = load({ width: 240, height: 100 });
  fn("id2");
  assert.deepStrictEqual(calls, [["id2", "120"]]);
});

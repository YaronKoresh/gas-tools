const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const fnSource = source.match(/function BlobToDataUrl[\s\S]*?\n}\n/)[0];
const BlobToDataUrl = new Function("Utilities", `${fnSource}; return BlobToDataUrl;`)({
  base64Encode: (bytes) => Buffer.from(bytes).toString("base64"),
});
const blobOf = (type) => ({ getContentType: () => type, getBytes: () => [104, 105] });

test("BlobToDataUrl keeps a normal media type", () => {
  assert.strictEqual(BlobToDataUrl(blobOf("image/png")), "data:image/png;base64,aGk=");
});

test("BlobToDataUrl falls back to a generic type when the blob has none", () => {
  for (const type of [null, undefined, "", "  "]) {
    assert.strictEqual(BlobToDataUrl(blobOf(type)), "data:application/octet-stream;base64,aGk=");
  }
});

test("BlobToDataUrl removes the spaces of a type that has parameters", () => {
  assert.strictEqual(BlobToDataUrl(blobOf("text/plain; charset=utf-8")), "data:text/plain;charset=utf-8;base64,aGk=");
});

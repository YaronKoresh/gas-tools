const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (re) => source.match(re)[0];
const code = [
  grab(/function Range[\s\S]*?\n}\n/),
  grab(/function Random[\s\S]*?\n}\n/),
  grab(/function Uuid[\s\S]*?\n}\n/),
  grab(/const uuid_charset = .*;/),
  "return { Uuid, uuid_charset };",
].join("\n");
const { Uuid, uuid_charset } = new Function(code)();

test("uuid charset holds only letters, numbers, punctuation and symbols", () => {
  assert.ok(uuid_charset.length > 40000);
  for (const ch of uuid_charset) {
    assert.match(ch, /^[\p{L}\p{N}\p{P}\p{S}]$/u);
  }
});

test("uuid charset has no whitespace, line separators or format characters", () => {
  const bad = new RegExp("[\\s\\u200b-\\u200f\\u2028\\u2029\\u202a-\\u202e\\u2060-\\u2064\\ufeff]");
  assert.doesNotMatch(uuid_charset, bad);
});

test("Uuid returns the requested number of characters without whitespace", () => {
  for (let i = 0; i < 300; i++) {
    const id = Uuid(10);
    assert.strictEqual([...id].length, 10);
    assert.doesNotMatch(id, /\s/);
  }
});

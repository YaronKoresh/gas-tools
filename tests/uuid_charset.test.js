const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (re) => source.match(re)[0];
const code = [
  grab(/function Range[\s\S]*?\n}\n/),
  grab(/function Random[\s\S]*?\n}\n/),
  grab(/function Uuid\([\s\S]*?\n}\n/),
  grab(/let uuid_charset_cache = null;/),
  grab(/function UuidCharset[\s\S]*?\n}\n/),
  "return { Uuid, UuidCharset };",
].join("\n");
const { Uuid, UuidCharset } = new Function(code)();
const uuid_charset = UuidCharset().join("");

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

test("the charset is built on first use only and then reused", () => {
  const vm = require("node:vm");
  const ctx = vm.createContext({ CacheService: { getScriptCache: () => ({}) }, UrlFetchApp: { fetch: () => ({ getContentText: () => "" }) }, console });
  vm.runInContext(source, ctx);
  assert.strictEqual(vm.runInContext("uuid_charset_cache", ctx), null);
  const first = vm.runInContext("UuidCharset()", ctx);
  assert.ok(first.length > 40000);
  assert.strictEqual(vm.runInContext("UuidCharset()", ctx), first);
});

test("Uuid calls after the first are fast", () => {
  Uuid(1);
  const start = process.hrtime.bigint();
  for (let i = 0; i < 100; i++) Uuid(10);
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  assert.ok(ms < 100, `${ms} ms for 100 calls`);
});

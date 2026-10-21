const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");

function context(fetch) {
  return vm.createContext({
    CacheService: { getScriptCache: () => ({}) },
    UrlFetchApp: { fetch },
    console,
  });
}

test("Code.gs loads without fetching pdf-lib", () => {
  let fetched = 0;
  const ctx = context(() => {
    fetched++;
    throw new Error("network down");
  });
  vm.runInContext(source, ctx);
  assert.strictEqual(fetched, 0);
  assert.strictEqual(vm.runInContext("typeof Uuid", ctx), "function");
});

test("LoadPdfLib fetches the library once and keeps it global", () => {
  let fetched = 0;
  const ctx = context(() => {
    fetched++;
    return { getContentText: () => "var PDFLib = { marker: 42 };" };
  });
  vm.runInContext(source, ctx);
  assert.strictEqual(vm.runInContext("LoadPdfLib().marker", ctx), 42);
  assert.strictEqual(vm.runInContext("LoadPdfLib().marker", ctx), 42);
  assert.strictEqual(fetched, 1);
});

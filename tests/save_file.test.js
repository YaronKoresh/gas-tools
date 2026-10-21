const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const fnSource = source.match(/function SaveFile[\s\S]*?\n}\n/)[0];

function load(existing = []) {
  const created = [];
  const mkFolder = (p) => ({
    getFoldersByName: (n) => {
      const full = `${p}/${n}`;
      const has = existing.includes(full) || created.includes(full);
      return {
        next: () => {
          if (!has) throw new Error("no folder");
          return mkFolder(full);
        },
      };
    },
    createFolder: (n) => created.push(`${p}/${n}`),
    createFile: (blob) => ({ getId: () => `in:${p || "/"} name:${blob.name}` }),
  });
  const SaveFile = new Function("DriveApp", `${fnSource}; return SaveFile;`)({ getRootFolder: () => mkFolder("") });
  return { SaveFile, created };
}

test("SaveFile saves into the root for the default path", () => {
  const { SaveFile } = load();
  assert.strictEqual(SaveFile({ name: "a.png" }), "in:/ name:a.png");
});

test("SaveFile uses existing folders and creates the missing ones", () => {
  const { SaveFile, created } = load(["/a"]);
  assert.strictEqual(SaveFile({ name: "b.png" }, "/a/b/c"), "in:/a/b/c name:b.png");
  assert.deepStrictEqual(created, ["/a/b", "/a/b/c"]);
});

test("SaveFile ignores empty path parts", () => {
  const { SaveFile, created } = load(["/a"]);
  assert.strictEqual(SaveFile({ name: "x" }, "//a//"), "in:/a name:x");
  assert.deepStrictEqual(created, []);
});

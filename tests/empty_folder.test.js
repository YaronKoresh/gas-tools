const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const fnSource = source.match(/function EmptyFolder[\s\S]*?\n}\n/)[0];

function run(names) {
  const trashed = [];
  const list = names.map((n) => ({ setTrashed: () => trashed.push(n) }));
  let i = 0;
  const leaf = { getFiles: () => ({ hasNext: () => i < list.length, next: () => list[i++] }) };
  const root = { getFoldersByName: () => ({ next: () => leaf }) };
  new Function("DriveApp", `${fnSource}; EmptyFolder("a/b");`)({ getRootFolder: () => root });
  return trashed;
}

test("EmptyFolder trashes every file of the folder", () => {
  assert.deepStrictEqual(run(["a", "b", "c"]), ["a", "b", "c"]);
});

test("EmptyFolder does nothing for an empty folder", () => {
  assert.deepStrictEqual(run([]), []);
});

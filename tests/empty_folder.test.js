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
  leaf.getFoldersByName = () => ({ hasNext: () => true, next: () => leaf });
  const root = { getFoldersByName: () => ({ hasNext: () => true, next: () => leaf }) };
  new Function("DriveApp", `${fnSource}; EmptyFolder("a/b");`)({ getRootFolder: () => root });
  return trashed;
}

test("EmptyFolder trashes every file of the folder", () => {
  assert.deepStrictEqual(run(["a", "b", "c"]), ["a", "b", "c"]);
});

test("EmptyFolder does nothing for an empty folder", () => {
  assert.deepStrictEqual(run([]), []);
});

function runPath(p, existing) {
  const asked = [];
  const trashed = [];
  let done = false;
  const leaf = {
    getFiles: () => ({ hasNext: () => !done, next: () => ({ setTrashed: () => { done = true; trashed.push("f"); } }) }),
  };
  const folderFor = (name) => ({
    hasNext: () => existing.includes(name),
    next: () => {
      if (!existing.includes(name)) throw new Error("Exception: no folder");
      return leaf;
    },
  });
  leaf.getFoldersByName = (n) => { asked.push(n); return folderFor(n); };
  const root = { getFoldersByName: (n) => { asked.push(n); return folderFor(n); } };
  new Function("DriveApp", `${fnSource}; EmptyFolder(${JSON.stringify(p)});`)({ getRootFolder: () => root });
  return { asked, trashed };
}

test("EmptyFolder ignores a leading or doubled slash", () => {
  const r = runPath("/a//b/", ["a", "b"]);
  assert.deepStrictEqual(r.asked, ["a", "b"]);
  assert.deepStrictEqual(r.trashed, ["f"]);
});

test("EmptyFolder names the missing folder in its error", () => {
  assert.throws(() => runPath("a/zzz", ["a"]), /zzz/);
});

test("EmptyFolder refuses an empty path instead of trashing the files of the Drive root", () => {
  for (const p of ["", "/", "//", undefined, null]) {
    let trashed = 0;
    const rootFile = { setTrashed: () => trashed++ };
    const root = {
      getFoldersByName: () => ({ hasNext: () => false }),
      getFiles: () => {
        let done = false;
        return { hasNext: () => !done, next: () => ((done = true), rootFile) };
      },
    };
    assert.throws(
      () => new Function("DriveApp", "p", `${fnSource}; EmptyFolder(p);`)({ getRootFolder: () => root }, p),
      /needs a folder path/,
    );
    assert.strictEqual(trashed, 0);
  }
});

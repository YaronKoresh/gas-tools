const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const fnSource = source.match(/function SaveUrl[\s\S]*?\n}\n/)[0];

function load(existing = [], type = "image/png") {
  const created = [];
  const mkFolder = (p) => ({
    getFoldersByName: (n) => {
      const full = `${p}/${n}`;
      const has = existing.includes(full) || created.includes(full);
      return { hasNext: () => has, next: () => mkFolder(full) };
    },
    createFolder: (n) => {
      const full = `${p}/${n}`;
      created.push(full);
      return mkFolder(full);
    },
    createFile: (b) => ({ getId: () => `in:${p || "/"} name:${b.name}` }),
  });
  const env = {
    GetType: () => type,
    ParseUrlContent: () => [1],
    PackContent: (name) => ({ name }),
    DriveApp: { getRootFolder: () => mkFolder("") },
  };
  const SaveUrl = new Function(...Object.keys(env), `${fnSource}; return SaveUrl;`)(...Object.values(env));
  return { SaveUrl, created };
}

test("SaveUrl saves into the folders of a path with a leading slash", () => {
  const { SaveUrl } = load(["/a", "/a/b"]);
  assert.strictEqual(SaveUrl("http://x/y.png", "/a/b/c.png"), "in:/a/b name:c.png");
});

test("SaveUrl saves into the folders of a relative path", () => {
  const { SaveUrl } = load(["/a"]);
  assert.strictEqual(SaveUrl("http://x/y.png", "a/c.png"), "in:/a name:c.png");
});

test("SaveUrl keeps a bare file name in the root", () => {
  const { SaveUrl } = load();
  assert.strictEqual(SaveUrl("http://x/y.png", "c.png"), "in:/ name:c.png");
});

test("SaveUrl creates missing folders", () => {
  const { SaveUrl, created } = load();
  assert.strictEqual(SaveUrl("http://x/y.png", "/n/m/c.png"), "in:/n/m name:c.png");
  assert.deepStrictEqual(created, ["/n", "/n/m"]);
});

test("SaveUrl names the file after the url when the path has no name", () => {
  const { SaveUrl } = load();
  assert.strictEqual(SaveUrl("http://x/dir/y.png?v=1#t"), "in:/ name:y.png");
});

test("SaveUrl throws and creates nothing when the url cannot be read", () => {
  const { SaveUrl, created } = load([], null);
  assert.throws(() => SaveUrl("http://x/missing.png", "/new/c.png"), /http:\/\/x\/missing\.png/);
  assert.deepStrictEqual(created, []);
});

test("SaveUrl decodes percent codes in the name taken from the url", () => {
  const { SaveUrl } = load();
  assert.strictEqual(SaveUrl("http://x/my%20photo%20%D7%90.png"), "in:/ name:my photo א.png");
});

test("SaveUrl keeps an invalid percent code and never turns a name into a path", () => {
  const { SaveUrl } = load();
  assert.strictEqual(SaveUrl("http://x/a%.png"), "in:/ name:a%.png");
  assert.strictEqual(SaveUrl("http://x/a%2Fb.png"), "in:/ name:a-b.png");
});

test("SaveUrl does not use the host as a file name", () => {
  const { SaveUrl } = load();
  assert.strictEqual(SaveUrl("http://example.com"), "in:/ name:file");
  assert.strictEqual(SaveUrl("http://example.com/?q=1"), "in:/ name:file");
  assert.strictEqual(SaveUrl("http://x/dir/"), "in:/ name:file");
});

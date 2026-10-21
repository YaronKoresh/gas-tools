const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function load(env) {
  const names = ["ParseIdContent", "DriveIdToFinalUrl", "PackContent"];
  return new Function(...Object.keys(env), `${names.map(grab).join("")}; return { ${names.join(", ")} };`)(...Object.values(env));
}

test("ParseIdContent reads the content of the uc link of the id", () => {
  const seen = [];
  const { ParseIdContent } = load({ ParseUrlContent: (u) => (seen.push(u), [1, 2]) });
  assert.deepStrictEqual(ParseIdContent("abc"), [1, 2]);
  assert.deepStrictEqual(seen, ["https://drive.google.com/uc?id=abc"]);
});

test("DriveIdToFinalUrl follows the redirects of the uc link", () => {
  const { DriveIdToFinalUrl } = load({ FinalUrl: (u) => "final:" + u });
  assert.strictEqual(DriveIdToFinalUrl("abc"), "final:https://drive.google.com/uc?id=abc");
});

test("PackContent builds a blob with the bytes, name and type", () => {
  const blob = {
    setBytes(b) {
      this.bytes = b;
    },
    setName(n) {
      this.name = n;
    },
    setContentType(t) {
      this.type = t;
    },
  };
  const { PackContent } = load({ Utilities: { newBlob: () => blob } });
  const result = PackContent("a.png", "image/png", [1, 2, 3]);
  assert.strictEqual(result, blob);
  assert.deepStrictEqual([blob.bytes, blob.name, blob.type], [[1, 2, 3], "a.png", "image/png"]);
});

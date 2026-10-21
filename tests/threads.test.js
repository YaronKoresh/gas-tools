const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function load() {
  const posted = [];
  class FakeWorker {
    postMessage(message) {
      posted.push(message);
      setTimeout(() => this.onmessage({ data: { result: "r" } }), 0);
    }
    terminate() {}
  }
  const env = {
    Worker: FakeWorker,
    Blob: class {},
    URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} },
  };
  const code = `${grab("Stringify")}${grab("Parse")}${grab("createWorker")}${grab("Threads")}; return Threads;`;
  const Threads = new Function(...Object.keys(env), code)(...Object.values(env));
  return { Threads, posted };
}

test("Threads does not change the deps array it receives", async () => {
  const { Threads } = load();
  const deps = [function helper() {}];
  await Threads(async (x) => x, [[1]], deps);
  await Threads(async (x) => x, [[2]], deps);
  assert.strictEqual(deps.length, 1);
});

test("Threads does not create a global deps_txt", async () => {
  const { Threads } = load();
  await Threads(async (x) => x, [[1]]);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(globalThis, "deps_txt"), false);
});

test("Threads sends the dependencies and Parse once to each worker", async () => {
  const { Threads, posted } = load();
  const deps = [function helper() {}];
  const results = await Threads(async (x) => x, [[1], [2]], deps);
  assert.deepStrictEqual(results, ["r", "r"]);
  assert.strictEqual(posted.length, 2);
  for (const message of posted) {
    assert.strictEqual(message.deps.split("function helper").length - 1, 1);
    assert.strictEqual(message.deps.split("function Parse").length - 1, 1);
  }
});

test("Threads resolves an empty list without starting workers", async () => {
  const { Threads, posted } = load();
  assert.deepStrictEqual(await Threads(async (x) => x, []), []);
  assert.strictEqual(posted.length, 0);
});

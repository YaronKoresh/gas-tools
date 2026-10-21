const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function load() {
  let workerCode = "";
  class FakeWorker {
    postMessage(message) {
      const self = { postMessage: (data) => setTimeout(() => this.onmessage({ data }), 0) };
      try {
        new Function("self", `with (self) {${workerCode}}`)(self);
        Promise.resolve(self.onmessage({ data: message })).catch((error) => this.onerror({ message: error.message }));
      } catch (error) {
        setTimeout(() => this.onerror({ message: error.message }), 0);
      }
    }
    terminate() {}
  }
  const env = {
    Worker: FakeWorker,
    Blob: class {
      constructor(parts) {
        workerCode = parts.join("");
      }
    },
    URL: { createObjectURL: () => "blob:x", revokeObjectURL() {} },
  };
  const code = `${grab("Stringify")}${grab("Parse")}${grab("createWorker")}${grab("Threads")}; return Threads;`;
  return new Function(...Object.keys(env), code)(...Object.values(env));
}

test("Threads runs a function dependency inside the worker", async () => {
  const Threads = load();
  const results = await Threads(async (x) => helper(x) + 1, [5], [function helper(v) { return v * 2; }]);
  assert.deepStrictEqual(results, [11]);
});

test("Threads accepts an object dependency and exposes its keys to the worker", async () => {
  const Threads = load();
  const results = await Threads(async (x) => CONFIG + x, [5], [{ CONFIG: 10 }]);
  assert.deepStrictEqual(results, [15]);
});

test("Threads ignores dependencies that are not functions or plain objects", async () => {
  const Threads = load();
  const results = await Threads(async (x) => x + 1, [5], ["text", 7, null, [1, 2], true]);
  assert.deepStrictEqual(results, [6]);
});

test("Threads runs a method given as a dependency", async () => {
  const Threads = load();
  const holder = { twice(v) { return v * 2; } };
  const results = await Threads(async (x) => twice(x), [4], [holder.twice]);
  assert.deepStrictEqual(results, [8]);
});

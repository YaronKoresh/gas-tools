const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function load(answer) {
  const state = { created: 0, terminated: 0, revoked: 0 };
  class FakeWorker {
    constructor() {
      state.created++;
    }
    postMessage() {
      if (answer) {
        setTimeout(() => this.onmessage({ data: { result: "r" } }), 0);
      }
    }
    terminate() {
      state.terminated++;
    }
  }
  const env = {
    Worker: FakeWorker,
    Blob: class {},
    URL: { createObjectURL: () => "blob:x", revokeObjectURL: () => state.revoked++ },
  };
  const code = `${grab("Stringify")}${grab("Parse")}${grab("createWorker")}${grab("Threads")}; return Threads;`;
  const Threads = new Function(...Object.keys(env), code)(...Object.values(env));
  return { Threads, state };
}

test("Threads revokes the worker url for an empty list", async () => {
  const { Threads, state } = load(true);
  await Threads(async (x) => x, []);
  assert.strictEqual(state.revoked, 1);
});

test("Threads stops the running workers and revokes the url on timeout", async () => {
  const { Threads, state } = load(false);
  await assert.rejects(() => Threads(async (x) => x, [[1], [2]], [], 0, 0.3), /timed out/);
  assert.strictEqual(state.terminated, 2);
  assert.strictEqual(state.revoked, 1);
});

test("Threads does not start delayed workers after the timeout", async () => {
  const { Threads, state } = load(false);
  await assert.rejects(() => Threads(async (x) => x, [[1], [2]], [], 0.2, 0.05), /timed out/);
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.strictEqual(state.created, 1);
  assert.strictEqual(state.terminated, 1);
});

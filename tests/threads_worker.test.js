const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const createWorkerSource = source.match(/function createWorker\(\) \{[\s\S]*?\n}\n/)[0];

function startWorker() {
  let code = null;
  new Function("Blob", "URL", `${createWorkerSource}; createWorker();`)(
    class {
      constructor(parts) {
        code = parts[0];
      }
    },
    { createObjectURL: () => "blob:x" },
  );
  const self = { posted: [] };
  self.postMessage = (message) => self.posted.push(message);
  new Function("self", code)(self);
  return self;
}

test("the worker runs the function with its data", async () => {
  const self = startWorker();
  await self.onmessage({ data: { asyncFnString: "async (a, b) => a + b", deps: "", data: [2, 3] } });
  assert.deepStrictEqual(self.posted, [{ result: 5 }]);
});

test("the worker lets the function use the functions passed as dependencies", async () => {
  const self = startWorker();
  await self.onmessage({
    data: { asyncFnString: "async (x) => helper(x)", deps: "function helper(v) { return v * 2; }", data: [4] },
  });
  assert.deepStrictEqual(self.posted, [{ result: 8 }]);
});

test("the worker reports a function that cannot be parsed", async () => {
  const self = startWorker();
  await self.onmessage({ data: { asyncFnString: "async (x => ", deps: "", data: [1] } });
  assert.match(self.posted[0].error, /Function parsing failed/);
});

test("the worker reports an error thrown by the function", async () => {
  const self = startWorker();
  await self.onmessage({ data: { asyncFnString: "async () => { throw new Error('bad'); }", deps: "", data: [] } });
  assert.match(self.posted[0].error, /Function execution failed: bad/);
});

test("the worker passes a single non-array item as the only argument", async () => {
  const self = startWorker();
  await self.onmessage({ data: { asyncFnString: "async (x) => x * 10", deps: "", data: 4 } });
  assert.deepStrictEqual(self.posted, [{ result: 40 }]);
});

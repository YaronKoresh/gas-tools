const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function load() {
  const calls = [];
  const UrlFetchApp = { fetch: (url, options) => (calls.push([url, options]), { ok: true }) };
  const names = ["ObjectToQueryString", "GetSync", "PostSync", "GetAsync", "PostAsync"];
  const fns = new Function("UrlFetchApp", `${names.map(grab).join("")}; return { ${names.join(", ")} };`)(UrlFetchApp);
  return { ...fns, calls };
}

test("PostSync posts the parameters as payload with the headers and does not throw on http errors", () => {
  const { PostSync, calls } = load();
  PostSync("https://a.example.com/p", { a: 1 }, { Authorization: "t" });
  assert.deepStrictEqual(calls[0], [
    "https://a.example.com/p",
    { method: "POST", muteHttpExceptions: true, headers: { Authorization: "t" }, payload: { a: 1 } },
  ]);
});

test("GetSync sends the headers and does not throw on http errors", () => {
  const { GetSync, calls } = load();
  GetSync("https://a.example.com/g", { q: "x y" }, { H: "1" });
  assert.deepStrictEqual(calls[0], ["https://a.example.com/g?q=x%20y", { muteHttpExceptions: true, headers: { H: "1" } }]);
});

test("GetAsync and PostAsync resolve with the response", async () => {
  const { GetAsync, PostAsync, calls } = load();
  assert.deepStrictEqual(await GetAsync("https://a.example.com/g"), { ok: true });
  assert.deepStrictEqual(await PostAsync("https://a.example.com/p", { a: 1 }), { ok: true });
  assert.strictEqual(calls.length, 2);
});

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function ticking(isos) {
  const RealDate = Date;
  let calls = 0;
  const FakeDate = class extends RealDate {
    constructor(...args) {
      if (args.length) super(...args);
      else super(isos[Math.min(calls++, isos.length - 1)]);
    }
  };
  const env = new Function("Date", `${grab("TimeNow")}${grab("DateNow")}${grab("Now")}; return { TimeNow, DateNow, Now };`)(FakeDate);
  return { ...env, calls: () => calls };
}

test("Now reads the clock once so the date and the time come from the same moment", () => {
  const clock = ticking(["2026-06-01T20:59:59.999Z", "2026-06-01T21:00:00.001Z"]);
  assert.strictEqual(clock.Now(), "01/06/2026 23:59:59");
  assert.strictEqual(clock.calls(), 1);
});

test("Now, DateNow and TimeNow format the date they are given", () => {
  const { Now, DateNow, TimeNow } = ticking(["2030-01-01T00:00:00Z"]);
  const given = new Date("2026-06-01T06:07:08Z");
  assert.strictEqual(Now(given), "01/06/2026 09:07:08");
  assert.strictEqual(DateNow("en", "IL", "Asia/Jerusalem", given), "01/06/2026");
  assert.strictEqual(TimeNow("en", "IL", "Asia/Jerusalem", given), "09:07:08");
});

test("AddToDatabase takes the stamp and the millisecond offset from one clock reading", () => {
  const body = grab("AddToDatabase");
  assert.ok(/const clock = new Date\(\);/.test(body));
  assert.ok(/Now\(clock\)/.test(body));
  assert.ok(/clock\.getTime\(\)/.test(body));
  assert.ok(!/\(new Date\(\)\)\.getTime\(\)/.test(body));
});

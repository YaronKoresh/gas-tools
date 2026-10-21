const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];

function at(iso) {
  const RealDate = Date;
  const FakeDate = class extends RealDate {
    constructor(...args) {
      if (args.length) super(...args);
      else super(iso);
    }
  };
  return new Function("Date", `${grab("TimeNow")}${grab("DateNow")}${grab("Now")}; return { TimeNow, DateNow, Now };`)(FakeDate);
}

test("TimeNow pads the hour to two digits", () => {
  assert.strictEqual(at("2026-06-01T06:07:08Z").TimeNow(), "09:07:08");
});

test("TimeNow shows midnight as 00 and not 24", () => {
  assert.strictEqual(at("2026-06-01T21:00:05Z").TimeNow(), "00:00:05");
  assert.strictEqual(at("2026-06-01T21:05:09Z").TimeNow(), "00:05:09");
});

test("TimeNow keeps late hours", () => {
  assert.strictEqual(at("2026-06-01T20:59:59Z").TimeNow(), "23:59:59");
});

test("Now joins date and time", () => {
  assert.strictEqual(at("2026-06-01T06:07:08Z").Now(), "01/06/2026 09:07:08");
});

test("file names built from TimeNow sort by time", () => {
  const names = ["2026-06-01T06:07:08Z", "2026-06-01T07:00:00Z", "2026-06-01T20:59:59Z"].map(
    (iso) => at(iso).TimeNow().replaceAll(":", "-") + " export.pdf",
  );
  assert.deepStrictEqual([...names].sort(), names);
});

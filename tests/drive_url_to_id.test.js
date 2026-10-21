const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const grab = (name) => source.match(new RegExp(`function ${name}\\b[\\s\\S]*?\\n}\\n`))[0];
const { DriveUrlToId, DriveIdToUrl } = new Function(`${grab("DriveUrlToId")}${grab("DriveIdToUrl")}; return { DriveUrlToId, DriveIdToUrl };`)();

const id = "ABC_def-1";
const urls = [
  `https://drive.google.com/file/d/${id}/view?usp=drivesdk`,
  `https://drive.google.com/file/d/${id}/view?usp=drive_link`,
  `https://drive.google.com/file/d/${id}/view?usp=sharing`,
  `https://drive.google.com/file/d/${id}/view`,
  `https://drive.google.com/file/d/${id}/edit`,
  `https://drive.google.com/file/u/0/d/${id}/view`,
  `https://drive.google.com/open?id=${id}`,
  `https://drive.google.com/uc?id=${id}&export=download`,
  `https://drive.google.com/uc?export=download&id=${id}`,
];

for (const url of urls) {
  test(`DriveUrlToId reads ${url}`, () => {
    assert.strictEqual(DriveUrlToId(url), id);
  });
}

test("DriveUrlToId round-trips DriveIdToUrl", () => {
  assert.strictEqual(DriveUrlToId(DriveIdToUrl(id)), id);
});

test("DriveUrlToId returns a plain id unchanged", () => {
  assert.strictEqual(DriveUrlToId(id), id);
});

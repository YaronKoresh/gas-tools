const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const fnSource = source.match(/function CreateDatabase[\s\S]*?\n}\n/)[0];

function run({ dbFolders = 1, fileExists = false } = {}) {
  const state = { activated: 0, created: [], deletedColumns: [], moved: 0, movedByName: 0, movedIds: [], folders: 0 };
  const sheet = { deleteColumns: (...a) => state.deletedColumns.push(a) };
  const ss = {
    getId: () => "new-id",
    getSheetByName: () => null,
    getSheets: () => [sheet],
  };
  const folder = {
    getFilesByName: () => ({ hasNext: () => fileExists }),
  };
  const iterator = (count) => {
    let left = count;
    return { hasNext: () => left > 0, next: () => (left--, folder) };
  };
  const env = {
    DriveApp: {
      getRootFolder: () => ({
        getFoldersByName: () => iterator(dbFolders),
        createFolder: () => state.folders++,
        getFilesByName: () => ({ next: () => ({ moveTo: () => state.movedByName++ }) }),
      }),
      getFileById: (id) => ({ moveTo: () => (state.moved++, state.movedIds.push(id)) }),
    },
    SpreadsheetApp: {
      create: (name) => {
        state.created.push(name);
        return ss;
      },
      setActiveSpreadsheet: () => state.activated++,
    },
  };
  const CreateDatabase = new Function(...Object.keys(env), `${fnSource}; return CreateDatabase;`)(...Object.values(env));
  CreateDatabase("MyProject");
  return state;
}

test("CreateDatabase works when the first sheet is not called Sheet1", () => {
  const state = run();
  assert.deepStrictEqual(state.created, ["Database MyProject"]);
  assert.deepStrictEqual(state.deletedColumns, [[3, 24]]);
  assert.strictEqual(state.moved, 1);
});

test("CreateDatabase does nothing when the database exists", () => {
  const state = run({ fileExists: true });
  assert.deepStrictEqual(state.created, []);
});

test("CreateDatabase refuses several [DB] folders", () => {
  assert.throws(() => run({ dbFolders: 2 }), /Multiple \[DB\] folders/);
});

test("CreateDatabase moves the file it created, not a file of the same name in the root", () => {
  const state = run();
  assert.deepStrictEqual(state.movedIds, ["new-id"]);
  assert.strictEqual(state.movedByName, 0);
});

test("CreateDatabase leaves the active spreadsheet alone", () => {
  const state = run();
  assert.strictEqual(state.activated, 0);
});

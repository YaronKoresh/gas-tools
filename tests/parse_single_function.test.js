const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8");
const Parse = new Function(`${source.match(/function Parse\b[\s\S]*?\n}\n/)[0]}; return Parse;`)();

const read = (text) => Parse(JSON.stringify({ f: text })).f;

test("Parse keeps text that holds more than one expression as text", () => {
  globalThis.__ran = 0;
  const texts = [
    "x=>1,globalThis.__ran++",
    "function(){}, globalThis.__ran++, function(){}",
    "function(){} + globalThis.__ran++",
    "(a)=>{}, globalThis.__ran++",
    "x=>1;globalThis.__ran++",
    "function(){}); globalThis.__ran++; (function(){}",
  ];
  for (const text of texts) {
    assert.strictEqual(read(text), text);
  }
  assert.strictEqual(globalThis.__ran, 0);
  delete globalThis.__ran;
});

test("Parse still revives functions with strings, templates, regexes and nesting", () => {
  const texts = [
    "function named(a,b){ return `${a}}${b}` + \"}\" + /[}]/.source }",
    "x=>({a:1,b:[1,2]})",
    "async function f(){ await 1; }",
    "(a,b)=>a+b",
    "x=>x.map(y=>y*2)",
    "()=>{}",
    "a=>\"x,y\"",
    "a=>`a,${a},b`",
    "x => x / 2 / 3",
  ];
  for (const text of texts) {
    assert.strictEqual(typeof read(text), "function", text);
  }
  assert.strictEqual(read("a=>`a,${a},b`")(1), "a,1,b");
  assert.strictEqual(read("x => x / 2 / 3")(12), 2);
});

test("Parse keeps text with unbalanced brackets as text", () => {
  assert.strictEqual(read("function(){"), "function(){");
  assert.strictEqual(read("x=>(1"), "x=>(1");
});

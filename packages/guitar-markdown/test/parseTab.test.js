import test from "node:test";
import assert from "node:assert/strict";
import { parseAsciiTab } from "../src/index.js";

test("parse une tablature ASCII en mesures et événements", () => {
  const ast = parseAsciiTab(`   Em        D
e|--0--2--|--2-----|
B|--0-----|--3-----|
G|--0-----|--2-----|
D|--2-----|--0-----|
A|--2-----|--------|
E|--0-----|--------|`);
  assert.equal(ast.measures.length, 2);
  assert.equal(ast.measures[0].events[0].positions.length, 6);
  assert.equal(ast.measures[1].events[0].positions.length, 4);
});

test("détecte hammer-on et pull-off", () => {
  const ast = parseAsciiTab(`e|--5h7p5--|
B|----------|
G|----------|
D|----------|
A|----------|
E|----------|`);
  assert.deepEqual(ast.measures[0].techniques.map(t => t.type), ["hammer", "pull"]);
});

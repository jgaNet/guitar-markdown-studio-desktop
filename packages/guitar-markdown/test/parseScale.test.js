import test from "node:test";
import assert from "node:assert/strict";
import { parseScale } from "../src/index.js";

test("parse un diagramme de gamme avec notes grises et surlignées", () => {
  const ast = parseScale(`frets: 0-8
e: 0|2|3|[5]|[7]|8
E: 0|2|3|[5]|[7]|8`);
  assert.deepEqual(ast.fretRange, [0, 8]);
  assert.deepEqual(ast.dim[1], [
    { fret: 0, label: null },
    { fret: 2, label: null },
    { fret: 3, label: null },
    { fret: 8, label: null },
  ]);
  assert.deepEqual(ast.highlight[1], [
    { fret: 5, label: null },
    { fret: 7, label: null },
  ]);
});

test("parse une étiquette de note (grise et surlignée)", () => {
  const ast = parseScale("e: 5,A|[7,Am]|[3,A#]|2,Ab");
  assert.deepEqual(ast.dim[1], [
    { fret: 5, label: "A" },
    { fret: 2, label: "Ab" },
  ]);
  assert.deepEqual(ast.highlight[1], [
    { fret: 7, label: "Am" },
    { fret: 3, label: "A#" },
  ]);
});

test("déduit la plage de frettes si absente", () => {
  const ast = parseScale("e: 0|[2]|5");
  assert.deepEqual(ast.fretRange, [0, 5]);
});

test("rejette une frette invalide", () => {
  assert.throws(() => parseScale("e: 0|x|5"), /Frette invalide/);
});

test("rejette une ligne de corde inconnue", () => {
  assert.throws(() => parseScale("Z: 0|2|5"), /Ligne de diagramme invalide/);
});

test("rejette un diagramme vide", () => {
  assert.throws(() => parseScale("   "), /aucune ligne trouvée/);
});

test("rejette une plage de frettes invalide", () => {
  assert.throws(() => parseScale("frets: 5-2"), /Plage de frettes invalide/);
});

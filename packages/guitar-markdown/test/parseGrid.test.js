import test from "node:test";
import assert from "node:assert/strict";
import { parseChordGrid } from "../src/index.js";

test("parse une grille simple", () => {
  const grid = parseChordGrid("| Em | C | G | D |");
  assert.deepEqual(grid.rows, [{ cells: ["Em", "C", "G", "D"], repeat: false, repeatCount: null }]);
});

test("parse une grille multi-lignes où seule la première ligne porte les barres de reprise", () => {
  const grid = parseChordGrid("||: Dsus2 | B5 | F#5 | F#5 :|| x3\nDsus2 | B5 | A5 | A5");
  assert.deepEqual(grid.rows[0], { cells: ["Dsus2", "B5", "F#5", "F#5"], repeat: true, repeatCount: "3" });
  assert.deepEqual(grid.rows[1], { cells: ["Dsus2", "B5", "A5", "A5"], repeat: false, repeatCount: null });
});

test("rejette une grille vide", () => {
  assert.throws(() => parseChordGrid("   "), /aucune ligne trouvée/);
});

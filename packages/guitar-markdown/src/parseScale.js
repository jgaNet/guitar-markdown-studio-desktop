const STRING_LETTERS = { e: 1, B: 2, G: 3, D: 4, A: 5, E: 6 };

function parseRange(text) {
  const match = text.trim().match(/^(\d+)\s*-\s*(\d+)$/);
  if (!match) throw new Error(`Plage de frettes invalide « ${text.trim()} ».`);
  const from = Number(match[1]);
  const to = Number(match[2]);
  if (to < from) throw new Error(`Plage de frettes invalide « ${text.trim()} ».`);
  return [from, to];
}

function parseNote(token) {
  const highlight = token.startsWith("[") && token.endsWith("]") && token.length > 2;
  const inner = highlight ? token.slice(1, -1) : token;
  if (!highlight && (inner.includes("[") || inner.includes("]"))) {
    throw new Error(`Frette invalide « ${token} ».`);
  }

  const match = inner.match(/^(\d+)(?:,(.+))?$/);
  if (!match || (match[2] !== undefined && !match[2].trim())) {
    throw new Error(`Frette invalide « ${token} ».`);
  }

  return { fret: Number(match[1]), label: match[2] ? match[2].trim() : null, highlight };
}

function parseNoteList(text) {
  return text.split("|").map(token => token.trim()).filter(Boolean).map(parseNote);
}

export function parseScale(source) {
  const lines = source.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) throw new Error("Diagramme de gamme invalide : aucune ligne trouvée.");

  let fretRange = null;
  const dim = {};
  const highlight = {};

  for (const line of lines) {
    const fretsMatch = line.match(/^frets\s*:\s*(.+)$/i);
    if (fretsMatch) {
      fretRange = parseRange(fretsMatch[1]);
      continue;
    }

    const stringMatch = line.match(/^([eBGDAE])\s*:\s*(.+)$/);
    if (stringMatch) {
      const string = STRING_LETTERS[stringMatch[1]];
      for (const note of parseNoteList(stringMatch[2])) {
        const bucket = note.highlight ? highlight : dim;
        (bucket[string] ??= []).push({ fret: note.fret, label: note.label });
      }
      continue;
    }

    throw new Error(`Ligne de diagramme invalide : « ${line} »`);
  }

  if (!fretRange) {
    const allFrets = [...Object.values(dim).flat(), ...Object.values(highlight).flat()].map(note => note.fret);
    if (!allFrets.length) throw new Error("Diagramme de gamme invalide : aucune frette trouvée.");
    fretRange = [Math.min(...allFrets), Math.max(...allFrets)];
  }

  return { type: "scale", fretRange, dim, highlight };
}

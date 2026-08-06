const DEFAULT_TUNING = ["e", "B", "G", "D", "A", "E"];
const STRING_NUMBER_BY_LABEL = { e: 1, B: 2, G: 3, D: 4, A: 5, E: 6 };

function normalizeLines(source) {
  return source
    .split(/\r?\n/)
    .map(line => line.replace(/\t/g, "  "))
    .filter(line => line.trim().length > 0);
}

function findStringLines(lines) {
  const candidates = lines
    .map((line, sourceIndex) => {
      const match = line.match(/^\s*([eEBGDA])\s*\|(.+)$/);
      return match ? { label: match[1], body: match[2], sourceIndex } : null;
    })
    .filter(Boolean);

  if (candidates.length !== 6) {
    throw new Error("Une tablature doit contenir exactement 6 lignes de cordes (e, B, G, D, A, E).");
  }
  const labels = new Set(candidates.map(candidate => candidate.label));
  if (labels.size !== 6) {
    throw new Error("Chaque corde (e, B, G, D, A, E) doit apparaître exactement une fois dans la tablature.");
  }
  return candidates;
}

function splitMeasures(body) {
  const cleaned = body.endsWith("|") ? body.slice(0, -1) : body;
  return cleaned.split("|");
}

function readTokenAt(segment, index) {
  const rest = segment.slice(index);
  const match = rest.match(/^(\d+|x)/i);
  if (!match) return null;
  return { value: match[1].toLowerCase(), length: match[1].length };
}

function techniqueBetween(segment, fromEnd, toStart) {
  const text = segment.slice(fromEnd, toStart);
  if (/h/i.test(text)) return "hammer";
  if (/p/i.test(text)) return "pull";
  if (/\//.test(text)) return "slide-up";
  if (/\\/.test(text)) return "slide-down";
  if (/b/i.test(text)) return "bend";
  if (/~/.test(text)) return "vibrato";
  return null;
}

const DURATION_TABLE = [
  { sixteenths: 24, duration: "hd" },
  { sixteenths: 16, duration: "w" },
  { sixteenths: 12, duration: "qd" },
  { sixteenths: 8, duration: "h" },
  { sixteenths: 6, duration: "8d" },
  { sixteenths: 4, duration: "q" },
  { sixteenths: 3, duration: "16d" },
  { sixteenths: 2, duration: "8" },
  { sixteenths: 1, duration: "16" },
];

function quantizeDuration(sixteenths) {
  const rounded = Math.max(1, Math.round(sixteenths));
  let closest = DURATION_TABLE[DURATION_TABLE.length - 1];
  let bestDiff = Infinity;
  for (const entry of DURATION_TABLE) {
    const diff = Math.abs(entry.sixteenths - rounded);
    if (diff < bestDiff) {
      bestDiff = diff;
      closest = entry;
    }
  }
  return closest.duration;
}

function parseTimeSignature(timeSignature) {
  const match = /^(\d+)\s*\/\s*(\d+)$/.exec(timeSignature ?? "4/4");
  if (!match) return { beatsPerMeasure: 4, beatUnit: 4 };
  return { beatsPerMeasure: Number(match[1]), beatUnit: Number(match[2]) };
}

function parseMeasure(segments, measureIndex, chord = "", timeSignature = "4/4") {
  const width = Math.max(...segments.map(({ segment }) => segment.length), 1);
  const { beatsPerMeasure, beatUnit } = parseTimeSignature(timeSignature);
  const totalSixteenths = beatsPerMeasure * (16 / beatUnit);
  const eventMap = new Map();
  const perStringNotes = [];

  segments.forEach(({ label, segment }) => {
    const stringNumber = STRING_NUMBER_BY_LABEL[label] ?? STRING_NUMBER_BY_LABEL[label.toUpperCase()];
    const notes = [];
    for (let column = 0; column < segment.length;) {
      const token = readTokenAt(segment, column);
      if (!token) {
        column += 1;
        continue;
      }
      const note = {
        string: stringNumber,
        fret: token.value,
        column,
        endColumn: column + token.length,
      };
      notes.push(note);
      if (!eventMap.has(column)) eventMap.set(column, []);
      eventMap.get(column).push({ string: stringNumber, fret: token.value });
      column += token.length;
    }
    perStringNotes.push({ string: stringNumber, segment, notes });
  });

  const sortedColumns = [...eventMap.keys()].sort((a, b) => a - b);
  const events = sortedColumns.map((column, eventIndex) => {
    const nextColumn = sortedColumns[eventIndex + 1] ?? width;
    const sixteenths = ((nextColumn - column) / width) * totalSixteenths;
    return {
      id: `m${measureIndex}-e${eventIndex}`,
      column,
      offset: column / width,
      duration: quantizeDuration(sixteenths),
      positions: eventMap.get(column).sort((a, b) => a.string - b.string),
    };
  });

  const techniques = [];
  for (const row of perStringNotes) {
    for (let i = 0; i < row.notes.length - 1; i += 1) {
      const current = row.notes[i];
      const next = row.notes[i + 1];
      const type = techniqueBetween(row.segment, current.endColumn, next.column);
      if (!type) continue;
      const fromEvent = events.findIndex(event => event.column === current.column);
      const toEvent = events.findIndex(event => event.column === next.column);
      if (fromEvent >= 0 && toEvent >= 0) {
        techniques.push({ type, string: row.string, fromEvent, toEvent });
      }
    }
  }

  return { index: measureIndex, chord, width, events, techniques };
}

export function parseAsciiTab(source, options = {}) {
  const timeSignature = options.timeSignature ?? "4/4";
  const lines = normalizeLines(source);
  const stringLines = findStringLines(lines);
  const firstStringLineIndex = Math.min(...stringLines.map(line => line.sourceIndex));
  const chordLine = lines[firstStringLineIndex - 1] ?? "";
  const splitByString = stringLines.map(line => ({ ...line, measures: splitMeasures(line.body) }));
  const measureCount = Math.max(...splitByString.map(line => line.measures.length));

  const measureWidths = Array.from({ length: measureCount }, (_, index) =>
    Math.max(...splitByString.map(line => (line.measures[index] ?? "").length), 1)
  );
  let cursor = 0;
  const chordLabels = measureWidths.map(width => {
    const label = chordLine.slice(cursor, cursor + width + 1).trim();
    cursor += width + 1;
    return label;
  });

  const measures = Array.from({ length: measureCount }, (_, measureIndex) => {
    const segments = splitByString.map(line => ({
      label: line.label,
      segment: line.measures[measureIndex] ?? "",
    }));
    return parseMeasure(segments, measureIndex, chordLabels[measureIndex], timeSignature);
  });

  return {
    type: "tablature",
    tuning: options.tuning ?? DEFAULT_TUNING,
    timeSignature: options.timeSignature ?? "4/4",
    measures,
    source,
  };
}

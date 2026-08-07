import {
  Annotation,
  Beam,
  Bend,
  Formatter,
  Renderer,
  Stave,
  StaveConnector,
  StaveNote,
  TabNote,
  TabSlide,
  TabStave,
  TabTie,
  Tuning,
  Vibrato,
  Voice,
} from "vexflow";

const SVG_NS = "http://www.w3.org/2000/svg";
const STANDARD_TUNING = new Tuning("standard");

function parseTimeSignature(timeSignature) {
  const match = /^(\d+)\s*\/\s*(\d+)$/.exec(timeSignature ?? "4/4");
  if (!match) return { numBeats: 4, beatValue: 4 };
  return { numBeats: Number(match[1]), beatValue: Number(match[2]) };
}

function addChordAnnotation(note, chord) {
  if (!chord) return;
  note.addModifier(
    new Annotation(chord)
      .setVerticalJustification(Annotation.VerticalJustify.TOP)
      .setFont("Arial", 13, "bold"),
    0,
  );
}

function addSingleNoteModifiers(note, event, measure, eventIndex) {
  const outgoing = measure.techniques.filter(technique => technique.fromEvent === eventIndex);
  if (outgoing.some(technique => technique.type === "bend")) {
    note.addModifier(new Bend([{ type: Bend.UP, text: "Full" }]), 0);
  }
  if (outgoing.some(technique => technique.type === "vibrato")) {
    note.addModifier(new Vibrato(), 0);
  }
}

function connectorForTechnique(technique, notes) {
  const firstNote = notes[technique.fromEvent];
  const lastNote = notes[technique.toEvent];
  if (!firstNote || !lastNote) return null;
  const firstIndex = firstNote.getPositions().findIndex(position => position.str === technique.string);
  const lastIndex = lastNote.getPositions().findIndex(position => position.str === technique.string);
  if (firstIndex < 0 || lastIndex < 0) return null;

  const tieOptions = {
    firstNote,
    lastNote,
    firstIndexes: [firstIndex],
    lastIndexes: [lastIndex],
  };

  if (technique.type === "hammer") return new TabTie(tieOptions, "H");
  if (technique.type === "pull") return new TabTie(tieOptions, "P");
  if (technique.type === "slide-up") return TabSlide.createSlideUp(tieOptions);
  if (technique.type === "slide-down") return TabSlide.createSlideDown(tieOptions);
  return null;
}

function createMeasureNotes(measure, { annotateChord = true } = {}) {
  return measure.events.map((event, eventIndex) => {
    const note = new TabNote({
      positions: event.positions.map(position => ({
        str: position.string,
        fret: position.fret,
      })),
      duration: event.duration,
    });
    if (eventIndex === 0 && annotateChord) addChordAnnotation(note, measure.chord);
    addSingleNoteModifiers(note, event, measure, eventIndex);
    return note;
  });
}

function pitchForPosition(position) {
  return STANDARD_TUNING.getNoteForFret(position.fret, position.string);
}

function createStandardNotes(measure) {
  return measure.events.map((event, eventIndex) => {
    const pitches = event.positions.filter(position => position.fret !== "x").map(pitchForPosition);
    const note = pitches.length
      ? new StaveNote({ keys: pitches, duration: event.duration, clef: "treble", auto_stem: true })
      : new StaveNote({ keys: ["b/4"], duration: `${event.duration}r`, clef: "treble" });
    if (eventIndex === 0) addChordAnnotation(note, measure.chord);
    return note;
  });
}

function measureClefOverhead(makeStave) {
  const bare = makeStave();
  bare.format();
  const bareNoteStartX = bare.getNoteStartX();
  const withClef = makeStave();
  withClef.addClef("tab");
  withClef.format();
  return withClef.getNoteStartX() - bareNoteStartX;
}

function computeMeasureWidths(measureWidth, count, firstMeasureOverhead) {
  return Array.from({ length: count }, (_, index) => (index === 0 ? measureWidth + firstMeasureOverhead : measureWidth));
}

function renderRow(container, measures, options) {
  const measureWidth = options.measureWidth;
  const height = options.height;
  const { numBeats, beatValue } = parseTimeSignature(options.timeSignature);
  const clefOverhead = measureClefOverhead(() => new TabStave(0, 0, measureWidth, { spaceAboveStaffLn: 2 }));
  // Size the canvas for a full row (options.measuresPerRow), not just this
  // row's actual measure count — otherwise a shorter last row has a smaller
  // natural SVG width and CSS max-width scaling makes its notation look
  // bigger than the other, fuller rows.
  const widths = computeMeasureWidths(measureWidth, options.measuresPerRow ?? measures.length, clefOverhead);
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);

  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(totalWidth, height);
  const context = renderer.getContext();

  let cursorX = 0;
  measures.forEach((measure, index) => {
    const width = widths[index];
    const stave = new TabStave(cursorX, 8, width, {
      spaceAboveStaffLn: 2,
      leftBar: index === 0,
    });
    cursorX += width;
    if (index === 0) stave.addClef("tab");
    stave.setContext(context).draw();

    const notes = createMeasureNotes(measure);
    if (!notes.length) return;

    const voice = new Voice({ numBeats, beatValue }).setMode(Voice.Mode.SOFT);
    voice.addTickables(notes);
    new Formatter().joinVoices([voice]).formatToStave([voice], stave);
    voice.draw(context, stave);

    for (const technique of measure.techniques) {
      const connector = connectorForTechnique(technique, notes);
      connector?.setContext(context).draw();
    }
  });
}

function measureScoreClefOverhead(measureWidth, numBeats, beatValue) {
  const bareNotation = new Stave(0, 0, measureWidth);
  const bareTab = new TabStave(0, 0, measureWidth, { spaceAboveStaffLn: 2 });
  Stave.formatBegModifiers([bareNotation, bareTab]);
  const bareNoteStartX = bareNotation.getNoteStartX();

  const clefNotation = new Stave(0, 0, measureWidth).addClef("treble").addTimeSignature(`${numBeats}/${beatValue}`);
  const clefTab = new TabStave(0, 0, measureWidth, { spaceAboveStaffLn: 2 }).addClef("tab");
  Stave.formatBegModifiers([clefNotation, clefTab]);
  return clefNotation.getNoteStartX() - bareNoteStartX;
}

function renderScoreRow(container, measures, options) {
  const measureWidth = options.measureWidth;
  const notationHeight = 90;
  const tabHeight = options.height;
  const { numBeats, beatValue } = parseTimeSignature(options.timeSignature);
  const clefOverhead = measureScoreClefOverhead(measureWidth, numBeats, beatValue);
  // Same fixed-canvas-width reasoning as renderRow — see comment there.
  const widths = computeMeasureWidths(measureWidth, options.measuresPerRow ?? measures.length, clefOverhead);
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);

  const renderer = new Renderer(container, Renderer.Backends.SVG);
  renderer.resize(totalWidth, notationHeight + tabHeight);
  const context = renderer.getContext();

  let firstNotationStave = null;
  let firstTabStave = null;
  let cursorX = 0;

  measures.forEach((measure, index) => {
    const width = widths[index];
    const x = cursorX;
    cursorX += width;
    const notationStave = new Stave(x, 0, width, { leftBar: index === 0 });
    const tabStave = new TabStave(x, notationHeight, width, {
      spaceAboveStaffLn: 2,
      leftBar: index === 0,
    });
    if (index === 0) {
      notationStave.addClef("treble").addTimeSignature(`${numBeats}/${beatValue}`);
      tabStave.addClef("tab");
      firstNotationStave = notationStave;
      firstTabStave = tabStave;
    }
    Stave.formatBegModifiers([notationStave, tabStave]);
    notationStave.setContext(context).draw();
    tabStave.setContext(context).draw();

    const tabNotes = createMeasureNotes(measure, { annotateChord: false });
    const standardNotes = createStandardNotes(measure);
    if (!tabNotes.length) return;

    const tabVoice = new Voice({ numBeats, beatValue }).setMode(Voice.Mode.SOFT);
    tabVoice.addTickables(tabNotes);
    const standardVoice = new Voice({ numBeats, beatValue }).setMode(Voice.Mode.SOFT);
    standardVoice.addTickables(standardNotes);

    new Formatter()
      .joinVoices([standardVoice])
      .joinVoices([tabVoice])
      .formatToStave([standardVoice, tabVoice], notationStave);

    const beams = Beam.applyAndGetBeams(standardVoice);
    standardVoice.draw(context, notationStave);
    beams.forEach(beam => beam.setContext(context).draw());
    tabVoice.draw(context, tabStave);

    for (const technique of measure.techniques) {
      const connector = connectorForTechnique(technique, tabNotes);
      connector?.setContext(context).draw();
    }
  });

  if (firstNotationStave && firstTabStave) {
    new StaveConnector(firstNotationStave, firstTabStave).setType("singleLeft").setContext(context).draw();
  }
}

function renderMeasureRows(ast, target, options, className, drawRow) {
  target.replaceChildren();
  target.classList.add(className);

  for (let start = 0; start < ast.measures.length; start += options.measuresPerRow) {
    const rowMeasures = ast.measures.slice(start, start + options.measuresPerRow);
    const rowHost = document.createElement("div");
    rowHost.className = className === "vex-tab-score" ? "vex-tab-row" : "vex-score-row";
    rowHost.dataset.row = String(start / options.measuresPerRow + 1);
    target.append(rowHost);
    try {
      drawRow(rowHost, rowMeasures, options);
    } catch (error) {
      rowHost.classList.add("render-error");
      rowHost.textContent = `Mesures ${start + 1}–${start + rowMeasures.length} : ${error.message}`;
    }
  }

  return target;
}

export function renderTablatureSvg(ast, target, options = {}) {
  const settings = {
    measureWidth: options.measureWidth ?? 200,
    height: options.height ?? 130,
    measuresPerRow: options.measuresPerRow ?? ast.measures.length,
    timeSignature: ast.timeSignature,
  };
  return renderMeasureRows(ast, target, settings, "vex-tab-score", renderRow);
}

export function renderScoreSvg(ast, target, options = {}) {
  const settings = {
    measureWidth: options.measureWidth ?? 220,
    height: options.height ?? 130,
    measuresPerRow: options.measuresPerRow ?? ast.measures.length,
    timeSignature: ast.timeSignature,
  };
  return renderMeasureRows(ast, target, settings, "vex-score-score", renderScoreRow);
}

export function serializeTablatureSvg(target) {
  const wrapper = document.createElementNS(SVG_NS, "svg");
  wrapper.setAttribute("xmlns", SVG_NS);
  wrapper.setAttribute("width", "100%");
  wrapper.setAttribute("height", "auto");
  return target.querySelectorAll("svg").length === 1
    ? new XMLSerializer().serializeToString(target.querySelector("svg"))
    : null;
}

import { SVGuitarChord } from "svguitar";

function chordData(chord) {
  const playedFrets = chord.frets.filter(fret => typeof fret === "number" && fret > 0);
  const minFret = playedFrets.length ? Math.min(...playedFrets) : 1;
  const maxFret = playedFrets.length ? Math.max(...playedFrets) : 4;
  const position = maxFret > 4 ? minFret : 1;

  const fingers = chord.frets.flatMap((fret, index) => {
    const string = 6 - index;
    if (fret === "x") return [[string, "x"]];
    if (fret === 0) return [[string, 0]];
    return [[string, fret - position + 1, ""]];
  });
  return { title: chord.name, fingers, barres: [], position };
}

export function renderChordDiagrams(chords, target) {
  target.replaceChildren();
  target.classList.add("svguitar-grid");
  chords.forEach(chord => {
    const item = document.createElement("div");
    item.className = "svguitar-item";
    target.append(item);
    const data = chordData(chord);
    new SVGuitarChord(item)
      .configure({
        title: data.title,
        strings: 6,
        frets: 5,
        position: data.position,
        fretLabelPosition: "right",
        color: "#1f2937",
        backgroundColor: "transparent",
        strokeWidth: 2,
      })
      .chord({ fingers: data.fingers, barres: data.barres })
      .draw();
  });
  return target;
}

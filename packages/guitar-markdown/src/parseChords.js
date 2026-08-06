function parseShape(shape) {
  const tokens = shape.includes(" ") ? shape.trim().split(/\s+/) : [...shape.trim()];
  if (tokens.length !== 6) throw new Error(`Forme d'accord invalide « ${shape} » : 6 cordes sont attendues.`);
  return tokens.map(token => token.toLowerCase() === "x" ? "x" : Number(token));
}

export function parseChordBlock(source) {
  return source.split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const match = line.match(/^(\S+)\s+(.+)$/);
      if (!match) throw new Error(`Accord invalide à la ligne ${index + 1}. Format : Am x02210`);
      return { type: "chord", name: match[1], frets: parseShape(match[2]) };
    });
}

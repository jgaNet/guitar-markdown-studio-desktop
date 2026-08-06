import "./style.css";
import { DEFAULT_MARKDOWN } from "./default-content.js";
import { renderMarkdown } from "./markdown.js";
import { renderTablatureSvg, renderScoreSvg } from "@gms/renderer-vexflow";
import { renderChordDiagrams } from "@gms/renderer-svguitar";

const STORAGE_KEY = "gms:vexflow:document";
const PAGE_HEIGHT_MM = 297;
const PRINT_MARGIN_MM = 14;
const PAGE_CONTENT_HEIGHT_MM = PAGE_HEIGHT_MM - 2 * PRINT_MARGIN_MM;
const MM_TO_PX = 96 / 25.4;
const app = document.querySelector("#app");
const saved = localStorage.getItem(STORAGE_KEY) ?? DEFAULT_MARKDOWN;
let currentFilePath = null;

app.innerHTML = `
<main class="app-shell">
  <header class="topbar">
    <div><h1>Guitar Markdown Studio</h1><p>Markdown → AST → SVG VexFlow / SVGuitar</p></div>
    <div class="actions">
      <button id="open-md">Ouvrir</button>
      <label class="button browser-import">Importer<input id="import-file" type="file" accept=".md,.markdown" hidden></label>
      <button id="download-md">Enregistrer .md</button>
      <button id="reset">Exemple</button>
      <button id="print" class="primary">Imprimer / PDF</button>
    </div>
  </header>
  <nav class="insertbar">
    <button data-insert="tab">Tablature</button>
    <button data-insert="partition">Partition</button>
    <button data-insert="chords">Accords</button>
    <button data-insert="rhythm">Rythmique</button>
    <button data-insert="grid">Grille</button>
    <button data-insert="pagebreak">Saut de page</button>
    <span class="grow"></span>
    <span id="status">Prêt</span>
  </nav>
  <section class="workspace">
    <section class="pane editor-pane">
      <div class="pane-title">Markdown</div>
      <textarea id="editor" spellcheck="false"></textarea>
    </section>
    <section class="pane preview-pane">
      <div class="pane-title">Rendu SVG</div>
      <article id="preview" class="course-page"></article>
    </section>
  </section>
</main>`;

const editor = document.querySelector("#editor");
const preview = document.querySelector("#preview");
const status = document.querySelector("#status");
editor.value = saved;

const snippets = {
  tab: `\n\`\`\`tab\ne|----------------|\nB|----------------|\nG|----------------|\nD|----------------|\nA|----------------|\nE|----------------|\n\`\`\`\n`,
  partition: `\n\`\`\`partition\ne|----------------|\nB|----------------|\nG|----------------|\nD|----------------|\nA|----------------|\nE|----------------|\n\`\`\`\n`,
  chords: `\n\`\`\`chords\nAm x02210\nC  x32010\nG  320003\n\`\`\`\n`,
  rhythm: `\n\`\`\`rhythm\nB H | B h | B H | h B\n\`\`\`\n`,
  grid: `\n\`\`\`grid\n| Am | F | C | G |\n\`\`\`\n`,
  pagebreak: `\n\`\`\`pagebreak\n\`\`\`\n`,
};

function drawPending(renders) {
  for (const render of renders) {
    const target = document.getElementById(render.id);
    if (!target) continue;
    if (render.type === "tab") renderTablatureSvg(render.ast, target, { measureWidth: 220, height: 130 });
    if (render.type === "partition") renderScoreSvg(render.ast, target, { measureWidth: 220, height: 110 });
    if (render.type === "chords") renderChordDiagrams(render.ast, target);
  }
}

function renderPageBreaks() {
  preview.querySelectorAll(".page-break-line").forEach(line => line.remove());
  const pageContentHeightPx = PAGE_CONTENT_HEIGHT_MM * MM_TO_PX;
  const manualBreaks = [...preview.querySelectorAll(".page-break")].map(el => el.offsetTop).sort((a, b) => a - b);
  const boundaries = [0, ...manualBreaks, preview.scrollHeight];

  let pageNumber = 1;
  for (let i = 0; i < boundaries.length - 1; i += 1) {
    const segmentStart = boundaries[i];
    const segmentHeight = boundaries[i + 1] - segmentStart;
    const autoBreaksInSegment = Math.max(0, Math.ceil(segmentHeight / pageContentHeightPx) - 1);
    for (let j = 1; j <= autoBreaksInSegment; j += 1) {
      pageNumber += 1;
      const line = document.createElement("div");
      line.className = "page-break-line";
      line.style.top = `${(segmentStart + j * pageContentHeightPx) / MM_TO_PX}mm`;
      line.dataset.page = String(pageNumber);
      preview.append(line);
    }
    if (i < boundaries.length - 2) pageNumber += 1;
  }
}

function update() {
  try {
    const result = renderMarkdown(editor.value);
    preview.innerHTML = result.html;
    drawPending(result.renders);
    renderPageBreaks();
    localStorage.setItem(STORAGE_KEY, editor.value);
    status.textContent = "Sauvegardé";
  } catch (error) {
    status.textContent = "Erreur";
    preview.innerHTML = `<div class="block-error">${error.message}</div>`;
  }
}

let debounce;
editor.addEventListener("input", () => {
  status.textContent = "Rendu…";
  clearTimeout(debounce);
  debounce = setTimeout(update, 140);
});
let resizeDebounce;
window.addEventListener("resize", () => {
  clearTimeout(resizeDebounce);
  resizeDebounce = setTimeout(renderPageBreaks, 140);
});
editor.addEventListener("keydown", event => {
  if (event.key === "Tab") {
    event.preventDefault();
    editor.setRangeText("  ", editor.selectionStart, editor.selectionEnd, "end");
  }
});

document.querySelectorAll("[data-insert]").forEach(button => button.addEventListener("click", () => {
  editor.setRangeText(snippets[button.dataset.insert], editor.selectionStart, editor.selectionEnd, "end");
  editor.focus();
  update();
}));

document.querySelector("#reset").addEventListener("click", () => { editor.value = DEFAULT_MARKDOWN; update(); });
document.querySelector("#print").addEventListener("click", async () => {
  if (window.gmsDesktop) {
    const result = await window.gmsDesktop.exportPdf();
    if (result) status.textContent = "PDF exporté";
  } else {
    window.print();
  }
});
document.querySelector("#download-md").addEventListener("click", async () => {
  if (window.gmsDesktop) {
    const result = await window.gmsDesktop.saveMarkdown({ content: editor.value, filePath: currentFilePath });
    if (result) {
      currentFilePath = result.filePath;
      status.textContent = "Fichier enregistré";
    }
    return;
  }
  const blob = new Blob([editor.value], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cours-guitare.md";
  a.click();
  URL.revokeObjectURL(url);
});

const openButton = document.querySelector("#open-md");
if (window.gmsDesktop) {
  document.querySelector(".browser-import")?.remove();
  openButton.addEventListener("click", async () => {
    const result = await window.gmsDesktop.openMarkdown();
    if (!result) return;
    currentFilePath = result.filePath;
    editor.value = result.content;
    update();
    status.textContent = "Fichier ouvert";
  });
} else {
  openButton.remove();
}

document.querySelector("#import-file")?.addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  editor.value = await file.text();
  event.target.value = "";
  update();
});

update();

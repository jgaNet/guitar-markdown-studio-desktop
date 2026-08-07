import "./style.css";
import { DEFAULT_MARKDOWN } from "./default-content.js";
import { renderMarkdown, parseFrontMatter } from "./markdown.js";
import { renderTablatureSvg, renderScoreSvg } from "@gms/renderer-vexflow";
import { renderChordDiagrams } from "@gms/renderer-svguitar";

const STORAGE_KEY = "gms:vexflow:document";
const EDITOR_WIDTH_KEY = "gms:editor-width";
const DEFAULT_EDITOR_WIDTH = 420;
const EDITOR_MIN_VISIBLE_WIDTH = 220;
const EDITOR_HIDE_THRESHOLD = 160;
const PREVIEW_MIN_VISIBLE_WIDTH = 160;
const RESIZER_WIDTH = 6;
const COMPACT_BREAKPOINT = "(max-width: 1100px)";
const PAGE_HEIGHT_MM = 297;
const PAGE_WIDTH_MM = 210;
const PRINT_MARGIN_MM = 14;
const PAGE_CONTENT_HEIGHT_MM = PAGE_HEIGHT_MM - 2 * PRINT_MARGIN_MM;
const LANDSCAPE_CONTENT_HEIGHT_MM = PAGE_WIDTH_MM - 2 * PRINT_MARGIN_MM;
const MM_TO_PX = 96 / 25.4;
const PAGE_FIT_MIN_SCALE = 0.35;
const RHYTHM_FIT_MIN_SCALE = 0.4;
const GRID_FIT_MIN_SCALE = 0.45;
const app = document.querySelector("#app");
const saved = localStorage.getItem(STORAGE_KEY) ?? DEFAULT_MARKDOWN;
let currentFilePath = null;
let fitToPage = false;
let editorWidth = Number(localStorage.getItem(EDITOR_WIDTH_KEY)) || DEFAULT_EDITOR_WIDTH;
let compactView = "preview";

app.innerHTML = `
<main class="app-shell">
  <header class="topbar">
    <div><h1>Guitar Markdown Studio</h1><p>Markdown → AST → SVG VexFlow / SVGuitar</p></div>
    <div class="actions">
      <button id="open-md">Ouvrir</button>
      <span id="status">Prêt</span>
      <label class="button browser-import">Importer<input id="import-file" type="file" accept=".md,.markdown" hidden></label>
      <button id="download-md">Enregistrer .md</button>
      <button id="reset">Exemple</button>
      <button id="print" class="primary">Imprimer / PDF</button>
    </div>
  </header>
  <nav class="insertbar">
    <div class="insert-group">
      <button data-insert="tab">Tablature</button>
      <button data-insert="partition">Partition</button>
      <button data-insert="chords">Accords</button>
      <button data-insert="rhythm">Rythmique</button>
      <button data-insert="grid">Grille</button>
    </div>
    <span class="insert-divider"></span>
    <div class="insert-group">
      <button data-insert="pagebreak">Saut de page</button>
      <button data-insert="landscapebreak">Saut de page (mode optimisé)</button>
      <button data-insert="columnbreak">Saut de colonne (mode optimisé)</button>
      <button data-insert="columns">Colonnes</button>
      <button data-insert="zoom">Zoom</button>
    </div>
    <span class="grow"></span>
  </nav>
  <section class="workspace">
    <button id="edit-toggle" class="edit-toggle" type="button" hidden>✎ Éditer</button>
    <section class="pane editor-pane" id="editor-pane">
      <div class="pane-title">Markdown</div>
      <textarea id="editor" spellcheck="false"></textarea>
    </section>
    <div class="resizer" id="pane-resizer"></div>
    <section class="pane preview-pane">
      <div class="pane-title pane-title-row">
        <span>Preview</span>
        <div class="mode-switch" role="group" aria-label="Mode de mise en page">
          <button id="mode-portrait" class="mode-option" type="button">Standard</button>
          <button id="mode-landscape" class="mode-option" type="button">Optimisé</button>
        </div>
      </div>
      <div id="preview-scale-wrapper">
        <article id="preview" class="course-page"></article>
      </div>
    </section>
  </section>
</main>`;

const editor = document.querySelector("#editor");
const preview = document.querySelector("#preview");
const previewWrapper = document.querySelector("#preview-scale-wrapper");
const workspace = document.querySelector(".workspace");
const previewPane = document.querySelector(".preview-pane");
const editorPane = document.querySelector("#editor-pane");
const resizer = document.querySelector("#pane-resizer");
const editToggle = document.querySelector("#edit-toggle");
const insertbar = document.querySelector(".insertbar");
const compactQuery = window.matchMedia(COMPACT_BREAKPOINT);
const modePortraitButton = document.querySelector("#mode-portrait");
const modeLandscapeButton = document.querySelector("#mode-landscape");
const status = document.querySelector("#status");
editor.value = saved;

const snippets = {
  tab: `\n\`\`\`tab\ne|----------------|\nB|----------------|\nG|----------------|\nD|----------------|\nA|----------------|\nE|----------------|\n\`\`\`\n`,
  partition: `\n\`\`\`partition\ne|----------------|\nB|----------------|\nG|----------------|\nD|----------------|\nA|----------------|\nE|----------------|\n\`\`\`\n`,
  chords: `\n\`\`\`chords\nAm x02210\nC  x32010\nG  320003\n\`\`\`\n`,
  rhythm: `\n\`\`\`rhythm\nB H | B h | B H | h B\n\`\`\`\n`,
  grid: `\n\`\`\`grid\n| Am | F | C | G |\n\`\`\`\n`,
  pagebreak: `\n\`\`\`pagebreak\n\`\`\`\n`,
  landscapebreak: `\n\`\`\`landscapebreak\n\`\`\`\n`,
  columnbreak: `\n\`\`\`columnbreak\n\`\`\`\n`,
  columns: `\n\`\`\`columns\n\`\`\`\n\n\`\`\`column\n\`\`\`\n\n\`\`\`endcolumns\n\`\`\`\n`,
  zoom: `\n\`\`\`zoom 0.8\n\`\`\`\n\n\`\`\`endzoom\n\`\`\`\n`,
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

function splitByMarker(nodes, markerClass) {
  const segments = [[]];
  for (const node of nodes) {
    if (node.nodeType === 1 && node.classList.contains(markerClass)) {
      segments.push([]);
    } else {
      segments[segments.length - 1].push(node);
    }
  }
  return segments;
}

function applyColumnSections() {
  const nodes = [...preview.childNodes];
  const output = [];
  let i = 0;
  while (i < nodes.length) {
    const node = nodes[i];
    if (node.nodeType !== 1 || !node.classList.contains("column-section-start")) {
      output.push(node);
      i += 1;
      continue;
    }

    const groups = [[]];
    i += 1;
    while (i < nodes.length && !nodes[i].classList?.contains("column-section-end")) {
      if (nodes[i].classList?.contains("column-section-sep")) {
        groups.push([]);
      } else {
        groups[groups.length - 1].push(nodes[i]);
      }
      i += 1;
    }
    i += 1; // skip the end marker

    const section = document.createElement("div");
    section.className = "column-section";
    section.style.setProperty("--columns", String(groups.length));
    groups.forEach(groupNodes => {
      const column = document.createElement("div");
      column.className = "column-section-column";
      groupNodes.forEach(groupNode => column.append(groupNode));
      section.append(column);
    });
    output.push(section);
  }

  preview.innerHTML = "";
  output.forEach(node => preview.append(node));
}

function wrapZoomSections() {
  const nodes = [...preview.childNodes];
  const output = [];
  let i = 0;
  while (i < nodes.length) {
    const node = nodes[i];
    if (node.nodeType !== 1 || !node.classList.contains("zoom-start")) {
      output.push(node);
      i += 1;
      continue;
    }

    const scale = parseFloat(node.dataset.scale) || 0.8;
    const groupNodes = [];
    i += 1;
    while (i < nodes.length && !nodes[i].classList?.contains("zoom-end")) {
      groupNodes.push(nodes[i]);
      i += 1;
    }
    i += 1; // skip the end marker

    const block = document.createElement("div");
    block.className = "zoom-block";
    block.dataset.scale = String(scale);
    const inner = document.createElement("div");
    inner.className = "zoom-inner";
    groupNodes.forEach(groupNode => inner.append(groupNode));
    block.append(inner);
    output.push(block);
  }

  preview.innerHTML = "";
  output.forEach(node => preview.append(node));
}

function applyZoomScale(root = document) {
  // Measured last (after tab/chord SVGs are drawn and any landscape column
  // restructuring/scaling has settled), then the wrapper collapses to the
  // post-scale width AND height — like zooming a window — instead of leaving
  // the unscaled footprint reserved.
  root.querySelectorAll(".zoom-block").forEach(block => {
    const scale = parseFloat(block.dataset.scale) || 0.8;
    const inner = block.querySelector(".zoom-inner");
    inner.style.setProperty("--zoom-scale", String(scale));

    // Chord diagrams repack themselves via --zoom-scale (smaller/larger grid
    // tracks let a different number fit per row instead of just visually
    // scaling whatever row count the full-size layout already decided on),
    // so no transform is needed — the intrinsic resize already reclaims/uses
    // the space.
    const onlyChordBlocks = inner.children.length > 0 && [...inner.children].every(child => child.classList.contains("chord-block"));
    if (onlyChordBlocks) {
      block.style.width = "";
      block.style.height = "";
      inner.style.transform = "";
      inner.style.width = "";
      return;
    }

    block.style.width = "";
    inner.style.transform = "";
    inner.style.width = "";
    const naturalWidth = inner.offsetWidth;
    const naturalHeight = inner.scrollHeight;
    // Lock inner to its natural pixel width so resizing the outer block
    // doesn't also resize (and reflow) inner via the default 100% width —
    // only the transform should scale it, not the layout itself.
    inner.style.width = `${naturalWidth}px`;
    inner.style.transformOrigin = "top left";
    inner.style.transform = `scale(${scale})`;
    block.style.width = `${naturalWidth * scale}px`;
    block.style.height = `${naturalHeight * scale}px`;
  });
}

function fitRhythmBlocks(root = document) {
  root.querySelectorAll(".rhythm-block").forEach(block => {
    block.style.setProperty("--rhythm-scale", "1");
    // Padding, gaps and font sizes all shrink together with --rhythm-scale, so a
    // plain width ratio applies. Font metrics don't scale perfectly linearly, so
    // re-measure and correct over a few passes.
    let scale = 1;
    for (let pass = 0; pass < 4; pass += 1) {
      const natural = block.scrollWidth;
      const available = block.clientWidth;
      if (available <= 0 || natural <= available || scale <= RHYTHM_FIT_MIN_SCALE) break;
      scale = Math.max(RHYTHM_FIT_MIN_SCALE, scale * (available / natural) * 0.98);
      block.style.setProperty("--rhythm-scale", String(scale));
    }
  });
}

function fitChordGrids(root = document) {
  root.querySelectorAll(".chord-grid").forEach(grid => {
    grid.style.setProperty("--grid-scale", "1");
    // Grid cells use minmax(0, 1fr), so their tracks shrink instead of the whole
    // grid overflowing — overflow shows up per-cell instead of on the container.
    let scale = 1;
    for (let pass = 0; pass < 4; pass += 1) {
      const cells = [...grid.querySelectorAll(".grid-cell, .grid-repeat-count")];
      const worstRatio = cells.reduce((worst, cell) => {
        return cell.clientWidth > 0 ? Math.max(worst, cell.scrollWidth / cell.clientWidth) : worst;
      }, 1);
      if (worstRatio <= 1.02 || scale <= GRID_FIT_MIN_SCALE) break;
      scale = Math.max(GRID_FIT_MIN_SCALE, (scale / worstRatio) * 0.98);
      grid.style.setProperty("--grid-scale", String(scale));
    }
  });
}

function setPrintOrientation(isLandscape) {
  let styleTag = document.getElementById("dynamic-page-size");
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = "dynamic-page-size";
    document.head.append(styleTag);
  }
  styleTag.textContent = isLandscape ? "@media print { @page { size: A4 landscape; margin: 0; } }" : "";
}

function buildLandscapeStructure() {
  // A landscapebreak starts a new physical landscape page; a columnbreak starts
  // a new column within the current page. pagebreak is portrait-only and is
  // left untouched here (hidden via CSS instead). Both consumed marker types
  // never appear in the final DOM. `preview` itself stays attached (but
  // hidden) so getElementById lookups in drawPending keep working on the next
  // render pass, before its content has been redistributed into page boxes.
  const pages = splitByMarker([...preview.childNodes], "landscape-page-break");
  preview.classList.remove("landscape-fit");
  preview.innerHTML = "";
  preview.style.display = "none";
  previewWrapper.innerHTML = "";
  previewWrapper.append(preview);
  previewWrapper.style.height = "";

  pages.forEach(pageNodes => {
    const pageBox = document.createElement("article");
    pageBox.className = "course-page landscape-fit";

    const columnsHost = document.createElement("div");
    columnsHost.className = "landscape-columns";
    splitByMarker(pageNodes, "column-break").forEach(nodes => {
      const column = document.createElement("div");
      column.className = "landscape-column";
      const inner = document.createElement("div");
      inner.className = "landscape-column-inner";
      nodes.forEach(node => inner.append(node));
      column.append(inner);
      columnsHost.append(column);
    });
    pageBox.append(columnsHost);
    previewWrapper.append(pageBox);
  });
}

function rescaleLandscapeColumns() {
  const usableHeightPx = LANDSCAPE_CONTENT_HEIGHT_MM * MM_TO_PX;
  document.querySelectorAll(".course-page.landscape-fit").forEach(pageBox => {
    // Measure at the true physical landscape width (297mm), not whatever width the
    // responsive on-screen preview happens to be at — text reflow depends on width,
    // so measuring at a shrunk viewport width would compute a scale that doesn't
    // match the actual print output.
    pageBox.style.width = `${PAGE_HEIGHT_MM * MM_TO_PX}px`;
    pageBox.querySelectorAll(".landscape-column-inner").forEach(inner => {
      inner.style.transform = "";
      inner.style.width = "";
      const naturalHeight = inner.scrollHeight;
      const scale = Math.max(PAGE_FIT_MIN_SCALE, Math.min(1, usableHeightPx / naturalHeight));
      inner.style.transformOrigin = "top left";
      inner.style.transform = `scale(${scale})`;
      inner.style.width = `${100 / scale}%`;
    });
    pageBox.style.width = "";
  });
}

function applyPageFit() {
  workspace.classList.toggle("landscape-active", fitToPage);
  setPrintOrientation(fitToPage);

  if (!fitToPage) {
    preview.classList.remove("landscape-fit");
    preview.style.transform = "";
    preview.style.width = "";
    preview.style.display = "";
    previewWrapper.style.height = "";
    previewWrapper.innerHTML = "";
    previewWrapper.append(preview);
    return;
  }

  buildLandscapeStructure();
  rescaleLandscapeColumns();
}

function applyCompactMode() {
  workspace.classList.toggle("compact", compactQuery.matches);
  if (!compactQuery.matches) {
    workspace.classList.remove("editor-overlay");
    insertbar.hidden = false;
    applyEditorWidth();
    return;
  }
  // Tablet/mobile: a single full-width pane at a time — either the editor (with
  // its insert toolbar) or the preview (full A4/optimized rendering, no editing
  // controls) — toggled by the same floating button used on desktop.
  resizer.hidden = true;
  const showEditor = compactView === "edit";
  editorPane.hidden = !showEditor;
  editorPane.style.width = "100%";
  previewPane.hidden = showEditor;
  insertbar.hidden = !showEditor;
  editToggle.hidden = false;
  editToggle.textContent = showEditor ? "👁 Aperçu" : "✎ Éditer";
}

function applyEditorWidth() {
  // The preview always renders at true A4 size and never shrinks to fit the
  // window — the editor absorbs the squeeze instead, shrinking first and then
  // hiding entirely (behind the floating edit-toggle button) once there's no
  // usable width left for it.
  if (compactQuery.matches || workspace.classList.contains("editor-overlay")) return;
  const available = workspace.clientWidth - RESIZER_WIDTH - PREVIEW_MIN_VISIBLE_WIDTH;
  if (available < EDITOR_HIDE_THRESHOLD) {
    editorPane.hidden = true;
    resizer.hidden = true;
    editToggle.hidden = false;
    editToggle.textContent = "✎ Éditer";
    return;
  }
  editorPane.hidden = false;
  resizer.hidden = false;
  editToggle.hidden = true;
  const width = Math.min(Math.max(editorWidth, EDITOR_MIN_VISIBLE_WIDTH), available);
  editorPane.style.width = `${width}px`;
}

function update() {
  try {
    const result = renderMarkdown(editor.value);
    preview.innerHTML = result.html;
    const { data } = parseFrontMatter(editor.value);
    document.title = data.title ? slugify(data.title) : "Guitar Markdown Studio";
    applyColumnSections();
    wrapZoomSections();
    drawPending(result.renders);
    if (fitToPage) {
      preview.querySelectorAll(".page-break-line").forEach(line => line.remove());
    } else {
      renderPageBreaks();
    }
    applyPageFit();
    fitRhythmBlocks();
    fitChordGrids();
    applyZoomScale();
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
  resizeDebounce = setTimeout(() => {
    applyCompactMode();
    if (fitToPage) rescaleLandscapeColumns();
    else renderPageBreaks();
    fitRhythmBlocks();
    fitChordGrids();
    applyZoomScale();
  }, 140);
});
editor.addEventListener("keydown", event => {
  if (event.key === "Tab") {
    event.preventDefault();
    editor.setRangeText("  ", editor.selectionStart, editor.selectionEnd, "end");
  }
});

// Sync scroll position (by percentage, not by line) between the editor and the
// preview in standard mode only — in landscape/fit-to-page mode the preview's
// content is restructured into columns/pages, so line order no longer matches.
let syncingScroll = false;
function scrollRatio(el) {
  return el.scrollHeight > el.clientHeight ? el.scrollTop / (el.scrollHeight - el.clientHeight) : 0;
}
function applyScrollRatio(el, ratio) {
  el.scrollTop = ratio * (el.scrollHeight - el.clientHeight);
}
editor.addEventListener("scroll", () => {
  if (fitToPage || syncingScroll) return;
  syncingScroll = true;
  applyScrollRatio(previewPane, scrollRatio(editor));
  syncingScroll = false;
});
previewPane.addEventListener("scroll", () => {
  if (fitToPage || syncingScroll) return;
  syncingScroll = true;
  applyScrollRatio(editor, scrollRatio(previewPane));
  syncingScroll = false;
});

document.querySelectorAll("[data-insert]").forEach(button => button.addEventListener("click", () => {
  editor.setRangeText(snippets[button.dataset.insert], editor.selectionStart, editor.selectionEnd, "end");
  editor.focus();
  update();
}));

document.querySelector("#reset").addEventListener("click", () => { editor.value = DEFAULT_MARKDOWN; update(); });

let resizingPane = false;
resizer.addEventListener("mousedown", event => {
  resizingPane = true;
  resizer.classList.add("dragging");
  document.body.style.cursor = "col-resize";
  event.preventDefault();
});
window.addEventListener("mousemove", event => {
  if (!resizingPane) return;
  const rect = workspace.getBoundingClientRect();
  editorWidth = event.clientX - rect.left;
  applyEditorWidth();
});
window.addEventListener("mouseup", () => {
  if (!resizingPane) return;
  resizingPane = false;
  resizer.classList.remove("dragging");
  document.body.style.cursor = "";
  localStorage.setItem(EDITOR_WIDTH_KEY, String(editorWidth));
});
editToggle.addEventListener("click", () => {
  if (compactQuery.matches) {
    compactView = compactView === "edit" ? "preview" : "edit";
    applyCompactMode();
    return;
  }
  const isOverlay = workspace.classList.toggle("editor-overlay");
  editorPane.hidden = false;
  resizer.hidden = true;
  editToggle.textContent = isOverlay ? "Aperçu" : "✎ Éditer";
  if (!isOverlay) applyEditorWidth();
});
compactQuery.addEventListener("change", applyCompactMode);
function setOrientationMode(landscape) {
  if (fitToPage === landscape) return;
  fitToPage = landscape;
  modePortraitButton.classList.toggle("active", !landscape);
  modePortraitButton.setAttribute("aria-pressed", String(!landscape));
  modeLandscapeButton.classList.toggle("active", landscape);
  modeLandscapeButton.setAttribute("aria-pressed", String(landscape));
  update();
}
modePortraitButton.classList.add("active");
modePortraitButton.setAttribute("aria-pressed", "true");
modeLandscapeButton.setAttribute("aria-pressed", "false");
modePortraitButton.addEventListener("click", () => setOrientationMode(false));
modeLandscapeButton.addEventListener("click", () => setOrientationMode(true));
function slugify(title) {
  const base = (title ?? "")
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return base || "cours-guitare";
}
document.querySelector("#print").addEventListener("click", async () => {
  if (window.gmsDesktop) {
    const { data } = parseFrontMatter(editor.value);
    const result = await window.gmsDesktop.exportPdf(`${slugify(data.title)}.pdf`);
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

applyCompactMode();
update();

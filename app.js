const statusEl = document.getElementById("status");
const renderedContent = document.getElementById("rendered-content");
const dropZone = document.getElementById("drop-zone");
const matrixPanel = document.getElementById("matrix-panel");
const contextMenu = document.getElementById("context-menu");
const renderKatexBtn = document.getElementById("render-katex");
const removeKatexBtn = document.getElementById("remove-katex");
const tocList = document.getElementById("toc-list");
const highlightColorSelect = document.getElementById("highlight-color");
const showHighlightCodeCheckbox = document.getElementById("show-highlight-code");
const protocolloAddSheetBtn = document.getElementById("protocollo-add-sheet");
const protocolloTab = document.getElementById("protocollo-tab");
const protocolloSheetSelect = document.getElementById("protocollo-sheet-select");
const protocolloFaceEditor = document.getElementById("protocollo-face-editor");
const protocolloEditorMeta = document.getElementById("protocollo-editor-meta");
const protocolloViewer = document.getElementById("protocollo-viewer");
const protocolloVisibilityList = document.getElementById("protocollo-visibility-list");
const protocolloFrontBtn = document.getElementById("protocollo-front");
const protocolloBackBtn = document.getElementById("protocollo-back");
const protocolloFullscreenBtn = document.getElementById("protocollo-fullscreen");
const protocolloWidthInput = document.getElementById("protocollo-width");
const protocolloHeightInput = document.getElementById("protocollo-height");

const HIGHLIGHT_COLOR_MAP = {
  yellow: { latex: "yellow", html: "#fff59d" },
  orange: { latex: "orange", html: "#ffcc80" },
  red: { latex: "red", html: "#ff9e9e" },
  pink: { latex: "magenta", html: "#f8bbd0" },
  purple: { latex: "purple", html: "#d1c4e9" },
  blue: { latex: "blue", html: "#bbdefb" },
  teal: { latex: "teal", html: "#b2dfdb" },
  green: { latex: "green", html: "#c8e6c9" },
  brown: { latex: "brown", html: "#d7ccc8" },
  gray: { latex: "gray", html: "#e0e0e0" },
};

const editor = CodeMirror.fromTextArea(document.getElementById("code"), {
  mode: "markdown",
  lineNumbers: true,
  lineWrapping: true,
  indentUnit: 2,
  tabSize: 2,
  autoCloseBrackets: true,
});

let isSaving = false;
let dragDepth = 0;
let selectedText = "";
let selectionRange = null;
let selectedElement = null;
let suppressLatexAutoGroup = false;
let highlightSyntaxMarks = [];
const MATRIX_DRAFT_COOKIE = "matrix_draft";
const PROTOCOLLO_STORAGE_KEY = "protocollo_sheets_v1";
let protocolloDragState = null;
let protocolloState = {
  sheets: [],
  selectedSheetId: null,
  nextId: 1,
};

function getCookie(name) {
  const key = `${name}=`;
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const cookie = part.trim();
    if (cookie.startsWith(key)) {
      return decodeURIComponent(cookie.slice(key.length));
    }
  }
  return null;
}

function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
}

function defaultMatrixCellValue(row, col) {
  return `${String.fromCharCode(97 + row)}_${col + 1}`;
}

function getMatrixGridFromDom() {
  const table = document.querySelector("#matrix-grid table");
  if (!table) {
    return [];
  }

  return Array.from(table.querySelectorAll("tr")).map((tr) =>
    Array.from(tr.querySelectorAll("input")).map((input) => input.value),
  );
}

function loadMatrixDraft() {
  const raw = getCookie(MATRIX_DRAFT_COOKIE);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch (error) {
    return null;
  }
}

function saveMatrixDraft() {
  const rows = Number(document.getElementById("matrix-rows").value) || 3;
  const cols = Number(document.getElementById("matrix-cols").value) || 3;
  const draft = {
    type: document.getElementById("matrix-type").value,
    rows,
    cols,
    text: document.getElementById("matrix-text").value,
    output: document.getElementById("matrix-output").value,
    grid: getMatrixGridFromDom(),
  };
  setCookie(MATRIX_DRAFT_COOKIE, JSON.stringify(draft), 7);
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSelectedProtocolloSheet() {
  return protocolloState.sheets.find((sheet) => sheet.id === protocolloState.selectedSheetId) || null;
}

function saveProtocolloState() {
  localStorage.setItem(PROTOCOLLO_STORAGE_KEY, JSON.stringify(protocolloState));
}

function loadProtocolloState() {
  try {
    const raw = localStorage.getItem(PROTOCOLLO_STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.sheets)) {
      return;
    }

    protocolloState = {
      sheets: parsed.sheets
        .map((sheet, index) => ({
          id: Number.isFinite(Number(sheet.id)) ? Number(sheet.id) : index + 1,
          name: typeof sheet.name === "string" ? sheet.name : `Foglio ${index + 1}`,
          currentFace: Math.min(4, Math.max(1, Number(sheet.currentFace) || 1)),
          x: Number.isFinite(Number(sheet.x)) ? Number(sheet.x) : 30 + index * 24,
          y: Number.isFinite(Number(sheet.y)) ? Number(sheet.y) : 30 + index * 24,
          z: Number.isFinite(Number(sheet.z)) ? Number(sheet.z) : index + 1,
          width: Number.isFinite(Number(sheet.width)) ? Number(sheet.width) : 290,
          height: Number.isFinite(Number(sheet.height)) ? Number(sheet.height) : 390,
          visible: typeof sheet.visible === "boolean" ? sheet.visible : true,
          faces: Array.from({ length: 4 }, (_, i) => (Array.isArray(sheet.faces) && typeof sheet.faces[i] === "string" ? sheet.faces[i] : "")),
        }))
        .filter((sheet) => sheet.id > 0),
      selectedSheetId: Number.isFinite(Number(parsed.selectedSheetId)) ? Number(parsed.selectedSheetId) : null,
      nextId: Number.isFinite(Number(parsed.nextId)) ? Number(parsed.nextId) : 1,
    };

    if (!protocolloState.sheets.length) {
      protocolloState.selectedSheetId = null;
      protocolloState.nextId = 1;
      return;
    }

    if (!protocolloState.sheets.some((sheet) => sheet.id === protocolloState.selectedSheetId)) {
      protocolloState.selectedSheetId = protocolloState.sheets[0].id;
    }

    const maxId = Math.max(...protocolloState.sheets.map((sheet) => sheet.id));
    protocolloState.nextId = Math.max(protocolloState.nextId, maxId + 1);
  } catch (error) {
    protocolloState = { sheets: [], selectedSheetId: null, nextId: 1 };
  }
}

function createProtocolloSheet() {
  const id = protocolloState.nextId;
  protocolloState.nextId += 1;

  const sheet = {
    id,
    name: `Foglio ${id}`,
    currentFace: 1,
    faces: ["", "", "", ""],
    x: 30 + protocolloState.sheets.length * 24,
    y: 30 + protocolloState.sheets.length * 24,
    z: protocolloState.sheets.length + 1,
    width: 290,
    height: 390,
    visible: true,
  };

  protocolloState.sheets.push(sheet);
  protocolloState.selectedSheetId = sheet.id;
  saveProtocolloState();
  renderProtocolloUi();
}

function setProtocolloFace(face) {
  const sheet = getSelectedProtocolloSheet();
  if (!sheet) {
    return;
  }
  sheet.currentFace = Math.min(4, Math.max(1, face));
  saveProtocolloState();
  renderProtocolloUi();
}

function updateSelectedProtocolloSize() {
  const sheet = getSelectedProtocolloSheet();
  if (!sheet) {
    return;
  }

  const width = Math.max(180, Math.min(1200, Number(protocolloWidthInput.value) || 290));
  const height = Math.max(220, Math.min(1600, Number(protocolloHeightInput.value) || 390));
  sheet.width = width;
  sheet.height = height;
  saveProtocolloState();
  renderProtocolloViewer();
}

function updateSelectedProtocolloFaceText(value) {
  const sheet = getSelectedProtocolloSheet();
  if (!sheet) {
    return;
  }

  sheet.faces[sheet.currentFace - 1] = value;
  saveProtocolloState();
  renderProtocolloViewer();
}

function bringSelectedSheetFront() {
  const sheet = getSelectedProtocolloSheet();
  if (!sheet) {
    return;
  }
  const maxZ = Math.max(...protocolloState.sheets.map((item) => item.z));
  sheet.z = maxZ + 1;
  saveProtocolloState();
  renderProtocolloViewer();
}

function bringSelectedSheetBack() {
  const sheet = getSelectedProtocolloSheet();
  if (!sheet) {
    return;
  }
  const minZ = Math.min(...protocolloState.sheets.map((item) => item.z));
  sheet.z = minZ - 1;
  saveProtocolloState();
  renderProtocolloViewer();
}

function beginProtocolloDrag(event, sheet) {
  const viewerRect = protocolloViewer.getBoundingClientRect();
  protocolloDragState = {
    sheetId: sheet.id,
    offsetX: event.clientX - viewerRect.left - sheet.x,
    offsetY: event.clientY - viewerRect.top - sheet.y,
  };
}

function onProtocolloDrag(event) {
  if (!protocolloDragState) {
    return;
  }

  const sheet = protocolloState.sheets.find((item) => item.id === protocolloDragState.sheetId);
  if (!sheet) {
    return;
  }

  const viewerRect = protocolloViewer.getBoundingClientRect();
  const maxX = Math.max(0, protocolloViewer.scrollWidth - (sheet.width || 290));
  const maxY = Math.max(0, protocolloViewer.scrollHeight - (sheet.height || 390));

  const nextX = Math.round(event.clientX - viewerRect.left - protocolloDragState.offsetX + protocolloViewer.scrollLeft);
  const nextY = Math.round(event.clientY - viewerRect.top - protocolloDragState.offsetY + protocolloViewer.scrollTop);

  sheet.x = Math.min(maxX, Math.max(0, nextX));
  sheet.y = Math.min(maxY, Math.max(0, nextY));
  renderProtocolloViewer();
}

function endProtocolloDrag() {
  if (!protocolloDragState) {
    return;
  }
  protocolloDragState = null;
  saveProtocolloState();
}

function renderProtocolloViewer() {
  if (!protocolloViewer) {
    return;
  }

  protocolloViewer.innerHTML = "";

  const ordered = [...protocolloState.sheets]
    .filter((sheet) => sheet.visible !== false)
    .sort((a, b) => a.z - b.z);
  for (const sheet of ordered) {
    const card = document.createElement("article");
    card.className = "foglio-card";
    if (sheet.id === protocolloState.selectedSheetId) {
      card.classList.add("active");
    }
    card.style.left = `${sheet.x}px`;
    card.style.top = `${sheet.y}px`;
    card.style.zIndex = String(sheet.z);
    card.style.width = `${sheet.width || 290}px`;
    card.style.height = `${sheet.height || 390}px`;
    card.style.setProperty("--foglio-height", `${sheet.height || 390}px`);

    const faceContent = sheet.faces[sheet.currentFace - 1] || "";
    const preview = faceContent.trim() ? buildRenderedHtml(faceContent) : "<em>Empty face</em>";
    card.innerHTML = `
      <div class="foglio-head">${escapeHtml(sheet.name)} · Face ${sheet.currentFace}/4 · z:${sheet.z}</div>
      <div class="foglio-body"><div class="foglio-doc">${preview}</div></div>
    `;

    card.addEventListener("click", () => {
      protocolloState.selectedSheetId = sheet.id;
      saveProtocolloState();
      renderProtocolloUi();
    });

    card.addEventListener("mousedown", (event) => {
      if (event.button !== 0) {
        return;
      }
      protocolloState.selectedSheetId = sheet.id;
      beginProtocolloDrag(event, sheet);
      saveProtocolloState();
      renderProtocolloUi();
      event.preventDefault();
    });

    protocolloViewer.appendChild(card);
  }
}

function renderProtocolloVisibilityList() {
  if (!protocolloVisibilityList) {
    return;
  }

  protocolloVisibilityList.innerHTML = "";

  if (!protocolloState.sheets.length) {
    const empty = document.createElement("li");
    empty.className = "toc-empty";
    empty.textContent = "No fogli created";
    protocolloVisibilityList.appendChild(empty);
    return;
  }

  for (const sheet of protocolloState.sheets) {
    const item = document.createElement("li");
    item.className = "protocollo-visibility-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = sheet.visible !== false;
    checkbox.addEventListener("change", () => {
      sheet.visible = checkbox.checked;
      saveProtocolloState();
      renderProtocolloViewer();
    });

    const label = document.createElement("span");
    label.textContent = `${sheet.name} (Face ${sheet.currentFace}/4)`;

    item.appendChild(checkbox);
    item.appendChild(label);
    protocolloVisibilityList.appendChild(item);
  }
}

function syncProtocolloEditorPanel() {
  if (!protocolloFaceEditor || !protocolloEditorMeta) {
    return;
  }

  const sheet = getSelectedProtocolloSheet();
  if (!sheet) {
    protocolloEditorMeta.textContent = "No foglio selected";
    protocolloFaceEditor.value = "";
    protocolloFaceEditor.disabled = true;
    return;
  }

  protocolloEditorMeta.textContent = `${sheet.name} - Face ${sheet.currentFace}/4`;
  protocolloFaceEditor.disabled = false;
  protocolloFaceEditor.value = sheet.faces[sheet.currentFace - 1] || "";
}

function renderProtocolloUi() {
  if (!protocolloSheetSelect) {
    return;
  }

  protocolloSheetSelect.innerHTML = "";
  for (const sheet of protocolloState.sheets) {
    const option = document.createElement("option");
    option.value = String(sheet.id);
    option.textContent = sheet.name;
    protocolloSheetSelect.appendChild(option);
  }

  const selected = getSelectedProtocolloSheet();
  protocolloSheetSelect.disabled = !selected;
  protocolloFrontBtn.disabled = !selected;
  protocolloBackBtn.disabled = !selected;
  protocolloWidthInput.disabled = !selected;
  protocolloHeightInput.disabled = !selected;

  document.querySelectorAll(".protocollo-face-btn").forEach((button) => {
    const face = Number(button.getAttribute("data-face"));
    button.classList.toggle("active", Boolean(selected && selected.currentFace === face));
    button.disabled = !selected;
  });

  if (!selected) {
    protocolloWidthInput.value = "290";
    protocolloHeightInput.value = "390";
  } else {
    protocolloSheetSelect.value = String(selected.id);
    protocolloWidthInput.value = String(selected.width || 290);
    protocolloHeightInput.value = String(selected.height || 390);
  }

  syncProtocolloEditorPanel();
  renderProtocolloVisibilityList();
  renderProtocolloViewer();
}

function setupProtocolloFeature() {
  if (!protocolloAddSheetBtn) {
    return;
  }

  protocolloAddSheetBtn.addEventListener("click", () => {
    createProtocolloSheet();
    setStatus("New foglio created");
  });

  protocolloSheetSelect.addEventListener("change", () => {
    const id = Number(protocolloSheetSelect.value);
    if (!Number.isFinite(id)) {
      return;
    }
    protocolloState.selectedSheetId = id;
    saveProtocolloState();
    renderProtocolloUi();
  });

  document.querySelectorAll(".protocollo-face-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const face = Number(button.getAttribute("data-face"));
      setProtocolloFace(face);
    });
  });

  protocolloWidthInput.addEventListener("change", updateSelectedProtocolloSize);
  protocolloHeightInput.addEventListener("change", updateSelectedProtocolloSize);
  protocolloWidthInput.addEventListener("input", updateSelectedProtocolloSize);
  protocolloHeightInput.addEventListener("input", updateSelectedProtocolloSize);
  protocolloFaceEditor?.addEventListener("input", () => {
    updateSelectedProtocolloFaceText(protocolloFaceEditor.value);
  });

  protocolloFrontBtn.addEventListener("click", bringSelectedSheetFront);
  protocolloBackBtn.addEventListener("click", bringSelectedSheetBack);

  const updateFullscreenButton = () => {
    if (!protocolloFullscreenBtn) {
      return;
    }
    protocolloFullscreenBtn.textContent = document.fullscreenElement === protocolloTab ? "Exit Full Screen" : "Full Screen";
  };

  protocolloFullscreenBtn?.addEventListener("click", async () => {
    if (document.fullscreenElement === protocolloTab) {
      await document.exitFullscreen();
      return;
    }
    if (protocolloTab?.requestFullscreen) {
      await protocolloTab.requestFullscreen();
    }
  });

  document.addEventListener("fullscreenchange", updateFullscreenButton);
  updateFullscreenButton();

  document.addEventListener("mousemove", onProtocolloDrag);
  document.addEventListener("mouseup", endProtocolloDrag);
  document.addEventListener("mouseleave", endProtocolloDrag);

  loadProtocolloState();
  renderProtocolloUi();
}

function buildRenderedHtml(sourceText) {
  let processedContent = sourceText;
  const mathBlocks = [];
  let mathIndex = 0;

  processedContent = processedContent.replace(
    /\$(\s*\\begin\{(?:matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix)\}[\s\S]*?\\end\{(?:matrix|pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix)\}\s*)\$/g,
    (match, latex) => {
      const placeholder = `MATHBLOCK${mathIndex}DISPLAY`;
      mathBlocks[mathIndex] = { type: "display", latex, placeholder };
      mathIndex += 1;
      return placeholder;
    },
  );

  processedContent = processedContent.replace(/\\\[([\s\S]*?)\\\]/g, (match, latex) => {
    const placeholder = `MATHBLOCK${mathIndex}DISPLAY`;
    mathBlocks[mathIndex] = { type: "display", latex, placeholder };
    mathIndex += 1;
    return placeholder;
  });

  processedContent = processedContent.replace(/\$\$([\s\S]*?)\$\$/g, (match, latex) => {
    const placeholder = `MATHBLOCK${mathIndex}DISPLAY`;
    mathBlocks[mathIndex] = { type: "display", latex, placeholder };
    mathIndex += 1;
    return placeholder;
  });

  processedContent = processedContent.replace(/\\\(([\s\S]*?)\\\)/g, (match, latex) => {
    const placeholder = `MATHBLOCK${mathIndex}INLINE`;
    mathBlocks[mathIndex] = { type: "inline", latex, placeholder };
    mathIndex += 1;
    return placeholder;
  });

  processedContent = processedContent.replace(/\$([^$\n]+?)\$/g, (match, latex) => {
    const placeholder = `MATHBLOCK${mathIndex}INLINE`;
    mathBlocks[mathIndex] = { type: "inline", latex, placeholder };
    mathIndex += 1;
    return placeholder;
  });

  let htmlContent = marked.parse(processedContent, { gfm: true, breaks: false });

  mathBlocks.forEach((block) => {
    if (!block) {
      return;
    }
    try {
      const rendered = katex.renderToString(block.latex, {
        displayMode: block.type === "display",
        throwOnError: false,
        errorColor: "#cc0000",
        strict: false,
        trust: false,
        macros: {
          "\\RR": "\\mathbb{R}",
          "\\NN": "\\mathbb{N}",
          "\\ZZ": "\\mathbb{Z}",
          "\\QQ": "\\mathbb{Q}",
        },
      });
      htmlContent = htmlContent.replace(block.placeholder, rendered);
    } catch (error) {
      htmlContent = htmlContent.replace(block.placeholder, block.latex);
    }
  });

  return htmlContent;
}

function countUnescapedMatches(text, pattern) {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

function isInLatexContext(cm, pos) {
  const full = cm.getValue();
  const cursorIndex = cm.indexFromPos(pos);
  const head = full.slice(0, cursorIndex);

  const escapedInlineOpen = countUnescapedMatches(head, /\\\(/g);
  const escapedInlineClose = countUnescapedMatches(head, /\\\)/g);
  if (escapedInlineOpen > escapedInlineClose) {
    return true;
  }

  const escapedDisplayOpen = countUnescapedMatches(head, /\\\[/g);
  const escapedDisplayClose = countUnescapedMatches(head, /\\\]/g);
  if (escapedDisplayOpen > escapedDisplayClose) {
    return true;
  }

  let unescapedDollarCount = 0;
  for (let i = 0; i < head.length; i += 1) {
    if (head[i] !== "$") {
      continue;
    }

    let slashCount = 0;
    for (let j = i - 1; j >= 0 && head[j] === "\\"; j -= 1) {
      slashCount += 1;
    }
    if (slashCount % 2 === 1) {
      continue;
    }

    unescapedDollarCount += 1;
  }

  return unescapedDollarCount % 2 === 1;
}

function setupLatexAutoGroups() {
  editor.on("inputRead", (cm, change) => {
    if (suppressLatexAutoGroup) {
      return;
    }
    if (!change || change.origin !== "+input") {
      return;
    }
    if (!change.text || change.text.length !== 1 || change.text[0].length !== 1) {
      return;
    }

    const typed = change.text[0];
    if (typed !== "_" && typed !== "^" && typed !== "c") {
      return;
    }

    const doc = cm.getDoc();
    const cursor = doc.getCursor();

    // Auto-expand \frac into \frac{}{} and place cursor in first group.
    if (typed === "c") {
      const fracStart = { line: cursor.line, ch: Math.max(0, cursor.ch - 5) };
      const fracToken = doc.getRange(fracStart, cursor);
      if (fracToken === "\\frac" && isInLatexContext(cm, fracStart)) {
        const afterCursor = doc.getRange(cursor, { line: cursor.line, ch: cursor.ch + 1 });
        if (afterCursor !== "{") {
          suppressLatexAutoGroup = true;
          doc.replaceRange("{}{}", cursor);
          doc.setCursor({ line: cursor.line, ch: cursor.ch + 1 });
          suppressLatexAutoGroup = false;
        }
      }
      return;
    }

    const beforeCursor = doc.getRange({ line: cursor.line, ch: cursor.ch - 1 }, cursor);
    if (beforeCursor !== typed) {
      return;
    }

    if (!isInLatexContext(cm, { line: cursor.line, ch: cursor.ch - 1 })) {
      return;
    }

    const afterCursor = doc.getRange(cursor, { line: cursor.line, ch: cursor.ch + 1 });
    if (afterCursor === "{") {
      return;
    }

    suppressLatexAutoGroup = true;
    doc.replaceRange("{}", cursor);
    doc.setCursor({ line: cursor.line, ch: cursor.ch + 1 });
    suppressLatexAutoGroup = false;
  });
}

function setStatus(message) {
  statusEl.textContent = message;
}

function findMatchingBrace(text, openIndex) {
  if (openIndex < 0 || text[openIndex] !== "{") {
    return -1;
  }

  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    if (text[i] === "{") {
      depth += 1;
    } else if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        return i;
      }
    }
  }

  return -1;
}

function clearHighlightSyntaxMasks() {
  highlightSyntaxMarks.forEach((mark) => mark.clear());
  highlightSyntaxMarks = [];
}

function addCollapsedMask(fromIndex, toIndex) {
  if (toIndex <= fromIndex) {
    return;
  }

  const doc = editor.getDoc();
  const from = doc.posFromIndex(fromIndex);
  const to = doc.posFromIndex(toIndex);
  const mark = doc.markText(from, to, {
    collapsed: true,
    clearOnEnter: false,
  });
  highlightSyntaxMarks.push(mark);
}

function addStyledMask(fromIndex, toIndex, className) {
  if (toIndex <= fromIndex) {
    return;
  }

  const doc = editor.getDoc();
  const from = doc.posFromIndex(fromIndex);
  const to = doc.posFromIndex(toIndex);
  const mark = doc.markText(from, to, {
    className,
    clearOnEnter: false,
  });
  highlightSyntaxMarks.push(mark);
}

function applyHighlightSyntaxMasks() {
  clearHighlightSyntaxMasks();

  const doc = editor.getDoc();
  const text = doc.getValue();

  const showHighlightCode = Boolean(showHighlightCodeCheckbox?.checked);

  if (!showHighlightCode) {
    const markOpenRegex = /<mark style="background-color:[^"]*;">/g;
    for (const match of text.matchAll(markOpenRegex)) {
      addCollapsedMask(match.index, match.index + match[0].length);
    }

    const markCloseRegex = /<\/mark>/g;
    for (const match of text.matchAll(markCloseRegex)) {
      addCollapsedMask(match.index, match.index + match[0].length);
    }
  }

  let searchFrom = 0;
  while (searchFrom < text.length) {
    const start = text.indexOf("\\textcolor", searchFrom);
    if (start < 0) {
      break;
    }

    const colorOpen = start + "\\textcolor".length;
    const colorClose = findMatchingBrace(text, colorOpen);
    if (colorClose < 0) {
      searchFrom = start + 1;
      continue;
    }

    const contentOpen = colorClose + 1;
    if (text[contentOpen] !== "{") {
      searchFrom = start + 1;
      continue;
    }

    const contentClose = findMatchingBrace(text, contentOpen);
    if (contentClose < 0) {
      searchFrom = start + 1;
      continue;
    }

    if (showHighlightCode) {
      addStyledMask(start, contentOpen + 1, "latex-highlight-code");
      addStyledMask(contentClose, contentClose + 1, "latex-highlight-code");
    } else {
      addCollapsedMask(start, contentOpen + 1);
      addCollapsedMask(contentClose, contentClose + 1);
    }
    searchFrom = contentClose + 1;
  }
}

function highlightSelectionInEditor() {
  const doc = editor.getDoc();
  const selectedColorKey = highlightColorSelect?.value || "yellow";
  const selectedColor = HIGHLIGHT_COLOR_MAP[selectedColorKey] || HIGHLIGHT_COLOR_MAP.yellow;
  const selections = doc.listSelections();
  const ranges = selections
    .filter((sel) => !sel.empty())
    .map((sel) => ({ from: sel.from(), to: sel.to() }))
    .sort((a, b) => {
      if (a.from.line !== b.from.line) {
        return b.from.line - a.from.line;
      }
      return b.from.ch - a.from.ch;
    });

  if (!ranges.length) {
    setStatus("Select text to highlight first");
    return;
  }

  ranges.forEach((range) => {
    const selectedText = doc.getRange(range.from, range.to);
    const inLatex = isInLatexContext(editor, range.from);
    const replacement = inLatex
      ? `\\textcolor{${selectedColor.latex}}{${selectedText}}`
      : `<mark style="background-color:${selectedColor.html};">${selectedText}</mark>`;
    doc.replaceRange(replacement, range.from, range.to);
  });

  applyHighlightSyntaxMasks();
  renderMarkdown();
  setStatus("Selection highlighted");
}

function renderMarkdown() {
  const prevScrollTop = renderedContent.scrollTop;
  const prevScrollHeight = renderedContent.scrollHeight;

  const raw = editor.getValue();
  const htmlContent = buildRenderedHtml(raw);

  renderedContent.innerHTML = htmlContent;
  generateToc();

  const newScrollHeight = renderedContent.scrollHeight;
  if (prevScrollHeight > 0 && newScrollHeight > 0) {
    const scrollRatio = prevScrollTop / prevScrollHeight;
    renderedContent.scrollTop = scrollRatio * newScrollHeight;
  }
}

function generateToc() {
  const headings = renderedContent.querySelectorAll("h1, h2, h3");

  if (!headings.length) {
    tocList.innerHTML = '<li class="toc-empty">No sections found</li>';
    return;
  }

  tocList.innerHTML = "";
  headings.forEach((heading, index) => {
    const id = `section-${index}`;
    heading.id = id;

    const li = document.createElement("li");
    li.className = `toc-item toc-${heading.tagName.toLowerCase()}`;
    li.textContent = heading.textContent;
    li.title = heading.textContent;
    li.addEventListener("click", () => {
      heading.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    tocList.appendChild(li);
  });
}

function hideContextMenu() {
  contextMenu.classList.add("hidden");
}

function setupLatexContextMenu() {
  renderedContent.addEventListener("mouseup", (event) => {
    const selection = window.getSelection();
    selectedText = selection ? selection.toString().trim() : "";

    if (!selectedText || !selection || selection.rangeCount === 0) {
      hideContextMenu();
      return;
    }

    selectionRange = selection.getRangeAt(0);
    selectedElement = selection.anchorNode?.parentElement || null;

    contextMenu.style.left = `${event.clientX}px`;
    contextMenu.style.top = `${event.clientY + 8}px`;
    contextMenu.classList.remove("hidden");
  });

  document.addEventListener("mousedown", (event) => {
    if (!contextMenu.contains(event.target)) {
      hideContextMenu();
    }
  });

  renderKatexBtn.addEventListener("click", () => {
    if (!selectedText || !selectionRange) {
      return;
    }

    try {
      const wrapper = document.createElement("span");
      wrapper.style.display = "inline-block";
      wrapper.style.padding = "2px 4px";
      wrapper.style.margin = "0 2px";
      wrapper.style.background = "rgba(15, 123, 108, 0.06)";
      wrapper.style.borderRadius = "4px";
      wrapper.setAttribute("data-original-latex", selectedText);
      wrapper.classList.add("manual-katex-render");

      katex.render(selectedText, wrapper, {
        displayMode: false,
        throwOnError: true,
        errorColor: "#cc0000",
        strict: false,
        trust: false,
      });

      selectionRange.deleteContents();
      selectionRange.insertNode(wrapper);
      setStatus("Rendered as KaTeX");
    } catch (error) {
      try {
        const wrapper = document.createElement("div");
        wrapper.style.margin = "1em 0";
        wrapper.style.padding = "8px";
        wrapper.style.background = "rgba(15, 123, 108, 0.06)";
        wrapper.style.borderRadius = "6px";
        wrapper.setAttribute("data-original-latex", selectedText);
        wrapper.classList.add("manual-katex-render");

        katex.render(selectedText, wrapper, {
          displayMode: true,
          throwOnError: true,
          errorColor: "#cc0000",
          strict: false,
          trust: false,
        });

        selectionRange.deleteContents();
        selectionRange.insertNode(wrapper);
        setStatus("Rendered as KaTeX (display)");
      } catch (innerError) {
        setStatus("Invalid LaTeX syntax");
      }
    }

    hideContextMenu();
    window.getSelection()?.removeAllRanges();
  });

  removeKatexBtn.addEventListener("click", () => {
    if (!selectedElement) {
      return;
    }

    const katexContainer = selectedElement.closest(".manual-katex-render");
    if (!katexContainer || !katexContainer.parentNode) {
      setStatus("No manual KaTeX render found");
      hideContextMenu();
      return;
    }

    const originalLatex = katexContainer.getAttribute("data-original-latex") || katexContainer.textContent || selectedText;
    const textNode = document.createTextNode(originalLatex);
    katexContainer.parentNode.replaceChild(textNode, katexContainer);
    setStatus("KaTeX rendering removed");
    hideContextMenu();
    window.getSelection()?.removeAllRanges();
  });
}

async function loadNote() {
  const response = await fetch("/api/note");
  if (!response.ok) {
    throw new Error("Unable to load note");
  }
  const payload = await response.json();
  editor.setValue(payload.content || "");
  renderMarkdown();
  setStatus("Note loaded");
}

async function saveNote() {
  if (isSaving) {
    return;
  }
  isSaving = true;
  setStatus("Saving...");

  try {
    const response = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editor.getValue() }),
    });

    if (!response.ok) {
      throw new Error("Save failed");
    }

    const payload = await response.json();
    const stamp = new Date(payload.savedAt).toLocaleTimeString();
    setStatus(`Saved at ${stamp}`);
  } catch (error) {
    setStatus(`Save error: ${error.message}`);
  } finally {
    isSaving = false;
  }
}

function insertAtCursor(text) {
  const doc = editor.getDoc();
  const cursor = doc.getCursor();
  doc.replaceRange(text, cursor);
  editor.focus();
  renderMarkdown();
}

function ensureImageDragVisual(active) {
  dropZone.classList.toggle("hidden", !active);
}

async function uploadImage(file) {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch("/api/upload-image", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Image upload failed");
  }

  return response.json();
}

async function exportPdf() {
  renderMarkdown();

  const printableHtml = renderedContent.innerHTML;
  const safeContent = JSON.stringify(printableHtml).replace(/<\/script/gi, "<\\/script");
  const today = new Date().toLocaleString();

  const printDocument = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Print Preview</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
    <style>
      :root {
        --paper-width: 210mm;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: #eef1f6;
        color: #1a1f2c;
        font-family: "Avenir Next", "Segoe UI", sans-serif;
      }

      .print-toolbar {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        gap: 10px;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        background: #ffffff;
        border-bottom: 1px solid #d9deea;
      }

      .print-toolbar button {
        border: 0;
        border-radius: 8px;
        background: #0f7b6c;
        color: #fff;
        padding: 8px 12px;
        cursor: pointer;
      }

      .page {
        width: min(var(--paper-width), 100%);
        margin: 18px auto;
        background: #fff;
        padding: 18mm 16mm;
        box-shadow: 0 6px 24px rgba(20, 27, 45, 0.08);
        line-height: 1.6;
      }

      .page img {
        max-width: 100%;
      }

      .katex-display {
        overflow-x: auto;
        overflow-y: hidden;
      }

      h1, h2, h3, h4, h5, h6,
      p, li, blockquote, pre, table, figure {
        break-inside: avoid;
        page-break-inside: avoid;
      }

      p, li {
        orphans: 3;
        widows: 3;
      }

      @media print {
        @page {
          size: A4;
          margin: 12mm;
        }

        body {
          background: #fff;
        }

        .print-toolbar {
          display: none;
        }

        .page {
          width: auto;
          margin: 0;
          padding: 0;
          box-shadow: none;
        }
      }
    </style>
  </head>
  <body>
    <div class="print-toolbar">
      <div>Print Preview - ${today}</div>
      <button onclick="window.print()">Print / Save as PDF</button>
    </div>
    <main class="page" id="print-content"></main>
    <script>
      const html = ${safeContent};
      document.getElementById("print-content").innerHTML = html;
    </script>
  </body>
</html>`;

  const blob = new Blob([printDocument], { type: "text/html" });
  const blobUrl = URL.createObjectURL(blob);
  const printWindow = window.open(blobUrl, "_blank");

  if (!printWindow) {
    URL.revokeObjectURL(blobUrl);
    setStatus("Popup blocked. Allow popups to open print preview.");
    return;
  }

  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  setStatus("Print preview opened in a new tab");
}

function normalizeMatrixCellValue(value) {
  let raw = value.trim();
  if (raw === "") {
    return "0";
  }

  let negative = false;
  if (raw.startsWith("-")) {
    negative = true;
    raw = raw.slice(1);
  }

  if (raw.includes("/")) {
    const parts = raw.split("/");
    if (parts.length === 2 && parts[0] && parts[1]) {
      raw = `\\frac{${parts[0]}}{${parts[1]}}`;
    }
  }

  return `${negative ? "-" : ""}${raw}`;
}

function buildMatrixLatex(rows) {
  const matrixType = document.getElementById("matrix-type").value;
  let latex = `\\[\n\\begin{${matrixType}}\n`;

  rows.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      latex += normalizeMatrixCellValue(cell);
      if (colIndex < row.length - 1) {
        latex += " & ";
      }
    });
    latex += rowIndex === rows.length - 1 ? " \n" : " \\\\\n";
  });

  latex += `\\end{${matrixType}}\n\\]`;
  return latex;
}

function regenerateMatrixGrid() {
  const rows = Number(document.getElementById("matrix-rows").value);
  const cols = Number(document.getElementById("matrix-cols").value);
  const host = document.getElementById("matrix-grid");
  const table = document.createElement("table");
  const currentGrid = getMatrixGridFromDom();
  const draft = loadMatrixDraft();
  const draftGrid = draft?.grid || [];

  host.innerHTML = "";

  for (let i = 0; i < rows; i += 1) {
    const tr = document.createElement("tr");
    for (let j = 0; j < cols; j += 1) {
      const td = document.createElement("td");
      const input = document.createElement("input");
      input.type = "text";
      input.value = currentGrid[i]?.[j] ?? draftGrid[i]?.[j] ?? defaultMatrixCellValue(i, j);
      input.addEventListener("input", saveMatrixDraft);
      td.appendChild(input);
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }

  host.appendChild(table);
  saveMatrixDraft();
}

function generateFromGrid() {
  const table = document.querySelector("#matrix-grid table");
  if (!table) {
    return;
  }

  const rows = Array.from(table.querySelectorAll("tr")).map((tr) =>
    Array.from(tr.querySelectorAll("input")).map((input) => input.value),
  );

  document.getElementById("matrix-output").value = buildMatrixLatex(rows);
  saveMatrixDraft();
}

function generateFromText() {
  const text = document.getElementById("matrix-text").value;
  const rows = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split("\t"));

  if (rows.length === 0) {
    setStatus("Matrix text input is empty");
    return;
  }

  document.getElementById("matrix-output").value = buildMatrixLatex(rows);
  saveMatrixDraft();
}

function setupImageDrop() {
  const wrapper = editor.getWrapperElement();

  wrapper.addEventListener("dragenter", (event) => {
    event.preventDefault();
    dragDepth += 1;
    ensureImageDragVisual(true);
  });

  wrapper.addEventListener("dragover", (event) => {
    event.preventDefault();
  });

  wrapper.addEventListener("dragleave", (event) => {
    event.preventDefault();
    dragDepth -= 1;
    if (dragDepth <= 0) {
      dragDepth = 0;
      ensureImageDragVisual(false);
    }
  });

  wrapper.addEventListener("drop", async (event) => {
    event.preventDefault();
    dragDepth = 0;
    ensureImageDragVisual(false);

    const files = Array.from(event.dataTransfer?.files || []);
    if (files.length === 0) {
      return;
    }

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setStatus(`Skipped non-image file: ${file.name}`);
        continue;
      }

      try {
        setStatus(`Uploading ${file.name}...`);
        const payload = await uploadImage(file);
        const markdownImage = `\n![${payload.originalName}](${payload.url})\n`;
        insertAtCursor(markdownImage);
        setStatus(`Uploaded ${payload.originalName}`);
      } catch (error) {
        setStatus(`Upload failed: ${error.message}`);
      }
    }
  });
}

function setupEvents() {
  editor.on("change", () => {
    applyHighlightSyntaxMasks();
    renderMarkdown();
  });

  document.getElementById("save-now").addEventListener("click", saveNote);
  document.getElementById("export-pdf").addEventListener("click", exportPdf);
  document.getElementById("search-editor").addEventListener("click", () => editor.execCommand("find"));
  document.getElementById("highlight-selection").addEventListener("click", highlightSelectionInEditor);
  showHighlightCodeCheckbox?.addEventListener("change", () => {
    applyHighlightSyntaxMasks();
  });

  editor.addKeyMap({
    "Cmd-Shift-H": highlightSelectionInEditor,
    "Ctrl-Shift-H": highlightSelectionInEditor,
  });

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      document.getElementById("save-now").click();
    }
  });

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      const pane = button.closest(".pane");
      if (!pane) {
        return;
      }

      const tabId = button.getAttribute("data-tab");
      pane.querySelectorAll(".tab-button").forEach((tabBtn) => tabBtn.classList.remove("active"));
      button.classList.add("active");

      pane.querySelectorAll(".tab-content").forEach((tabContent) => tabContent.classList.remove("active"));
      const targetTab = pane.querySelector(`#${tabId}`);
      if (targetTab) {
        targetTab.classList.add("active");
      }

      if (tabId === "edit-tab") {
        editor.refresh();
      }
    });
  });

  document.getElementById("toggle-matrix").addEventListener("click", () => {
    matrixPanel.classList.toggle("hidden");
  });

  document.getElementById("matrix-generate-table").addEventListener("click", regenerateMatrixGrid);
  document.getElementById("matrix-from-table").addEventListener("click", generateFromGrid);
  document.getElementById("matrix-from-text").addEventListener("click", generateFromText);

  document.getElementById("matrix-insert").addEventListener("click", () => {
    const latex = document.getElementById("matrix-output").value.trim();
    if (!latex) {
      setStatus("Generate matrix LaTeX before inserting");
      return;
    }
    insertAtCursor(`\n${latex}\n`);
    deleteCookie(MATRIX_DRAFT_COOKIE);
  });

  document.getElementById("matrix-rows").addEventListener("change", regenerateMatrixGrid);
  document.getElementById("matrix-cols").addEventListener("change", regenerateMatrixGrid);
  document.getElementById("matrix-type").addEventListener("change", saveMatrixDraft);

  const matrixText = document.getElementById("matrix-text");
  matrixText.addEventListener("input", saveMatrixDraft);
  matrixText.addEventListener("keyup", (event) => {
    if (event.key === "Enter") {
      generateFromText();
    }
  });
  matrixText.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      event.preventDefault();
      const start = matrixText.selectionStart;
      const end = matrixText.selectionEnd;
      const value = matrixText.value;
      matrixText.value = `${value.slice(0, start)}\t${value.slice(end)}`;
      matrixText.selectionStart = matrixText.selectionEnd = start + 1;
    }
  });

  window.addEventListener("beforeunload", () => {
    navigator.sendBeacon(
      "/api/save",
      new Blob([JSON.stringify({ content: editor.getValue() })], {
        type: "application/json",
      }),
    );
  });

  setupImageDrop();
  setupLatexContextMenu();
  setupLatexAutoGroups();
  setupProtocolloFeature();
}

async function boot() {
  try {
    setupEvents();

    const draft = loadMatrixDraft();
    if (draft) {
      if (draft.type) {
        document.getElementById("matrix-type").value = draft.type;
      }
      if (Number.isFinite(Number(draft.rows))) {
        document.getElementById("matrix-rows").value = String(Math.max(1, Number(draft.rows)));
      }
      if (Number.isFinite(Number(draft.cols))) {
        document.getElementById("matrix-cols").value = String(Math.max(1, Number(draft.cols)));
      }
      if (typeof draft.text === "string") {
        document.getElementById("matrix-text").value = draft.text;
      }
      if (typeof draft.output === "string") {
        document.getElementById("matrix-output").value = draft.output;
      }
    }

    regenerateMatrixGrid();
    await loadNote();
    applyHighlightSyntaxMasks();
    setInterval(saveNote, 30000);
  } catch (error) {
    setStatus(`Startup failed: ${error.message}`);
  }
}

boot();

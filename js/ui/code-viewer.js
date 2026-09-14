// Clarity Professional AI Code Experience
// Clean Interactive Code Cells and Full-Featured Code Workspace

window.Clarity = window.Clarity || {};

(function () {
  // In-memory registry for exact raw code snippets across messages and cells
  const codeRegistry = new Map();
  let activeWorkspaceState = null;
  let workspaceElement = null;
  let isEventsInitialized = false;

  // SVG Icons
  const ICONS = {
    copy: '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    check: '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
    download: '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    expand: '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    minimize: '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="10" y1="14" x2="3" y2="21"/></svg>',
    wrap: '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><path d="M3 12h15a3 3 0 0 1 0 6h-4"/><polyline points="16 16 14 18 16 20"/><line x1="3" y1="18" x2="9" y2="18"/></svg>',
    close: '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    file: '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  };

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getHighlighter() {
    return window.Clarity.highlighter || {
      getLanguageInfo: (l) => ({ id: l || "text", name: (l || "TEXT").toUpperCase(), ext: ".txt", mime: "text/plain" }),
      detectFilename: (l) => `file_${Date.now()}.txt`,
      renderLineNumberedHtml: (code) => escapeHtml(code),
      highlightCode: (code) => escapeHtml(code),
    };
  }

  // Register or update snippet in memory
  function registerSnippet(cellId, data) {
    if (!cellId) return;
    codeRegistry.set(cellId, {
      id: cellId,
      code: typeof data.code === "string" ? data.code : "",
      lang: data.lang || "plaintext",
      filename: data.filename || "file.txt",
      precedingText: data.precedingText || "",
      files: data.files || null,
      activeFileIndex: data.activeFileIndex || 0,
    });
  }

  function extractSnippetFromDom(cellEl) {
    if (!cellEl) return null;
    const cellId = cellEl.getAttribute("data-cell-id") || cellEl.id || ("codecell_" + Math.random().toString(36).substring(2, 9));

    // 1. Raw code from hidden textarea
    let rawCode = "";
    const rawTextarea = cellEl.querySelector(".code-cell__raw");
    if (rawTextarea && typeof rawTextarea.value === "string") {
      rawCode = rawTextarea.value;
    } else if (cellEl._rawCode) {
      rawCode = cellEl._rawCode;
    } else {
      // 2. Extract code from lines in DOM
      const lineEls = cellEl.querySelectorAll(".code-line__code");
      if (lineEls && lineEls.length > 0) {
        rawCode = Array.from(lineEls).map((el) => el.textContent).join("\n");
      } else {
        const codeEl = cellEl.querySelector("code, pre");
        if (codeEl) rawCode = codeEl.textContent;
      }
    }

    const lang = cellEl.getAttribute("data-lang") ||
      cellEl.querySelector(".code-cell__badge")?.textContent?.trim().toLowerCase() ||
      "plaintext";

    const filename = cellEl.getAttribute("data-filename") ||
      cellEl.querySelector(".code-cell__filename")?.textContent?.trim() ||
      `snippet.${lang === "python" ? "py" : (lang === "javascript" ? "js" : "txt")}`;

    const snippet = {
      id: cellId,
      code: rawCode,
      lang: lang,
      filename: filename,
      precedingText: "",
      files: null,
      activeFileIndex: 0,
    };

    if (cellId) {
      codeRegistry.set(cellId, snippet);
    }
    return snippet;
  }

  function getSnippet(cellId, fallbackEl = null) {
    if (cellId && codeRegistry.has(cellId)) {
      const s = codeRegistry.get(cellId);
      if (s && typeof s.code === "string") return s;
    }

    // DOM Fallback
    const cellEl = fallbackEl
      ? (fallbackEl.closest(".code-cell") || fallbackEl)
      : (cellId ? (document.getElementById(cellId) || document.querySelector(`[data-cell-id="${cellId}"]`)) : null);

    if (cellEl) {
      return extractSnippetFromDom(cellEl);
    }

    return null;
  }

  // Download pure source code file
  function downloadCode(filename, code, lang) {
    const highlighter = getHighlighter();
    const langInfo = highlighter.getLanguageInfo(lang || filename);
    const cleanFilename = filename || `code${langInfo.ext || ".txt"}`;
    const mime = langInfo.mime || "text/plain";

    try {
      const blob = new Blob([code || ""], { type: `${mime};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = cleanFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      if (window.Clarity.toast) {
        window.Clarity.toast.show(`Downloaded ${cleanFilename}`, "success");
      }
    } catch (err) {
      console.error("Failed to download code file", err);
      if (window.Clarity.toast) {
        window.Clarity.toast.show("Download failed", "error");
      }
    }
  }

  // Pure source code clipboard copy
  async function copyCode(rawCode, btnEl = null) {
    const code = String(rawCode || "");
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const ta = document.createElement("textarea");
        ta.value = code;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
    } catch (err) {
      console.error("Failed to copy code", err);
    }

    if (btnEl) {
      btnEl.classList.add("code-cell__btn--copied");
      const origHtml = btnEl.innerHTML;
      btnEl.innerHTML = `${ICONS.check}<span>Copied ✓</span>`;
      setTimeout(() => {
        btnEl.classList.remove("code-cell__btn--copied");
        btnEl.innerHTML = origHtml;
      }, 2000);
    }

    if (window.Clarity.toast) {
      window.Clarity.toast.show("Code copied to clipboard", "success");
    }
  }

  // Render the interactive code cell for markdown (Clean view, no preview)
  function renderCell(options) {
    const {
      cellId = "cell_" + Math.random().toString(36).substring(2, 9),
      code = "",
      lang = "",
      filename = "",
      precedingText = "",
      isStreaming = false,
      files = null,
      activeFileIndex = 0,
    } = options;

    const highlighter = getHighlighter();
    const detectedFilename = filename || highlighter.detectFilename(lang, code, precedingText);
    const langInfo = highlighter.getLanguageInfo(lang || detectedFilename);

    // Save to in-memory store
    registerSnippet(cellId, {
      code,
      lang: langInfo.id,
      filename: detectedFilename,
      precedingText,
      files,
      activeFileIndex,
    });

    const linesCount = code ? code.split(/\r?\n/).length : 1;

    // Highlighting lines
    const lineNumberedHtml = highlighter.renderLineNumberedHtml(code, langInfo.id || langInfo.prism);

    // Multiple file tabs if present
    let tabsHtml = "";
    if (files && files.length > 1) {
      tabsHtml = `<div class="code-cell__tabs" role="tablist">` +
        files.map((f, i) => {
          const isActive = i === activeFileIndex;
          return `<button class="code-tab ${isActive ? "is-active" : ""}" type="button" role="tab" data-code-action="tab" data-cell-id="${cellId}" data-file-index="${i}">${ICONS.file}<span>${escapeHtml(f.name)}</span></button>`;
        }).join("") +
        `</div>`;
    }

    return `
<div class="code-cell" id="${cellId}" data-cell-id="${cellId}" data-lang="${escapeHtml(langInfo.id)}" data-filename="${escapeHtml(detectedFilename)}" data-streaming="${isStreaming ? "true" : "false"}">
  <textarea class="code-cell__raw" hidden aria-hidden="true" style="display:none !important;">${escapeHtml(code)}</textarea>
  ${tabsHtml}
  <div class="code-cell__header">
    <div class="code-cell__meta">
      <span class="code-cell__badge">${escapeHtml(langInfo.name)}</span>
      <span class="code-cell__filename" title="${escapeHtml(detectedFilename)}">${ICONS.file} ${escapeHtml(detectedFilename)}</span>
      <span class="code-cell__lines-count">(${linesCount} line${linesCount === 1 ? "" : "s"})</span>
    </div>
    <div class="code-cell__actions">
      <button class="code-cell__btn code-cell__btn--copy" type="button" data-code-action="copy" data-cell-id="${cellId}" title="Copy code" aria-label="Copy code">
        ${ICONS.copy}
        <span>Copy</span>
      </button>
      <button class="code-cell__btn code-cell__btn--download" type="button" data-code-action="download" data-cell-id="${cellId}" title="Download ${escapeHtml(detectedFilename)}" aria-label="Download file">
        ${ICONS.download}
        <span>Download</span>
      </button>
      <button class="code-cell__btn code-cell__btn--expand" type="button" data-code-action="expand" data-cell-id="${cellId}" onclick="event.preventDefault(); event.stopPropagation(); window.Clarity.codeViewer.openWorkspace('${cellId}', 'code', this); return false;" title="Expand / Open in Workspace" aria-label="Expand code workspace">
        ${ICONS.expand}
        <span>Expand</span>
      </button>
    </div>
  </div>
  <div class="code-cell__body">
    <div class="code-cell__editor-wrap" style="${linesCount > 30 ? "max-height: 480px;" : ""}">
      ${lineNumberedHtml}
    </div>
  </div>
</div>`.trim();
  }

  // ---------- EXPANDED CODE WORKSPACE (CLEAN CODE VIEWER) ----------
  function openWorkspace(cellIdOrSnippet, initialView = "code", triggerEl = null) {
    let snippet = null;
    if (cellIdOrSnippet && typeof cellIdOrSnippet === "object") {
      snippet = cellIdOrSnippet;
    } else {
      snippet = getSnippet(cellIdOrSnippet, triggerEl);
    }

    if (!snippet && triggerEl) {
      const cell = triggerEl.closest(".code-cell");
      if (cell) snippet = extractSnippetFromDom(cell);
    }

    if (!snippet && cellIdOrSnippet && typeof cellIdOrSnippet === "string") {
      const cell = document.getElementById(cellIdOrSnippet) || document.querySelector(`[data-cell-id="${cellIdOrSnippet}"]`);
      if (cell) snippet = extractSnippetFromDom(cell);
    }

    if (!snippet) {
      const anyCell = document.querySelector(".code-cell");
      if (anyCell) snippet = extractSnippetFromDom(anyCell);
    }

    if (!snippet) {
      console.warn("Could not find code cell to expand.");
      return;
    }

    // Set state first before rendering
    activeWorkspaceState = {
      cellId: snippet.id || (typeof cellIdOrSnippet === "string" ? cellIdOrSnippet : "snippet"),
      isFullscreen: false,
      isWrapped: false,
      ...snippet,
    };

    renderWorkspaceDom();
    bindWorkspaceDragAndResize();
  }

  function renderWorkspaceDom() {
    // Remove existing backdrop if open, but DO NOT null out activeWorkspaceState!
    const existingBackdrop = document.getElementById("clarityCodeWorkspaceBackdrop");
    if (existingBackdrop) {
      existingBackdrop.remove();
    }

    const state = activeWorkspaceState;
    if (!state) return;

    const highlighter = getHighlighter();
    const langInfo = highlighter.getLanguageInfo(state.lang || state.filename);
    const codeStr = typeof state.code === "string" ? state.code : "";
    const linesCount = codeStr ? codeStr.split(/\r?\n/).length : 1;
    const charsCount = codeStr.length;

    const backdrop = document.createElement("div");
    backdrop.className = "code-workspace-backdrop";
    backdrop.id = "clarityCodeWorkspaceBackdrop";

    const workspace = document.createElement("div");
    workspace.className = "code-workspace" + (state.isFullscreen ? " is-fullscreen" : "") + (state.isWrapped ? " is-wrapped" : "");
    workspace.id = "clarityCodeWorkspace";

    // Header Toolbar
    const headerHtml = `
      <div class="code-workspace__header" id="workspaceDragHeader">
        <div class="code-workspace__header-left">
          <div class="code-workspace__title">
            ${ICONS.file}
            <span id="workspaceFilename">${escapeHtml(state.filename)}</span>
            <span class="code-workspace__badge">${escapeHtml(langInfo.name)}</span>
            <span style="font-size: 11.5px; color: #8b949e; font-weight: normal;">(${linesCount} lines • ${charsCount} chars)</span>
          </div>
        </div>
        <div class="code-workspace__header-right">
          <button type="button" class="code-workspace__btn ${state.isWrapped ? "is-active" : ""}" data-ws-action="toggle-wrap" title="${state.isWrapped ? "Disable word wrap" : "Enable word wrap"}">
            ${ICONS.wrap}
            <span>${state.isWrapped ? "Unwrap" : "Wrap"}</span>
          </button>
          <button type="button" class="code-workspace__btn" data-ws-action="copy" title="Copy code to clipboard">
            ${ICONS.copy}
            <span>Copy</span>
          </button>
          <button type="button" class="code-workspace__btn" data-ws-action="download" title="Download source file">
            ${ICONS.download}
            <span>Download</span>
          </button>
          <button type="button" class="code-workspace__btn" data-ws-action="toggle-fullscreen" title="${state.isFullscreen ? "Exit fullscreen" : "Full screen"}">
            ${state.isFullscreen ? ICONS.minimize : ICONS.expand}
            <span>${state.isFullscreen ? "Restore" : "Fullscreen"}</span>
          </button>
          <button type="button" class="code-workspace__close-btn" data-ws-action="close" title="Close workspace (Esc)">
            ${ICONS.close}
          </button>
        </div>
      </div>
    `;

    // Highlighting lines
    const lineNumberedHtml = highlighter.renderLineNumberedHtml(codeStr, langInfo.id || langInfo.prism);

    const bodyHtml = `
      <div class="code-workspace__main" id="workspaceMain">
        <div class="code-workspace__code-pane" id="workspaceCodePane">
          ${lineNumberedHtml}
        </div>
      </div>
      <!-- Resizer handles -->
      <div class="code-workspace__resizer code-workspace__resizer--corner" id="wsResizeCorner"></div>
      <div class="code-workspace__resizer code-workspace__resizer--right" id="wsResizeRight"></div>
      <div class="code-workspace__resizer code-workspace__resizer--bottom" id="wsResizeBottom"></div>
    `;

    workspace.innerHTML = headerHtml + bodyHtml;
    backdrop.appendChild(workspace);
    document.body.appendChild(backdrop);
    workspaceElement = workspace;

    // Close on backdrop click (outside workspace)
    let backdropMouseDownOnSelf = false;
    backdrop.addEventListener("mousedown", (e) => {
      backdropMouseDownOnSelf = (e.target === backdrop);
    });
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop && backdropMouseDownOnSelf) {
        closeWorkspace();
      }
      backdropMouseDownOnSelf = false;
    });

    // Esc key listener
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        closeWorkspace();
        window.removeEventListener("keydown", onKeyDown);
      }
    };
    window.addEventListener("keydown", onKeyDown);
  }

  function closeWorkspace() {
    const backdrop = document.getElementById("clarityCodeWorkspaceBackdrop");
    if (backdrop) {
      backdrop.remove();
    }
    workspaceElement = null;
    activeWorkspaceState = null;
  }

  // Draggable Header & Resizable Handles
  function bindWorkspaceDragAndResize() {
    const ws = document.getElementById("clarityCodeWorkspace");
    const header = document.getElementById("workspaceDragHeader");
    if (!ws || !header) return;

    // Drag header
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    header.addEventListener("mousedown", (e) => {
      if (activeWorkspaceState && activeWorkspaceState.isFullscreen) return;
      if (e.target.closest("button")) return;

      isDragging = true;
      const rect = ws.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = rect.left;
      initialTop = rect.top;

      if (ws && ws.style) {
        ws.style.position = "fixed";
        ws.style.left = initialLeft + "px";
        ws.style.top = initialTop + "px";
        ws.style.margin = "0";
      }

      const onMouseMove = (moveEvent) => {
        if (!isDragging) return;
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        const newLeft = Math.max(10, Math.min(window.innerWidth - ws.offsetWidth - 10, initialLeft + dx));
        const newTop = Math.max(10, Math.min(window.innerHeight - ws.offsetHeight - 10, initialTop + dy));
        if (ws && ws.style) {
          ws.style.left = newLeft + "px";
          ws.style.top = newTop + "px";
        }
      };

      const onMouseUp = () => {
        isDragging = false;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });

    // Resize bottom-right corner
    const cornerHandle = document.getElementById("wsResizeCorner");
    if (cornerHandle) {
      cornerHandle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const startW = ws.offsetWidth;
        const startH = ws.offsetHeight;
        const startClientX = e.clientX;
        const startClientY = e.clientY;

        const onMouseMove = (moveEvent) => {
          const newW = Math.max(280, Math.min(window.innerWidth * 0.98, startW + (moveEvent.clientX - startClientX)));
          const newH = Math.max(240, Math.min(window.innerHeight * 0.96, startH + (moveEvent.clientY - startClientY)));
          if (ws && ws.style) {
            ws.style.width = newW + "px";
            ws.style.height = newH + "px";
            ws.style.maxWidth = "none";
            ws.style.maxHeight = "none";
          }
        };

        const onMouseUp = () => {
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      });
    }

    // Resize right edge
    const rightHandle = document.getElementById("wsResizeRight");
    if (rightHandle) {
      rightHandle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const startW = ws.offsetWidth;
        const startClientX = e.clientX;

        const onMouseMove = (moveEvent) => {
          const newW = Math.max(280, Math.min(window.innerWidth * 0.98, startW + (moveEvent.clientX - startClientX)));
          if (ws && ws.style) {
            ws.style.width = newW + "px";
            ws.style.maxWidth = "none";
          }
        };

        const onMouseUp = () => {
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      });
    }

    // Resize bottom edge
    const bottomHandle = document.getElementById("wsResizeBottom");
    if (bottomHandle) {
      bottomHandle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        const startH = ws.offsetHeight;
        const startClientY = e.clientY;

        const onMouseMove = (moveEvent) => {
          const newH = Math.max(240, Math.min(window.innerHeight * 0.96, startH + (moveEvent.clientY - startClientY)));
          if (ws && ws.style) {
            ws.style.height = newH + "px";
            ws.style.maxHeight = "none";
          }
        };

        const onMouseUp = () => {
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        };

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      });
    }
  }

  // Global Delegated Event Handlers (Works seamlessly with streaming and re-renders)
  function initEvents() {
    if (isEventsInitialized) return;
    isEventsInitialized = true;

    const handleDocumentClick = (e) => {
      // 1. INLINE CODE CELL ACTIONS
      const cellBtn = e.target.closest("[data-code-action]");
      if (cellBtn) {
        const action = cellBtn.getAttribute("data-code-action");
        const cellId = cellBtn.getAttribute("data-cell-id");
        const cellEl = cellBtn.closest(".code-cell");
        const snippet = getSnippet(cellId, cellBtn);

        if (action === "copy") {
          e.preventDefault();
          e.stopPropagation();
          const code = snippet ? snippet.code : (cellEl?.querySelector(".code-cell__raw")?.value || cellEl?.querySelector(".code-line__code")?.textContent || cellEl?.querySelector("code")?.textContent || "");
          copyCode(code, cellBtn);
          return;
        }

        if (action === "download") {
          e.preventDefault();
          e.stopPropagation();
          if (snippet) {
            downloadCode(snippet.filename, snippet.code, snippet.lang);
          } else if (cellEl) {
            const fallbackSnippet = extractSnippetFromDom(cellEl);
            if (fallbackSnippet) {
              downloadCode(fallbackSnippet.filename, fallbackSnippet.code, fallbackSnippet.lang);
            }
          }
          return;
        }

        if (action === "expand") {
          e.preventDefault();
          e.stopPropagation();
          openWorkspace(cellId, "code", cellBtn);
          return;
        }

        if (action === "tab") {
          e.preventDefault();
          e.stopPropagation();
          const fileIndex = parseInt(cellBtn.getAttribute("data-file-index"), 10);
          if (snippet && snippet.files && snippet.files[fileIndex]) {
            const file = snippet.files[fileIndex];
            snippet.activeFileIndex = fileIndex;
            snippet.code = file.code;
            snippet.lang = file.lang;
            snippet.filename = file.name;

            // Re-render cell contents smoothly
            const cell = cellEl;
            if (cell) {
              const highlighter = getHighlighter();
              const langInfo = highlighter.getLanguageInfo(file.lang || file.name);

              // Update raw textarea
              const rawTa = cell.querySelector(".code-cell__raw");
              if (rawTa) rawTa.value = file.code;

              // Update badge & filename
              const badge = cell.querySelector(".code-cell__badge");
              if (badge) badge.textContent = langInfo.name;
              const fnEl = cell.querySelector(".code-cell__filename");
              if (fnEl) fnEl.innerHTML = `${ICONS.file} ${escapeHtml(file.name)}`;

              // Update tabs
              cell.querySelectorAll(".code-tab").forEach((tab, i) => {
                tab.classList.toggle("is-active", i === fileIndex);
              });

              // Update lines
              const editorWrap = cell.querySelector(".code-cell__editor-wrap");
              if (editorWrap) {
                editorWrap.innerHTML = highlighter.renderLineNumberedHtml(file.code, langInfo.id);
              }
            }
          }
          return;
        }
      }

      // 2. EXPANDED WORKSPACE ACTIONS
      const wsBtn = e.target.closest("[data-ws-action]");
      if (wsBtn) {
        const action = wsBtn.getAttribute("data-ws-action");

        if (action === "close") {
          e.preventDefault();
          e.stopPropagation();
          closeWorkspace();
          return;
        }

        if (action === "toggle-wrap") {
          e.preventDefault();
          e.stopPropagation();
          if (activeWorkspaceState) {
            activeWorkspaceState.isWrapped = !activeWorkspaceState.isWrapped;
            const ws = document.getElementById("clarityCodeWorkspace");
            if (ws) {
              ws.classList.toggle("is-wrapped", activeWorkspaceState.isWrapped);
            }
            wsBtn.classList.toggle("is-active", activeWorkspaceState.isWrapped);
            wsBtn.innerHTML = `${ICONS.wrap}<span>${activeWorkspaceState.isWrapped ? "Unwrap" : "Wrap"}</span>`;
            wsBtn.title = activeWorkspaceState.isWrapped ? "Disable word wrap" : "Enable word wrap";
          }
          return;
        }

        if (action === "toggle-fullscreen") {
          e.preventDefault();
          e.stopPropagation();
          if (activeWorkspaceState) {
            activeWorkspaceState.isFullscreen = !activeWorkspaceState.isFullscreen;
            const ws = document.getElementById("clarityCodeWorkspace");
            if (ws) {
              ws.classList.toggle("is-fullscreen", activeWorkspaceState.isFullscreen);
              if (activeWorkspaceState.isFullscreen) {
                ws.style.position = "";
                ws.style.left = "";
                ws.style.top = "";
                ws.style.width = "";
                ws.style.height = "";
                ws.style.margin = "";
              }
            }
            wsBtn.innerHTML = activeWorkspaceState.isFullscreen
              ? `${ICONS.minimize}<span>Restore</span>`
              : `${ICONS.expand}<span>Fullscreen</span>`;
          }
          return;
        }

        if (action === "copy") {
          e.preventDefault();
          e.stopPropagation();
          if (activeWorkspaceState) {
            copyCode(activeWorkspaceState.code, wsBtn);
          }
          return;
        }

        if (action === "download") {
          e.preventDefault();
          e.stopPropagation();
          if (activeWorkspaceState) {
            downloadCode(
              activeWorkspaceState.filename,
              activeWorkspaceState.code,
              activeWorkspaceState.lang
            );
          }
          return;
        }
      }
    };

    // Attach to document directly so event delegation is universal and impervious to timing/replacement
    document.addEventListener("click", handleDocumentClick);
  }

  // Export module
  window.Clarity.codeViewer = {
    renderCell,
    openWorkspace,
    closeWorkspace,
    getSnippet,
    extractSnippetFromDom,
    copyCode,
    downloadCode,
    initEvents,
  };

  // Auto initialize event listeners
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initEvents);
  } else {
    initEvents();
  }
})();

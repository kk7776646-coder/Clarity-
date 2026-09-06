window.NexaRAG = window.NexaRAG || {};
window.NexaRAG.pages = window.NexaRAG.pages || {};

window.NexaRAG.pages.project = async function renderProjectPage(route) {
  const main = document.getElementById("main");
  if (!main) return;
  const projectId = route ? route.replace("#/project/", "").trim() : null;
  if (!projectId) {
    return renderProjectList(main);
  }
  return renderProjectDetail(main, projectId);
};

async function renderProjectList(main) {
  let projects = [];
  let defaultProjectId = null;
  try {
    const data = await window.NexaRAG.api.get("/api/projects");
    projects = data.projects || [];
  } catch (err) {
    window.NexaRAG.toast.show("Failed to load projects", "danger");
  }
  try {
    const def = await window.NexaRAG.api.get("/api/projects/default");
    defaultProjectId = def.id;
  } catch (e) {}

  main.innerHTML = [
    '<div class="page"><div class="page__inner">',
    '<header class="page__header">',
    '<div><h1 class="page__title">Projects</h1>',
    '<p class="page__subtitle">Upload a ZIP or folder to analyze an entire codebase. The AI will use the indexed files as context for answers.</p></div>',
    '<div class="hstack" style="gap:8px;">',
    '<label class="btn btn--outline" style="cursor:pointer;">',
    '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    ' Upload ZIP',
    '<input id="projectZipInput" type="file" hidden accept=".zip">',
    '</label>',
    '<button class="btn btn--primary" id="createProjectBtn" type="button">',
    '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>',
    ' New project</button>',
    '</div></header>',
    '<div id="projectDropzone" class="dropzone"><div class="dropzone__inner">',
    '<svg class="icon" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>',
    '<div><strong>Drop a ZIP here</strong> to create a project from it</div>',
    '</div></div>',
    '<section class="project-grid">',
    projects.length === 0 ? '<div class="empty-state">No projects yet. Upload a ZIP or create a new project.</div>' : '',
    projects.map(p => projectCardHtml(p, defaultProjectId === p.id)).join(""),
    '</section>',
    '</div></div>'
  ].join("");

  document.getElementById("createProjectBtn")?.addEventListener("click", async () => {
    const name = prompt("Project name:", "My Project");
    if (name && name.trim()) {
      try {
        const data = await window.NexaRAG.api.post("/api/projects", { name: name.trim() });
        window.location.hash = "#/project/" + data.id;
      } catch (err) {
        window.NexaRAG.toast.show("Failed to create project", "danger");
      }
    }
  });

  const zipInput = document.getElementById("projectZipInput");
  const dz = document.getElementById("projectDropzone");
  if (zipInput) {
    zipInput.addEventListener("change", async (e) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (f) await uploadProjectZip(f);
    });
  }
  if (dz) {
    dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("is-dragover"); });
    dz.addEventListener("dragleave", () => dz.classList.remove("is-dragover"));
    dz.addEventListener("drop", async (e) => {
      e.preventDefault();
      dz.classList.remove("is-dragover");
      const f = Array.from(e.dataTransfer.files || []).find(x => x.name.toLowerCase().endsWith(".zip"));
      if (f) await uploadProjectZip(f);
      else window.NexaRAG.toast.show("Please drop a .zip file", "danger");
    });
  }

  document.querySelectorAll("[data-project-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-project-id");
      const action = btn.getAttribute("data-project-action");
      if (action === "open") window.location.hash = "#/project/" + id;
      else if (action === "delete") {
        if (!confirm("Delete this project? This cannot be undone.")) return;
        try {
          await window.NexaRAG.api.del("/api/projects/" + id);
          window.NexaRAG.toast.show("Project deleted", "success");
          window.NexaRAG.app.navigate("#/project");
        } catch (err) {
          window.NexaRAG.toast.show("Delete failed: " + (err.message || ""), "danger");
        }
      } else if (action === "ask") {
        window.NexaRAG.uiChat.attachProject(id);
        window.NexaRAG.toast.show("Project attached to chat context", "success");
        window.location.hash = "#/chat";
      }
    });
  });
}

function projectCardHtml(p, isDefault) {
  return '<article class="card project-card">' +
    '<div class="card__body">' +
      '<div class="project-card__head"><h3>' + window.NexaRAG.utils.escapeHtml(p.name) + '</h3>' + (isDefault ? '<span class="tag tag--xs">Default</span>' : '') + '</div>' +
      '<div class="muted">Project ' + window.NexaRAG.utils.escapeHtml(p.id) + '</div>' +
      '<div class="hstack" style="margin-top:12px;gap:6px;">' +
        '<button class="btn btn--primary btn--sm" type="button" data-project-action="open" data-project-id="' + p.id + '">Open</button>' +
        '<button class="btn btn--outline btn--sm" type="button" data-project-action="ask" data-project-id="' + p.id + '">Ask AI</button>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-project-action="delete" data-project-id="' + p.id + '">Delete</button>' +
      '</div>' +
    '</div>' +
  '</article>';
}

async function uploadProjectZip(file) {
  if (!file.name.toLowerCase().endsWith(".zip")) {
    window.NexaRAG.toast.show("Only .zip files are supported", "danger");
    return;
  }
  window.NexaRAG.toast.show("Uploading " + file.name + "...", "info");
  try {
    const fd = new FormData();
    fd.append("files", file, file.name);
    const resp = await fetch(window.NexaRAG.api.base + "/api/files/upload", { method: "POST", body: fd });
    const data = await resp.json();
    const r = (data.files || [])[0];
    if (!r || !r.ok) {
      window.NexaRAG.toast.show("Upload failed: " + (r?.error || "unknown"), "danger");
      return;
    }
    const name = file.name.replace(/\.zip$/i, "");
    const proj = await window.NexaRAG.api.post("/api/projects", { name, description: "Uploaded from " + file.name });
    const projectId = proj.id;
    if (r.extracted && r.extracted.length > 0) {
      window.NexaRAG.toast.show("Indexing " + r.extracted.length + " files...", "info");
      try {
        await window.NexaRAG.api.post("/api/projects/" + projectId + "/index");
        window.NexaRAG.toast.show("Index complete", "success");
      } catch (e) {
        window.NexaRAG.toast.show("Indexing failed (project still created)", "warning");
      }
    } else {
      window.NexaRAG.toast.show("Project created", "success");
    }
    window.location.hash = "#/project/" + projectId;
  } catch (err) {
    window.NexaRAG.toast.show("Upload failed: " + (err.message || ""), "danger");
  }
}

async function renderProjectDetail(main, projectId) {
  let tree = {};
  let loadError = null;
  try {
    const t = await window.NexaRAG.api.get("/api/projects/" + projectId + "/tree");
    tree = t.tree || {};
  } catch (err) {
    loadError = "Failed to load project tree: " + (err.message || "");
  }

  const flatFiles = flattenTree(tree);
  const hasFiles = flatFiles.length > 0;
  const hasValidName = projectId && !/[#/]/.test(projectId) && projectId.trim() !== "";
  const showError = loadError && hasFiles;
  const titleHtml = hasValidName
    ? '<h1 class="page__title">Project: ' + window.NexaRAG.utils.escapeHtml(projectId) + '</h1>'
    : '';

  main.innerHTML = [
    '<div class="page project-page"><div class="page__inner">',
    '<header class="page__header">',
    '<div>' + titleHtml,
    '<p class="page__subtitle">' + flatFiles.length + ' file' + (flatFiles.length === 1 ? '' : 's') + ' indexed</p></div>',
    '<div class="hstack" style="gap:8px;">',
    '<button class="btn btn--outline btn--sm" id="backToProjectsBtn" type="button">← All projects</button>',
    '<button class="btn btn--ghost btn--sm" id="indexProjectBtn" type="button" title="Re-index" aria-label="Re-index project"' + (hasFiles ? '' : ' disabled') + '>',
    '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
    ' Re-index</button>',
    '<button class="btn btn--primary btn--sm" id="attachToChatBtn" type="button"' + (hasFiles ? '' : ' disabled') + '>Ask AI about this project</button>',
    '</div></header>',
    showError ? '<div class="project-notice">' + window.NexaRAG.utils.escapeHtml(loadError) + '</div>' : '',
    '<section class="grid-2 project-section">',
    '<div class="panel"><div class="panel__head"><h2>Project Tree</h2></div><div class="panel__body project-tree">' +
      (flatFiles.length === 0 ? '<div class="empty-state">No files. Upload a ZIP to populate this project.</div>' : renderTree(tree)) +
    '</div></div>',
    '<div class="panel"><div class="panel__head"><h2>Files</h2></div><div class="panel__body project-files">' +
      (flatFiles.length === 0 ? '<div class="empty-state">No files indexed.</div>' : flatFiles.map(fileItemHtml).join("")) +
    '</div></div>',
    '</section>',
    '</div></div>'
  ].join("");

  document.getElementById("backToProjectsBtn")?.addEventListener("click", () => window.location.hash = "#/project");
  document.getElementById("attachToChatBtn")?.addEventListener("click", () => {
    window.NexaRAG.uiChat.attachProject(projectId);
    window.NexaRAG.toast.show("Project attached to chat", "success");
    window.location.hash = "#/chat";
  });
  document.getElementById("indexProjectBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("indexProjectBtn");
    btn.disabled = true;
    btn.textContent = "Indexing...";
    try {
      await window.NexaRAG.api.post("/api/projects/" + projectId + "/index");
      window.NexaRAG.toast.show("Index complete", "success");
    } catch (err) {
      window.NexaRAG.toast.show("Index failed: " + (err.message || ""), "danger");
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg> Re-index';
    }
  });

  document.querySelectorAll("[data-file-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const path = btn.getAttribute("data-file-path");
      const action = btn.getAttribute("data-file-action");
      if (action === "preview") await previewProjectFile(projectId, path);
      else if (action === "analyze") {
        window.NexaRAG.uiChat.attachProject(projectId);
        const fileName = path.split("/").pop();
        window.NexaRAG.uiChat._pendingPrompt = "Analyze the file " + fileName + " (path: " + path + ") and explain what it does.";
        window.NexaRAG.toast.show("Project attached. Open chat to send the question.", "info");
        window.location.hash = "#/chat";
      }
    });
  });
}

function fileItemHtml(f) {
  return '<div class="file-item" data-file-path="' + window.NexaRAG.utils.escapeHtml(f.path) + '">' +
    '<span class="file-item__icon">' + fileTypeIcon(f.ext) + '</span>' +
    '<span class="file-item__name">' + window.NexaRAG.utils.escapeHtml(f.name) + '</span>' +
    '<span class="muted">' + formatSize(f.size) + '</span>' +
    '<div class="file-item__actions">' +
      '<button class="btn btn--ghost btn--icon-sm" data-file-action="preview" data-file-path="' + window.NexaRAG.utils.escapeHtml(f.path) + '" title="Preview" aria-label="Preview file">' +
        '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>' +
      '</button>' +
      '<button class="btn btn--ghost btn--icon-sm" data-file-action="analyze" data-file-path="' + window.NexaRAG.utils.escapeHtml(f.path) + '" title="Analyze with AI" aria-label="Analyze with AI">' +
        '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>' +
      '</button>' +
    '</div>' +
  '</div>';
}

function fileTypeIcon(ext) {
  if (['.png','.jpg','.jpeg','.gif','.webp','.bmp','.svg'].includes(ext)) return '🖼';
  if (['.js','.jsx','.ts','.tsx'].includes(ext)) return '📜';
  if (['.py'].includes(ext)) return '🐍';
  if (['.json','.yaml','.yml','.toml'].includes(ext)) return '⚙';
  if (['.md','.txt'].includes(ext)) return '📄';
  if (['.html','.css','.scss'].includes(ext)) return '🎨';
  if (['.zip','.tar','.gz'].includes(ext)) return '🗜';
  return '📄';
}

function flattenTree(node, prefix, out) {
  out = out || [];
  prefix = prefix || "";
  if (!node || typeof node !== "object") return out;
  const entries = Object.entries(node);
  for (const [key, value] of entries) {
    const path = prefix ? prefix + "/" + key : key;
    if (value && value.children === null) {
      out.push({ path, name: key, ext: (value.ext || ""), size: value.size || 0 });
    } else if (value && value.children) {
      out.push({ path, name: key, ext: "", size: 0, isDir: true });
      flattenTree(value.children, path, out);
    }
  }
  return out;
}

async function previewProjectFile(projectId, path) {
  try {
    const data = await window.NexaRAG.api.get("/api/projects/" + projectId + "/file?path=" + encodeURIComponent(path));
    const content = data.content || "(Empty file)";
    const ext = (path.split(".").pop() || "").toLowerCase();
    const lang = window.NexaRAG.markdown ? window.NexaRAG.markdown.normalizeLang(ext) : "";
    const highlighted = window.NexaRAG.markdown && window.NexaRAG.markdown.highlightCode
      ? window.NexaRAG.markdown.highlightCode(content, lang)
      : window.NexaRAG.utils.escapeHtml(content);
    const body = '<div class="file-preview-head"><strong>' + window.NexaRAG.utils.escapeHtml(path) + '</strong><span class="muted">' + content.length + ' chars</span></div>' +
      '<pre class="code-block"><code class="language-' + lang + '">' + highlighted + '</code></pre>';
    window.NexaRAG.modal.open("File: " + path, body, '<button class="btn btn--primary" type="button" data-modal-close="true">Close</button>');
  } catch (err) {
    window.NexaRAG.toast.show("Preview failed: " + (err.message || ""), "danger");
  }
}

function renderTree(node, prefix) {
  prefix = prefix || "";
  if (!node || typeof node !== "object") return "";
  let html = "";
  const entries = Object.entries(node);
  entries.forEach(([key, value], i) => {
    const isLast = i === entries.length - 1;
    const isFile = value && value.children === null;
    const icon = isFile
      ? '<svg class="icon" style="width:14px;height:14px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>'
      : '<svg class="icon" style="width:14px;height:14px;"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l1.5 2H18.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z"/></svg>';
    const connector = isLast ? "└─" : "├─";
    html += '<div class="tree-item" style="margin-left:' + (prefix.length * 0.6) + 'em">' +
      '<span class="tree-connector">' + connector + '</span>' + icon +
      '<span class="tree-name">' + window.NexaRAG.utils.escapeHtml(key) + '</span>' +
      (value && value.size ? '<span class="tree-size">' + formatSize(value.size) + '</span>' : '') +
      '</div>';
    if (!isFile && value && value.children) {
      html += renderTree(value.children, prefix + "  ");
    }
  });
  return html;
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}


async function renderKnowledgeTab(container) {
  container.innerHTML = '<div style="padding:20px;color:var(--ink-muted)">Loading Knowledge Engine...</div>';
  
  try {
    const res = await fetch(`/api/projects/${currentProjectId}/knowledge`);
    const data = await res.json();
    
    container.innerHTML = `
      <div class="project-tab-inner" style="padding: 24px; max-width: 800px; margin: 0 auto;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px;">
          <div>
            <h2 style="margin:0 0 8px 0; font-size:24px; color:var(--ink)">Advanced RAG & Knowledge Engine</h2>
            <p style="margin:0; color:var(--ink-muted); line-height:1.5">
              Clarity AI automatically processes your project into structure-aware chunk embeddings. This powers semantic retrieval for the Copilot.
            </p>
          </div>
          <button id="reindexBtn" class="btn btn--primary">⟳ Reindex Project</button>
        </div>
        
        <div class="architecture-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:32px;">
          <div class="card" style="padding:20px; text-align:center;">
            <div style="font-size:32px; font-weight:600; color:var(--accent)">${data.status}</div>
            <div style="color:var(--ink-muted); margin-top:8px; font-size:14px; text-transform:uppercase; letter-spacing:0.5px">Indexing Status</div>
          </div>
          <div class="card" style="padding:20px; text-align:center;">
            <div style="font-size:32px; font-weight:600; color:var(--ink)">${data.stats.files}</div>
            <div style="color:var(--ink-muted); margin-top:8px; font-size:14px; text-transform:uppercase; letter-spacing:0.5px">Files Indexed</div>
          </div>
          <div class="card" style="padding:20px; text-align:center;">
            <div style="font-size:32px; font-weight:600; color:var(--ink)">${data.stats.chunks}</div>
            <div style="color:var(--ink-muted); margin-top:8px; font-size:14px; text-transform:uppercase; letter-spacing:0.5px">Knowledge Chunks</div>
          </div>
        </div>

        <div class="card" style="padding:24px;">
          <h3 style="margin:0 0 16px 0; font-size:18px;">Knowledge Inspector & RAG Debugger</h3>
          <p style="color:var(--ink-muted); margin-bottom:16px; font-size:14px;">
            Test the retrieval engine by typing a query. The engine uses hybrid search (Semantic + Lexical + Structural + Architecture Graph) to fetch relevant chunks.
          </p>
          <div style="display:flex; gap:8px; margin-bottom:24px;">
            <input type="text" id="ragTestInput" class="form-input" style="flex:1" placeholder="E.g. 'How does authentication work?' or 'Where is the database initialized?'" />
            <button id="ragTestBtn" class="btn btn--outline">Test Search</button>
          </div>
          <div id="ragResults" style="display:flex; flex-direction:column; gap:16px;"></div>
        </div>
      </div>
    `;

    document.getElementById('reindexBtn').addEventListener('click', async (e) => {
      const btn = e.target;
      btn.textContent = "Indexing...";
      btn.disabled = true;
      try {
        await fetch(`/api/projects/${currentProjectId}/knowledge/reindex`, { method: "POST" });
        renderKnowledgeTab(container);
      } catch (err) {
        console.error(err);
        btn.textContent = "Error";
      }
    });
    
    document.getElementById('ragTestBtn').addEventListener('click', async () => {
      const q = document.getElementById('ragTestInput').value.trim();
      if (!q) return;
      const resContainer = document.getElementById('ragResults');
      resContainer.innerHTML = '<div style="color:var(--ink-muted)">Searching knowledge store...</div>';
      
      try {
        // We will add a search endpoint to test the knowledge engine
        const searchRes = await fetch(`/api/projects/${currentProjectId}/knowledge/search?q=${encodeURIComponent(q)}`);
        const searchData = await searchRes.json();
        
        if (!searchData.results || searchData.results.length === 0) {
           resContainer.innerHTML = '<div style="color:var(--ink-muted)">No evidence found.</div>';
           return;
        }
        
        let html = '';
        for (const item of searchData.results) {
           html += `
             <div style="border:1px solid var(--line); border-radius:var(--r-md); background:var(--surface);">
               <div style="padding:12px 16px; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; align-items:center;">
                 <div style="font-family:var(--font-mono); font-size:13px; color:var(--accent)">${window.Clarity.utils.escapeHtml(item.file)} (Lines ${item.lines})</div>
                 <div style="display:flex; gap:8px; align-items:center;">
                    <span style="font-size:12px; color:var(--ink-muted); background:var(--surface-muted); padding:2px 6px; border-radius:4px;">Score: ${item.score}</span>
                 </div>
               </div>
               <div style="padding:12px 16px; font-size:13px; color:var(--ink-muted); border-bottom:1px solid var(--line);">
                 <strong>Relevance match:</strong> ${window.Clarity.utils.escapeHtml(item.reason)}
               </div>
               <pre style="margin:0; padding:16px; font-family:var(--font-mono); font-size:13px; color:var(--ink); overflow-x:auto; background:transparent;">${window.Clarity.utils.escapeHtml(item.content)}</pre>
             </div>
           `;
        }
        resContainer.innerHTML = html;
        
      } catch (err) {
        resContainer.innerHTML = '<div style="color:var(--danger)">Error performing search</div>';
      }
    });
    
  } catch (err) {
    container.innerHTML = `<div style="padding:20px;color:var(--danger)">Error loading knowledge status: ${err.message}</div>`;
  }
}

window.Clarity = window.Clarity || {};
window.Clarity.pages = window.Clarity.pages || {};

window.Clarity.pages.project = async function renderProjectPage(route) {
  const main = document.getElementById("main");
  if (!main) return;
  const projectId = route ? route.replace("#/project/", "").trim() : null;
  if (!projectId || projectId === "#/project") {
    return renderProjectList(main);
  }
  return renderProjectDetail(main, projectId);
};

/* ============================================================
   Project List View
   ============================================================ */
async function renderProjectList(main) {
  let projects = [];
  try {
    const data = await window.Clarity.api.get("/api/projects");
    projects = data.projects || [];
  } catch (err) {
    window.Clarity.toast.show("Failed to load projects", "danger");
  }

  main.innerHTML = [
    '<div class="page project-page"><div class="page__inner">',
    '<header class="page__header">',
    '<div><h1 class="page__title">Universal Project Understanding</h1>',
    '<p class="page__subtitle">Upload any project ZIP, repository folder, or source files (React, Python, Node, Django, Java, C++, Go, etc.) to extract, analyze architecture, inspect code, and chat with AI.</p></div>',
    '<div class="hstack" style="gap:8px; flex-wrap:wrap;">',
    '<button class="btn btn--outline" id="importGithubBtn" style="cursor:pointer; display:inline-flex; align-items:center; gap:6px;">',
    '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>',
    ' Import from GitHub',
    '</button>',
    '<label class="btn btn--primary" style="cursor:pointer;" id="uploadZipLabel">',
    '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    ' Upload Project ZIP',
    '<input id="projectZipInput" type="file" hidden accept=".zip">',
    '</label>',
    '<label class="btn btn--outline" style="cursor:pointer;" id="uploadFolderLabel">',
    '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><polyline points="12 11 12 17"/><polyline points="9 14 12 11 15 14"/></svg>',
    ' Upload Folder',
    '<input id="projectFolderInput" type="file" webkitdirectory directory multiple hidden>',
    '</label>',
    '<label class="btn btn--outline" style="cursor:pointer;" id="uploadFilesLabel">',
    '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>',
    ' Upload Files',
    '<input id="projectFilesInput" type="file" multiple hidden>',
    '</label>',
    '</div></header>',
    '<div id="projectDropzone" class="dropzone" style="cursor:pointer; margin-bottom:28px;"><div class="dropzone__inner">',
    '<svg class="icon" viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>',
    '<div><strong style="font-size:15px;">Drop any project ZIP, folder, or files here</strong><div class="muted" style="margin-top:4px;">Universal engine automatically detects language, frameworks, architecture, and security</div></div>',
    '</div></div>',
    '<div id="uploadProgressContainer" style="display:none; margin-bottom:24px;"></div>',
    '<section class="project-grid">',
    projects.length === 0 ? '<div class="empty-state" style="grid-column: 1 / -1; padding:48px 24px; text-align:center;"><div style="font-size:32px; margin-bottom:12px;">📦</div><h3 style="font-size:16px; font-weight:600; margin-bottom:6px;">No projects yet</h3><p class="muted">Upload or create a project to get started.</p></div>' : '',
    projects.map(p => projectCardHtml(p)).join(""),
    '</section>',
    '</div></div>'
  ].join("");

  const zipInput = document.getElementById("projectZipInput");
  const folderInput = document.getElementById("projectFolderInput");
  const filesInput = document.getElementById("projectFilesInput");
  const dz = document.getElementById("projectDropzone");

  if (zipInput) {
    zipInput.addEventListener("change", async (e) => {
      const f = e.target.files?.[0];
      e.target.value = "";
      if (f) await handleZipUpload(f);
    });
  }

  if (folderInput) {
    folderInput.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      e.target.value = "";
      if (files.length > 0) await handleBatchUpload(files);
    });
  }

  if (filesInput) {
    filesInput.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      e.target.value = "";
      if (files.length > 0) await handleBatchUpload(files);
    });
  }

  if (dz) {
    dz.addEventListener("click", () => zipInput?.click());
    dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("is-dragover"); });
    dz.addEventListener("dragleave", () => dz.classList.remove("is-dragover"));
    dz.addEventListener("drop", async (e) => {
      e.preventDefault();
      dz.classList.remove("is-dragover");
      const dropped = Array.from(e.dataTransfer.files || []);
      if (dropped.length === 0) return;
      const zipFile = dropped.find(x => x.name.toLowerCase().endsWith(".zip"));
      if (zipFile && dropped.length === 1) {
        await handleZipUpload(zipFile);
      } else {
        await handleBatchUpload(dropped);
      }
    });
  }

  async function handleBatchUpload(files) {
    const progCont = document.getElementById("uploadProgressContainer");
    if (progCont) {
      progCont.style.display = "block";
      progCont.innerHTML = [
        '<div class="card" style="padding:16px 20px;">',
        '<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">',
        '<strong style="font-size:14px;">Uploading and analyzing ' + files.length + ' files...</strong>',
        '<span class="spinner" style="width:16px; height:16px;"></span>',
        '</div>',
        '<div class="progress" style="height:6px; background:var(--surface-muted); border-radius:999px; overflow:hidden;">',
        '<div style="width:65%; height:100%; background:var(--accent); border-radius:999px; animation: pulse 1.5s infinite;"></div>',
        '</div>',
        '<div class="muted" style="font-size:12px; margin-top:8px;">Extracting files safely, scanning dependencies, tracing architecture, and cataloging APIs...</div>',
        '</div>'
      ].join("");
    }

    try {
      const fd = new FormData();
      const paths = [];
      for (const f of files) {
        fd.append("files", f, f.name);
        paths.push(f.webkitRelativePath || f.name);
      }
      fd.append("paths", JSON.stringify(paths));

      const resp = await fetch(window.Clarity.api.base + "/api/projects/upload-files", {
        method: "POST",
        body: fd,
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to upload and analyze project files.");
      }

      const resData = await resp.json();
      window.Clarity.toast.show("Project created and analyzed successfully! " + (resData.filesCount || files.length) + " files indexed.", "success");
      window.location.hash = "#/project/" + resData.project.id;
    } catch (err) {
      console.error("Batch upload error:", err);
      window.Clarity.toast.show("Upload failed: " + (err.message || "Unknown error"), "danger");
      if (progCont) progCont.style.display = "none";
    }
  }

  const importGithubBtn = document.getElementById("importGithubBtn");
  if (importGithubBtn) {
    importGithubBtn.addEventListener("click", () => {
      openGithubImportModal(main);
    });
  }

  document.querySelectorAll("[data-project-action]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-project-id");
      const action = btn.getAttribute("data-project-action");
      if (action === "open") {
        window.location.hash = "#/project/" + id;
      } else if (action === "delete") {
        if (!confirm("Are you sure you want to delete this project and all its analyzed data?")) return;
        try {
          btn.disabled = true;
          btn.textContent = "Deleting...";
          await window.Clarity.api.del("/api/projects/" + id);
          window.Clarity.toast.show("Project deleted successfully", "success");
          await renderProjectList(main);
        } catch (err) {
          btn.disabled = false;
          btn.textContent = "Delete";
          window.Clarity.toast.show("Delete failed: " + (err.message || "Unknown error"), "danger");
        }
      } else if (action === "ask") {
        window.Clarity.uiChat.attachProject(id);
        window.Clarity.toast.show("Project context attached to chat", "success");
        window.location.hash = "#/chat";
      }
    });
  });
}

function projectCardHtml(p) {
  const lang = p.primary_language || "Codebase";
  const type = p.project_type || "Universal Project";
  const filesCount = p.file_count || 0;

  const githubBadge = p.github
    ? '<span class="tag tag--xs" style="background:#24292e; color:#fff; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>' + window.Clarity.utils.escapeHtml(p.github.owner + '/' + p.github.repo) + '</span>'
    : '';

  return '<article class="card project-card" style="display:flex; flex-direction:column; justify-content:space-between;">' +
    '<div class="card__body">' +
      '<div class="project-card__head" style="display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:8px; gap:8px;">' +
        '<h3 style="font-size:16px; font-weight:600; color:var(--ink);">' + window.Clarity.utils.escapeHtml(p.name) + '</h3>' +
        '<div style="display:flex; gap:6px; flex-shrink:0;">' +
          githubBadge +
          '<span class="tag tag--xs" style="background:var(--accent-soft); color:var(--accent); font-weight:600;">' + window.Clarity.utils.escapeHtml(lang) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="muted" style="font-size:13px; margin-bottom:12px; line-height:1.4;">' + window.Clarity.utils.escapeHtml(p.description || type) + '</div>' +
      '<div class="hstack" style="gap:12px; font-size:12px; color:var(--ink-muted); margin-bottom:16px;">' +
        '<span>' + filesCount + ' files</span>' +
        '<span>' + window.Clarity.utils.escapeHtml(type) + '</span>' +
        (p.github ? '<span>' + window.Clarity.utils.escapeHtml(p.github.branch) + '</span>' : '') +
      '</div>' +
      '<div class="hstack" style="gap:6px; margin-top:auto; pt-2; border-top:1px solid var(--line);">' +
        '<button class="btn btn--primary btn--sm" type="button" data-project-action="open" data-project-id="' + p.id + '">View Intelligence</button>' +
        '<button class="btn btn--outline btn--sm" type="button" data-project-action="ask" data-project-id="' + p.id + '">Ask AI</button>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-project-action="delete" data-project-id="' + p.id + '">Delete</button>' +
      '</div>' +
    '</div>' +
  '</article>';
}

/* ============================================================
   GitHub Import Modal Dialog (Step 13)
   ============================================================ */
function openGithubImportModal(mainContainer) {
  const existingModal = document.getElementById("githubImportModal");
  if (existingModal) existingModal.remove();

  const modal = document.createElement("div");
  modal.id = "githubImportModal";
  modal.style = "position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.65); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; padding:16px;";

  modal.innerHTML = [
    '<div style="background:var(--surface); border:1px solid var(--line); border-radius:14px; width:100%; max-width:540px; box-shadow:0 24px 48px rgba(0,0,0,0.3); overflow:hidden; display:flex; flex-direction:column;">',
    '<div style="padding:18px 22px; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; align-items:center;">',
    '<div style="display:flex; align-items:center; gap:10px;">',
    '<div style="width:32px; height:32px; border-radius:8px; background:#24292e; color:#fff; display:flex; align-items:center; justify-content:center;">',
    '<svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>',
    '</div>',
    '<h3 style="margin:0; font-size:16px; font-weight:600; color:var(--ink);">Import from GitHub</h3>',
    '</div>',
    '<button id="closeGhModalBtn" class="btn btn--ghost btn--sm" style="font-size:18px; line-height:1; padding:4px 8px;">✕</button>',
    '</div>',

    '<div style="padding:22px; display:flex; flex-direction:column; gap:16px;">',
    '<div>',
    '<label style="display:block; font-size:13px; font-weight:600; margin-bottom:6px; color:var(--ink);">GitHub Repository <span style="color:var(--danger)">*</span></label>',
    '<div style="display:flex; gap:8px;">',
    '<input type="text" id="ghRepoUrl" class="input" style="flex:1;" placeholder="e.g. facebook/react or https://github.com/torvalds/linux">',
    '<button type="button" id="ghFetchBranchesBtn" class="btn btn--outline btn--sm" style="white-space:nowrap;">Fetch Branches</button>',
    '</div>',
    '<p style="font-size:12px; color:var(--ink-muted); margin-top:4px;">Enter "owner/repo" or the full GitHub repository URL.</p>',
    '</div>',

    '<div id="ghRepoMetaBox" style="display:none; padding:12px; border-radius:8px; background:var(--surface-muted); border:1px solid var(--line); font-size:13px;">',
    '<div style="font-weight:600; color:var(--ink); display:flex; align-items:center; gap:8px;">',
    '<span id="ghMetaTitle"></span>',
    '<span id="ghMetaPrivateTag" class="tag tag--xs" style="display:none; background:rgba(239,68,68,0.15); color:#dc2626;">Private</span>',
    '<span id="ghMetaStars" style="color:var(--ink-muted); font-size:12px; font-weight:normal;"></span>',
    '</div>',
    '<div id="ghMetaDesc" style="color:var(--ink-muted); font-size:12px; margin-top:4px; line-height:1.4;"></div>',
    '</div>',

    '<div>',
    '<label style="display:block; font-size:13px; font-weight:600; margin-bottom:6px; color:var(--ink);">Branch <span style="color:var(--danger)">*</span></label>',
    '<select id="ghBranchSelect" class="input" style="width:100%;">',
    '<option value="main">main (default)</option>',
    '</select>',
    '</div>',

    '<div>',
    '<label style="display:block; font-size:13px; font-weight:600; margin-bottom:6px; color:var(--ink);">Project Name in Clarity</label>',
    '<input type="text" id="ghProjectName" class="input" style="width:100%;" placeholder="Defaults to repository name">',
    '</div>',

    '<div>',
    '<details style="font-size:12.5px;">',
    '<summary style="cursor:pointer; color:var(--accent); font-weight:500;">Private repository or rate limit issue? Provide Token</summary>',
    '<div style="margin-top:8px;">',
    '<input type="password" id="ghToken" class="input" style="width:100%;" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx (GitHub Personal Access Token)">',
    '<p style="font-size:11.5px; color:var(--ink-muted); margin-top:4px;">Token is only used to pull and synchronize code. Never stored insecurely.</p>',
    '</div>',
    '</details>',
    '</div>',

    '<div id="ghProgressBox" style="display:none; padding:12px; border-radius:8px; background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.2); font-size:13px; color:var(--accent);">',
    '<div style="display:flex; align-items:center; gap:10px;">',
    '<span class="spinner" style="width:16px; height:16px; border:2px solid currentColor; border-top-color:transparent; border-radius:50%; display:inline-block; animation:spin 1s linear infinite;"></span>',
    '<span id="ghProgressText">Downloading repository archive from GitHub...</span>',
    '</div>',
    '</div>',
    '</div>',

    '<div style="padding:16px 22px; border-top:1px solid var(--line); background:var(--surface-muted); display:flex; justify-content:flex-end; gap:10px;">',
    '<button id="cancelGhModalBtn" class="btn btn--outline">Cancel</button>',
    '<button id="submitGhImportBtn" class="btn btn--primary">Import & Analyze Project</button>',
    '</div>',
    '</div>'
  ].join("");

  document.body.appendChild(modal);

  const close = () => modal.remove();
  document.getElementById("closeGhModalBtn").addEventListener("click", close);
  document.getElementById("cancelGhModalBtn").addEventListener("click", close);

  const repoInput = document.getElementById("ghRepoUrl");
  const branchSelect = document.getElementById("ghBranchSelect");
  const nameInput = document.getElementById("ghProjectName");
  const tokenInput = document.getElementById("ghToken");
  const fetchBtn = document.getElementById("ghFetchBranchesBtn");
  const submitBtn = document.getElementById("submitGhImportBtn");
  const progressBox = document.getElementById("ghProgressBox");
  const progressText = document.getElementById("ghProgressText");
  const metaBox = document.getElementById("ghRepoMetaBox");
  const metaTitle = document.getElementById("ghMetaTitle");
  const metaDesc = document.getElementById("ghMetaDesc");
  const metaStars = document.getElementById("ghMetaStars");
  const metaPrivateTag = document.getElementById("ghMetaPrivateTag");

  async function fetchBranches() {
    const repoUrl = repoInput.value.trim();
    if (!repoUrl) {
      window.Clarity.toast.show("Please enter a GitHub repository name or URL", "warning");
      return;
    }
    fetchBtn.disabled = true;
    fetchBtn.textContent = "Fetching...";
    try {
      const res = await window.Clarity.api.post("/api/github/branches", {
        repoUrl,
        token: tokenInput.value.trim() || undefined,
      });

      metaBox.style.display = "block";
      metaTitle.textContent = res.fullName;
      metaDesc.textContent = res.description || "No description provided.";
      metaStars.textContent = "★ " + (res.stars || 0);
      metaPrivateTag.style.display = res.isPrivate ? "inline" : "none";

      if (!nameInput.value.trim()) {
        nameInput.value = res.repo;
      }

      branchSelect.innerHTML = "";
      (res.branches || ["main"]).forEach(b => {
        const opt = document.createElement("option");
        opt.value = b;
        opt.textContent = b + (b === res.defaultBranch ? " (default)" : "");
        if (b === res.defaultBranch) opt.selected = true;
        branchSelect.appendChild(opt);
      });

      window.Clarity.toast.show("Found " + (res.branches?.length || 0) + " branches", "success");
    } catch (err) {
      window.Clarity.toast.show("Could not fetch branches: " + (err.message || "Check repo name and token"), "danger");
    } finally {
      fetchBtn.disabled = false;
      fetchBtn.textContent = "Fetch Branches";
    }
  }

  fetchBtn.addEventListener("click", fetchBranches);
  repoInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      fetchBranches();
    }
  });

  submitBtn.addEventListener("click", async () => {
    const repoUrl = repoInput.value.trim();
    if (!repoUrl) {
      window.Clarity.toast.show("Please enter a repository URL", "warning");
      return;
    }

    submitBtn.disabled = true;
    fetchBtn.disabled = true;
    progressBox.style.display = "block";
    progressText.textContent = "Downloading repository from GitHub...";

    try {
      progressText.textContent = "Extracting files, scanning frameworks, and indexing knowledge...";
      const res = await window.Clarity.api.post("/api/github/import", {
        repoUrl,
        branch: branchSelect.value || "main",
        token: tokenInput.value.trim() || undefined,
        name: nameInput.value.trim() || undefined,
      });

      window.Clarity.toast.show("Project imported and analyzed! " + (res.filesCount || 0) + " files indexed.", "success");
      close();
      window.location.hash = "#/project/" + res.project.id;
    } catch (err) {
      submitBtn.disabled = false;
      fetchBtn.disabled = false;
      progressBox.style.display = "none";
      window.Clarity.toast.show("Import failed: " + (err.message || "Unknown error"), "danger");
    }
  });
}

/* ============================================================
   ZIP Upload Pipeline
   ============================================================ */
async function handleZipUpload(file) {
  if (!file.name.toLowerCase().endsWith(".zip")) {
    window.Clarity.toast.show("Only .zip files are supported", "danger");
    return;
  }

  const progCont = document.getElementById("uploadProgressContainer");
  if (progCont) {
    progCont.style.display = "block";
    progCont.innerHTML = [
      '<div class="card" style="padding:16px; border:1px solid var(--accent); background:var(--surface);">' +
        '<div class="hstack" style="justify-content:space-between; margin-bottom:8px;">' +
          '<strong style="font-size:14px; color:var(--ink);">Analyzing ' + window.Clarity.utils.escapeHtml(file.name) + '...</strong>' +
          '<span class="muted" style="font-size:12px;">Universal Understanding Engine</span>' +
        '</div>' +
        '<div style="width:100%; height:6px; background:var(--line); border-radius:999px; overflow:hidden;">' +
          '<div style="width:60%; height:100%; background:var(--accent); border-radius:999px; animation: pulse 1.5s infinite;"></div>' +
        '</div>' +
        '<div class="muted" style="font-size:12px; margin-top:8px;">Extracting files safely, scanning dependencies, tracing architecture, and cataloging APIs...</div>' +
      '</div>'
    ].join("");
  }

  try {
    const fd = new FormData();
    fd.append("file", file, file.name);
    fd.append("name", file.name.replace(/\.zip$/i, ""));

    const resp = await fetch(window.Clarity.api.base + "/api/projects/upload-zip", {
      method: "POST",
      body: fd,
    });

    if (!resp.ok) {
      const errJson = await resp.json().catch(() => ({}));
      throw new Error(errJson.error || "Failed to upload and analyze project ZIP.");
    }

    const resData = await resp.json();
    window.Clarity.toast.show("Project analyzed successfully! " + (resData.filesCount || 0) + " files indexed.", "success");
    window.location.hash = "#/project/" + resData.project.id;
  } catch (err) {
    console.error("ZIP upload error:", err);
    window.Clarity.toast.show("Upload failed: " + (err.message || "Unknown error"), "danger");
    if (progCont) progCont.style.display = "none";
  }
}

/* ============================================================
   Project Detail View (Comprehensive Intelligence Dashboard)
   ============================================================ */
let activeProjectTab = "overview";
let activeFileNode = null;

async function renderProjectDetail(main, projectId) {
  let project = null;
  let analysis = null;
  let treeData = null;

  try {
    const [pRes, aRes, tRes] = await Promise.all([
      window.Clarity.api.get("/api/projects/" + projectId),
      window.Clarity.api.get("/api/projects/" + projectId + "/analysis"),
      window.Clarity.api.get("/api/projects/" + projectId + "/tree"),
    ]);
    project = pRes.project;
    analysis = aRes.analysis;
    treeData = tRes;
  } catch (err) {
    main.innerHTML = [
      '<div class="page"><div class="page__inner">',
      '<header class="page__header"><h1 class="page__title">Project Not Found</h1></header>',
      '<p class="muted">Could not find or load project with ID: ' + window.Clarity.utils.escapeHtml(projectId) + '</p>',
      '<div style="margin-top:16px;"><button class="btn btn--outline" id="backToProjectsBtn">← Back to Projects</button></div>',
      '</div></div>'
    ].join("");
    document.getElementById("backToProjectsBtn")?.addEventListener("click", () => window.location.hash = "#/project");
    return;
  }

  // Render container
  main.innerHTML = [
    '<div class="page project-page"><div class="page__inner">',
    '<header class="page__header" style="align-items:flex-start;">',
    '<div>',
    '<div class="hstack" style="gap:8px; margin-bottom:4px;">',
    '<button class="btn btn--ghost btn--sm" id="backBtn" style="padding:0 6px;" title="Back to projects">← Back</button>',
    '<span class="muted">/</span>',
    '<span class="muted">' + window.Clarity.utils.escapeHtml(analysis.projectType) + '</span>',
    '</div>',
    '<h1 class="page__title" style="display:flex; align-items:center; gap:12px;">',
    window.Clarity.utils.escapeHtml(project.name),
    '<span class="tag" style="background:var(--accent-soft); color:var(--accent); font-size:13px; font-weight:600;">' + window.Clarity.utils.escapeHtml(analysis.primaryLanguage) + '</span>',
    '</h1>',
    '<p class="page__subtitle">' + window.Clarity.utils.escapeHtml(analysis.summary) + '</p>',
    '</div>',
    '<div class="hstack" style="gap:8px; flex-wrap:wrap;">',
    '<button class="btn btn--outline btn--sm" id="exportReportBtn" title="Download comprehensive Markdown report">',
    '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    ' Export Report</button>',
    '<button class="btn btn--outline btn--sm" id="reAnalyzeBtn" title="Re-run static intelligence scanner">',
    '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
    ' Re-Analyze</button>',
    '<button class="btn btn--primary btn--sm" id="openChatTabBtn">',
    '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    ' Ask AI About Project</button>',
    '<button class="btn btn--primary btn--sm" id="deleteProjectDetailBtn" title="Delete this project">',
    '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    ' Delete Project</button>',
    '</div></header>',

    // Navigation Tabs
    '<nav class="project-tabs-bar" id="projectTabsBar">',
    '<button class="project-tab-btn ' + (activeProjectTab === 'overview' ? 'is-active' : '') + '" data-tab="overview">Overview</button>',
    '<button class="project-tab-btn ' + (activeProjectTab === 'knowledge' ? 'is-active' : '') + '" data-tab="knowledge">Knowledge RAG</button>',
    '<button class="project-tab-btn ' + (activeProjectTab === 'files' ? 'is-active' : '') + '" data-tab="files">Code Explorer <span class="project-badge">' + (treeData.total || 0) + '</span></button>',
    '<button class="project-tab-btn ' + (activeProjectTab === 'architecture' ? 'is-active' : '') + '" data-tab="architecture">Architecture <span class="project-badge">' + analysis.architecture.nodes.length + '</span></button>',
    '<button class="project-tab-btn ' + (activeProjectTab === 'dataflow' ? 'is-active' : '') + '" data-tab="dataflow">Data Flow <span class="project-badge">' + analysis.dataFlow.steps.length + '</span></button>',
    '<button class="project-tab-btn ' + (activeProjectTab === 'apis' ? 'is-active' : '') + '" data-tab="apis">APIs <span class="project-badge">' + analysis.apiIntelligence.endpoints.length + '</span></button>',
    '<button class="project-tab-btn ' + (activeProjectTab === 'database' ? 'is-active' : '') + '" data-tab="database">Database <span class="project-badge">' + (analysis.databaseIntelligence.models.length || (analysis.databaseIntelligence.detected ? 1 : 0)) + '</span></button>',
    '<button class="project-tab-btn ' + (activeProjectTab === 'dependencies' ? 'is-active' : '') + '" data-tab="dependencies">Dependencies <span class="project-badge">' + analysis.dependencies.length + '</span></button>',
    '<button class="project-tab-btn ' + (activeProjectTab === 'security' ? 'is-active' : '') + '" data-tab="security">Security <span class="project-badge" style="' + (analysis.securityAnalysis.findings.length ? 'background:rgba(239,68,68,0.15); color:#dc2626;' : '') + '">' + analysis.securityAnalysis.findings.length + '</span></button>',
    '<button class="project-tab-btn ' + (activeProjectTab === 'quality' ? 'is-active' : '') + '" data-tab="quality">Code Quality <span class="project-badge">' + analysis.codeQuality.score + '/100</span></button>',
    '<button class="project-tab-btn ' + (activeProjectTab === 'viva' ? 'is-active' : '') + '" data-tab="viva">Viva / Defense Prep</button>',
    '<button class="project-tab-btn ' + (activeProjectTab === 'artifacts' ? 'is-active' : '') + '" data-tab="artifacts">Assets & Files <span class="project-badge" id="artifactsTabBadge">0</span></button>',
    '<button class="project-tab-btn ' + (activeProjectTab === 'chat' ? 'is-active' : '') + '" data-tab="chat">Project AI Assistant</button>',
    '<button class="project-tab-btn ' + (activeProjectTab === 'run' ? 'is-active' : '') + '" data-tab="run">Run & Test</button>',
    '</nav>',

    // Dynamic Tab Body Container
    '<div id="projectTabContent"></div>',
    '</div></div>'
  ].join("");

  // Update initial artifacts badge count
  window.Clarity.api.get("/api/projects/" + projectId + "/artifacts").then(res => {
    const badge = document.getElementById("artifactsTabBadge");
    if (badge && res && res.artifacts) {
      badge.textContent = String(res.artifacts.length);
    }
  }).catch(() => {});

  // Bind Header actions
  document.getElementById("backBtn")?.addEventListener("click", () => window.location.hash = "#/project");
  document.getElementById("exportReportBtn")?.addEventListener("click", () => {
    window.open(window.Clarity.api.base + "/api/projects/" + projectId + "/report", "_blank");
  });
  document.getElementById("reAnalyzeBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("reAnalyzeBtn");
    btn.disabled = true;
    btn.textContent = "Scanning...";
    try {
      await window.Clarity.api.post("/api/projects/" + projectId + "/analyze");
      window.Clarity.toast.show("Analysis updated", "success");
      renderProjectDetail(main, projectId);
    } catch (err) {
      window.Clarity.toast.show("Re-analysis failed: " + (err.message || ""), "danger");
      btn.disabled = false;
      btn.textContent = "Re-Analyze";
    }
  });
  document.getElementById("openChatTabBtn")?.addEventListener("click", () => {
    switchTab("chat");
  });
  document.getElementById("deleteProjectDetailBtn")?.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to permanently delete this project and all its analyzed data?")) return;
    const btn = document.getElementById("deleteProjectDetailBtn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Deleting...";
    }
    try {
      await window.Clarity.api.del("/api/projects/" + projectId);
      window.Clarity.toast.show("Project deleted successfully", "success");
      window.location.hash = "#/project";
    } catch (err) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Delete Project";
      }
      window.Clarity.toast.show("Delete failed: " + (err.message || "Unknown error"), "danger");
    }
  });

  // Tab switching logic
  const tabContentEl = document.getElementById("projectTabContent");
  const tabButtons = document.querySelectorAll(".project-tab-btn");

  function switchTab(tabId) {
    activeProjectTab = tabId;
    tabButtons.forEach(btn => {
      btn.classList.toggle("is-active", btn.getAttribute("data-tab") === tabId);
    });
    renderActiveTab();
  }

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      switchTab(btn.getAttribute("data-tab"));
    });
  });

  function renderActiveTab() {
    if (!tabContentEl) return;
    if (activeProjectTab === "overview") renderOverviewTab(tabContentEl, analysis, project, switchTab);
    else if (activeProjectTab === "files") renderFilesTab(tabContentEl, treeData, projectId);
    else if (activeProjectTab === "architecture") renderArchitectureTab(tabContentEl, analysis, switchTabToFile, projectId);
    else if (activeProjectTab === "dataflow") renderDataFlowTab(tabContentEl, analysis, switchTabToFile);
    else if (activeProjectTab === "apis") renderApisTab(tabContentEl, analysis, switchTabToFile);
    else if (activeProjectTab === "database") renderDatabaseTab(tabContentEl, analysis, switchTabToFile);
    else if (activeProjectTab === "dependencies") renderDependenciesTab(tabContentEl, analysis);
    else if (activeProjectTab === "security") renderSecurityTab(tabContentEl, analysis, switchTabToFile);
    else if (activeProjectTab === "quality") renderQualityTab(tabContentEl, analysis, switchTabToFile);
    else if (activeProjectTab === "viva") renderVivaTab(tabContentEl, analysis, switchTabToFile);
    else if (activeProjectTab === "artifacts") renderArtifactsTab(tabContentEl, projectId, analysis, switchTab);
    else if (activeProjectTab === "chat") renderProjectChatTab(tabContentEl, projectId, analysis);
    else if (activeProjectTab === "run") renderRunTestTab(tabContentEl, projectId, analysis);
  }

  function switchTabToFile(filePath, lineNumber) {
    activeProjectTab = "files";
    activeFileNode = filePath;
    tabButtons.forEach(btn => {
      btn.classList.toggle("is-active", btn.getAttribute("data-tab") === "files");
    });
    renderFilesTab(tabContentEl, treeData, projectId, filePath, lineNumber);
  }
  window.Clarity.jumpToFile = switchTabToFile;
  window.Clarity.currentProjectId = projectId;

  renderActiveTab();
}

/* ============================================================
   Tab 1: Overview
   ============================================================ */
function renderOverviewTab(container, analysis, project, switchTab) {
  const langBar = analysis.languages.map(l => {
    return '<div title="' + l.name + ': ' + l.percentage + '%" style="width:' + l.percentage + '%; height:100%; background:' + getLangColor(l.name) + ';"></div>';
  }).join("");

  const langLegend = analysis.languages.map(l => {
    return '<div class="hstack" style="gap:6px; font-size:12.5px;">' +
      '<span style="width:10px; height:10px; border-radius:50%; background:' + getLangColor(l.name) + ';"></span>' +
      '<span><strong>' + l.name + '</strong> ' + l.percentage + '% (' + l.filesCount + ' files)</span>' +
    '</div>';
  }).join("");

  const githubBanner = project.github
    ? '<div class="card" style="padding:16px 20px; border:1px solid rgba(59,130,246,0.25); background:rgba(59,130,246,0.04); border-radius:12px; margin-bottom:20px;">' +
        '<div class="hstack" style="justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">' +
          '<div class="hstack" style="gap:12px; align-items:center;">' +
            '<div style="width:36px; height:36px; border-radius:8px; background:#24292e; color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0;">' +
              '<svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>' +
            '</div>' +
            '<div>' +
              '<div style="font-weight:600; font-size:14px; color:var(--ink); display:flex; align-items:center; gap:8px;">' +
                '<span>' + window.Clarity.utils.escapeHtml(project.github.owner + '/' + project.github.repo) + '</span>' +
                '<span class="tag tag--xs" style="background:var(--accent-soft); color:var(--accent); font-weight:600;">' + window.Clarity.utils.escapeHtml(project.github.branch) + '</span>' +
                '<span class="tag tag--xs" style="' + (project.github.status === 'synced' ? 'background:rgba(16,185,129,0.15); color:#059669;' : 'background:rgba(239,68,68,0.15); color:#dc2626;') + ' font-weight:600;">' + window.Clarity.utils.escapeHtml(project.github.status.toUpperCase()) + '</span>' +
              '</div>' +
              '<div style="font-size:12px; color:var(--ink-muted); margin-top:2px;">' +
                'Source: GitHub Repository • Last synchronized: ' + (project.github.lastSyncedAt ? new Date(project.github.lastSyncedAt).toLocaleString() : 'Just now') +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="hstack" style="gap:8px;">' +
            '<a href="https://github.com/' + encodeURIComponent(project.github.owner) + '/' + encodeURIComponent(project.github.repo) + '/tree/' + encodeURIComponent(project.github.branch) + '" target="_blank" rel="noopener" class="btn btn--outline btn--sm">View on GitHub ↗</a>' +
            '<button class="btn btn--primary btn--sm" id="syncGithubBtn">' +
              '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>' +
              ' Sync Latest Code' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    : '';

  container.innerHTML = [
    githubBanner,
    '<div class="project-kpi-grid">',
    '<div class="project-kpi-card">',
    '<span class="project-kpi-card__label">Total Files</span>',
    '<span class="project-kpi-card__val">' + analysis.fileStats.totalFiles + '</span>',
    '<span class="project-kpi-card__sub">' + analysis.fileStats.totalLines.toLocaleString() + ' lines of code</span>',
    '</div>',
    '<div class="project-kpi-card">',
    '<span class="project-kpi-card__label">Primary Tech</span>',
    '<span class="project-kpi-card__val" style="font-size:20px;">' + analysis.primaryLanguage + '</span>',
    '<span class="project-kpi-card__sub">' + (analysis.frameworks[0] || "Universal") + '</span>',
    '</div>',
    '<div class="project-kpi-card">',
    '<span class="project-kpi-card__label">Security Health</span>',
    '<span class="project-kpi-card__val" style="color:' + (analysis.securityAnalysis.score >= 80 ? 'var(--success)' : analysis.securityAnalysis.score >= 50 ? 'var(--warning)' : 'var(--danger)') + '">' + analysis.securityAnalysis.score + '/100</span>',
    '<span class="project-kpi-card__sub">' + analysis.securityAnalysis.findings.length + ' findings detected</span>',
    '</div>',
    '<div class="project-kpi-card">',
    '<span class="project-kpi-card__label">Code Quality</span>',
    '<span class="project-kpi-card__val" style="color:' + (analysis.codeQuality.score >= 80 ? 'var(--success)' : 'var(--warning)') + '">' + analysis.codeQuality.score + '/100</span>',
    '<span class="project-kpi-card__sub">' + analysis.codeQuality.issues.length + ' maintainability points</span>',
    '</div>',
    '</div>',

    '<div class="grid-2" style="margin-bottom:24px;">',
    // Tech Breakdown
    '<div class="card" style="padding:20px; border:1px solid var(--line); background:var(--surface);">' +
      '<h3 style="font-size:15px; font-weight:600; margin-bottom:12px; color:var(--ink);">Languages & Distribution</h3>' +
      '<div style="width:100%; height:10px; border-radius:999px; overflow:hidden; display:flex; margin-bottom:16px; background:var(--line);">' + langBar + '</div>' +
      '<div style="display:flex; flex-wrap:wrap; gap:16px;">' + langLegend + '</div>' +
    '</div>',

    // Ecosystem & Runtimes
    '<div class="card" style="padding:20px; border:1px solid var(--line); background:var(--surface);">' +
      '<h3 style="font-size:15px; font-weight:600; margin-bottom:12px; color:var(--ink);">Frameworks & Tooling</h3>' +
      '<div style="display:flex; flex-direction:column; gap:10px;">' +
        '<div class="hstack" style="justify-content:space-between; font-size:13px;"><span class="muted">Frameworks</span><span style="font-weight:600;">' + (analysis.frameworks.join(", ") || "Standard / Vanilla") + '</span></div>' +
        '<div class="hstack" style="justify-content:space-between; font-size:13px;"><span class="muted">Runtimes</span><span style="font-weight:600;">' + (analysis.runtimes.join(", ") || "Generic System") + '</span></div>' +
        '<div class="hstack" style="justify-content:space-between; font-size:13px;"><span class="muted">Build Tools</span><span style="font-weight:600;">' + (analysis.buildTools.join(", ") || "Standard CLI") + '</span></div>' +
        '<div class="hstack" style="justify-content:space-between; font-size:13px;"><span class="muted">Automated Tests</span><span style="font-weight:600;">' + (analysis.codeQuality.testing.hasTests ? '✓ Yes (' + analysis.codeQuality.testing.testFilesCount + ' test files)' : '✗ None detected') + '</span></div>' +
      '</div>' +
    '</div>',
    '</div>',

    // Quick Architectural Teaser
    '<div class="card" style="padding:20px; border:1px solid var(--line); background:var(--surface);">' +
      '<div class="hstack" style="justify-content:space-between; margin-bottom:12px;">' +
        '<h3 style="font-size:15px; font-weight:600; color:var(--ink);">Architecture Synthesis</h3>' +
        '<button class="btn btn--ghost btn--sm" id="viewFullArchBtn">View full architecture →</button>' +
      '</div>' +
      '<p style="font-size:14px; line-height:1.6; color:var(--ink-muted); margin-bottom:16px;">' + window.Clarity.utils.escapeHtml(analysis.architecture.summary) + '</p>' +
      '<div class="arch-grid">' +
        analysis.architecture.nodes.slice(0, 4).map(node => {
          return '<div class="arch-card" style="background:var(--surface-muted);">' +
            '<div class="arch-card__head"><strong>' + window.Clarity.utils.escapeHtml(node.label) + '</strong><span class="arch-badge arch-badge--' + node.type + '">' + node.type + '</span></div>' +
            '<p style="font-size:12.5px; color:var(--ink-muted); line-height:1.4;">' + window.Clarity.utils.escapeHtml(node.description) + '</p>' +
          '</div>';
        }).join("") +
      '</div>' +
    '</div>'
  ].join("");

  document.getElementById("viewFullArchBtn")?.addEventListener("click", () => switchTab("architecture"));

  const syncBtn = document.getElementById("syncGithubBtn");
  if (syncBtn) {
    syncBtn.addEventListener("click", async () => {
      syncBtn.disabled = true;
      syncBtn.innerHTML = '<span class="spinner" style="width:14px; height:14px; border:2px solid currentColor; border-top-color:transparent; border-radius:50%; display:inline-block; animation:spin 1s linear infinite;"></span> Syncing...';
      window.Clarity.toast.show("Fetching latest changes from GitHub...", "info");
      try {
        const syncRes = await window.Clarity.api.post("/api/projects/" + project.id + "/github/sync", {});
        window.Clarity.toast.show(syncRes.message || "Project synchronized successfully!", "success");
        renderProjectDetail(document.getElementById("app") || document.querySelector("main"), project.id);
      } catch (err) {
        syncBtn.disabled = false;
        syncBtn.innerHTML = 'Sync Latest Code';
        window.Clarity.toast.show("Sync failed: " + (err.message || "Unknown error"), "danger");
      }
    });
  }
}

/* ============================================================
   Tab 2: VS Code-Style Universal Project File Manager (Step 4)
   ============================================================ */
function renderFilesTab(container, treeData, projectId, initialSelectPath, initialLineNumber) {
  let currentTree = treeData.tree || [];
  let currentFiles = treeData.files || [];
  let currentStats = {
    totalFiles: treeData.totalFiles || currentFiles.length,
    totalFolders: treeData.totalFolders || 0,
    totalSize: treeData.totalSize || 0,
    totalLines: treeData.totalLines || 0,
    categories: treeData.categories || {},
  };

  let activeCategory = "all";
  let searchMode = "name"; // "name" | "content"
  let searchQuery = "";
  let openFolders = new Set();
  let editingFile = false;
  let currentFileContent = "";
  let activeFileRecord = null;
  let projectDiagnostics = null;
  let isProjectAnalysisView = false;
  let viewMode = "code"; // "code" | "markdown-preview"
  let activeFileDiagnostics = null;
  let isProblemsPanelOpen = false;
  let inCodeSearchMatches = [];
  let currentSearchMatchIndex = -1;
  let activeLineNum = null;
  let inCodeSearchQuery = "";

  container.innerHTML = [
    '<div class="vscode-explorer" id="vscodeExplorerWrapper">',
    // Left Sidebar: Explorer
    '<aside class="vscode-sidebar" id="vscodeSidebar">',
    // Top Action Toolbar
    '<div class="vscode-toolbar">',
    '<div class="vscode-toolbar-group">',
    '<button class="vscode-toolbar-btn" id="fmNewFileBtn" title="New File" aria-label="New File">',
    '<svg class="icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>',
    '</button>',
    '<button class="vscode-toolbar-btn" id="fmNewFolderBtn" title="New Folder" aria-label="New Folder">',
    '<svg class="icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><line x1="12" y1="10" x2="12" y2="16"/><line x1="9" y1="13" x2="15" y2="13"/></svg>',
    '</button>',
    '<button class="vscode-toolbar-btn" id="fmUploadFilesBtn" title="Upload Files" aria-label="Upload Files">',
    '<svg class="icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    '</button>',
    '<button class="vscode-toolbar-btn" id="fmUploadFolderBtn" title="Upload Folder" aria-label="Upload Folder">',
    '<svg class="icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><polyline points="12 11 12 17"/><polyline points="9 14 12 11 15 14"/></svg>',
    '</button>',
    '<button class="vscode-toolbar-btn" id="fmUploadZipBtn" title="Upload & Merge ZIP Archive" aria-label="Upload ZIP">',
    '<svg class="icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v20"/><path d="M14 2v20"/><path d="M4 14h6"/><path d="M14 10h6"/><path d="M4 18h6"/><path d="M14 6h6"/></svg>',
    '</button>',
    '</div>',
    '<div class="vscode-toolbar-group">',
    '<button class="vscode-toolbar-btn" id="fmExportZipBtn" title="Download Full Project as ZIP" aria-label="Export ZIP">',
    '<svg class="icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    '</button>',
    '<button class="vscode-toolbar-btn" id="fmRefreshBtn" title="Refresh Files" aria-label="Refresh">\n      <svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>\n    </button>\n    <button class="vscode-toolbar-btn" id="fmReindexBtn" title="Reindex Project & Repair References" aria-label="Reindex">\n      <svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>\n    </button>',
    '</div>',
    '</div>',

    // Hidden inputs for uploads
    '<input type="file" id="fmFileInput" multiple hidden>',
    '<input type="file" id="fmFolderInput" webkitdirectory directory multiple hidden>',
    '<input type="file" id="fmZipInput" accept=".zip" hidden>',

    // Search bar with Content Search toggle
    '<div class="vscode-search">',
    '<div style="display:flex; align-items:center; gap:6px;">',
    '<input type="text" id="vscodeSearchInput" placeholder="Filter files (e.g. app.js, routes)..." style="flex:1;">',
    '<button class="vscode-toolbar-btn" id="toggleContentSearchBtn" title="Toggle full-text content search">',
    '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
    '</button>',
    '</div>',
    '</div>',

    // Category Filter Chips
    '<div class="vscode-category-filters" id="vscodeCategoryFilters">',
    '<button class="vscode-filter-chip is-active" data-cat="all">All</button>',
    '<button class="vscode-filter-chip" data-cat="code">Code</button>',
    '<button class="vscode-filter-chip" data-cat="config">Config</button>',
    '<button class="vscode-filter-chip" data-cat="document">Docs</button>',
    '<button class="vscode-filter-chip" data-cat="data">Data</button>',
    '<button class="vscode-filter-chip" data-cat="image">Images</button>',
    '</div>',

    // Tree Container
    '<div class="vscode-tree" id="vscodeTreeContainer"></div>',

    // Footer Stats Bar
    '<div style="padding:6px 12px; border-top:1px solid var(--line); font-size:11px; color:var(--ink-muted); display:flex; justify-content:space-between; background:var(--surface);">' +
    '<span id="fmStatsLeft">Loading...</span>' +
    '<span id="fmStatsRight"></span>' +
    '</div>',
    '</aside>',

    // Right Pane: Code Viewer & Editor
    '<main class="vscode-viewer" id="vscodeViewerPane">',
    '<div class="vscode-viewer__head">',
    '<div class="vscode-viewer__meta" id="viewerMeta">',
    '<span class="muted">Select any file to inspect code</span>',
    '</div>',
    '<div class="vscode-viewer__actions" id="viewerActions" style="display:none;">',
    '<button class="btn btn--outline btn--sm" id="searchInFileBtn" title="Find in file (Ctrl+F)"><svg class="icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>Find</button>',
    '<button class="btn btn--outline btn--sm" id="jumpToLineBtn" title="Go to line (Ctrl+G)">Go to Line</button>',
    '<button class="btn btn--outline btn--sm" id="diagnosticsToggleBtn" title="Code Problems & Diagnostics">Problems (0)</button>',
    '<button class="btn btn--outline btn--sm" id="editCodeBtn" title="Edit file in-place">Edit</button>',
    '<button class="btn btn--primary btn--sm" id="saveCodeBtn" style="display:none;" title="Save changes">Save</button>',
    '<button class="btn btn--outline btn--sm" id="cancelEditBtn" style="display:none;" title="Discard changes">Cancel</button>',
    '<button class="btn btn--outline btn--sm" id="mdPreviewToggleBtn" style="display:none;" title="Toggle Markdown preview">Preview</button>',
    '<button class="btn btn--outline btn--sm" id="copyCodeBtn" title="Copy clean code without line numbers"><svg class="icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>Copy</button>',
    '<button class="btn btn--outline btn--sm" id="downloadFileBtn" title="Download this file">Download</button>',
    '<button class="btn btn--primary btn--sm" id="askAboutFileBtn">Ask AI</button>',
    '</div>',
    '</div>',
    '<div class="vscode-viewer__content" id="viewerContent">',
    '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--ink-muted); padding:40px; text-align:center;">',
    '<svg class="icon" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:12px; opacity:0.6;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
    '<p style="font-size:14px; font-weight:500;">Select a file from the explorer or create/upload new files.</p>',
    '<p class="muted" style="font-size:12.5px; margin-top:4px;">Supports full syntax preview, editing, folder management, and AI grounding.</p>',
    '</div>',
    '</div>',
    '</main>',
    '</div>',

    // Modal Container
    '<div id="fmModalContainer"></div>'
  ].join("");

  const treeCont = document.getElementById("vscodeTreeContainer");
  const searchInput = document.getElementById("vscodeSearchInput");
  const toggleContentSearchBtn = document.getElementById("toggleContentSearchBtn");
  const catFilters = document.getElementById("vscodeCategoryFilters");
  const sidebar = document.getElementById("vscodeSidebar");

  // Update Stats Footer
  function updateStatsDisplay() {
    const left = document.getElementById("fmStatsLeft");
    const right = document.getElementById("fmStatsRight");
    if (left) {
      left.textContent = currentStats.totalFiles + " files · " + currentStats.totalFolders + " folders";
    }
    if (right) {
      right.textContent = formatSize(currentStats.totalSize) + (currentStats.totalLines ? " · " + currentStats.totalLines.toLocaleString() + "L" : "");
    }
  }
  updateStatsDisplay();

  // Reload tree from server
  async function refreshTree() {
    try {
      const data = await window.Clarity.api.get("/api/projects/" + projectId + "/tree");
      currentTree = data.tree || [];
      currentFiles = data.files || [];
      currentStats = {
        totalFiles: data.totalFiles || currentFiles.length,
        totalFolders: data.totalFolders || 0,
        totalSize: data.totalSize || 0,
        totalLines: data.totalLines || 0,
        categories: data.categories || {},
      };
      updateStatsDisplay();
      renderCurrentView();

      // Update badge in tabs bar if present
      const tabBadge = document.querySelector('[data-tab="files"] .project-badge');
      if (tabBadge) tabBadge.textContent = currentStats.totalFiles;
    } catch (err) {
      window.Clarity.toast.show("Failed to refresh file tree: " + (err.message || ""), "danger");
    }
  }

  function renderCurrentView() {
    if (searchMode === "content" && searchQuery.length >= 2) {
      performContentSearch(searchQuery);
    } else {
      renderTreeNodes(currentTree, searchQuery, activeCategory);
    }
  }

  // Content Search via Backend
  async function performContentSearch(query) {
    if (!treeCont) return;
    treeCont.innerHTML = '<div class="muted" style="padding:16px; font-size:12.5px;"><span class="spinner" style="width:14px; height:14px; vertical-align:middle; margin-right:6px;"></span> Searching project files...</div>';
    try {
      const data = await window.Clarity.api.get("/api/projects/" + projectId + "/search?q=" + encodeURIComponent(query) + (activeCategory !== "all" ? "&category=" + encodeURIComponent(activeCategory) : ""));
      const results = data.results || [];
      if (results.length === 0) {
        treeCont.innerHTML = '<div class="muted" style="padding:16px; font-size:12.5px;">No matches found for "' + window.Clarity.utils.escapeHtml(query) + '".</div>';
        return;
      }

      treeCont.innerHTML = [
        '<div style="padding:6px 10px; font-size:11.5px; font-weight:600; color:var(--ink-muted); text-transform:uppercase;">',
        results.length + ' Matching Files:',
        '</div>',
        '<div class="vscode-search-matches">',
        results.map(r => {
          const isSelected = activeFileNode === r.file;
          const matchLinesHtml = r.matches && r.matches.length > 0
            ? r.matches.map(m => '<div class="search-match-line">Line ' + m.line + ': ' + window.Clarity.utils.escapeHtml(m.text) + '</div>').join("")
            : '';
          return '<div class="search-match-item ' + (isSelected ? 'is-selected' : '') + '" data-file-path="' + window.Clarity.utils.escapeHtml(r.file) + '">' +
            '<div style="display:flex; align-items:center; gap:6px; font-size:12.5px; font-weight:500;">' +
              '<span>' + fileTypeIcon(r.extension) + '</span>' +
              '<span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + window.Clarity.utils.escapeHtml(r.file) + '</span>' +
              '<span class="muted" style="font-size:11px;">' + (r.lineCount ? r.lineCount + 'L' : '') + '</span>' +
            '</div>' +
            matchLinesHtml +
          '</div>';
        }).join(""),
        '</div>'
      ].join("");

      treeCont.querySelectorAll(".search-match-item").forEach(item => {
        item.addEventListener("click", () => {
          const path = item.getAttribute("data-file-path");
          activeFileNode = path;
          treeCont.querySelectorAll(".search-match-item").forEach(el => el.classList.remove("is-selected"));
          item.classList.add("is-selected");
          loadFileIntoViewer(path);
        });
      });
    } catch (err) {
      treeCont.innerHTML = '<div class="project-notice" style="margin:10px;">Search failed: ' + window.Clarity.utils.escapeHtml(err.message || "") + '</div>';
    }
  }

  // Render Tree Nodes
  function renderTreeNodes(nodes, filterVal, category) {
    if (!treeCont) return;

    if (filterVal || category !== "all") {
      let filtered = currentFiles;
      if (category !== "all") {
        filtered = filtered.filter(f => f.category === category);
      }
      if (filterVal) {
        const q = filterVal.toLowerCase();
        filtered = filtered.filter(f => f.path.toLowerCase().includes(q));
      }

      if (filtered.length === 0) {
        treeCont.innerHTML = '<div class="muted" style="padding:16px; font-size:12.5px;">No files found matching criteria.</div>';
        return;
      }

      treeCont.innerHTML = filtered.map(f => {
        const isSelected = activeFileNode === f.path;
        return '<div class="tree-file-node ' + (isSelected ? 'is-selected' : '') + '" data-file-path="' + window.Clarity.utils.escapeHtml(f.path) + '">' +
          '<div class="tree-node-content">' +
            '<span style="font-size:13px;">' + fileTypeIcon(f.extension) + '</span>' +
            '<span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + window.Clarity.utils.escapeHtml(f.path) + '</span>' +
            (f.lineCount ? '<span class="muted" style="font-size:11px;">' + f.lineCount + 'L</span>' : '') +
          '</div>' +
          '<div class="tree-node-actions">' +
            '<button class="tree-node-btn" data-action="rename-file" data-path="' + window.Clarity.utils.escapeHtml(f.path) + '" title="Rename file">✏️</button>' +
            '<button class="tree-node-btn tree-node-btn--danger" data-action="delete-file" data-path="' + window.Clarity.utils.escapeHtml(f.path) + '" title="Delete file">🗑️</button>' +
          '</div>' +
        '</div>';
      }).join("");
    } else {
      treeCont.innerHTML = generateTreeHtml(nodes, 0);
    }
    bindTreeEvents();
  }

  function generateTreeHtml(nodes, depth) {
    let html = "";
    for (const node of nodes) {
      const paddingLeft = (depth * 14 + 8) + "px";
      if (node.type === "dir") {
        const isOpen = openFolders.has(node.path) || depth === 0;
        html += '<div class="tree-folder ' + (isOpen ? 'is-open' : '') + '" data-folder-path="' + window.Clarity.utils.escapeHtml(node.path) + '" style="padding-left:' + paddingLeft + '">' +
          '<div class="tree-node-content">' +
            '<svg class="icon tree-folder__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>' +
            '<span style="font-size:13px;">📁</span>' +
            '<span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:500;">' + window.Clarity.utils.escapeHtml(node.name) + '</span>' +
          '</div>' +
          '<div class="tree-node-actions">' +
            '<button class="tree-node-btn" data-action="new-file-in-folder" data-folder="' + window.Clarity.utils.escapeHtml(node.path) + '" title="New file inside this folder">+</button>' +
            '<button class="tree-node-btn" data-action="rename-folder" data-folder="' + window.Clarity.utils.escapeHtml(node.path) + '" title="Rename folder">✏️</button>' +
            '<button class="tree-node-btn tree-node-btn--danger" data-action="delete-folder" data-folder="' + window.Clarity.utils.escapeHtml(node.path) + '" title="Delete folder">🗑️</button>' +
          '</div>' +
        '</div>' +
        '<div class="tree-children" style="display:' + (isOpen ? 'block' : 'none') + ';">' +
        (node.children ? generateTreeHtml(node.children, depth + 1) : "") +
        '</div>';
      } else {
        const isSelected = activeFileNode === node.path;
        html += '<div class="tree-file-node ' + (isSelected ? 'is-selected' : '') + '" data-file-path="' + window.Clarity.utils.escapeHtml(node.path) + '" style="padding-left:' + paddingLeft + '">' +
          '<div class="tree-node-content">' +
            '<span style="font-size:13px;">' + fileTypeIcon(node.extension) + '</span>' +
            '<span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + window.Clarity.utils.escapeHtml(node.name) + '</span>' +
            (node.lineCount ? '<span class="muted" style="font-size:11px;">' + node.lineCount + 'L</span>' : '') +
          '</div>' +
          '<div class="tree-node-actions">' +
            '<button class="tree-node-btn" data-action="rename-file" data-path="' + window.Clarity.utils.escapeHtml(node.path) + '" title="Rename file">✏️</button>' +
            '<button class="tree-node-btn tree-node-btn--danger" data-action="delete-file" data-path="' + window.Clarity.utils.escapeHtml(node.path) + '" title="Delete file">🗑️</button>' +
          '</div>' +
        '</div>';
      }
    }
    return html;
  }

  function bindTreeEvents() {
    // Folders expand/collapse
    treeCont.querySelectorAll(".tree-folder").forEach(folder => {
      const folderPath = folder.getAttribute("data-folder-path");
      folder.querySelector(".tree-node-content")?.addEventListener("click", (e) => {
        e.stopPropagation();
        folder.classList.toggle("is-open");
        const next = folder.nextElementSibling;
        const isOpen = folder.classList.contains("is-open");
        if (isOpen) openFolders.add(folderPath);
        else openFolders.delete(folderPath);
        if (next && next.classList.contains("tree-children")) {
          next.style.display = isOpen ? "block" : "none";
        }
      });
    });

    // File click to inspect
    treeCont.querySelectorAll(".tree-file-node").forEach(fileEl => {
      fileEl.querySelector(".tree-node-content")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        const path = fileEl.getAttribute("data-file-path");
        if (editingFile && !confirm("You have unsaved changes. Discard and switch file?")) {
          return;
        }
        editingFile = false;
        activeFileNode = path;
        treeCont.querySelectorAll(".tree-file-node").forEach(el => el.classList.remove("is-selected"));
        fileEl.classList.add("is-selected");
        await loadFileIntoViewer(path);
      });
    });

    // Node Action Buttons
    treeCont.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const action = btn.getAttribute("data-action");
        if (action === "new-file-in-folder") {
          const folder = btn.getAttribute("data-folder");
          openCreateFileModal(folder);
        } else if (action === "rename-file") {
          const path = btn.getAttribute("data-path");
          openRenameModal("file", path);
        } else if (action === "delete-file") {
          const path = btn.getAttribute("data-path");
          openDeleteModal("file", path);
        } else if (action === "rename-folder") {
          const folder = btn.getAttribute("data-folder");
          openRenameModal("folder", folder);
        } else if (action === "delete-folder") {
          const folder = btn.getAttribute("data-folder");
          openDeleteModal("folder", folder);
        }
      });
    });
  }

  // Load File Into Viewer
  async function loadFileIntoViewer(path, targetLine) {
    const meta = document.getElementById("viewerMeta");
    const actions = document.getElementById("viewerActions");
    const content = document.getElementById("viewerContent");
    if (!meta || !content) return;

    meta.innerHTML = '<span class="spinner" style="width:14px; height:14px;"></span> Loading ' + window.Clarity.utils.escapeHtml(path) + '...';

    try {
      const data = await window.Clarity.api.get("/api/projects/" + projectId + "/file?path=" + encodeURIComponent(path));
      activeFileRecord = data;
      currentFileContent = data.content || "";
      activeFileDiagnostics = null;
      inCodeSearchMatches = [];
      currentSearchMatchIndex = -1;
      activeLineNum = null;

      const isImg = data.category === "image";
      const isMd = data.extension === ".md" || data.extension === ".markdown";
      const ext = data.extension || path.split(".").pop() || "";
      const lines = data.lineCount || (currentFileContent ? currentFileContent.split(/\r?\n/).length : 0);

      // Meta Header with Breadcrumbs & Badges
      const pathParts = path.split("/");
      const breadcrumbs = pathParts.map((p, idx) => {
        const isLast = idx === pathParts.length - 1;
        return isLast
          ? '<strong>' + window.Clarity.utils.escapeHtml(p) + '</strong>'
          : '<span class="muted">' + window.Clarity.utils.escapeHtml(p) + '</span>';
      }).join(' <span class="muted">/</span> ');

      meta.innerHTML = [
        '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">',
        breadcrumbs,
        '<span class="tag" style="background:var(--accent-soft); color:var(--accent); font-size:11px;">' + window.Clarity.utils.escapeHtml(data.language || ext) + '</span>',
        '<span class="tag" style="background:var(--surface-muted); font-size:11px;">' + window.Clarity.utils.escapeHtml(data.category) + '</span>',
        lines ? '<span class="muted" style="font-size:12px;">' + lines.toLocaleString() + ' lines</span>' : '',
        '<span class="muted" style="font-size:12px;">' + formatSize(data.size) + '</span>',
        '</div>'
      ].join("");

      if (actions) actions.style.display = "flex";

      // Show/hide relevant action buttons
      const editBtn = document.getElementById("editCodeBtn");
      const saveBtn = document.getElementById("saveCodeBtn");
      const cancelBtn = document.getElementById("cancelEditBtn");
      const mdBtn = document.getElementById("mdPreviewToggleBtn");
      const searchBtn = document.getElementById("searchInFileBtn");
      const jumpBtn = document.getElementById("jumpToLineBtn");
      const diagBtn = document.getElementById("diagnosticsToggleBtn");

      if (editBtn) editBtn.style.display = isImg || data.isBinary ? "none" : "inline-flex";
      if (saveBtn) saveBtn.style.display = "none";
      if (cancelBtn) cancelBtn.style.display = "none";
      if (mdBtn) mdBtn.style.display = isMd ? "inline-flex" : "none";
      if (searchBtn) searchBtn.style.display = isImg || data.isBinary ? "none" : "inline-flex";
      if (jumpBtn) jumpBtn.style.display = isImg || data.isBinary ? "none" : "inline-flex";
      if (diagBtn) {
        diagBtn.style.display = isImg || data.isBinary ? "none" : "inline-flex";
        diagBtn.textContent = "Problems (0)";
        diagBtn.className = "btn btn--outline btn--sm";
      }

      renderViewerContent(false);

      if (targetLine && !isNaN(targetLine)) {
        setTimeout(() => jumpToLine(targetLine, true), 120);
      }

      // Trigger automatic diagnostic analysis for non-binary code files
      if (!isImg && !data.isBinary && currentFileContent) {
        fetchAndRenderDiagnostics(data.path, currentFileContent);
      }

    } catch (err) {
      meta.innerHTML = '<span style="color:var(--danger)">Failed to load file</span>';
      content.innerHTML = '<div class="project-notice" style="margin:20px;">' + window.Clarity.utils.escapeHtml(err.message || "") + '</div>';
    }
  }

  function renderViewerContent(isEditMode) {
    const content = document.getElementById("viewerContent");
    const editBtn = document.getElementById("editCodeBtn");
    const saveBtn = document.getElementById("saveCodeBtn");
    const cancelBtn = document.getElementById("cancelEditBtn");
    const searchBtn = document.getElementById("searchInFileBtn");
    const jumpBtn = document.getElementById("jumpToLineBtn");
    const diagBtn = document.getElementById("diagnosticsToggleBtn");
    if (!content || !activeFileRecord) return;

    if (isEditMode) {
      editingFile = true;
      if (editBtn) editBtn.style.display = "none";
      if (saveBtn) saveBtn.style.display = "inline-flex";
      if (cancelBtn) cancelBtn.style.display = "inline-flex";
      if (searchBtn) searchBtn.style.display = "none";
      if (jumpBtn) jumpBtn.style.display = "none";
      if (diagBtn) diagBtn.style.display = "none";

      content.innerHTML = [
        '<div class="vscode-editor-container">',
        '<div class="vscode-editor-bar">',
        '<span>Editing: <strong>' + window.Clarity.utils.escapeHtml(activeFileRecord.path) + '</strong></span>',
        '<span class="muted">Ctrl+S to save changes • Syncs project intelligence</span>',
        '</div>',
        '<textarea class="vscode-editor-textarea" id="vscodeEditTextarea" spellcheck="false">' + window.Clarity.utils.escapeHtml(currentFileContent) + '</textarea>',
        '</div>'
      ].join("");

      const ta = document.getElementById("vscodeEditTextarea");
      if (ta) {
        ta.focus();
        ta.addEventListener("keydown", (e) => {
          if (e.key === "Tab") {
            e.preventDefault();
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            ta.value = ta.value.substring(0, start) + "  " + ta.value.substring(end);
            ta.selectionStart = ta.selectionEnd = start + 2;
          } else if ((e.metaKey || e.ctrlKey) && e.key === "s") {
            e.preventDefault();
            saveActiveFile();
          }
        });
      }
      return;
    }

    editingFile = false;
    const isImg = activeFileRecord.category === "image";
    const isBin = activeFileRecord.isBinary;
    if (editBtn) editBtn.style.display = isImg || isBin ? "none" : "inline-flex";
    if (saveBtn) saveBtn.style.display = "none";
    if (cancelBtn) cancelBtn.style.display = "none";
    if (searchBtn) searchBtn.style.display = isImg || isBin ? "none" : "inline-flex";
    if (jumpBtn) jumpBtn.style.display = isImg || isBin ? "none" : "inline-flex";
    if (diagBtn) diagBtn.style.display = isImg || isBin ? "none" : "inline-flex";

    // Image Preview
    if (isImg) {
      const src = activeFileRecord.extension === ".svg"
        ? "data:image/svg+xml;utf8," + encodeURIComponent(activeFileRecord.content || "")
        : "/api/projects/" + projectId + "/file?path=" + encodeURIComponent(activeFileRecord.path);

      content.innerHTML = [
        '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:30px; background:var(--surface-muted);">' +
        '<div style="padding:20px; background:var(--surface); border:1px solid var(--line); border-radius:var(--r-card); box-shadow:var(--shadow-soft); max-width:85%; max-height:85%; display:flex; align-items:center; justify-content:center;">' +
        '<img src="' + src + '" alt="' + window.Clarity.utils.escapeHtml(activeFileRecord.name) + '" style="max-width:100%; max-height:480px; object-fit:contain; border-radius:6px;">' +
        '</div>' +
        '<div class="muted" style="margin-top:12px; font-size:12.5px;">Image Preview • ' + formatSize(activeFileRecord.size) + '</div>' +
        '</div>'
      ].join("");
      return;
    }

    // Markdown Preview mode
    if (viewMode === "markdown-preview" && window.Clarity.markdown && window.Clarity.markdown.render) {
      content.innerHTML = '<div style="padding:24px 32px; max-width:840px; margin:0 auto; overflow-y:auto; height:100%;" class="markdown-body">' +
        window.Clarity.markdown.render(currentFileContent) +
      '</div>';
      return;
    }

    // VS Code-Style Code Explorer & Editor View
    const rawLines = currentFileContent ? currentFileContent.split(/\r?\n/) : [""];

    // Highlight lines using PrismJS
    const highlightedLines = window.Clarity.highlighter && window.Clarity.highlighter.highlightLines
      ? window.Clarity.highlighter.highlightLines(currentFileContent, activeFileRecord.path || activeFileRecord.extension)
      : rawLines.map(l => window.Clarity.utils.escapeHtml(l));

    // Map problems by line number
    const problemsByLine = new Map();
    if (activeFileDiagnostics && activeFileDiagnostics.issues) {
      for (const issue of activeFileDiagnostics.issues) {
        if (!problemsByLine.has(issue.line)) {
          problemsByLine.set(issue.line, []);
        }
        problemsByLine.get(issue.line).push(issue);
      }
    }

    const rowsHtml = rawLines.map((_, idx) => {
      const lineNum = idx + 1;
      const issuesOnLine = problemsByLine.get(lineNum) || [];
      const hasError = issuesOnLine.some(i => i.severity === "error");
      const hasWarning = issuesOnLine.some(i => i.severity === "warning");
      const hasInfo = issuesOnLine.some(i => i.severity === "info");

      let markerHtml = "";
      if (hasError) {
        const err = issuesOnLine.find(i => i.severity === "error");
        markerHtml = '<span class="gutter-marker gutter-marker--error" title="' + window.Clarity.utils.escapeHtml(err.message) + '">●</span>';
      } else if (hasWarning) {
        const warn = issuesOnLine.find(i => i.severity === "warning");
        markerHtml = '<span class="gutter-marker gutter-marker--warning" title="' + window.Clarity.utils.escapeHtml(warn.message) + '">▲</span>';
      } else if (hasInfo) {
        markerHtml = '<span class="gutter-marker gutter-marker--info" title="Suggestion">ℹ</span>';
      }

      const lineClass = hasError ? "has-error" : (hasWarning ? "has-warning" : "");
      const codeHtml = highlightedLines[idx] || " ";

      return [
        '<tr class="code-line-row" id="L' + lineNum + '" data-line="' + lineNum + '">',
        '<td class="code-gutter-cell" data-line="' + lineNum + '" title="Line ' + lineNum + '">',
        '<span class="gutter-num">' + lineNum + '</span>' + markerHtml,
        '</td>',
        '<td class="code-content-cell ' + lineClass + '" data-line="' + lineNum + '">',
        '<pre class="code-pre"><code>' + codeHtml + '</code></pre>',
        '</td>',
        '</tr>'
      ].join("");
    }).join("");

    
    // Add context explain button logic after rendering
    setTimeout(() => {
      const stage = document.getElementById("vscodeEditorStage");
      if (stage) {
        let explainBtn = document.getElementById("explainCodeFloatBtn");
        if (!explainBtn) {
           explainBtn = document.createElement("button");
           explainBtn.id = "explainCodeFloatBtn";
           explainBtn.className = "btn btn--sm btn--primary";
           explainBtn.style.position = "fixed";
           explainBtn.style.display = "none";
           explainBtn.style.zIndex = "9999";
           explainBtn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
           explainBtn.textContent = "✨ Explain Code";
           document.body.appendChild(explainBtn);
        }
        
        stage.addEventListener("mouseup", (e) => {
          const selection = window.getSelection();
          const text = selection.toString().trim();
          if (text.length > 0) {
            const rect = selection.getRangeAt(0).getBoundingClientRect();
            explainBtn.style.display = "block";
            explainBtn.style.top = (rect.top - 36) + "px";
            explainBtn.style.left = (rect.left + (rect.width/2) - 50) + "px";
            
            explainBtn.onclick = () => {
               explainBtn.style.display = "none";
               const chatTabBtn = document.querySelector('.project-tab-btn[data-tab="chat"]');
               if (chatTabBtn) chatTabBtn.click();
               setTimeout(() => {
                 const chatInput = document.getElementById("projectChatInput");
                 const chatForm = document.getElementById("projectChatForm");
                 if (chatInput && chatForm) {
                   chatInput.value = "Explain this code in " + activeFileRecord.path + ":\n\n```\n" + text + "\n```";
                   chatForm.dispatchEvent(new Event("submit"));
                 }
               }, 100);
            };
          } else {
            explainBtn.style.display = "none";
          }
        });
        document.addEventListener("mousedown", (e) => {
          if (e.target.id !== "explainCodeFloatBtn") {
            explainBtn.style.display = "none";
          }
        }, { once: false });
      }
    }, 100);

    content.innerHTML = [
      '<div class="vscode-editor-stage" id="vscodeEditorStage">',
      // In-Code Search Bar
      '<div class="vscode-in-file-search" id="vscodeInFileSearchBar" style="display:none;">',
      '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#858585;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
      '<input type="text" id="inFileSearchInput" placeholder="Find in file..." autocomplete="off" spellcheck="false">',
      '<span id="inFileSearchCount" style="font-size:11.5px; color:#858585; min-width:48px;">0 of 0</span>',
      '<button class="btn btn--ghost btn--sm" id="inFileSearchPrevBtn" title="Previous match (Shift+Enter)" style="padding:2px 6px; color:#cccccc;">▲</button>',
      '<button class="btn btn--ghost btn--sm" id="inFileSearchNextBtn" title="Next match (Enter)" style="padding:2px 6px; color:#cccccc;">▼</button>',
      '<button class="btn btn--ghost btn--sm" id="inFileSearchCloseBtn" title="Close search (Esc)" style="padding:2px 6px; color:#cccccc;">✕</button>',
      '</div>',

      // Code Viewport with Sticky Gutter & Table Layout
      '<div class="vscode-code-viewport" id="vscodeCodeViewport">',
      '<table class="vscode-editor-table" id="vscodeEditorTable">',
      '<tbody>' + rowsHtml + '</tbody>',
      '</table>',
      '</div>',

      // Bottom Diagnostics / Problems Panel
      '<div class="vscode-problems-panel" id="vscodeProblemsPanel" style="' + (isProblemsPanelOpen ? 'display:flex;' : 'display:none;') + '">',
      '<div class="vscode-problems-panel__head">',
      '<div class="vscode-problems-panel__tabs">',
      '<span style="font-weight:600; color:#e4e4e7;" id="problemsTabTitle">PROBLEMS (0)</span>',
      '<span id="problemsBadgeCounts" style="display:flex; gap:6px; font-size:11px;"></span>',
      '</div>',
      '<div style="display:flex; align-items:center; gap:8px;">',
      '<button class="btn btn--ghost btn--sm" id="reAnalyzeCodeBtn" title="Re-analyze code with parser & intelligence" style="padding:2px 8px; font-size:11px; color:#a1a1aa;">↻ Refresh</button>',
      '<button class="btn btn--ghost btn--sm" id="closeProblemsPanelBtn" title="Close problems panel" style="padding:2px 8px; font-size:12px; color:#a1a1aa;">✕</button>',
      '</div>',
      '</div>',
      '<div class="vscode-problems-panel__list" id="problemsListContainer"></div>',
      '</div>',

      '</div>'
    ].join("");

    // Populate Problems Panel if open
    renderProblemsList();

    // Wire table row clicks
    const table = document.getElementById("vscodeEditorTable");
    if (table) {
      table.addEventListener("click", (e) => {
        const row = e.target.closest(".code-line-row");
        if (!row) return;
        const lineNum = parseInt(row.getAttribute("data-line"), 10);
        setActiveLine(lineNum, false);
      });
    }

    // Wire In-File Search inputs and buttons
    wireInFileSearch();

    // Wire Problems Panel controls
    document.getElementById("closeProblemsPanelBtn")?.addEventListener("click", () => {
      isProblemsPanelOpen = false;
      const panel = document.getElementById("vscodeProblemsPanel");
      if (panel) panel.style.display = "none";
    });

    
    document.getElementById("reAnalyzeCodeBtn")?.addEventListener("click", () => {
      isProjectAnalysisView = false;
      if (activeFileRecord) {
        fetchAndRenderDiagnostics(activeFileRecord.path, currentFileContent);
      }
    });

    const analyzeProjBtn = document.createElement("button");
    analyzeProjBtn.className = "btn btn--outline btn--sm";
    analyzeProjBtn.style.padding = "2px 8px";
    analyzeProjBtn.style.fontSize = "11px";
    analyzeProjBtn.innerHTML = "Analyze Project";
    analyzeProjBtn.title = "Run full project intelligence analysis";
    analyzeProjBtn.addEventListener("click", async () => {
       isProjectAnalysisView = true;
       analyzeProjBtn.innerHTML = "Analyzing...";
       analyzeProjBtn.disabled = true;
       try {
         const res = await window.Clarity.api.post("/api/projects/" + projectId + "/diagnostics/project");
         projectDiagnostics = res;
         // Override activeFileDiagnostics visually for the panel
         activeFileDiagnostics = res; 
         renderProblemsList();
       } catch (e) {
         window.Clarity.toast.show("Project analysis failed.", "danger");
       } finally {
         analyzeProjBtn.innerHTML = "Analyze Project";
         analyzeProjBtn.disabled = false;
       }
    });
    
    document.getElementById("reAnalyzeCodeBtn")?.parentElement?.insertBefore(analyzeProjBtn, document.getElementById("reAnalyzeCodeBtn"));

  }

  // Fetch and apply real code diagnostics
  async function fetchAndRenderDiagnostics(filePath, codeContent) {
    const diagBtn = document.getElementById("diagnosticsToggleBtn");
    if (diagBtn) {
      diagBtn.innerHTML = '<span class="spinner" style="width:12px; height:12px; margin-right:4px;"></span> Checking...';
    }

    try {
      const data = await window.Clarity.api.post("/api/projects/" + projectId + "/diagnostics", {
        path: filePath,
        content: codeContent,
      });

      activeFileDiagnostics = data; isProjectAnalysisView = false;
      const summary = data.summary || { errors: 0, warnings: 0, suggestions: 0 };
      const totalIssues = (summary.errors || 0) + (summary.warnings || 0) + (summary.suggestions || 0);

      if (diagBtn) {
        if (summary.errors > 0) {
          diagBtn.innerHTML = 'Problems (' + summary.errors + ' ❌)';
          diagBtn.className = "btn btn--sm btn--danger";
        } else if (summary.warnings > 0) {
          diagBtn.innerHTML = 'Problems (' + summary.warnings + ' ⚠️)';
          diagBtn.className = "btn btn--sm btn--warning";
        } else if (summary.suggestions > 0) {
          diagBtn.innerHTML = 'Problems (' + summary.suggestions + ' ℹ️)';
          diagBtn.className = "btn btn--outline btn--sm";
        } else {
          diagBtn.innerHTML = 'Problems (0)';
          diagBtn.className = "btn btn--outline btn--sm";
        }
      }

      // Auto-open problems panel if errors were found
      if (summary.errors > 0 && !isProblemsPanelOpen) {
        isProblemsPanelOpen = true;
      }

      // Update Gutter Markers and Underlines in the rendered table
      updateGutterMarkersAndUnderlines(data.issues || []);

      // Update Problems Panel UI
      const panel = document.getElementById("vscodeProblemsPanel");
      if (panel) {
        panel.style.display = isProblemsPanelOpen ? "flex" : "none";
      }
      renderProblemsList();

    } catch (err) {
      console.warn("Diagnostics check failed:", err);
      if (diagBtn) {
        diagBtn.textContent = "Problems (0)";
        diagBtn.className = "btn btn--outline btn--sm";
      }
    }
  }

  function updateGutterMarkersAndUnderlines(issues) {
    const table = document.getElementById("vscodeEditorTable");
    if (!table) return;

    // Reset previous gutter markers and error classes
    table.querySelectorAll(".gutter-marker").forEach(m => m.remove());
    table.querySelectorAll(".code-content-cell").forEach(c => {
      c.classList.remove("has-error", "has-warning");
    });

    const issuesByLine = new Map();
    for (const issue of issues) {
      if (!issuesByLine.has(issue.line)) issuesByLine.set(issue.line, []);
      issuesByLine.get(issue.line).push(issue);
    }

    issuesByLine.forEach((lineIssues, lineNum) => {
      const row = document.getElementById("L" + lineNum);
      if (!row) return;

      const gutterCell = row.querySelector(".code-gutter-cell");
      const contentCell = row.querySelector(".code-content-cell");

      const hasError = lineIssues.some(i => i.severity === "error");
      const hasWarning = lineIssues.some(i => i.severity === "warning");

      if (contentCell) {
        if (hasError) contentCell.classList.add("has-error");
        else if (hasWarning) contentCell.classList.add("has-warning");
      }

      if (gutterCell) {
        let marker = "";
        if (hasError) {
          const err = lineIssues.find(i => i.severity === "error");
          marker = '<span class="gutter-marker gutter-marker--error" title="' + window.Clarity.utils.escapeHtml(err.message) + '">●</span>';
        } else if (hasWarning) {
          const warn = lineIssues.find(i => i.severity === "warning");
          marker = '<span class="gutter-marker gutter-marker--warning" title="' + window.Clarity.utils.escapeHtml(warn.message) + '">▲</span>';
        } else {
          marker = '<span class="gutter-marker gutter-marker--info" title="Suggestion">ℹ</span>';
        }
        gutterCell.insertAdjacentHTML("beforeend", marker);
      }
    });
  }

  function renderProblemsList() {
    const listCont = document.getElementById("problemsListContainer");
    const title = document.getElementById("problemsTabTitle");
    const badges = document.getElementById("problemsBadgeCounts");
    if (!listCont) return;

    const issues = (activeFileDiagnostics && activeFileDiagnostics.issues) || [];
    const summary = (activeFileDiagnostics && activeFileDiagnostics.summary) || { errors: 0, warnings: 0, suggestions: 0 };
    const total = issues.length;

    if (title) title.textContent = 'PROBLEMS (' + total + ')';

    if (badges) {
      badges.innerHTML = [
        summary.errors > 0 ? '<span style="color:#ef4444; font-weight:600;">' + summary.errors + ' Errors</span>' : '',
        summary.warnings > 0 ? '<span style="color:#f59e0b; font-weight:600;">' + summary.warnings + ' Warnings</span>' : '',
        summary.suggestions > 0 ? '<span style="color:#3b82f6; font-weight:600;">' + summary.suggestions + ' Info</span>' : '',
      ].filter(Boolean).join(' <span style="color:#52525b;">•</span> ');
    }

    if (issues.length === 0) {
      listCont.innerHTML = [
        '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:24px; color:#a1a1aa; text-align:center;">',
        '<span style="font-size:24px; margin-bottom:6px;">✓</span>',
        '<div style="font-size:13px; font-weight:500; color:#e4e4e7;">No problems detected in this file</div>',
        '<div style="font-size:11.5px; color:#71717a; margin-top:2px;">Parser, compiler syntax, and project intelligence checks clean.</div>',
        '</div>'
      ].join("");
      return;
    }

    listCont.innerHTML = issues.map(issue => {
      const isErr = issue.severity === "error";
      const isWarn = issue.severity === "warning";
      const icon = isErr ? '❌' : (isWarn ? '⚠️' : 'ℹ️');
      const typeBadge = '<span class="tag" style="font-size:10px; padding:1px 6px; background:' + (isErr ? 'rgba(239,68,68,0.15); color:#f87171;' : (isWarn ? 'rgba(245,158,11,0.15); color:#fbbf24;' : 'rgba(59,130,246,0.15); color:#60a5fa;')) + '">' + window.Clarity.utils.escapeHtml(issue.type) + '</span>';

      const fixBtn = (issue.patchedContent || issue.suggestedCode)
        ? '<button class="btn btn--primary btn--sm apply-fix-btn" data-issue-id="' + issue.id + '" style="font-size:11px; padding:3px 8px;">Apply Fix</button>'
        : '';

      return [
        '<div class="problem-item" data-line="' + issue.line + '" data-file="' + window.Clarity.utils.escapeHtml(issue.file || '') + '">',
        '<span class="problem-item__icon">' + icon + '</span>',
        '<div class="problem-item__body">',
        '<div class="problem-item__title">',
        '<span>' + window.Clarity.utils.escapeHtml(issue.message) + '</span>',
        typeBadge,
        '<span class="problem-item__loc">' + window.Clarity.utils.escapeHtml(pathBasename(issue.file)) + ':' + issue.line + ':' + issue.column + '</span>',
        '</div>',
        '<div class="problem-item__explanation">' + window.Clarity.utils.escapeHtml(issue.explanation) + '</div>',
        issue.correction ? '<div class="problem-item__correction">Correction: ' + window.Clarity.utils.escapeHtml(issue.correction) + '</div>' : '',
        '</div>',
        '<div class="problem-item__actions">' + fixBtn + '</div>',
        '</div>'
      ].join("");
    }).join("");

    // Wire clicks on problem items to jump to line
    listCont.querySelectorAll(".problem-item").forEach(item => {
      item.addEventListener("click", (e) => {
        if (e.target.closest(".apply-fix-btn")) return;
        const line = parseInt(item.getAttribute("data-line"), 10);
        const file = item.getAttribute("data-file");
        if (file && (!activeFileRecord || activeFileRecord.path !== file)) {
            // Load file first
            loadFileIntoViewer(file, line);
        } else {
            jumpToLine(line, true);
        }
      });
    });

    // Wire clicks on Apply Fix buttons
    listCont.querySelectorAll(".apply-fix-btn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const issueId = btn.getAttribute("data-issue-id");
        const issue = issues.find(i => i.id === issueId);
        if (issue) {
           if (issue.file && (!activeFileRecord || activeFileRecord.path !== issue.file)) {
               // Must load the target file first
               await loadFileIntoViewer(issue.file, issue.line);
               // Wait a brief moment for state to settle
               setTimeout(() => openDiffFixModal(issue), 100);
           } else {
               openDiffFixModal(issue);
           }
        }
      });
    });
  }

  function pathBasename(p) {
    return (p || "").split("/").pop();
  }

  // Jump to specific line with smooth scrolling and flash animation
  function jumpToLine(targetLine, flash = true) {
    if (!targetLine || isNaN(targetLine)) return;
    const row = document.getElementById("L" + targetLine);
    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
      setActiveLine(targetLine, flash);
    }
  }

  function setActiveLine(lineNum, flash = false) {
    activeLineNum = lineNum;
    const table = document.getElementById("vscodeEditorTable");
    if (!table) return;

    table.querySelectorAll(".code-line-row.is-active-line").forEach(r => r.classList.remove("is-active-line"));
    const row = document.getElementById("L" + lineNum);
    if (row) {
      row.classList.add("is-active-line");
      if (flash) {
        row.classList.remove("is-flashing");
        // Trigger reflow to restart animation
        void row.offsetWidth;
        row.classList.add("is-flashing");
        setTimeout(() => row.classList.remove("is-flashing"), 2000);
      }
    }
  }

  function promptJumpToLine() {
    const rawLines = currentFileContent ? currentFileContent.split(/\r?\n/) : [""];
    const totalLines = rawLines.length;
    const input = prompt("Go to line (1 - " + totalLines + "):", activeLineNum || "1");
    if (input === null) return;
    const lineNum = parseInt(input.trim(), 10);
    if (isNaN(lineNum) || lineNum < 1 || lineNum > totalLines) {
      window.Clarity.toast.show("Please enter a valid line number between 1 and " + totalLines, "warning");
      return;
    }
    jumpToLine(lineNum, true);
  }

  // In-Code Search System
  function toggleInFileSearch(forceOpen) {
    const bar = document.getElementById("vscodeInFileSearchBar");
    const input = document.getElementById("inFileSearchInput");
    if (!bar) return;

    const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : bar.style.display === "none";
    bar.style.display = shouldOpen ? "flex" : "none";

    if (shouldOpen && input) {
      input.focus();
      input.select();
    } else {
      clearInFileSearchHighlights();
    }
  }

  function wireInFileSearch() {
    const input = document.getElementById("inFileSearchInput");
    const prevBtn = document.getElementById("inFileSearchPrevBtn");
    const nextBtn = document.getElementById("inFileSearchNextBtn");
    const closeBtn = document.getElementById("inFileSearchCloseBtn");

    if (input) {
      input.addEventListener("input", () => performInFileSearch(input.value));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (e.shiftKey) navigateInFileSearch(-1);
          else navigateInFileSearch(1);
        } else if (e.key === "Escape") {
          e.preventDefault();
          toggleInFileSearch(false);
        }
      });
    }

    if (prevBtn) prevBtn.addEventListener("click", () => navigateInFileSearch(-1));
    if (nextBtn) nextBtn.addEventListener("click", () => navigateInFileSearch(1));
    if (closeBtn) closeBtn.addEventListener("click", () => toggleInFileSearch(false));
  }

  function performInFileSearch(query) {
    inCodeSearchQuery = (query || "").trim();
    inCodeSearchMatches = [];
    currentSearchMatchIndex = -1;
    const countEl = document.getElementById("inFileSearchCount");

    clearInFileSearchHighlights();

    if (!inCodeSearchQuery) {
      if (countEl) countEl.textContent = "0 of 0";
      return;
    }

    const rawLines = currentFileContent ? currentFileContent.split(/\r?\n/) : [""];
    const qLower = inCodeSearchQuery.toLowerCase();

    for (let i = 0; i < rawLines.length; i++) {
      const lineStr = rawLines[i];
      let pos = lineStr.toLowerCase().indexOf(qLower);
      while (pos !== -1) {
        inCodeSearchMatches.push({ lineNum: i + 1, colStart: pos, length: qLower.length });
        pos = lineStr.toLowerCase().indexOf(qLower, pos + qLower.length);
      }
    }

    if (inCodeSearchMatches.length > 0) {
      currentSearchMatchIndex = 0;
      if (countEl) countEl.textContent = "1 of " + inCodeSearchMatches.length;
      highlightSearchMatches();
      jumpToLine(inCodeSearchMatches[0].lineNum, false);
    } else {
      if (countEl) countEl.textContent = "0 of 0";
    }
  }

  function navigateInFileSearch(dir) {
    if (inCodeSearchMatches.length === 0) return;
    currentSearchMatchIndex = (currentSearchMatchIndex + dir + inCodeSearchMatches.length) % inCodeSearchMatches.length;
    const countEl = document.getElementById("inFileSearchCount");
    if (countEl) countEl.textContent = (currentSearchMatchIndex + 1) + " of " + inCodeSearchMatches.length;
    highlightSearchMatches();
    jumpToLine(inCodeSearchMatches[currentSearchMatchIndex].lineNum, false);
  }

  function highlightSearchMatches() {
    const table = document.getElementById("vscodeEditorTable");
    if (!table || inCodeSearchMatches.length === 0) return;

    // Highlight row containing current match
    const currentMatch = inCodeSearchMatches[currentSearchMatchIndex];
    table.querySelectorAll(".code-line-row").forEach(row => {
      const lineNum = parseInt(row.getAttribute("data-line"), 10);
      const isCurrentMatchLine = currentMatch && currentMatch.lineNum === lineNum;
      const isAnyMatchLine = inCodeSearchMatches.some(m => m.lineNum === lineNum);

      if (isCurrentMatchLine) {
        row.classList.add("is-active-line");
      } else if (!isAnyMatchLine) {
        row.classList.remove("is-active-line");
      }
    });
  }

  function clearInFileSearchHighlights() {
    const table = document.getElementById("vscodeEditorTable");
    if (!table) return;
    table.querySelectorAll(".code-search-highlight").forEach(el => {
      el.replaceWith(el.textContent);
    });
  }

  // Diff Modal: Preview before & after and apply fix directly
  function openDiffFixModal(issue) {
    const modalCont = document.getElementById("fmModalContainer");
    if (!modalCont) return;

    const rawLines = currentFileContent ? currentFileContent.split(/\r?\n/) : [""];
    const currentLineText = issue.currentCode || rawLines[issue.line - 1] || "";
    const suggestedLineText = issue.suggestedCode || issue.correction || "";

    modalCont.innerHTML = [
      '<div class="fm-modal-backdrop" id="diffModalBackdrop">',
      '<div class="fm-modal" style="max-width:540px;">',
      '<div class="fm-modal-header">',
      '<h3>Apply Diagnostic Fix</h3>',
      '<button class="btn btn--ghost btn--sm" id="closeDiffModalBtn">✕</button>',
      '</div>',
      '<div class="fm-modal-body">',
      '<div style="font-size:13px; margin-bottom:12px;">',
      '<strong>' + window.Clarity.utils.escapeHtml(activeFileRecord.path) + '</strong> • Line ' + issue.line + (issue.column ? ':' + issue.column : ''),
      '<div style="color:var(--ink-muted); margin-top:4px; font-weight:500;">' + window.Clarity.utils.escapeHtml(issue.message) + '</div>',
      '</div>',
      '<div class="diff-container">',
      '<div class="diff-box diff-box--before">',
      '<div class="diff-box__title">Before (Line ' + issue.line + ')</div>',
      '<div class="diff-box__content">' + window.Clarity.utils.escapeHtml(currentLineText) + '</div>',
      '</div>',
      '<div class="diff-box diff-box--after">',
      '<div class="diff-box__title">After Fix</div>',
      '<div class="diff-box__content">' + window.Clarity.utils.escapeHtml(suggestedLineText) + '</div>',
      '</div>',
      '</div>',
      '<p style="font-size:12px; color:var(--ink-muted); margin-top:12px; line-height:1.5;">' + window.Clarity.utils.escapeHtml(issue.explanation) + '</p>',
      '</div>',
      '<div class="fm-modal-footer">',
      '<button class="btn btn--outline btn--sm" id="cancelDiffModalBtn">Cancel</button>',
      '<button class="btn btn--primary btn--sm" id="confirmApplyFixBtn">Apply Fix</button>',
      '</div>',
      '</div>',
      '</div>'
    ].join("");

    const closeModal = () => { modalCont.innerHTML = ""; };
    document.getElementById("closeDiffModalBtn")?.addEventListener("click", closeModal);
    document.getElementById("cancelDiffModalBtn")?.addEventListener("click", closeModal);

    document.getElementById("confirmApplyFixBtn")?.addEventListener("click", async () => {
      const confirmBtn = document.getElementById("confirmApplyFixBtn");
      if (confirmBtn) confirmBtn.disabled = true;

      let newContent = issue.patchedContent;
      if (!newContent) {
        const copyLines = [...rawLines];
        copyLines[issue.line - 1] = suggestedLineText;
        newContent = copyLines.join("\n");
      }

      try {
        const res = await window.Clarity.api.put("/api/projects/" + projectId + "/files", {
          path: activeFileRecord.path,
          content: newContent,
        });

        currentFileContent = newContent;
        activeFileRecord.content = newContent;
        activeFileRecord.lineCount = newContent.split(/\r?\n/).length;
        activeFileRecord.size = res.file.size;

        closeModal();
        window.Clarity.toast.show("Applied fix to line " + issue.line, "success");
        renderViewerContent(false);
        jumpToLine(issue.line, true);
        await fetchAndRenderDiagnostics(activeFileRecord.path, newContent);
      } catch (err) {
        window.Clarity.toast.show("Failed to apply fix: " + (err.message || ""), "danger");
        if (confirmBtn) confirmBtn.disabled = false;
      }
    });
  }

  // Save changes to active file
  async function saveActiveFile() {
    if (!activeFileRecord) return;
    const ta = document.getElementById("vscodeEditTextarea");
    const updatedContent = ta ? ta.value : currentFileContent;

    try {
      const res = await window.Clarity.api.put("/api/projects/" + projectId + "/files", {
        path: activeFileRecord.path,
        content: updatedContent,
      });

      currentFileContent = updatedContent;
      activeFileRecord.content = updatedContent;
      activeFileRecord.lineCount = updatedContent.split(/\r?\n/).length;
      activeFileRecord.size = res.file.size;

      window.Clarity.toast.show("Saved " + activeFileRecord.path, "success");
      renderViewerContent(false);
      await refreshTree();
      await fetchAndRenderDiagnostics(activeFileRecord.path, updatedContent);
    } catch (err) {
      window.Clarity.toast.show("Save failed: " + (err.message || ""), "danger");
    }
  }

  // Setup Action Button Listeners
  document.getElementById("editCodeBtn")?.addEventListener("click", () => renderViewerContent(true));
  document.getElementById("saveCodeBtn")?.addEventListener("click", saveActiveFile);
  document.getElementById("cancelEditBtn")?.addEventListener("click", () => renderViewerContent(false));

  document.getElementById("searchInFileBtn")?.addEventListener("click", () => toggleInFileSearch());
  document.getElementById("jumpToLineBtn")?.addEventListener("click", promptJumpToLine);

  document.getElementById("diagnosticsToggleBtn")?.addEventListener("click", () => {
    isProblemsPanelOpen = !isProblemsPanelOpen;
    const panel = document.getElementById("vscodeProblemsPanel");
    if (panel) panel.style.display = isProblemsPanelOpen ? "flex" : "none";
    if (isProblemsPanelOpen) renderProblemsList();
  });

  document.getElementById("mdPreviewToggleBtn")?.addEventListener("click", () => {
    viewMode = viewMode === "code" ? "markdown-preview" : "code";
    const btn = document.getElementById("mdPreviewToggleBtn");
    if (btn) btn.textContent = viewMode === "code" ? "Preview" : "Code";
    renderViewerContent(false);
  });

  document.getElementById("copyCodeBtn")?.addEventListener("click", () => {
    if (activeFileRecord) {
      navigator.clipboard.writeText(currentFileContent);
      const copyBtn = document.getElementById("copyCodeBtn");
      if (copyBtn) {
        const orig = copyBtn.innerHTML;
        copyBtn.innerHTML = '<span style="color:#10b981; font-weight:600;">✓ Copied!</span>';
        setTimeout(() => { if (copyBtn) copyBtn.innerHTML = orig; }, 1500);
      }
      window.Clarity.toast.show("Code copied to clipboard", "success");
    }
  });

  // Global keyboard shortcuts for editor navigation
  window.addEventListener("keydown", (e) => {
    // Only trigger if editor stage is present in DOM
    const editorStage = document.getElementById("vscodeEditorStage");
    if (!editorStage) return;

    if ((e.metaKey || e.ctrlKey) && e.key === "f") {
      e.preventDefault();
      toggleInFileSearch(true);
    } else if ((e.metaKey || e.ctrlKey) && e.key === "g") {
      e.preventDefault();
      promptJumpToLine();
    }
  });

  document.getElementById("downloadFileBtn")?.addEventListener("click", () => {
    if (!activeFileRecord) return;
    const downloadUrl = window.Clarity.api.base + "/api/projects/" + projectId + "/files/download?path=" + encodeURIComponent(activeFileRecord.path);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = activeFileRecord.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  document.getElementById("askAboutFileBtn")?.addEventListener("click", () => {
    if (!activeFileRecord) return;
    const chatTabBtn = document.querySelector('.project-tab-btn[data-tab="chat"]');
    if (chatTabBtn) chatTabBtn.click();
    setTimeout(() => {
      const chatInput = document.getElementById("projectChatInput");
      const chatForm = document.getElementById("projectChatForm");
      if (chatInput && chatForm) {
        chatInput.value = "Explain the project file `" + activeFileRecord.path + "` and its purpose, exports, and relationships.";
        chatForm.dispatchEvent(new Event("submit"));
      }
    }, 100);
  });

  // Search & Category Filters
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      renderCurrentView();
    });
  }

  if (toggleContentSearchBtn) {
    toggleContentSearchBtn.addEventListener("click", () => {
      searchMode = searchMode === "name" ? "content" : "name";
      toggleContentSearchBtn.classList.toggle("is-active", searchMode === "content");
      if (searchInput) {
        searchInput.placeholder = searchMode === "content" ? "Search file contents (e.g. function, API)..." : "Filter files (e.g. app.js, routes)...";
      }
      renderCurrentView();
    });
  }

  if (catFilters) {
    catFilters.querySelectorAll(".vscode-filter-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        catFilters.querySelectorAll(".vscode-filter-chip").forEach(c => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        activeCategory = chip.getAttribute("data-cat");
        renderCurrentView();
      });
    });
  }

  // Toolbar Actions: New File / Folder / Upload / Export / Refresh
  document.getElementById("fmNewFileBtn")?.addEventListener("click", () => openCreateFileModal(""));
  document.getElementById("fmNewFolderBtn")?.addEventListener("click", () => openCreateFolderModal(""));
  document.getElementById("fmRefreshBtn")?.addEventListener("click", () => {
    window.Clarity.toast.show("Refreshing project files...", "info");
    refreshTree();
  });

  // Upload Files Input
  const fileInput = document.getElementById("fmFileInput");
  document.getElementById("fmUploadFilesBtn")?.addEventListener("click", () => fileInput?.click());
  if (fileInput) {
    fileInput.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      e.target.value = "";
      if (files.length > 0) await handleUploadFiles(files);
    });
  }

  // Upload Folder Input
  const folderInput = document.getElementById("fmFolderInput");
  document.getElementById("fmUploadFolderBtn")?.addEventListener("click", () => folderInput?.click());
  if (folderInput) {
    folderInput.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      e.target.value = "";
      if (files.length > 0) await handleUploadFolder(files);
    });
  }

  // Upload ZIP Input
  const zipInput = document.getElementById("fmZipInput");
  document.getElementById("fmUploadZipBtn")?.addEventListener("click", () => zipInput?.click());
  if (zipInput) {
    zipInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file) await handleUploadZip(file);
    });
  }

  // Export Project ZIP
  document.getElementById("fmExportZipBtn")?.addEventListener("click", () => {
    window.location.href = window.Clarity.api.base + "/api/projects/" + projectId + "/export-zip";
  });

  // Drag and drop onto sidebar
  if (sidebar) {
    sidebar.addEventListener("dragover", (e) => {
      e.preventDefault();
      sidebar.style.outline = "2px dashed var(--accent)";
    });
    sidebar.addEventListener("dragleave", () => {
      sidebar.style.outline = "none";
    });
    sidebar.addEventListener("drop", async (e) => {
      e.preventDefault();
      sidebar.style.outline = "none";
      const droppedFiles = Array.from(e.dataTransfer.files || []);
      if (droppedFiles.length === 0) return;

      const zipFile = droppedFiles.find(f => f.name.toLowerCase().endsWith(".zip"));
      if (zipFile && droppedFiles.length === 1) {
        await handleUploadZip(zipFile);
      } else {
        await handleUploadFiles(droppedFiles);
      }
    });
  }

  // Upload Handlers
  async function handleUploadFiles(fileList) {
    const fd = new FormData();
    fd.append("projectId", projectId);
    const paths = [];

    for (const f of fileList) {
      fd.append("files", f, f.name);
      paths.push(f.webkitRelativePath || f.name);
    }
    fd.append("paths", JSON.stringify(paths));

    window.Clarity.toast.show("Uploading " + fileList.length + " files...", "info");
    try {
      const res = await fetch(window.Clarity.api.base + "/api/projects/upload-files", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Upload failed with status " + res.status);
      window.Clarity.toast.show("Successfully uploaded " + fileList.length + " files!", "success");
      await refreshTree();
    } catch (err) {
      window.Clarity.toast.show("File upload failed: " + (err.message || ""), "danger");
    }
  }

  async function handleUploadFolder(fileList) {
    return handleUploadFiles(fileList);
  }

  async function handleUploadZip(zipFile) {
    const fd = new FormData();
    fd.append("file", zipFile, zipFile.name);
    fd.append("projectId", projectId);

    window.Clarity.toast.show("Extracting and merging ZIP archive...", "info");
    try {
      const res = await fetch(window.Clarity.api.base + "/api/projects/upload-zip", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "ZIP upload failed");
      }
      const data = await res.json();
      window.Clarity.toast.show("ZIP merged! " + (data.filesCount || 0) + " files updated.", "success");
      await refreshTree();
    } catch (err) {
      window.Clarity.toast.show("Failed to upload ZIP: " + (err.message || ""), "danger");
    }
  }

  // Modals Implementation
  function openCreateFileModal(targetFolder) {
    const defaultPath = targetFolder ? (targetFolder.endsWith("/") ? targetFolder : targetFolder + "/") : "";
    const modalHtml = [
      '<div class="fm-modal-backdrop" id="fmActiveModalBackdrop">',
      '<div class="fm-modal">',
      '<div class="fm-modal-header">',
      '<h3>Create New File</h3>',
      '<button class="btn btn--ghost btn--icon-sm" id="closeFmModalBtn">&times;</button>',
      '</div>',
      '<div class="fm-modal-body">',
      '<label class="label" style="font-size:13px; font-weight:600; margin-bottom:6px; display:block;">File Path & Name:</label>',
      '<input type="text" id="fmNewFilePath" class="input" style="width:100%; font-family:var(--font-mono); font-size:13px;" placeholder="e.g. src/utils/helpers.js" value="' + window.Clarity.utils.escapeHtml(defaultPath) + '">',
      '<p class="muted" style="font-size:12px; margin-top:6px;">You can specify nested paths like <code>src/components/Button.tsx</code> to automatically place in folders.</p>',
      '<label class="label" style="font-size:13px; font-weight:600; margin-top:14px; margin-bottom:6px; display:block;">Initial Content (Optional):</label>',
      '<textarea id="fmNewFileContent" class="textarea" style="width:100%; height:120px; font-family:var(--font-mono); font-size:12.5px;" placeholder="// Initial code or comments..."></textarea>',
      '</div>',
      '<div class="fm-modal-footer">',
      '<button class="btn btn--outline btn--sm" id="cancelFmModalBtn">Cancel</button>',
      '<button class="btn btn--primary btn--sm" id="submitCreateFileBtn">Create File</button>',
      '</div>',
      '</div>',
      '</div>'
    ].join("");

    const cont = document.getElementById("fmModalContainer");
    if (!cont) return;
    cont.innerHTML = modalHtml;

    const input = document.getElementById("fmNewFilePath");
    input?.focus();
    if (input && defaultPath) {
      input.setSelectionRange(defaultPath.length, defaultPath.length);
    }

    const closeModal = () => { cont.innerHTML = ""; };
    document.getElementById("closeFmModalBtn")?.addEventListener("click", closeModal);
    document.getElementById("cancelFmModalBtn")?.addEventListener("click", closeModal);

    document.getElementById("submitCreateFileBtn")?.addEventListener("click", async () => {
      const filePath = input?.value.trim();
      const content = document.getElementById("fmNewFileContent")?.value || "";
      if (!filePath) {
        window.Clarity.toast.show("Please enter a valid file path", "danger");
        return;
      }
      try {
        await window.Clarity.api.post("/api/projects/" + projectId + "/files", {
          path: filePath,
          content,
        });
        window.Clarity.toast.show("Created file: " + filePath, "success");
        closeModal();
        await refreshTree();
        loadFileIntoViewer(filePath);
      } catch (err) {
        window.Clarity.toast.show("Create file failed: " + (err.message || ""), "danger");
      }
    });
  }

  function openCreateFolderModal(parentFolder) {
    const defaultPath = parentFolder ? (parentFolder.endsWith("/") ? parentFolder : parentFolder + "/") : "";
    const modalHtml = [
      '<div class="fm-modal-backdrop" id="fmActiveModalBackdrop">',
      '<div class="fm-modal">',
      '<div class="fm-modal-header">',
      '<h3>Create New Folder</h3>',
      '<button class="btn btn--ghost btn--icon-sm" id="closeFmModalBtn">&times;</button>',
      '</div>',
      '<div class="fm-modal-body">',
      '<label class="label" style="font-size:13px; font-weight:600; margin-bottom:6px; display:block;">Folder Path:</label>',
      '<input type="text" id="fmNewFolderPath" class="input" style="width:100%; font-family:var(--font-mono); font-size:13px;" placeholder="e.g. src/services" value="' + window.Clarity.utils.escapeHtml(defaultPath) + '">',
      '</div>',
      '<div class="fm-modal-footer">',
      '<button class="btn btn--outline btn--sm" id="cancelFmModalBtn">Cancel</button>',
      '<button class="btn btn--primary btn--sm" id="submitCreateFolderBtn">Create Folder</button>',
      '</div>',
      '</div>',
      '</div>'
    ].join("");

    const cont = document.getElementById("fmModalContainer");
    if (!cont) return;
    cont.innerHTML = modalHtml;

    const input = document.getElementById("fmNewFolderPath");
    input?.focus();

    const closeModal = () => { cont.innerHTML = ""; };
    document.getElementById("closeFmModalBtn")?.addEventListener("click", closeModal);
    document.getElementById("cancelFmModalBtn")?.addEventListener("click", closeModal);

    document.getElementById("submitCreateFolderBtn")?.addEventListener("click", async () => {
      const folderPath = input?.value.trim();
      if (!folderPath) {
        window.Clarity.toast.show("Please enter a folder path", "danger");
        return;
      }
      try {
        await window.Clarity.api.post("/api/projects/" + projectId + "/folders", {
          path: folderPath,
        });
        window.Clarity.toast.show("Created folder: " + folderPath, "success");
        closeModal();
        openFolders.add(folderPath);
        await refreshTree();
      } catch (err) {
        window.Clarity.toast.show("Create folder failed: " + (err.message || ""), "danger");
      }
    });
  }

  function openRenameModal(type, oldPath) {
    const isFile = type === "file";
    const modalHtml = [
      '<div class="fm-modal-backdrop" id="fmActiveModalBackdrop">',
      '<div class="fm-modal">',
      '<div class="fm-modal-header">',
      '<h3>Rename ' + (isFile ? 'File' : 'Folder') + '</h3>',
      '<button class="btn btn--ghost btn--icon-sm" id="closeFmModalBtn">&times;</button>',
      '</div>',
      '<div class="fm-modal-body">',
      '<label class="label" style="font-size:13px; font-weight:600; margin-bottom:6px; display:block;">New Path:</label>',
      '<input type="text" id="fmRenameInput" class="input" style="width:100%; font-family:var(--font-mono); font-size:13px;" value="' + window.Clarity.utils.escapeHtml(oldPath) + '">',
      '</div>',
      '<div class="fm-modal-footer">',
      '<button class="btn btn--outline btn--sm" id="cancelFmModalBtn">Cancel</button>',
      '<button class="btn btn--primary btn--sm" id="submitRenameBtn">Rename</button>',
      '</div>',
      '</div>',
      '</div>'
    ].join("");

    const cont = document.getElementById("fmModalContainer");
    if (!cont) return;
    cont.innerHTML = modalHtml;

    const input = document.getElementById("fmRenameInput");
    input?.focus();

    const closeModal = () => { cont.innerHTML = ""; };
    document.getElementById("closeFmModalBtn")?.addEventListener("click", closeModal);
    document.getElementById("cancelFmModalBtn")?.addEventListener("click", closeModal);

    document.getElementById("submitRenameBtn")?.addEventListener("click", async () => {
      const newPath = input?.value.trim();
      if (!newPath || newPath === oldPath) {
        closeModal();
        return;
      }
      try {
        if (isFile) {
          await window.Clarity.api.patch("/api/projects/" + projectId + "/files/rename", {
            oldPath,
            newPath,
          });
          window.Clarity.toast.show("Renamed to " + newPath, "success");
          if (activeFileNode === oldPath) activeFileNode = newPath;
        } else {
          await window.Clarity.api.patch("/api/projects/" + projectId + "/folders/rename", {
            oldFolderPath: oldPath,
            newFolderPath: newPath,
          });
          window.Clarity.toast.show("Renamed folder to " + newPath, "success");
          if (openFolders.has(oldPath)) {
            openFolders.delete(oldPath);
            openFolders.add(newPath);
          }
        }
        closeModal();
        await refreshTree();
        if (isFile && activeFileNode === newPath) {
          loadFileIntoViewer(newPath);
        }
      } catch (err) {
        window.Clarity.toast.show("Rename failed: " + (err.message || ""), "danger");
      }
    });
  }

  function openDeleteModal(type, itemPath) {
    const isFile = type === "file";
    const modalHtml = [
      '<div class="fm-modal-backdrop" id="fmActiveModalBackdrop">',
      '<div class="fm-modal">',
      '<div class="fm-modal-header">',
      '<h3>Delete ' + (isFile ? 'File' : 'Folder') + '</h3>',
      '<button class="btn btn--ghost btn--icon-sm" id="closeFmModalBtn">&times;</button>',
      '</div>',
      '<div class="fm-modal-body">',
      '<p style="font-size:14px; line-height:1.5;">Are you sure you want to delete <strong>' + window.Clarity.utils.escapeHtml(itemPath) + '</strong>?</p>',
      !isFile ? '<p class="muted" style="font-size:12.5px; margin-top:8px; color:#dc2626;">Warning: All files inside this folder will also be permanently deleted.</p>' : '',
      '</div>',
      '<div class="fm-modal-footer">',
      '<button class="btn btn--outline btn--sm" id="cancelFmModalBtn">Cancel</button>',
      '<button class="btn btn--primary btn--sm" id="submitDeleteBtn">Delete</button>',
      '</div>',
      '</div>',
      '</div>'
    ].join("");

    const cont = document.getElementById("fmModalContainer");
    if (!cont) return;
    cont.innerHTML = modalHtml;

    const closeModal = () => { cont.innerHTML = ""; };
    document.getElementById("closeFmModalBtn")?.addEventListener("click", closeModal);
    document.getElementById("cancelFmModalBtn")?.addEventListener("click", closeModal);

    document.getElementById("submitDeleteBtn")?.addEventListener("click", async () => {
      try {
        if (isFile) {
          await window.Clarity.api.del("/api/projects/" + projectId + "/files?path=" + encodeURIComponent(itemPath));
          window.Clarity.toast.show("Deleted " + itemPath, "success");
          if (activeFileNode === itemPath) {
            activeFileNode = null;
            const meta = document.getElementById("viewerMeta");
            const actions = document.getElementById("viewerActions");
            const content = document.getElementById("viewerContent");
            if (meta) meta.innerHTML = '<span class="muted">Select any file to inspect code</span>';
            if (actions) actions.style.display = "none";
            if (content) content.innerHTML = '<div style="padding:40px; text-align:center; color:var(--ink-muted);">File was deleted.</div>';
          }
        } else {
          await window.Clarity.api.del("/api/projects/" + projectId + "/folders?folderPath=" + encodeURIComponent(itemPath));
          window.Clarity.toast.show("Deleted folder " + itemPath, "success");
          openFolders.delete(itemPath);
        }
        closeModal();
        await refreshTree();
      } catch (err) {
        window.Clarity.toast.show("Delete failed: " + (err.message || ""), "danger");
      }
    });
  }

  // Initial Tree Render
  renderTreeNodes(currentTree, "", "all");

  // Auto-select initial file if requested
  if (initialSelectPath) {
    activeFileNode = initialSelectPath;
    loadFileIntoViewer(initialSelectPath, initialLineNumber);
  } else if (currentFiles.length > 0) {
    const priority = currentFiles.find(f => /readme|index\.|app\.|main\.|package\.json/i.test(f.name)) || currentFiles[0];
    if (priority) {
      activeFileNode = priority.path;
      loadFileIntoViewer(priority.path);
    }
  }
}

/* ============================================================
   Tab 3: Architecture & Visual Project Pipeline Map
   ============================================================ */
function renderArchitectureTab(container, analysis, switchTabToFile, projectId) {
  const arch = analysis.architecture || {};
  const health = arch.health || {};
  const dataFlow = analysis.dataFlow || { steps: [] };

  // State for Architecture Viewer
  let currentViewMode = "graph"; // "graph" | "mindmap" | "dataflow" | "advisor"
  let currentLOD = "high"; // "high" | "detailed" | "symbol" | "file"
  let selectedCategory = "all";
  let showEdgeLabels = true;
  let activeSearchQuery = "";
  let cyInstance = null;
  let selectedNodeData = null;
  let selectedEdgeData = null;
  let isFullscreen = false;
  let advisorData = null;
  let advisorCategoryFilter = "all";
  let activeFlow = null;
  let currentFlowStepIdx = 0;
  let flowPlayInterval = null;
  let selectedDataflowFlowId = "all";

  // Render Skeleton
  container.innerHTML = [
    '<div class="arch-stage" id="archStageWrapper">',

    // 1. Health Summary Header Bar
    '<div class="arch-health-bar">',
    '  <div class="arch-health-items">',
    '    <span class="muted" style="font-weight:600; font-size:11px; text-transform:uppercase; letter-spacing:0.04em;">System Verification:</span>',
    '    <span class="arch-health-chip arch-health-chip--info" id="archAdvisorHealthChip" style="cursor:pointer; display:none; font-weight:600;">Advisor...</span>',
    getHealthChipHtml(health.frontendBackend, "Frontend ↔ Backend"),
    getHealthChipHtml(health.backendDatabase, "Backend ↔ DB"),
    getHealthChipHtml(health.externalServices, "External APIs"),
    getHealthChipHtml(health.authentication, "Auth & Security"),
    arch.orphans && arch.orphans.length > 0
      ? '<span class="arch-health-chip arch-health-chip--warning" title="' + arch.orphans.length + ' orphan modules with no incoming references">⚠ ' + arch.orphans.length + ' Orphans</span>'
      : '<span class="arch-health-chip arch-health-chip--verified" title="Zero orphan modules discovered">✓ No Orphans</span>',
    arch.brokenReferences && arch.brokenReferences.length > 0
      ? '<span class="arch-health-chip arch-health-chip--danger" title="' + arch.brokenReferences.length + ' broken import references">✕ ' + arch.brokenReferences.length + ' Broken Refs</span>'
      : '<span class="arch-health-chip arch-health-chip--verified" title="All module imports resolved">✓ Refs Intact</span>',
    '  </div>',
    '  <div class="hstack" style="gap:8px;">',
    '    <button class="btn btn--primary btn--sm" id="explainArchBtn" style="font-size:12px; padding:5px 12px; gap:6px;">',
    '      <span>Explain Architecture</span>',
    '    </button>',
    '  </div>',
    '</div>',

    // 2. Interactive Controls Toolbar
    '<div class="arch-toolbar">',
    '  <div class="arch-toolbar__group">',
    '    <div class="arch-view-tabs">',
    '      <button class="arch-view-btn is-active" data-view="graph" id="viewGraphBtn">Graph View</button>',
    '      <button class="arch-view-btn" data-view="mindmap" id="viewMindmapBtn">Mind Map</button>',
    '      <button class="arch-view-btn" data-view="dataflow" id="viewDataflowBtn">Pipeline Flow</button>',
    '      <button class="arch-view-btn" data-view="advisor" id="viewAdvisorBtn">Architecture Advisor <span class="badge" id="advisorIssueCountBadge" style="display:none; margin-left:4px; font-size:10px; background:#ef4444; color:#ffffff; padding:1px 6px; border-radius:999px;"></span></button>',
    '    </div>',

    '    <div class="arch-lod-tabs" id="archLodGroup">',
    '      <button class="arch-lod-btn is-active" data-lod="high" title="Major Architectural Subsystems">High-Level</button>',
    '      <button class="arch-lod-btn" data-lod="detailed" title="Subsystems + Routers + Models + Services">Detailed</button>',
    '      <button class="arch-lod-btn" data-lod="symbol" title="Specific API Endpoints & Database Tables">Symbols</button>',
    '      <button class="arch-lod-btn" data-lod="file" title="Source Files & Direct Imports">File-Level</button>',
    '    </div>',
    '  </div>',

    '  <div class="arch-toolbar__group">',
    '    <div class="arch-flow-select-wrapper" id="archFlowSelectWrapper" title="Trace end-to-end execution flow inside this project">',
    '      <span style="font-size:12px; color:var(--accent); font-weight:700;">⚡</span>',
    '      <select class="arch-flow-select" id="archFlowSelector">',
    '        <option value="none">Trace Flow: All Architecture</option>',
    '      </select>',
    '    </div>',

    '    <div class="arch-search-wrapper" id="archSearchWrapper">',
    '      <span class="arch-search-icon">🔍</span>',
    '      <input type="text" class="arch-search-input" id="archSearchInput" placeholder="Search nodes & endpoints..." autocomplete="off">',
    '      <button class="arch-search-clear" id="archSearchClear" style="display:none;">✕</button>',
    '    </div>',

    '    <select class="arch-filter-select" id="archCategoryFilter">',
    '      <option value="all">All Layers</option>',
    '      <option value="frontend">Frontend & UI</option>',
    '      <option value="backend">Backend Services</option>',
    '      <option value="route">API Routes</option>',
    '      <option value="api">API Routers</option>',
    '      <option value="table">Database Tables</option>',
    '      <option value="database">Database Engines</option>',
    '      <option value="service">Client Services</option>',
    '      <option value="auth">Auth & Security</option>',
    '      <option value="external">External Cloud APIs</option>',
    '      <option value="ml">ML & Analytics</option>',
    '      <option value="storage">Storage & Cache</option>',
    '      <option value="devops">Containers & DevOps</option>',
    '      <option value="file">Files</option>',
    '    </select>',

    '    <button class="btn btn--outline btn--sm" id="toggleEdgeLabelsBtn" title="Toggle Connection Labels" style="padding:5px 8px; font-size:11.5px;">Labels: On</button>',

    '    <div class="hstack" style="gap:3px; background:var(--surface-muted); padding:2px; border-radius:6px; border:1px solid var(--line);">',
    '      <button class="btn btn--ghost btn--sm" id="zoomOutBtn" title="Zoom Out" style="padding:3px 8px;">−</button>',
    '      <span id="zoomLevelIndicator" style="font-size:11px; font-family:var(--font-mono); min-width:40px; text-align:center; color:var(--ink-muted);">100%</span>',
    '      <button class="btn btn--ghost btn--sm" id="zoomInBtn" title="Zoom In" style="padding:3px 8px;">+</button>',
    '      <button class="btn btn--ghost btn--sm" id="fitScreenBtn" title="Fit to Screen" style="padding:3px 8px; font-size:11px;">Fit</button>',
    '      <button class="btn btn--ghost btn--sm" id="autoLayoutBtn" title="Re-run Auto Layout" style="padding:3px 8px; font-size:11px;">Layout</button>',
    '      <button class="btn btn--ghost btn--sm" id="resetViewBtn" title="Reset View" style="padding:3px 8px; font-size:11px;">Reset</button>',
    '      <button class="btn btn--ghost btn--sm" id="fullscreenBtn" title="Toggle Fullscreen Canvas" style="padding:3px 8px; font-size:11px;">⛶</button>',
    '    </div>',
    '  </div>',
    '</div>',

    // 3. Main Stage Views Container
    '<div id="archMainStageView" style="position:relative; width:100%; min-height:620px; display:flex; flex-direction:column;">',
    '  <!-- Graph Canvas View -->',
    '  <div class="arch-canvas-stage" id="archGraphContainer">',
    '    <div id="cytoscapeCanvas"></div>',

    '    <!-- Floating Interactive Flow Player HUD -->',
    '    <div class="arch-flow-hud" id="archFlowHud" style="display:none;">',
    '      <div class="arch-flow-hud__info">',
    '        <div class="arch-flow-hud__title" id="archFlowHudTitle">',
    '          <span>⚡</span>',
    '          <span id="archFlowHudTitleText">Application Flow</span>',
    '          <span class="tag tag--xs" id="archFlowHudCategory" style="font-size:10px;">api</span>',
    '        </div>',
    '        <div class="arch-flow-hud__desc" id="archFlowHudDesc">Trigger description</div>',
    '      </div>',
    '      <div class="arch-flow-hud__stepper">',
    '        <button class="arch-flow-btn" id="flowPrevStepBtn" title="Previous execution step">◀ Prev</button>',
    '        <span class="arch-flow-step-badge" id="flowStepBadge">Step 1 of 5</span>',
    '        <button class="arch-flow-btn" id="flowNextStepBtn" title="Next execution step">Next ▶</button>',
    '        <button class="arch-flow-btn arch-flow-btn--primary" id="flowPlayBtn" title="Auto-play flow sequence">Play</button>',
    '        <button class="arch-flow-btn arch-flow-btn--danger" id="flowExitBtn" title="Exit flow trace">✕ Exit</button>',
    '      </div>',
    '    </div>',

    '    <!-- Floating Legend -->',
    '    <div class="arch-legend-floating" id="archLegend">',
    '      <span class="arch-legend-chip"><span class="arch-legend-dot" style="background:#4f46e5;"></span> User</span>',
    '      <span class="arch-legend-chip"><span class="arch-legend-dot" style="background:#2563eb;"></span> Frontend</span>',
    '      <span class="arch-legend-chip"><span class="arch-legend-dot" style="background:#10b981;"></span> Backend</span>',
    '      <span class="arch-legend-chip"><span class="arch-legend-dot" style="background:#f97316;"></span> Route</span>',
    '      <span class="arch-legend-chip"><span class="arch-legend-dot" style="background:#8b5cf6;"></span> DB / Table</span>',
    '      <span class="arch-legend-chip"><span class="arch-legend-dot" style="background:#ef4444;"></span> Auth</span>',
    '      <span class="arch-legend-chip"><span class="arch-legend-dot" style="background:#06b6d4;"></span> Service</span>',
    '      <span class="arch-legend-chip"><span class="arch-legend-dot" style="background:#eab308;"></span> External</span>',
    '      <span class="arch-legend-chip" style="margin-left:auto; font-size:10.5px; opacity:0.8;">Click node or edge for details</span>',
    '    </div>',

    '    <!-- Floating Interactive Minimap -->',
    '    <div class="arch-minimap-card" id="archMinimapWrapper">',
    '      <div class="arch-minimap-header">',
    '        <span>Viewport</span>',
    '        <span id="nodeCountBadge" style="opacity:0.7;">0 nodes</span>',
    '      </div>',
    '      <canvas id="archMinimapCanvas"></canvas>',
    '    </div>',

    '    <!-- Slide-over Inspector Drawer -->',
    '    <div class="arch-inspector-drawer" id="archInspectorDrawer" style="display:none;">',
    '      <div class="arch-inspector-header">',
    '        <div id="inspectorHeaderTitle" style="display:flex; align-items:center; gap:8px;"></div>',
    '        <button class="btn btn--ghost btn--sm" id="closeInspectorBtn" style="padding:2px 8px; font-size:13px;">✕</button>',
    '      </div>',
    '      <div class="arch-inspector-body" id="inspectorBodyContent"></div>',
    '    </div>',
    '  </div>',

    '  <!-- Mind Map View Container -->',
    '  <div id="archMindmapContainer" class="arch-mindmap-container" style="display:none;"></div>',

    '  <!-- Pipeline Data Flow View Container -->',
    '  <div id="archDataflowContainer" class="arch-dataflow-container" style="display:none;"></div>',

    '  <!-- Architecture Advisor View Container -->',
    '  <div id="archAdvisorContainer" class="arch-advisor-container" style="display:none; padding:16px 20px 40px; overflow-y:auto; flex:1;"></div>',
    '</div>',

    // Explanation Modal Container
    '<div id="archModalPortal"></div>',

    // Fix Modal Container
    '<div id="archFixModalPortal"></div>',

    '</div>'
  ].join("");

  // Helper: Health chip generator
  function getHealthChipHtml(healthItem, label) {
    if (!healthItem) return '';
    const status = healthItem.status || 'verified';
    const text = healthItem.text || 'Verified';
    const chipClass = status === 'verified'
      ? 'arch-health-chip--verified'
      : (status === 'warning' ? 'arch-health-chip--warning' : (status === 'danger' ? 'arch-health-chip--danger' : 'arch-health-chip--info'));
    const icon = status === 'verified' ? '✓' : (status === 'warning' ? '⚠' : (status === 'danger' ? '✕' : 'ℹ'));
    return '<span class="arch-health-chip ' + chipClass + '" title="' + window.Clarity.utils.escapeHtml(healthItem.details || text) + '">' + icon + ' ' + window.Clarity.utils.escapeHtml(label) + ': ' + window.Clarity.utils.escapeHtml(text) + '</span>';
  }

  // Bind View Mode Buttons
  const viewGraphBtn = document.getElementById("viewGraphBtn");
  const viewMindmapBtn = document.getElementById("viewMindmapBtn");
  const viewDataflowBtn = document.getElementById("viewDataflowBtn");
  const viewAdvisorBtn = document.getElementById("viewAdvisorBtn");
  const graphContainer = document.getElementById("archGraphContainer");
  const mindmapContainer = document.getElementById("archMindmapContainer");
  const dataflowContainer = document.getElementById("archDataflowContainer");
  const advisorContainer = document.getElementById("archAdvisorContainer");
  const advisorHealthChip = document.getElementById("archAdvisorHealthChip");
  const lodGroup = document.getElementById("archLodGroup");
  const searchWrapper = document.getElementById("archSearchWrapper");

  function setViewMode(mode) {
    currentViewMode = mode;
    [viewGraphBtn, viewMindmapBtn, viewDataflowBtn, viewAdvisorBtn].forEach(b => b?.classList.remove("is-active"));
    if (mode === "graph") {
      viewGraphBtn?.classList.add("is-active");
      if (graphContainer) graphContainer.style.display = "block";
      if (mindmapContainer) mindmapContainer.style.display = "none";
      if (dataflowContainer) dataflowContainer.style.display = "none";
      if (advisorContainer) advisorContainer.style.display = "none";
      if (lodGroup) lodGroup.style.display = "inline-flex";
      if (searchWrapper) searchWrapper.style.display = "flex";
      setTimeout(() => {
        if (cyInstance) {
          cyInstance.resize();
          cyInstance.fit(undefined, 40);
          updateMinimap();
        } else {
          initCytoscape();
        }
      }, 50);
    } else if (mode === "mindmap") {
      viewMindmapBtn?.classList.add("is-active");
      if (graphContainer) graphContainer.style.display = "none";
      if (mindmapContainer) mindmapContainer.style.display = "flex";
      if (dataflowContainer) dataflowContainer.style.display = "none";
      if (advisorContainer) advisorContainer.style.display = "none";
      if (lodGroup) lodGroup.style.display = "none";
      if (searchWrapper) searchWrapper.style.display = "none";
      renderMindMapView();
    } else if (mode === "dataflow") {
      viewDataflowBtn?.classList.add("is-active");
      if (graphContainer) graphContainer.style.display = "none";
      if (mindmapContainer) mindmapContainer.style.display = "none";
      if (dataflowContainer) dataflowContainer.style.display = "flex";
      if (advisorContainer) advisorContainer.style.display = "none";
      if (lodGroup) lodGroup.style.display = "none";
      if (searchWrapper) searchWrapper.style.display = "none";
      renderDataFlowView();
    } else if (mode === "advisor") {
      viewAdvisorBtn?.classList.add("is-active");
      if (graphContainer) graphContainer.style.display = "none";
      if (mindmapContainer) mindmapContainer.style.display = "none";
      if (dataflowContainer) dataflowContainer.style.display = "none";
      if (advisorContainer) advisorContainer.style.display = "block";
      if (lodGroup) lodGroup.style.display = "none";
      if (searchWrapper) searchWrapper.style.display = "none";
      renderAdvisorView();
    }
  }

  viewGraphBtn?.addEventListener("click", () => setViewMode("graph"));
  viewMindmapBtn?.addEventListener("click", () => setViewMode("mindmap"));
  viewDataflowBtn?.addEventListener("click", () => setViewMode("dataflow"));
  viewAdvisorBtn?.addEventListener("click", () => setViewMode("advisor"));
  advisorHealthChip?.addEventListener("click", () => setViewMode("advisor"));

  // Bind Level of Detail Buttons
  document.querySelectorAll(".arch-lod-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".arch-lod-btn").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      currentLOD = btn.getAttribute("data-lod") || "high";
      closeInspector();
      buildAndMountGraph();
    });
  });

  // Populate and Bind Flow Trace Selector
  const flowSelector = document.getElementById("archFlowSelector");
  const flowsList = arch.flows || [];
  if (flowSelector && flowsList.length > 0) {
    flowSelector.innerHTML = '<option value="none">Trace Flow: Full Architecture</option>' +
      flowsList.map(f => {
        const catIcon = f.category === 'auth' ? '🔒' : f.category === 'ai' ? '🧠' : f.category === 'file' ? '📁' : f.category === 'data' ? '🗄️' : '⚡';
        return '<option value="' + window.Clarity.utils.escapeHtml(f.id) + '">' + catIcon + ' ' + window.Clarity.utils.escapeHtml(f.name) + '</option>';
      }).join("");
  }

  flowSelector?.addEventListener("change", (e) => {
    const val = e.target.value;
    if (val === "none") {
      exitFlow();
    } else {
      activateFlow(val);
    }
  });

  // Bind Flow Player Controls
  document.getElementById("flowPrevStepBtn")?.addEventListener("click", () => {
    if (activeFlow) goToFlowStep(currentFlowStepIdx - 1);
  });
  document.getElementById("flowNextStepBtn")?.addEventListener("click", () => {
    if (activeFlow) goToFlowStep(currentFlowStepIdx + 1);
  });
  document.getElementById("flowPlayBtn")?.addEventListener("click", () => {
    togglePlayFlow();
  });
  document.getElementById("flowExitBtn")?.addEventListener("click", () => {
    exitFlow();
  });

  function activateFlow(flowId) {
    const flows = arch.flows || [];
    const flow = flows.find(f => f.id === flowId);
    if (!flow || !flow.steps || flow.steps.length === 0) {
      exitFlow();
      return;
    }

    // Switch to graph view if not already there
    if (currentViewMode !== "graph") {
      setViewMode("graph");
    }

    // If current LOD doesn't have the high-level flow nodes, ensure high LOD is loaded
    if (currentLOD === "file") {
      currentLOD = "high";
      document.querySelectorAll(".arch-lod-btn").forEach(b => {
        b.classList.toggle("is-active", b.getAttribute("data-lod") === "high");
      });
      buildAndMountGraph();
    }

    activeFlow = flow;
    currentFlowStepIdx = 0;

    const hud = document.getElementById("archFlowHud");
    if (hud) hud.style.display = "flex";

    const titleEl = document.getElementById("archFlowHudTitleText");
    if (titleEl) titleEl.textContent = flow.name;

    const catEl = document.getElementById("archFlowHudCategory");
    if (catEl) {
      catEl.textContent = (flow.category || "FLOW").toUpperCase();
      catEl.className = "tag tag--xs " + (flow.category === "auth" ? "tag--danger" : flow.category === "ai" ? "tag--primary" : flow.category === "data" ? "tag--accent" : "tag--info");
    }

    if (flowSelector) flowSelector.value = flow.id;

    goToFlowStep(0);
  }

  function goToFlowStep(stepIdx) {
    if (!activeFlow || !activeFlow.steps || activeFlow.steps.length === 0) return;

    if (stepIdx < 0) stepIdx = 0;
    if (stepIdx >= activeFlow.steps.length) stepIdx = activeFlow.steps.length - 1;
    currentFlowStepIdx = stepIdx;

    const step = activeFlow.steps[stepIdx];
    const total = activeFlow.steps.length;

    // Update HUD display
    const badge = document.getElementById("flowStepBadge");
    if (badge) badge.textContent = 'Step ' + (stepIdx + 1) + ' of ' + total;

    const descEl = document.getElementById("archFlowHudDesc");
    if (descEl) {
      const returnBadge = step.isReturnPath ? '<span style="color:#a855f7; font-weight:700;">[Return Path] </span>' : '';
      descEl.innerHTML = returnBadge + '<strong style="color:var(--ink);">' + window.Clarity.utils.escapeHtml(step.action || '') + '</strong> — ' + window.Clarity.utils.escapeHtml(step.description || '');
    }

    const prevBtn = document.getElementById("flowPrevStepBtn");
    const nextBtn = document.getElementById("flowNextStepBtn");
    if (prevBtn) prevBtn.disabled = (stepIdx === 0);
    if (nextBtn) nextBtn.disabled = (stepIdx === total - 1);

    // Apply Cytoscape highlighting
    if (cyInstance) {
      cyInstance.elements().removeClass("is-flow-active is-flow-current-step is-dimmed");
      cyInstance.elements().addClass("is-dimmed");

      const flowNodeIds = activeFlow.nodeIds || [];
      const flowEdgeIds = activeFlow.edgeIds || [];

      flowNodeIds.forEach(nid => {
        const n = cyInstance.getElementById(nid);
        if (n && n.length > 0) n.removeClass("is-dimmed").addClass("is-flow-active");
      });

      flowEdgeIds.forEach(eid => {
        const e = cyInstance.getElementById(eid);
        if (e && e.length > 0) e.removeClass("is-dimmed").addClass("is-flow-active");
      });

      // Highlight step node
      const currentTargetNode = cyInstance.getElementById(step.nodeId);
      if (currentTargetNode && currentTargetNode.length > 0) {
        currentTargetNode.removeClass("is-dimmed is-flow-active").addClass("is-flow-current-step");
        cyInstance.animate({
          center: { eles: currentTargetNode },
          zoom: Math.max(cyInstance.zoom(), 1.05),
          duration: 350,
        });

        selectedNodeData = currentTargetNode.data();
        selectedEdgeData = null;
        openNodeInspector(selectedNodeData);
      }

      // Highlight step edge
      if (step.edgeId) {
        const currentEdge = cyInstance.getElementById(step.edgeId);
        if (currentEdge && currentEdge.length > 0) {
          currentEdge.removeClass("is-dimmed is-flow-active").addClass("is-flow-current-step");
        }
      }
    }
  }

  function togglePlayFlow() {
    if (!activeFlow) return;
    const playBtn = document.getElementById("flowPlayBtn");

    if (flowPlayInterval) {
      clearInterval(flowPlayInterval);
      flowPlayInterval = null;
      if (playBtn) {
        playBtn.textContent = "Play";
        playBtn.classList.add("arch-flow-btn--primary");
      }
    } else {
      if (currentFlowStepIdx >= activeFlow.steps.length - 1) {
        currentFlowStepIdx = 0;
        goToFlowStep(0);
      }
      if (playBtn) {
        playBtn.textContent = "⏸ Pause";
        playBtn.classList.remove("arch-flow-btn--primary");
      }
      flowPlayInterval = setInterval(() => {
        if (!activeFlow) {
          clearInterval(flowPlayInterval);
          flowPlayInterval = null;
          return;
        }
        if (currentFlowStepIdx < activeFlow.steps.length - 1) {
          goToFlowStep(currentFlowStepIdx + 1);
        } else {
          clearInterval(flowPlayInterval);
          flowPlayInterval = null;
          if (playBtn) {
            playBtn.textContent = "Play";
            playBtn.classList.add("arch-flow-btn--primary");
          }
        }
      }, 2200);
    }
  }

  function exitFlow() {
    if (flowPlayInterval) {
      clearInterval(flowPlayInterval);
      flowPlayInterval = null;
    }
    activeFlow = null;
    currentFlowStepIdx = 0;

    const hud = document.getElementById("archFlowHud");
    if (hud) hud.style.display = "none";

    const playBtn = document.getElementById("flowPlayBtn");
    if (playBtn) {
      playBtn.textContent = "Play";
      playBtn.classList.add("arch-flow-btn--primary");
    }

    if (flowSelector) flowSelector.value = "none";

    if (cyInstance) {
      cyInstance.elements().removeClass("is-flow-active is-flow-current-step is-dimmed");
      cyInstance.fit(undefined, 50);
      updateMinimap();
    }
    closeInspector();
  }

  // Bind Category Filter
  const categoryFilter = document.getElementById("archCategoryFilter");
  categoryFilter?.addEventListener("change", (e) => {
    selectedCategory = e.target.value;
    filterGraphElements();
  });

  // Bind Search Input
  const searchInput = document.getElementById("archSearchInput");
  const searchClear = document.getElementById("archSearchClear");
  searchInput?.addEventListener("input", (e) => {
    activeSearchQuery = (e.target.value || "").trim().toLowerCase();
    if (searchClear) searchClear.style.display = activeSearchQuery ? "block" : "none";
    filterGraphElements();
  });
  searchClear?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    activeSearchQuery = "";
    if (searchClear) searchClear.style.display = "none";
    filterGraphElements();
  });

  // Bind Labels Toggle
  const labelsBtn = document.getElementById("toggleEdgeLabelsBtn");
  labelsBtn?.addEventListener("click", () => {
    showEdgeLabels = !showEdgeLabels;
    labelsBtn.textContent = "Labels: " + (showEdgeLabels ? "On" : "Off");
    if (cyInstance) {
      cyInstance.style()
        .selector('edge')
        .style('label', showEdgeLabels ? 'data(label)' : '')
        .update();
    }
  });

  // Bind Zoom & Viewport Buttons
  document.getElementById("zoomInBtn")?.addEventListener("click", () => {
    if (!cyInstance) return;
    cyInstance.zoom({
      level: cyInstance.zoom() * 1.25,
      renderedPosition: { x: cyInstance.width() / 2, y: cyInstance.height() / 2 }
    });
    updateZoomIndicator();
    updateMinimap();
  });

  document.getElementById("zoomOutBtn")?.addEventListener("click", () => {
    if (!cyInstance) return;
    cyInstance.zoom({
      level: cyInstance.zoom() / 1.25,
      renderedPosition: { x: cyInstance.width() / 2, y: cyInstance.height() / 2 }
    });
    updateZoomIndicator();
    updateMinimap();
  });

  document.getElementById("fitScreenBtn")?.addEventListener("click", () => {
    if (!cyInstance) return;
    cyInstance.fit(undefined, 50);
    updateZoomIndicator();
    updateMinimap();
  });

  document.getElementById("autoLayoutBtn")?.addEventListener("click", () => {
    runLayout();
  });

  document.getElementById("resetViewBtn")?.addEventListener("click", () => {
    if (!cyInstance) return;
    selectedCategory = "all";
    if (categoryFilter) categoryFilter.value = "all";
    if (searchInput) searchInput.value = "";
    activeSearchQuery = "";
    if (searchClear) searchClear.style.display = "none";
    closeInspector();
    buildAndMountGraph();
  });

  // Fullscreen toggle
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const stageWrapper = document.getElementById("archStageWrapper");
  fullscreenBtn?.addEventListener("click", () => {
    isFullscreen = !isFullscreen;
    stageWrapper?.classList.toggle("is-fullscreen", isFullscreen);
    fullscreenBtn.textContent = isFullscreen ? "✕ Exit" : "⛶";
    setTimeout(() => {
      if (cyInstance) {
        cyInstance.resize();
        cyInstance.fit(undefined, 50);
        updateMinimap();
      }
    }, 100);
  });

  // Explain Architecture AI Modal
  document.getElementById("explainArchBtn")?.addEventListener("click", async () => {
    openArchitectureExplanationModal();
  });

  // Slide-over Inspector Close
  document.getElementById("closeInspectorBtn")?.addEventListener("click", closeInspector);

  // Initialize Cytoscape Graph
  function initCytoscape() {
    const canvasEl = document.getElementById("cytoscapeCanvas");
    if (!canvasEl) return;

    if (cyInstance) {
      try { cyInstance.destroy(); } catch (e) {}
      cyInstance = null;
    }

    buildAndMountGraph();
  }

  function getActiveElementsForLOD() {
    let rawNodes = arch.nodes || [];
    let rawEdges = arch.edges || [];

    if (currentLOD === "symbol" && arch.symbolNodes && arch.symbolNodes.length > 0) {
      rawNodes = arch.symbolNodes;
      rawEdges = arch.symbolEdges || [];
    } else if (currentLOD === "detailed" && arch.detailedNodes && arch.detailedNodes.length > 0) {
      rawNodes = arch.detailedNodes;
      rawEdges = arch.detailedEdges || [];
    } else if (currentLOD === "file" && arch.fileNodes && arch.fileNodes.length > 0) {
      rawNodes = arch.fileNodes;
      rawEdges = arch.fileEdges || [];
    }

    // Map to Cytoscape format
    const cyNodes = rawNodes.map(n => {
      const color = getNodeColor(n.type);
      const icon = getNodeIcon(n.type);
      let hasIssue = false;
      if (advisorData && advisorData.issues) {
        hasIssue = advisorData.issues.some(iss => iss.nodeId === n.id || (iss.file && (n.files || []).includes(iss.file)));
      }
      return {
        group: 'nodes',
        data: {
          id: n.id,
          label: n.label,
          type: n.type,
          subType: n.subType || '',
          level: n.level || currentLOD,
          description: n.description || '',
          files: n.files || [],
          endpoints: n.endpoints || [],
          models: n.models || [],
          technology: n.technology || '',
          evidence: n.evidence || [],
          icon: icon,
          color: color,
          hasIssue: hasIssue,
        }
      };
    });

    const cyEdges = rawEdges.map((e, idx) => {
      let edgeStatus = e.status || 'VERIFIED';
      if (advisorData && advisorData.issues) {
        const issue = advisorData.issues.find(iss => iss.edgeId === e.id || (iss.source === e.source && iss.target === e.target));
        if (issue) {
          edgeStatus = issue.status || 'POTENTIAL_ISSUE';
        }
      }
      const statusColor = getEdgeStatusColor(edgeStatus);
      const isReturn = e.isReturn || e.type === "HTTP_RESPONSE" || e.type === "RETURNS" || e.type === "RETURNS_DATA";
      const lineStyle = isReturn ? 'dashed' : ((edgeStatus === 'UNRESOLVED' || edgeStatus === 'POTENTIAL_ISSUE' || edgeStatus === 'MISSING' || edgeStatus === 'INCORRECT') ? 'dashed' : 'solid');
      return {
        group: 'edges',
        data: {
          id: e.id || ('e_' + e.source + '_' + e.target + '_' + idx),
          source: e.source,
          target: e.target,
          label: e.label || '',
          type: e.type || '',
          status: edgeStatus,
          evidence: e.evidence || [],
          detail: e.detail || '',
          statusColor: statusColor,
          lineStyle: lineStyle,
          isReturn: !!isReturn,
        }
      };
    });

    return { nodes: cyNodes, edges: cyEdges };
  }

  function buildAndMountGraph() {
    const canvasEl = document.getElementById("cytoscapeCanvas");
    if (!canvasEl) return;

    const cytoscapeLib = window.cytoscape;
    if (!cytoscapeLib) {
      canvasEl.innerHTML = '<div style="padding:40px; text-align:center; color:var(--ink-muted);">Visualizer library loading...</div>';
      return;
    }

    const { nodes, edges } = getActiveElementsForLOD();

    if (nodes.length === 0) {
      canvasEl.innerHTML = [
        '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:40px; text-align:center;">',
        '<div style="font-size:32px; margin-bottom:12px;">🗺️</div>',
        '<div style="font-size:16px; font-weight:600; color:var(--ink); margin-bottom:6px;">No architecture nodes to display</div>',
        '<div style="font-size:13px; color:var(--ink-muted); max-width:420px; line-height:1.5;">This project might contain only plain text files or static non-code assets. Try uploading a full source project.</div>',
        '</div>'
      ].join("");
      return;
    }

    // Update node badge count
    const badge = document.getElementById("nodeCountBadge");
    if (badge) badge.textContent = nodes.length + " nodes";

    try {
      cyInstance = cytoscapeLib({
        container: canvasEl,
        elements: [...nodes, ...edges],
        boxSelectionEnabled: false,
        autounselectify: false,
        wheelSensitivity: 0.3,
        style: [
          {
            selector: 'node',
            style: {
              'shape': 'round-rectangle',
              'background-color': 'data(color)',
              'label': 'data(label)',
              'color': '#ffffff',
              'text-valign': 'center',
              'text-halign': 'center',
              'font-size': (currentLOD === 'file' || currentLOD === 'symbol') ? '10.5px' : '12px',
              'font-weight': 600,
              'font-family': 'ui-sans-serif, system-ui, -apple-system, sans-serif',
              'width': currentLOD === 'file' ? 140 : (currentLOD === 'symbol' ? 190 : 180),
              'height': currentLOD === 'file' ? 44 : (currentLOD === 'symbol' ? 50 : 54),
              'text-wrap': 'wrap',
              'text-max-width': currentLOD === 'file' ? '130px' : (currentLOD === 'symbol' ? '180px' : '170px'),
              'border-width': 2,
              'border-color': 'rgba(255, 255, 255, 0.4)',
              'border-opacity': 0.8,
              'text-outline-color': 'data(color)',
              'text-outline-width': 1.5,
              'text-outline-opacity': 0.9,
              'shadow-blur': 10,
              'shadow-color': 'rgba(0, 0, 0, 0.25)',
              'shadow-offset-y': 3,
              'transition-property': 'opacity, border-width, border-color, shadow-blur',
              'transition-duration': '0.15s',
            }
          },
          {
            selector: 'node:selected',
            style: {
              'border-width': 4,
              'border-color': '#ffffff',
              'shadow-blur': 16,
              'shadow-color': 'rgba(99, 102, 241, 0.6)',
            }
          },
          {
            selector: 'node[?hasIssue]',
            style: {
              'border-width': 3.5,
              'border-style': 'dashed',
              'border-color': '#ef4444',
            }
          },
          {
            selector: 'node.is-flow-active',
            style: {
              'opacity': 1,
              'border-width': 3,
              'border-color': '#a5b4fc',
              'shadow-blur': 14,
              'shadow-color': 'rgba(99, 102, 241, 0.4)',
            }
          },
          {
            selector: 'node.is-flow-current-step',
            style: {
              'opacity': 1,
              'border-width': 4.5,
              'border-color': '#fbbf24',
              'shadow-blur': 24,
              'shadow-color': '#f59e0b',
            }
          },
          {
            selector: 'edge',
            style: {
              'width': 2.5,
              'line-color': 'data(statusColor)',
              'target-arrow-color': 'data(statusColor)',
              'target-arrow-shape': 'triangle',
              'arrow-scale': 1.1,
              'curve-style': 'bezier',
              'line-style': 'data(lineStyle)',
              'line-dash-pattern': [6, 3],
              'label': showEdgeLabels ? 'data(label)' : '',
              'font-size': '10px',
              'font-family': 'ui-monospace, monospace',
              'color': '#cbd5e1',
              'text-background-color': '#18181b',
              'text-background-opacity': 0.9,
              'text-background-padding': '3px',
              'text-background-shape': 'roundrectangle',
              'text-border-width': 1,
              'text-border-color': '#334155',
              'text-rotation': 'autorotate',
              'text-margin-y': -8,
              'transition-property': 'opacity, width, line-color',
              'transition-duration': '0.15s',
            }
          },
          {
            selector: 'edge:selected',
            style: {
              'width': 4,
              'line-color': '#60a5fa',
              'target-arrow-color': '#60a5fa',
              'z-index': 999,
            }
          },
          {
            selector: 'edge.is-flow-active',
            style: {
              'opacity': 1,
              'width': 3.5,
              'line-color': '#818cf8',
              'target-arrow-color': '#818cf8',
              'z-index': 888,
            }
          },
          {
            selector: 'edge.is-flow-current-step',
            style: {
              'opacity': 1,
              'width': 5,
              'line-color': '#f59e0b',
              'target-arrow-color': '#f59e0b',
              'z-index': 999,
            }
          },
          {
            selector: '.is-dimmed',
            style: {
              'opacity': 0.18,
            }
          },
          {
            selector: '.is-highlighted',
            style: {
              'opacity': 1,
              'border-width': 3.5,
              'border-color': '#ffffff',
            }
          },
          {
            selector: '.is-search-matched',
            style: {
              'border-width': 4.5,
              'border-color': '#fbbf24',
              'shadow-blur': 22,
              'shadow-color': '#f59e0b',
            }
          }
        ]
      });

      // Events
      cyInstance.on('tap', 'node', function(evt) {
        const node = evt.target;
        selectedNodeData = node.data();
        selectedEdgeData = null;
        highlightNeighborhood(node);
        openNodeInspector(selectedNodeData);
      });

      cyInstance.on('tap', 'edge', function(evt) {
        const edge = evt.target;
        selectedEdgeData = edge.data();
        selectedNodeData = null;
        highlightEdge(edge);
        openEdgeInspector(selectedEdgeData);
      });

      cyInstance.on('tap', function(evt) {
        if (evt.target === cyInstance) {
          clearHighlights();
          closeInspector();
        }
      });

      cyInstance.on('zoom pan', function() {
        updateZoomIndicator();
        updateMinimap();
      });

      cyInstance.on('render', function() {
        updateMinimap();
      });

      // Run Dagre or fallback layout
      runLayout();

    } catch (err) {
      console.error("Cytoscape init error:", err);
      canvasEl.innerHTML = '<div style="padding:30px; color:var(--danger); text-align:center;">Failed to initialize graph engine: ' + window.Clarity.utils.escapeHtml(err.message || "") + '</div>';
    }
  }

  function runLayout() {
    if (!cyInstance) return;

    let layoutName = 'dagre';
    // Test if dagre is available
    try {
      cyInstance.layout({
        name: 'dagre',
        rankDir: 'LR',
        nodeSep: currentLOD === 'file' ? 35 : 55,
        rankSep: currentLOD === 'file' ? 70 : 100,
        animate: true,
        animationDuration: 400,
      }).run();
    } catch (e) {
      console.warn("Dagre layout fallback:", e);
      cyInstance.layout({
        name: 'breadthfirst',
        directed: true,
        padding: 50,
        animate: true,
      }).run();
    }

    setTimeout(() => {
      if (cyInstance) {
        cyInstance.fit(undefined, 50);
        updateZoomIndicator();
        updateMinimap();
      }
    }, 450);
  }

  function highlightNeighborhood(node) {
    if (!cyInstance) return;
    cyInstance.elements().removeClass('is-highlighted is-dimmed');

    const connectedEdges = node.connectedEdges();
    const neighborNodes = connectedEdges.connectedNodes();

    cyInstance.elements().addClass('is-dimmed');
    node.removeClass('is-dimmed').addClass('is-highlighted');
    neighborNodes.removeClass('is-dimmed').addClass('is-highlighted');
    connectedEdges.removeClass('is-dimmed').addClass('is-highlighted');
  }

  function highlightEdge(edge) {
    if (!cyInstance) return;
    cyInstance.elements().removeClass('is-highlighted is-dimmed');

    const source = edge.source();
    const target = edge.target();

    cyInstance.elements().addClass('is-dimmed');
    edge.removeClass('is-dimmed').addClass('is-highlighted');
    source.removeClass('is-dimmed').addClass('is-highlighted');
    target.removeClass('is-dimmed').addClass('is-highlighted');
  }

  function clearHighlights() {
    if (!cyInstance) return;
    cyInstance.elements().removeClass('is-highlighted is-dimmed is-search-matched');
  }

  function filterGraphElements() {
    if (!cyInstance) return;

    const allNodes = cyInstance.nodes();
    const allEdges = cyInstance.edges();

    allNodes.removeClass('is-search-matched is-dimmed');
    allEdges.removeClass('is-dimmed');

    let matchedCount = 0;
    let firstMatchedNode = null;

    allNodes.forEach(node => {
      const data = node.data();
      const catMatch = selectedCategory === "all" || data.type === selectedCategory;
      const q = activeSearchQuery;
      const searchMatch = !q ||
        data.label.toLowerCase().includes(q) ||
        data.description.toLowerCase().includes(q) ||
        (data.files && data.files.some(f => f.toLowerCase().includes(q))) ||
        (data.endpoints && data.endpoints.some(e => (e.path || '').toLowerCase().includes(q)));

      if (catMatch && searchMatch) {
        node.style('display', 'element');
        if (q) {
          node.addClass('is-search-matched');
          if (!firstMatchedNode) firstMatchedNode = node;
          matchedCount++;
        }
      } else {
        if (!catMatch) {
          node.style('display', 'none');
        } else if (q && !searchMatch) {
          node.addClass('is-dimmed');
        }
      }
    });

    // Update edges display based on connected nodes
    allEdges.forEach(edge => {
      const src = edge.source();
      const tgt = edge.target();
      if (src.style('display') === 'none' || tgt.style('display') === 'none') {
        edge.style('display', 'none');
      } else {
        edge.style('display', 'element');
      }
    });

    if (firstMatchedNode && activeSearchQuery) {
      cyInstance.animate({
        center: { eles: firstMatchedNode },
        zoom: Math.max(cyInstance.zoom(), 1.2),
        duration: 300,
      });
    }

    updateMinimap();
  }

  function updateZoomIndicator() {
    const indicator = document.getElementById("zoomLevelIndicator");
    if (!indicator || !cyInstance) return;
    const zoomPct = Math.round(cyInstance.zoom() * 100);
    indicator.textContent = zoomPct + "%";
  }

  // 4. Interactive Minimap Canvas
  function updateMinimap() {
    const canvas = document.getElementById("archMinimapCanvas");
    if (!canvas || !cyInstance) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const extent = cyInstance.extent();
    const bb = cyInstance.elements().boundingBox();

    if (!bb || bb.w <= 0 || bb.h <= 0) return;

    // Scale to fit elements
    const padding = 20;
    const minX = Math.min(extent.x1, bb.x1) - padding;
    const maxX = Math.max(extent.x2, bb.x2) + padding;
    const minY = Math.min(extent.y1, bb.y1) - padding;
    const maxY = Math.max(extent.y2, bb.y2) + padding;

    const worldW = maxX - minX;
    const worldH = maxY - minY;
    if (worldW <= 0 || worldH <= 0) return;

    const scaleX = w / worldW;
    const scaleY = h / worldH;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = (w - worldW * scale) / 2 - minX * scale;
    const offsetY = (h - worldH * scale) / 2 - minY * scale;

    // Draw edges
    ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
    ctx.lineWidth = 1;
    cyInstance.edges().forEach(e => {
      if (e.style('display') === 'none') return;
      const srcPos = e.source().position();
      const tgtPos = e.target().position();
      ctx.beginPath();
      ctx.moveTo(srcPos.x * scale + offsetX, srcPos.y * scale + offsetY);
      ctx.lineTo(tgtPos.x * scale + offsetX, tgtPos.y * scale + offsetY);
      ctx.stroke();
    });

    // Draw nodes
    cyInstance.nodes().forEach(n => {
      if (n.style('display') === 'none') return;
      const pos = n.position();
      const color = n.data('color') || '#6366f1';
      const nodeX = pos.x * scale + offsetX;
      const nodeY = pos.y * scale + offsetY;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(nodeX, nodeY, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Viewport Camera Rect
    const camX1 = extent.x1 * scale + offsetX;
    const camY1 = extent.y1 * scale + offsetY;
    const camW = (extent.x2 - extent.x1) * scale;
    const camH = (extent.y2 - extent.y1) * scale;

    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1.5;
    ctx.fillStyle = "rgba(59, 130, 246, 0.12)";
    ctx.fillRect(camX1, camY1, camW, camH);
    ctx.strokeRect(camX1, camY1, camW, camH);
  }

  // Click on minimap to pan
  const minimapCanvas = document.getElementById("archMinimapCanvas");
  minimapCanvas?.addEventListener("click", (e) => {
    if (!cyInstance) return;
    const rect = minimapCanvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const w = minimapCanvas.width;
    const h = minimapCanvas.height;
    const extent = cyInstance.extent();
    const bb = cyInstance.elements().boundingBox();
    const padding = 20;
    const minX = Math.min(extent.x1, bb.x1) - padding;
    const maxX = Math.max(extent.x2, bb.x2) + padding;
    const minY = Math.min(extent.y1, bb.y1) - padding;
    const maxY = Math.max(extent.y2, bb.y2) + padding;
    const worldW = maxX - minX;
    const worldH = maxY - minY;
    const scale = Math.min(w / worldW, h / worldH);
    const offsetX = (w - worldW * scale) / 2 - minX * scale;
    const offsetY = (h - worldH * scale) / 2 - minY * scale;

    const targetWorldX = (clickX - offsetX) / scale;
    const targetWorldY = (clickY - offsetY) / scale;

    cyInstance.animate({
      center: { x: targetWorldX, y: targetWorldY },
      duration: 250,
    });
  });

  // 5. Slide-over Inspector Drawer: Node Details
  function openNodeInspector(nodeData) {
    const drawer = document.getElementById("archInspectorDrawer");
    const headTitle = document.getElementById("inspectorHeaderTitle");
    const bodyContent = document.getElementById("inspectorBodyContent");
    if (!drawer || !headTitle || !bodyContent) return;

    drawer.style.display = "flex";

    headTitle.innerHTML = [
      '<span class="arch-legend-dot" style="background:' + nodeData.color + '; width:12px; height:12px;"></span>',
      '<strong style="font-size:14.5px; color:var(--ink);">' + window.Clarity.utils.escapeHtml(nodeData.label) + '</strong>',
      '<span class="arch-badge arch-badge--' + nodeData.type + '" style="font-size:10px; padding:2px 6px;">' + nodeData.type + '</span>'
    ].join("");

    // Find incoming and outgoing edges for this node
    const incomingEdges = (arch.edges || []).filter(e => e.target === nodeData.id);
    const outgoingEdges = (arch.edges || []).filter(e => e.source === nodeData.id);

    // Files list HTML with line jumps
    const filesHtml = (nodeData.files && nodeData.files.length > 0)
      ? nodeData.files.map(f => {
          return '<button class="arch-evidence-btn" data-jump-file="' + window.Clarity.utils.escapeHtml(f) + '">' +
            '<span>' + window.Clarity.utils.escapeHtml(f) + '</span>' +
            '<span class="muted" style="font-size:11px;">Inspect →</span>' +
            '</button>';
        }).join("")
      : '<span class="muted" style="font-size:12px;">No primary files mapped to this layer.</span>';

    // Endpoints HTML
    const endpointsHtml = (nodeData.endpoints && nodeData.endpoints.length > 0)
      ? nodeData.endpoints.map(ep => {
          return '<div style="display:flex; align-items:center; justify-content:space-between; padding:6px 8px; background:var(--surface-muted); border-radius:6px; font-size:12px; font-family:var(--font-mono);">' +
            '<div><span style="font-weight:700; color:var(--accent);">' + window.Clarity.utils.escapeHtml(ep.method) + '</span> ' + window.Clarity.utils.escapeHtml(ep.path) + '</div>' +
            (ep.file ? '<button class="btn btn--ghost btn--sm" data-jump-file="' + window.Clarity.utils.escapeHtml(ep.file) + '" data-jump-line="' + (ep.line || 1) + '" style="padding:1px 6px; font-size:11px; color:var(--accent);">Line ' + (ep.line || 1) + '</button>' : '') +
            '</div>';
        }).join("")
      : '';

    // Models HTML
    const modelsHtml = (nodeData.models && nodeData.models.length > 0)
      ? nodeData.models.map(m => {
          return '<div style="padding:6px 8px; background:var(--surface-muted); border-radius:6px; font-size:12px;">' +
            '<div style="font-weight:600; color:var(--ink); font-family:var(--font-mono);">Table/Model: ' + window.Clarity.utils.escapeHtml(m.name) + '</div>' +
            (m.file ? '<button class="btn btn--ghost btn--sm" data-jump-file="' + window.Clarity.utils.escapeHtml(m.file) + '" style="padding:0; font-size:11px; color:var(--accent); font-family:var(--font-mono);">' + window.Clarity.utils.escapeHtml(m.file) + '</button>' : '') +
            '</div>';
        }).join("")
      : '';

    // Connections summary HTML
    const inHtml = incomingEdges.map(e => {
      const srcNode = (arch.nodes || []).find(n => n.id === e.source);
      const srcLabel = srcNode ? srcNode.label : e.source;
      return '<div style="font-size:12px; padding:4px 0;">← <strong>' + window.Clarity.utils.escapeHtml(srcLabel) + '</strong>: <span class="muted">' + window.Clarity.utils.escapeHtml(e.label) + '</span></div>';
    }).join("");

    const outHtml = outgoingEdges.map(e => {
      const tgtNode = (arch.nodes || []).find(n => n.id === e.target);
      const tgtLabel = tgtNode ? tgtNode.label : e.target;
      return '<div style="font-size:12px; padding:4px 0;">→ <strong>' + window.Clarity.utils.escapeHtml(tgtLabel) + '</strong>: <span class="muted">' + window.Clarity.utils.escapeHtml(e.label) + '</span></div>';
    }).join("");

    bodyContent.innerHTML = [
      // Description Section
      '<div class="arch-inspector-section">',
      '  <span class="arch-inspector-section-title">Subsystem Role & Description</span>',
      '  <p style="color:var(--ink); line-height:1.5; font-size:13.5px; margin:0;">' + window.Clarity.utils.escapeHtml(nodeData.description) + '</p>',
      '</div>',

      // Endpoints (if any)
      endpointsHtml ? (
        '<div class="arch-inspector-section">' +
        '  <span class="arch-inspector-section-title">Exposed Endpoints & Routes (' + nodeData.endpoints.length + ')</span>' +
        '  <div style="display:flex; flex-direction:column; gap:6px;">' + endpointsHtml + '</div>' +
        '</div>'
      ) : '',

      // Models (if any)
      modelsHtml ? (
        '<div class="arch-inspector-section">' +
        '  <span class="arch-inspector-section-title">Data Schemas & Storage Entities (' + nodeData.models.length + ')</span>' +
        '  <div style="display:flex; flex-direction:column; gap:6px;">' + modelsHtml + '</div>' +
        '</div>'
      ) : '',

      // Files Section
      '<div class="arch-inspector-section">',
      '  <span class="arch-inspector-section-title">Verified Source Files (' + (nodeData.files ? nodeData.files.length : 0) + ')</span>',
      '  <div style="display:flex; flex-direction:column; gap:6px;">' + filesHtml + '</div>',
      '</div>',

      // Connections
      (inHtml || outHtml) ? (
        '<div class="arch-inspector-section">' +
        '  <span class="arch-inspector-section-title">Connected Relationships</span>' +
        '  <div style="background:var(--surface-muted); padding:10px 12px; border-radius:6px;">' +
        (inHtml ? '<div style="margin-bottom:6px;"><strong style="font-size:11px; text-transform:uppercase; color:var(--ink-muted);">Incoming Calls:</strong>' + inHtml + '</div>' : '') +
        (outHtml ? '<div><strong style="font-size:11px; text-transform:uppercase; color:var(--ink-muted);">Outgoing Calls:</strong>' + outHtml + '</div>' : '') +
        '  </div>' +
        '</div>'
      ) : ''
    ].join("");

    wireInspectorJumpButtons(bodyContent);
  }

  // 6. Slide-over Inspector Drawer: Edge Details
  function openEdgeInspector(edgeData) {
    const drawer = document.getElementById("archInspectorDrawer");
    const headTitle = document.getElementById("inspectorHeaderTitle");
    const bodyContent = document.getElementById("inspectorBodyContent");
    if (!drawer || !headTitle || !bodyContent) return;

    drawer.style.display = "flex";

    const srcNode = (arch.nodes || []).find(n => n.id === edgeData.source);
    const tgtNode = (arch.nodes || []).find(n => n.id === edgeData.target);
    const srcName = srcNode ? srcNode.label : edgeData.source;
    const tgtName = tgtNode ? tgtNode.label : edgeData.target;

    // Check if there is an advisor issue for this connection or endpoints
    let relatedIssue = null;
    if (advisorData && advisorData.issues) {
      relatedIssue = advisorData.issues.find(iss => {
        if (iss.edgeId && iss.edgeId === edgeData.id) return true;
        if (iss.source === edgeData.source && iss.target === edgeData.target) return true;
        if (edgeData.label && iss.title && iss.title.toLowerCase().includes(edgeData.label.toLowerCase())) return true;
        if (edgeData.source === 'frontend' && edgeData.target === 'backend' && iss.category === 'api_route') return true;
        return false;
      });
    }

    const isUnverified = edgeData.status === 'UNRESOLVED' || edgeData.status === 'POTENTIAL_ISSUE' || edgeData.status === 'MISSING' || edgeData.status === 'INCORRECT';

    headTitle.innerHTML = [
      '<span class="arch-legend-dot" style="background:' + edgeData.statusColor + '; width:10px; height:10px;"></span>',
      '<strong style="font-size:13.5px; color:var(--ink);">' + window.Clarity.utils.escapeHtml(edgeData.label || edgeData.type) + '</strong>'
    ].join("");

    const statusBadge = '<span class="arch-health-chip ' +
      (edgeData.status === 'VERIFIED' ? 'arch-health-chip--verified' : (edgeData.status === 'LIKELY' ? 'arch-health-chip--info' : 'arch-health-chip--danger')) +
      '" style="font-size:11px; padding:2px 8px;">' + edgeData.status + '</span>';

    // Advisor Warning & Repair Block
    let advisorBlockHtml = '';
    if (isUnverified || relatedIssue) {
      const explanation = relatedIssue ? relatedIssue.explanation : "Static AST analysis detected an invocation or interface call between these subsystems, but could not statically verify a matching declared handler.";
      const potentialCauses = (relatedIssue && relatedIssue.potentialCauses) || [
        "The targeted backend route or controller function has not been implemented yet.",
        "Path prefix mismatch or typo (e.g. /api/v1/... vs /api/...)",
        "Dynamic routing or runtime endpoint registration not captured in static AST.",
        "HTTP method mismatch between client fetch and server route declaration."
      ];
      const recommendedArch = (relatedIssue && relatedIssue.recommendedArchitecture) || (srcName + ' ──[REST/JSON]──> Express Router ──> Controller ──> ' + tgtName);
      const suggestedCode = relatedIssue ? relatedIssue.suggestedImplementation : "";

      advisorBlockHtml = [
        '<div class="arch-inspector-section" style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:12px 14px; margin-bottom:12px;">',
        '  <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">',
        '    <div style="display:flex; align-items:center; gap:6px; font-weight:700; color:#b45309; font-size:12.5px;">',
        '      <span>⚠ CONNECTION NOT VERIFIED</span>',
        '    </div>',
        '    <span class="tag tag--xs" style="background:#fef3c7; color:#92400e; font-weight:600;">Advisor Alert</span>',
        '  </div>',
        '  <p style="font-size:12px; color:var(--ink); line-height:1.45; margin:0 0 10px;">' + window.Clarity.utils.escapeHtml(explanation) + '</p>',

        '  <div style="margin-bottom:8px;">',
        '    <strong style="font-size:11px; text-transform:uppercase; color:#92400e; letter-spacing:0.03em;">Potential Causes:</strong>',
        '    <ul style="margin:4px 0 0 16px; padding:0; font-size:11.5px; color:var(--ink-muted); line-height:1.4;">',
        potentialCauses.map(c => '<li>' + window.Clarity.utils.escapeHtml(c) + '</li>').join(""),
        '    </ul>',
        '  </div>',

        '  <div style="margin-bottom:8px;">',
        '    <strong style="font-size:11px; text-transform:uppercase; color:#92400e; letter-spacing:0.03em;">Recommended Architecture:</strong>',
        '    <pre style="background:var(--surface); border:1px solid var(--line); border-radius:6px; padding:6px 10px; font-size:11px; font-family:var(--font-mono); color:var(--ink); margin:4px 0 0; overflow-x:auto;">' + window.Clarity.utils.escapeHtml(recommendedArch) + '</pre>',
        '  </div>',

        suggestedCode ? [
          '  <div style="margin-top:10px;">',
          '    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">',
          '      <strong style="font-size:11px; text-transform:uppercase; color:#15803d; letter-spacing:0.03em;">Suggested Fix:</strong>',
          relatedIssue && relatedIssue.fixDiff ? [
            '      <button class="btn btn--primary btn--sm" data-open-fix-issue="' + window.Clarity.utils.escapeHtml(relatedIssue.id) + '" style="padding:2px 8px; font-size:11px; gap:4px;">',
            '        <span>Review Diff & Apply Fix</span>',
            '      </button>'
          ].join("") : '',
          '    </div>',
          '    <pre class="arch-code-snippet" style="background:var(--surface); border:1px solid var(--line); border-radius:6px; padding:8px; font-size:11px; max-height:140px; overflow:auto; margin:0;">' + window.Clarity.utils.escapeHtml(suggestedCode) + '</pre>',
          '  </div>'
        ].join("") : '',

        '</div>'
      ].join("");
    }

    // Evidence records
    let evidenceHtml = '';
    if (edgeData.evidence && Array.isArray(edgeData.evidence) && edgeData.evidence.length > 0) {
      evidenceHtml = edgeData.evidence.map(ev => {
        return '<div style="display:flex; flex-direction:column; gap:6px; padding:10px; background:var(--surface-muted); border-radius:6px; border:1px solid var(--line);">' +
          '<div style="display:flex; align-items:center; justify-content:space-between;">' +
          '  <button class="btn btn--ghost btn--sm" data-jump-file="' + window.Clarity.utils.escapeHtml(ev.file) + '" data-jump-line="' + (ev.line || 1) + '" style="padding:0; font-family:var(--font-mono); font-size:12px; color:var(--accent); font-weight:600;">' +
          '    ' + window.Clarity.utils.escapeHtml(ev.file) + ':' + (ev.line || 1) +
          '  </button>' +
          '  <span class="muted" style="font-size:11px;">Jump to Line →</span>' +
          '</div>' +
          (ev.context ? '<div style="font-size:12px; color:var(--ink-muted);">' + window.Clarity.utils.escapeHtml(ev.context) + '</div>' : '') +
          (ev.snippet ? '<pre class="arch-code-snippet">' + window.Clarity.utils.escapeHtml(ev.snippet) + '</pre>' : '') +
          '</div>';
      }).join("");
    } else if (typeof edgeData.evidence === 'string') {
      evidenceHtml = '<p style="color:var(--ink-muted); font-size:12.5px; margin:0;">' + window.Clarity.utils.escapeHtml(edgeData.evidence) + '</p>';
    } else {
      evidenceHtml = '<span class="muted" style="font-size:12px;">Inferred from module architecture.</span>';
    }

    bodyContent.innerHTML = [
      advisorBlockHtml,

      '<div class="arch-inspector-section">',
      '  <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">',
      '    <span class="arch-inspector-section-title">Connection Status</span>',
      statusBadge,
      '  </div>',
      '  <div style="padding:10px; background:var(--surface-muted); border-radius:6px; font-size:13px; font-family:var(--font-mono);">' +
      '    <div><strong>Source:</strong> ' + window.Clarity.utils.escapeHtml(srcName) + '</div>' +
      '    <div style="margin-top:4px;"><strong>Target:</strong> ' + window.Clarity.utils.escapeHtml(tgtName) + '</div>' +
      '  </div>',
      '</div>',

      '<div class="arch-inspector-section">',
      '  <span class="arch-inspector-section-title">Relationship Details</span>',
      '  <p style="color:var(--ink); line-height:1.5; font-size:13px; margin:0;">' + window.Clarity.utils.escapeHtml(edgeData.detail || edgeData.label || "Verified architectural relationship between subsystems.") + '</p>',
      '</div>',

      '<div class="arch-inspector-section">',
      '  <span class="arch-inspector-section-title">Ground-Truth Code Evidence</span>',
      '  <div style="display:flex; flex-direction:column; gap:8px;">' + evidenceHtml + '</div>',
      '</div>'
    ].join("");

    wireInspectorJumpButtons(bodyContent);
  }

  function closeInspector() {
    const drawer = document.getElementById("archInspectorDrawer");
    if (drawer) drawer.style.display = "none";
    clearHighlights();
  }

  function wireInspectorJumpButtons(containerEl) {
    containerEl.querySelectorAll("[data-jump-file]").forEach(btn => {
      btn.addEventListener("click", () => {
        const file = btn.getAttribute("data-jump-file");
        const line = parseInt(btn.getAttribute("data-jump-line"), 10);
        if (file) {
          switchTabToFile(file, isNaN(line) ? undefined : line);
        }
      });
    });

    containerEl.querySelectorAll("[data-open-fix-issue]").forEach(btn => {
      btn.addEventListener("click", () => {
        const issueId = btn.getAttribute("data-open-fix-issue");
        if (advisorData && advisorData.issues) {
          const issue = advisorData.issues.find(iss => iss.id === issueId);
          if (issue) openAdvisorFixModal(issue);
        }
      });
    });
  }

  // 7. Mind Map View
  function renderMindMapView() {
    const cont = document.getElementById("archMindmapContainer");
    if (!cont) return;

    const items = (arch.mindMap && arch.mindMap.length > 0)
      ? arch.mindMap
      : (arch.nodes || []).map(n => ({
          id: n.id,
          title: n.label,
          category: n.type,
          description: n.description,
          files: n.files || [],
          subsections: (n.endpoints || []).map(e => ({ title: `${e.method} ${e.path}`, detail: `${e.file}:${e.line}`, file: e.file, line: e.line }))
        }));

    cont.innerHTML = [
      '<div class="card" style="padding:18px 22px; border:1px solid var(--line); background:var(--surface);">' +
      '<h3 style="font-size:15px; font-weight:600; color:var(--ink); margin-bottom:6px;">Hierarchical System Mind Map</h3>' +
      '<p class="muted" style="font-size:13px; margin:0;">Expandable structural overview of software components, services, and associated files.</p>' +
      '</div>',

      items.map(item => {
        const color = getNodeColor(item.category || item.id);
        const filesList = (item.files || []).map(f => {
          return '<button class="arch-evidence-btn" data-jump-file="' + window.Clarity.utils.escapeHtml(f) + '" style="font-size:11.5px; padding:4px 8px;">' +
            '<span>' + window.Clarity.utils.escapeHtml(f) + '</span>' +
            '<span class="muted" style="font-size:10.5px;">Inspect</span>' +
            '</button>';
        }).join("");

        const subList = (item.subsections || []).map(sub => {
          return '<div class="arch-mindmap-child-node">' +
            '<div style="font-weight:600; font-size:12px; color:var(--ink); font-family:var(--font-mono);">' + window.Clarity.utils.escapeHtml(sub.title) + '</div>' +
            (sub.detail ? '<div class="muted" style="font-size:11.5px;">' + window.Clarity.utils.escapeHtml(sub.detail) + '</div>' : '') +
            (sub.file ? '<button class="btn btn--ghost btn--sm" data-jump-file="' + window.Clarity.utils.escapeHtml(sub.file) + '" data-jump-line="' + (sub.line || 1) + '" style="padding:0; font-size:11px; color:var(--accent); text-align:left;">Jump to code →</button>' : '') +
            '</div>';
        }).join("");

        return '<div class="arch-mindmap-card">' +
          '<div class="arch-mindmap-header">' +
          '  <div style="display:flex; align-items:center; gap:10px;">' +
          '    <span class="arch-legend-dot" style="background:' + color + '; width:11px; height:11px;"></span>' +
          '    <strong style="font-size:14.5px; color:var(--ink);">' + window.Clarity.utils.escapeHtml(item.title) + '</strong>' +
          '    <span class="arch-badge arch-badge--' + (item.category || 'service') + '" style="font-size:10.5px; padding:2px 7px;">' + (item.category || 'service') + '</span>' +
          '  </div>' +
          '  <span class="muted" style="font-size:12px;">' + (item.files ? item.files.length : 0) + ' files</span>' +
          '</div>' +
          '<div class="arch-mindmap-content">' +
          '  <p style="font-size:13px; color:var(--ink-muted); margin:0; line-height:1.5;">' + window.Clarity.utils.escapeHtml(item.description || '') + '</p>' +
          (subList ? '<div class="arch-mindmap-children">' + subList + '</div>' : '') +
          (filesList ? '<div style="margin-top:8px; display:flex; flex-direction:column; gap:5px;">' + filesList + '</div>' : '') +
          '</div>' +
          '</div>';
      }).join("")
    ].join("");

    wireInspectorJumpButtons(cont);
  }

  // 8. Pipeline Data Flow View
  function renderDataFlowView() {
    const cont = document.getElementById("archDataflowContainer");
    if (!cont) return;

    const flowsList = arch.flows || [];
    const activeSelectedFlow = (selectedDataflowFlowId !== "all" && flowsList.length > 0)
      ? flowsList.find(f => f.id === selectedDataflowFlowId)
      : null;

    let flowSelectorPills = '';
    if (flowsList.length > 0) {
      flowSelectorPills = [
        '<div style="display:flex; align-items:center; gap:8px; overflow-x:auto; padding-bottom:6px; margin-bottom:16px;">',
        '  <button class="btn btn--sm ' + (selectedDataflowFlowId === 'all' ? 'btn--primary' : 'btn--outline') + '" data-dflow-id="all">General System Pipeline</button>',
        flowsList.map(f => {
          const isActive = selectedDataflowFlowId === f.id;
          const catIcon = f.category === 'auth' ? '🔒' : f.category === 'ai' ? '🧠' : f.category === 'file' ? '📁' : f.category === 'data' ? '🗄️' : '⚡';
          return '<button class="btn btn--sm ' + (isActive ? 'btn--primary' : 'btn--outline') + '" data-dflow-id="' + window.Clarity.utils.escapeHtml(f.id) + '">' + catIcon + ' ' + window.Clarity.utils.escapeHtml(f.name) + '</button>';
        }).join(""),
        '</div>'
      ].join("");
    }

    if (activeSelectedFlow) {
      const steps = activeSelectedFlow.steps || [];
      cont.innerHTML = [
        '<div class="card" style="padding:18px 22px; border:1px solid var(--line); background:var(--surface); margin-bottom:16px;">',
        '  <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">',
        '    <div>',
        '      <div style="display:flex; align-items:center; gap:8px;">',
        '        <span style="font-size:18px;">⚡</span>',
        '        <h3 style="font-size:15.5px; font-weight:700; color:var(--ink); margin:0;">' + window.Clarity.utils.escapeHtml(activeSelectedFlow.name) + '</h3>',
        '        <span class="tag tag--xs tag--info">' + (activeSelectedFlow.category || 'api').toUpperCase() + '</span>',
        '      </div>',
        '      <p class="muted" style="font-size:13px; margin:6px 0 0;">' + window.Clarity.utils.escapeHtml(activeSelectedFlow.description) + '</p>',
        '    </div>',
        '    <button class="btn btn--primary btn--sm" id="traceFlowInGraphBtn" data-flow-trace-id="' + window.Clarity.utils.escapeHtml(activeSelectedFlow.id) + '" style="font-size:12.5px; padding:6px 14px; gap:6px;">',
        '      <span>Interactive Trace in Graph</span>',
        '    </button>',
        '  </div>',
        '</div>',

        flowSelectorPills,

        '<div class="flow-timeline">',
        steps.map(step => {
          const fileEvidence = step.evidence?.file
            ? '<button class="arch-file-tag" data-jump-file="' + window.Clarity.utils.escapeHtml(step.evidence.file) + '" ' + (step.evidence.line ? 'data-jump-line="' + step.evidence.line + '"' : '') + '>' + window.Clarity.utils.escapeHtml(step.evidence.file) + (step.evidence.line ? ':' + step.evidence.line : '') + '</button>'
            : '';

          return '<div class="flow-step-item">' +
            '<div class="flow-step-marker" style="' + (step.isReturnPath ? 'background:var(--accent-soft); color:var(--accent); border-color:var(--accent);' : '') + '">' + step.step + '</div>' +
            '<div class="hstack" style="justify-content:space-between; margin-bottom:6px; flex-wrap:wrap; gap:8px;">' +
            '  <strong style="font-size:14.5px; color:var(--ink);">' + window.Clarity.utils.escapeHtml(step.action) + '</strong>' +
            '  <span class="muted" style="font-size:12px; font-family:var(--font-mono);">' +
            (step.isReturnPath ? '<span class="tag tag--xs" style="background:rgba(168,85,247,0.12); color:#9333ea; font-size:10px; margin-right:4px;">Return</span>' : '') +
            window.Clarity.utils.escapeHtml(step.nodeLabel) +
            '  </span>' +
            '</div>' +
            '<p style="font-size:13.5px; color:var(--ink-muted); line-height:1.5; margin-bottom:10px;">' + window.Clarity.utils.escapeHtml(step.description) + '</p>' +
            (fileEvidence ? '<div class="arch-files-list">' + fileEvidence + '</div>' : '') +
            '</div>';
        }).join(""),
        '</div>'
      ].join("");

      document.getElementById("traceFlowInGraphBtn")?.addEventListener("click", () => {
        setViewMode("graph");
        setTimeout(() => {
          activateFlow(activeSelectedFlow.id);
        }, 80);
      });

    } else {
      const steps = dataFlow.steps || [];
      cont.innerHTML = [
        '<div class="card" style="padding:18px 22px; border:1px solid var(--line); background:var(--surface); margin-bottom:16px;">',
        '  <h3 style="font-size:15px; font-weight:600; color:var(--ink); margin-bottom:6px;">End-to-End Pipeline Execution Trace</h3>',
        '  <p class="muted" style="font-size:13px; margin:0;">' + window.Clarity.utils.escapeHtml(dataFlow.summary || "Step-by-step execution path traced across application layers.") + '</p>',
        '</div>',

        flowSelectorPills,

        '<div class="flow-timeline">' +
        steps.map(step => {
          const filesList = (step.files || []).map(f => {
            return '<button class="arch-file-tag" data-jump-file="' + window.Clarity.utils.escapeHtml(f) + '">' + window.Clarity.utils.escapeHtml(f) + '</button>';
          }).join("");

          return '<div class="flow-step-item">' +
            '<div class="flow-step-marker">' + step.step + '</div>' +
            '<div class="hstack" style="justify-content:space-between; margin-bottom:6px; flex-wrap:wrap; gap:8px;">' +
            '  <strong style="font-size:14.5px; color:var(--ink);">' + window.Clarity.utils.escapeHtml(step.title) + '</strong>' +
            '  <span class="muted" style="font-size:12px; font-family:var(--font-mono);">' + window.Clarity.utils.escapeHtml(step.source) + ' → ' + window.Clarity.utils.escapeHtml(step.target) + '</span>' +
            '</div>' +
            '<p style="font-size:13.5px; color:var(--ink-muted); line-height:1.5; margin-bottom:10px;">' + window.Clarity.utils.escapeHtml(step.description) + '</p>' +
            '<div class="arch-files-list">' + filesList + '</div>' +
            '</div>';
        }).join("") +
        '</div>'
      ].join("");
    }

    cont.querySelectorAll("[data-dflow-id]").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedDataflowFlowId = btn.getAttribute("data-dflow-id") || "all";
        renderDataFlowView();
      });
    });

    wireInspectorJumpButtons(cont);
  }

  // 9. AI Architecture Explanation Modal
  async function openArchitectureExplanationModal() {
    const portal = document.getElementById("archModalPortal");
    if (!portal) return;

    portal.innerHTML = [
      '<div class="fm-modal-backdrop" id="archModalBackdrop">',
      '<div class="arch-explanation-modal">',
      '  <div class="arch-explanation-header">',
      '    <div style="display:flex; align-items:center; gap:8px;">',
      '      <span style="font-size:18px;">⚡</span>',
      '      <strong style="font-size:15.5px; color:var(--ink);">Architectural Intelligence & Systems Breakdown</strong>',
      '    </div>',
      '    <button class="btn btn--ghost btn--sm" id="closeArchModalBtn" style="font-size:14px; padding:2px 8px;">✕</button>',
      '  </div>',
      '  <div class="arch-explanation-body" id="archExplanationContent">',
      '    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:48px 24px;">',
      '      <span class="spinner" style="width:24px; height:24px; margin-bottom:14px;"></span>',
      '      <div style="font-size:14px; font-weight:600; color:var(--ink);">Synthesizing Architecture Intelligence...</div>',
      '      <div class="muted" style="font-size:12.5px; margin-top:4px;">Cross-referencing AST calls, routing endpoints, schemas, and security boundaries.</div>',
      '    </div>',
      '  </div>',
      '  <div class="arch-explanation-footer">',
      '    <button class="btn btn--outline btn--sm" id="copyArchExplanationBtn" style="display:none;">Copy Markdown</button>',
      '    <button class="btn btn--primary btn--sm" id="doneArchModalBtn">Done</button>',
      '  </div>',
      '</div>',
      '</div>'
    ].join("");

    const closeModal = () => { portal.innerHTML = ""; };
    document.getElementById("closeArchModalBtn")?.addEventListener("click", closeModal);
    document.getElementById("doneArchModalBtn")?.addEventListener("click", closeModal);
    document.getElementById("archModalBackdrop")?.addEventListener("click", (e) => {
      if (e.target.id === "archModalBackdrop") closeModal();
    });

    let explanationText = "";
    try {
      const res = await window.Clarity.api.post("/api/projects/" + projectId + "/explain-architecture");
      explanationText = res.explanation || "";

      const contentEl = document.getElementById("archExplanationContent");
      const copyBtn = document.getElementById("copyArchExplanationBtn");
      if (contentEl) {
        if (window.Clarity.markdown && window.Clarity.markdown.render) {
          contentEl.innerHTML = '<div class="markdown-body">' + window.Clarity.markdown.render(explanationText) + '</div>';
        } else {
          contentEl.innerHTML = '<pre style="white-space:pre-wrap; font-family:inherit; font-size:13.5px; line-height:1.6;">' + window.Clarity.utils.escapeHtml(explanationText) + '</pre>';
        }
      }

      if (copyBtn) {
        copyBtn.style.display = "inline-flex";
        copyBtn.addEventListener("click", () => {
          navigator.clipboard.writeText(explanationText);
          window.Clarity.toast.show("Architecture explanation copied", "success");
        });
      }

    } catch (err) {
      const contentEl = document.getElementById("archExplanationContent");
      if (contentEl) {
        contentEl.innerHTML = '<div class="project-notice" style="margin:20px;">' + window.Clarity.utils.escapeHtml(err.message || "Failed to generate explanation") + '</div>';
      }
    }
  }

  // Helpers: Node Color & Icon Mapping
  function getNodeColor(type) {
    switch (type) {
      case 'user': return '#4f46e5'; // Indigo
      case 'frontend': return '#2563eb'; // Royal Blue
      case 'backend': return '#10b981'; // Emerald Green
      case 'database': return '#8b5cf6'; // Purple
      case 'table': return '#8b5cf6'; // Purple
      case 'route': return '#f97316'; // Orange
      case 'api': return '#f97316'; // Orange
      case 'auth': return '#ef4444'; // Red
      case 'service': return '#06b6d4'; // Cyan
      case 'external': return '#eab308'; // Amber
      case 'ml': return '#ec4899'; // Pink
      case 'storage': return '#14b8a6'; // Teal
      case 'queue': return '#0ea5e9'; // Sky
      case 'cache': return '#f43f5e'; // Rose
      case 'devops': return '#64748b'; // Slate
      case 'file': return '#475569';
      default: return '#6366f1'; // Indigo
    }
  }

  function getNodeIcon(type) {
    switch (type) {
      case 'user': return '👤';
      case 'frontend': return '💻';
      case 'backend': return '⚙️';
      case 'database': return '🗄️';
      case 'table': return '📊';
      case 'route': return '🔗';
      case 'api': return '🔌';
      case 'auth': return '🛡️';
      case 'service': return '📡';
      case 'external': return '☁️';
      case 'ml': return '🧠';
      case 'storage': return '📦';
      case 'queue': return '📬';
      case 'cache': return '⚡';
      case 'devops': return '🐳';
      case 'file': return '📄';
      default: return '🧩';
    }
  }

  function getEdgeStatusColor(status) {
    switch (status) {
      case 'VERIFIED': return '#10b981';
      case 'LIKELY': return '#3b82f6';
      case 'UNRESOLVED': return '#f59e0b';
      case 'POTENTIAL_ISSUE': return '#ef4444';
      case 'MISSING': return '#ef4444';
      case 'INCORRECT': return '#dc2626';
      default: return '#94a3b8';
    }
  }

  // 10. Architecture Advisor Intelligence Engine
  const targetProjectId = projectId || (analysis && analysis.id);

  async function loadAdvisorReport() {
    if (!targetProjectId) return;
    try {
      const res = await window.Clarity.api.get("/api/projects/" + targetProjectId + "/advisor");
      if (res && res.advisor) {
        advisorData = res.advisor;
        updateAdvisorBadgesAndHealth();
        if (cyInstance) {
          updateGraphAdvisorIndicators();
        }
      }
    } catch (err) {
      console.warn("Architecture Advisor report unavailable:", err);
    }
  }

  function updateAdvisorBadgesAndHealth() {
    if (!advisorData) return;
    const badge = document.getElementById("advisorIssueCountBadge");
    const healthChip = document.getElementById("archAdvisorHealthChip");
    const issues = advisorData.issues || [];
    const issueCount = issues.length;

    if (badge) {
      if (issueCount > 0) {
        badge.textContent = issueCount;
        badge.style.display = "inline-block";
      } else {
        badge.style.display = "none";
      }
    }

    if (healthChip) {
      healthChip.style.display = "inline-flex";
      const rate = advisorData.stats ? advisorData.stats.verificationRate : 100;
      if (issueCount === 0) {
        healthChip.className = "arch-health-chip arch-health-chip--verified";
        healthChip.innerHTML = "✓ Advisor: " + rate + "% Verified (0 Issues)";
        healthChip.title = "All architectural connections verified by AST static analysis.";
      } else {
        const hasCritical = issues.some(i => i.severity === 'critical');
        healthChip.className = hasCritical ? "arch-health-chip arch-health-chip--danger" : "arch-health-chip arch-health-chip--warning";
        healthChip.innerHTML = "⚠ Advisor: " + rate + "% (" + issueCount + " Issue" + (issueCount > 1 ? "s" : "") + ")";
        healthChip.title = "Click to inspect " + issueCount + " unverified architectural connections and repair recommendations.";
      }
    }
  }

  function updateGraphAdvisorIndicators() {
    if (!cyInstance || !advisorData) return;
    const issues = advisorData.issues || [];
    cyInstance.batch(() => {
      cyInstance.edges().forEach(e => {
        const eid = e.id();
        const src = e.data('source');
        const tgt = e.data('target');
        const label = e.data('label') || '';
        const issue = issues.find(iss => iss.edgeId === eid || (iss.source === src && iss.target === tgt) || (label && iss.title && iss.title.toLowerCase().includes(label.toLowerCase())));
        if (issue) {
          const color = getEdgeStatusColor(issue.status || 'POTENTIAL_ISSUE');
          e.data('status', issue.status || 'POTENTIAL_ISSUE');
          e.data('statusColor', color);
          e.data('lineStyle', 'dashed');
          e.style({
            'line-color': color,
            'target-arrow-color': color,
            'line-style': 'dashed',
            'line-dash-pattern': [6, 3]
          });
        }
      });
      cyInstance.nodes().forEach(n => {
        const nid = n.id();
        const files = n.data('files') || [];
        const hasIssue = issues.some(iss => iss.nodeId === nid || (iss.file && files.includes(iss.file)));
        if (hasIssue) {
          n.data('hasIssue', true);
          n.style({
            'border-width': 3.5,
            'border-style': 'dashed',
            'border-color': '#ef4444'
          });
        }
      });
    });
  }


  // Code Change Diff Modal
  function openCodeChangeModal(plan) {
    const portal = document.getElementById("fmModalContainer");
    if (!portal) return;

    let tabsHtml = '';
    let contentHtml = '';
    
    plan.files.forEach((f, idx) => {
      const active = idx === 0 ? 'is-active' : '';
      const displayStyle = idx === 0 ? 'block' : 'none';
      tabsHtml += `<button class="project-tab-btn ${active}" data-file-idx="${idx}">${window.Clarity.utils.escapeHtml(f.path)}</button>`;
      
      contentHtml += `<div class="diff-file-content" data-content-idx="${idx}" style="display:${displayStyle}; height: 100%; overflow: auto;">
        <div style="padding: 12px; background: var(--surface); border-bottom: 1px solid var(--line); font-family: monospace; font-size: 13px; font-weight: bold;">
          📝 Proposed New Content: ${window.Clarity.utils.escapeHtml(f.path)}
        </div>
        <pre style="margin: 0; padding: 16px; font-size: 13px; line-height: 1.5; background: var(--surface-hover); color: var(--ink); border-bottom-left-radius: 6px; border-bottom-right-radius: 6px;"><code>${window.Clarity.utils.escapeHtml(f.content)}</code></pre>
      </div>`;
    });

    portal.innerHTML = `
      <div class="fm-modal-backdrop" id="ccModalBackdrop" style="position:fixed; inset:0; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">
        <div style="background:var(--surface); border:1px solid var(--line); border-radius:12px; width:100%; max-width:900px; height:85vh; display:flex; flex-direction:column; box-shadow:0 20px 40px rgba(0,0,0,0.25); overflow:hidden; animation: fmFadeIn 0.2s ease-out;">
          
          <div style="display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid var(--line); background:var(--surface-muted);">
            <div>
              <h3 style="margin:0; font-size:16px; font-weight:600; color:var(--ink);">Review Code Changes</h3>
              <p class="muted" style="margin:4px 0 0 0; font-size:13px;">${window.Clarity.utils.escapeHtml(plan.description || "Review the proposed modifications before applying.")}</p>
            </div>
            <button class="btn btn--ghost btn--sm" id="closeCcModalBtn" style="padding:4px 8px; font-size:13px;">✕</button>
          </div>

          <div style="display:flex; flex:1; overflow:hidden; flex-direction:column;">
            <div style="display:flex; gap:8px; border-bottom:1px solid var(--line); padding:8px 16px; overflow-x:auto; background:var(--surface-muted);">
              ${tabsHtml}
            </div>
            <div style="flex:1; background:var(--surface); overflow:hidden;">
              ${contentHtml}
            </div>
          </div>

          <div style="padding:16px 20px; border-top:1px solid var(--line); background:var(--surface-muted); display:flex; justify-content:flex-end; gap:12px;">
            <button class="btn btn--outline btn--sm" id="cancelCcModalBtn">Cancel</button>
            <button class="btn btn--primary btn--sm" id="applyCcModalBtn">Approve & Apply</button>
          </div>
        </div>
      </div>
    `;

    const cleanup = () => { portal.innerHTML = ""; };
    document.getElementById("closeCcModalBtn")?.addEventListener("click", cleanup);
    document.getElementById("cancelCcModalBtn")?.addEventListener("click", cleanup);
    document.getElementById("ccModalBackdrop")?.addEventListener("click", (e) => {
      if (e.target.id === "ccModalBackdrop") cleanup();
    });

    const tabBtns = portal.querySelectorAll(".project-tab-btn[data-file-idx]");
    const contents = portal.querySelectorAll(".diff-file-content");

    tabBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        tabBtns.forEach(b => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        const idx = btn.getAttribute("data-file-idx");
        contents.forEach(c => {
          c.style.display = c.getAttribute("data-content-idx") === idx ? "block" : "none";
        });
      });
    });

    document.getElementById("applyCcModalBtn")?.addEventListener("click", async (e) => {
      const btn = e.target;
      try {
        btn.disabled = true;
        btn.textContent = "Applying...";
        const res = await window.Clarity.api.post("/api/projects/" + window.Clarity.currentProjectId + "/apply-changes", { plan });
        if (res.ok) {
          window.Clarity.toast.show("Code changes applied successfully.", "success");
          cleanup();
          // Force file explorer reload if we are on files tab
          const chatBtn = document.querySelector('.project-tab-btn[data-tab="files"]');
          if (chatBtn) chatBtn.click();
        } else {
          throw new Error(res.error || "Failed to apply changes");
        }
      } catch (err) {
        btn.disabled = false;
        btn.textContent = "Approve & Apply";
        window.Clarity.toast.show(err.message, "danger");
      }
    });
  }

  // 11. Architecture Advisor Fix Modal
  function openAdvisorFixModal(issue) {
    if (!issue || !issue.fixDiff) return;
    const portal = document.getElementById("archFixModalPortal");
    if (!portal) return;

    const diff = issue.fixDiff;
    const hasBefore = Boolean(diff.before && diff.before.trim());

    portal.innerHTML = [
      '<div class="fm-modal-backdrop" id="fixModalBackdrop" style="position:fixed; inset:0; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); z-index:9999; display:flex; align-items:center; justify-content:center; padding:16px;">',
      '  <div class="card" style="width:100%; max-width:680px; max-height:90vh; display:flex; flex-direction:column; background:var(--surface); border:1px solid var(--line); border-radius:14px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.3); overflow:hidden;">',
      '    <!-- Header -->',
      '    <div style="display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid var(--line); background:var(--surface-muted);">',
      '      <div style="display:flex; align-items:center; gap:8px;">',
      '        <span style="font-size:18px;">🔧</span>',
      '        <div>',
      '          <strong style="font-size:15px; color:var(--ink);">' + window.Clarity.utils.escapeHtml(issue.title) + '</strong>',
      '          <div class="muted" style="font-size:11.5px; margin-top:2px;">Architecture Advisor Connection Repair</div>',
      '        </div>',
      '      </div>',
      '      <button class="btn btn--ghost btn--sm" id="closeFixModalBtn" style="padding:4px 8px; font-size:13px;">✕</button>',
      '    </div>',

      '    <!-- Body -->',
      '    <div style="padding:20px; overflow-y:auto; display:flex; flex-direction:column; gap:16px;">',
      '      <!-- Target File Bar -->',
      '      <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--surface-muted); border-radius:8px; border:1px solid var(--line);">',
      '        <div style="display:flex; align-items:center; gap:8px; font-family:var(--font-mono); font-size:13px; color:var(--ink); font-weight:600;">',
      '          <span>📄</span> ' + window.Clarity.utils.escapeHtml(diff.file),
      '        </div>',
      '        <span class="tag tag--xs" style="background:#e0e7ff; color:#4338ca; font-weight:600;">' + (hasBefore ? "Modify File" : "Create File") + '</span>',
      '      </div>',

      '      <!-- Explanation -->',
      '      <div style="font-size:13px; color:var(--ink-muted); line-height:1.5;">' + window.Clarity.utils.escapeHtml(diff.explanation || issue.explanation || "Applies recommended architecture modifications to verify the connection.") + '</div>',

      '      <!-- Diff View -->',
      '      <div style="display:flex; flex-direction:column; gap:10px;">',
      hasBefore ? [
        '        <div>',
        '          <div style="font-size:11.5px; font-weight:700; text-transform:uppercase; color:#dc2626; margin-bottom:6px; display:flex; align-items:center; gap:5px;">',
        '            <span>− Original Snippet:</span>',
        '          </div>',
        '          <pre class="arch-code-snippet" style="background:#fef2f2; border:1px solid #fecaca; color:#991b1b; padding:10px 12px; border-radius:8px; font-size:12px; max-height:140px; overflow:auto; margin:0;">' + window.Clarity.utils.escapeHtml(diff.before) + '</pre>',
        '        </div>'
      ].join("") : '',

      '        <div>',
      '          <div style="font-size:11.5px; font-weight:700; text-transform:uppercase; color:#16a34a; margin-bottom:6px; display:flex; align-items:center; gap:5px;">',
      '            <span>+ Proposed Implementation:</span>',
      '          </div>',
      '          <pre class="arch-code-snippet" style="background:#f0fdf4; border:1px solid #bbf7d0; color:#166534; padding:10px 12px; border-radius:8px; font-size:12px; max-height:220px; overflow:auto; margin:0;">' + window.Clarity.utils.escapeHtml(diff.after) + '</pre>',
      '        </div>',
      '      </div>',

      '      <!-- Safety Notice -->',
      '      <div style="display:flex; align-items:flex-start; gap:10px; padding:10px 12px; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; font-size:12px; color:#92400e;">',
      '        <span style="font-size:14px; line-height:1;">🔒</span>',
      '        <div><strong>Safety Directives Enforced:</strong> Clarity will never silently edit project files without your explicit approval. Applying this fix modifies only the specified lines above and re-verifies your system pipeline.</div>',
      '      </div>',
      '    </div>',

      '    <!-- Footer -->',
      '    <div style="display:flex; align-items:center; justify-content:flex-end; gap:10px; padding:14px 20px; border-top:1px solid var(--line); background:var(--surface-muted);">',
      '      <button class="btn btn--outline btn--sm" id="cancelFixModalBtn">Cancel</button>',
      '      <button class="btn btn--primary btn--sm" id="applyFixConfirmBtn" style="gap:6px;"><span>Confirm & Apply Fix</span></button>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join("");

    const cleanup = () => { portal.innerHTML = ""; };
    document.getElementById("closeFixModalBtn")?.addEventListener("click", cleanup);
    document.getElementById("cancelFixModalBtn")?.addEventListener("click", cleanup);
    document.getElementById("fixModalBackdrop")?.addEventListener("click", (e) => {
      if (e.target.id === "fixModalBackdrop") cleanup();
    });

    document.getElementById("applyFixConfirmBtn")?.addEventListener("click", async () => {
      const applyBtn = document.getElementById("applyFixConfirmBtn");
      if (applyBtn) {
        applyBtn.disabled = true;
        applyBtn.innerHTML = '<span class="spinner" style="width:14px; height:14px;"></span> Applying...';
      }

      try {
        await window.Clarity.api.post("/api/projects/" + targetProjectId + "/advisor/apply-fix", {
          file: diff.file,
          before: diff.before,
          after: diff.after,
          explanation: diff.explanation || issue.explanation
        });

        cleanup();
        window.Clarity.toast.show("Fix applied successfully to " + diff.file + "! System re-analyzed.", "success");

        // Reload intelligence and advisor report
        await loadAdvisorReport();
        if (currentViewMode === "advisor") {
          renderAdvisorView();
        } else if (currentViewMode === "graph") {
          buildAndMountGraph();
          closeInspector();
        }
      } catch (err) {
        console.error("Failed to apply fix:", err);
        window.Clarity.toast.show("Failed to apply fix: " + err.message, "danger");
        if (applyBtn) {
          applyBtn.disabled = false;
          applyBtn.innerHTML = "Retry Applying Fix";
        }
      }
    });
  }

  // 12. Architecture Advisor View
  function renderAdvisorView() {
    const cont = document.getElementById("archAdvisorContainer");
    if (!cont) return;

    if (!advisorData) {
      cont.innerHTML = [
        '<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 20px; text-align:center;">',
        '  <span class="spinner" style="width:28px; height:28px; margin-bottom:14px;"></span>',
        '  <div style="font-weight:600; font-size:15px; color:var(--ink);">Auditing Cross-Component Architecture...</div>',
        '  <div class="muted" style="font-size:12.5px; margin-top:4px;">Cross-referencing AST calls, routing endpoints, schemas, and security boundaries.</div>',
        '</div>'
      ].join("");
      loadAdvisorReport().then(() => {
        if (currentViewMode === "advisor") renderAdvisorView();
      });
      return;
    }

    const stats = advisorData.stats || {};
    const issues = advisorData.issues || [];
    const routesMatrix = advisorData.routesMatrix || [];
    const totalIssues = issues.length;

    // Filter issues by category
    const filteredIssues = advisorCategoryFilter === "all"
      ? issues
      : issues.filter(iss => iss.category === advisorCategoryFilter);

    // Compute category counts
    const apiCount = issues.filter(i => i.category === 'api_route').length;
    const dbCount = issues.filter(i => i.category === 'database').length;
    const authCount = issues.filter(i => i.category === 'auth').length;
    const envCount = issues.filter(i => i.category === 'env').length;

    // Build Route Verification Rows
    const routesRowsHtml = routesMatrix.length === 0
      ? '<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--ink-muted);">No client-side API invocations detected in static analysis.</td></tr>'
      : routesMatrix.map(r => {
          const isVer = r.status === 'VERIFIED';
          const isLikely = r.status === 'LIKELY';
          const badgeClass = isVer
            ? 'arch-health-chip--verified'
            : (isLikely ? 'arch-health-chip--info' : 'arch-health-chip--danger');
          const badgeIcon = isVer ? '✓' : (isLikely ? 'ℹ' : '⚠');

          // Find if there is an issue with fix for this route
          const relatedIssue = issues.find(i => (i.category === 'api_route' && (i.title.includes(r.path) || (i.fixDiff && i.fixDiff.after && i.fixDiff.after.includes(r.path)))));

          return [
            '<tr style="border-bottom:1px solid var(--line); font-size:13px;">',
            '  <td style="padding:10px 12px;">',
            '    <div style="display:flex; align-items:center; gap:6px;">',
            '      <span class="tag tag--xs" style="font-weight:700; font-family:var(--font-mono); background:' + (r.method === 'GET' ? '#dbeafe; color:#1d4ed8;' : (r.method === 'POST' ? '#dcfce7; color:#15803d;' : '#fef3c7; color:#b45309;')) + '">' + window.Clarity.utils.escapeHtml(r.method) + '</span>',
            '      <span style="font-family:var(--font-mono); font-weight:600; color:var(--ink);">' + window.Clarity.utils.escapeHtml(r.path) + '</span>',
            '    </div>',
            r.clientFile ? '    <div style="margin-top:4px;"><button class="btn btn--ghost btn--sm" data-jump-file="' + window.Clarity.utils.escapeHtml(r.clientFile) + '" data-jump-line="' + (r.clientLine || 1) + '" style="padding:0; font-size:11px; font-family:var(--font-mono); color:var(--accent);">' + window.Clarity.utils.escapeHtml(r.clientFile) + ':' + (r.clientLine || 1) + '</button></div>' : '',
            '  </td>',
            '  <td style="padding:10px 12px;">',
            '    <span class="arch-health-chip ' + badgeClass + '" style="font-size:11px; padding:2px 8px;">' + badgeIcon + ' ' + r.status + '</span>',
            '  </td>',
            '  <td style="padding:10px 12px; font-family:var(--font-mono); font-size:12px;">',
            r.serverFile
              ? '<button class="btn btn--ghost btn--sm" data-jump-file="' + window.Clarity.utils.escapeHtml(r.serverFile) + '" data-jump-line="' + (r.serverLine || 1) + '" style="padding:0; font-size:11.5px; font-family:var(--font-mono); color:var(--accent); font-weight:600;">' + window.Clarity.utils.escapeHtml(r.serverFile) + ':' + (r.serverLine || 1) + '</button>'
              : '<span style="color:#ef4444; font-weight:600;">⚠ No Route Handler Declared</span>',
            '  </td>',
            '  <td style="padding:10px 12px; color:var(--ink-muted); font-size:12.5px; line-height:1.4;">' + window.Clarity.utils.escapeHtml(r.detail || "Direct HTTP API dispatch.") + '</td>',
            '  <td style="padding:10px 12px; text-align:right; white-space:nowrap;">',
            relatedIssue
              ? '<button class="btn btn--primary btn--sm" data-open-fix-issue="' + window.Clarity.utils.escapeHtml(relatedIssue.id) + '" style="font-size:11.5px; padding:3px 10px; gap:4px;"><span>Repair</span></button>'
              : (r.clientFile ? '<button class="btn btn--outline btn--sm" data-jump-file="' + window.Clarity.utils.escapeHtml(r.clientFile) + '" data-jump-line="' + (r.clientLine || 1) + '" style="font-size:11.5px; padding:3px 10px;">Inspect Code</button>' : '<span class="muted" style="font-size:11px;">Verified</span>'),
            '  </td>',
            '</tr>'
          ].join("");
        }).join("");

    // Build Issues Cards
    let issuesCardsHtml = '';
    if (filteredIssues.length === 0) {
      issuesCardsHtml = [
        '<div class="card" style="padding:32px 24px; text-align:center; border:1px solid var(--line); background:var(--surface); border-radius:12px;">',
        '  <div style="font-size:32px; margin-bottom:10px;">✅</div>',
        '  <div style="font-size:16px; font-weight:600; color:var(--ink); margin-bottom:4px;">All Connections in this Category Verified</div>',
        '  <p class="muted" style="font-size:13px; max-width:480px; margin:0 auto; line-height:1.5;">Every detected invocation, model import, and handler connection meets strict static AST cross-referencing criteria.</p>',
        '</div>'
      ].join("");
    } else {
      issuesCardsHtml = filteredIssues.map(iss => {
        const sevClass = iss.severity === 'critical' ? 'arch-health-chip--danger' : (iss.severity === 'warning' ? 'arch-health-chip--warning' : 'arch-health-chip--info');
        const sevLabel = iss.severity ? iss.severity.toUpperCase() : 'ISSUE';

        return [
          '<div class="card" style="padding:18px 20px; border:1px solid var(--line); background:var(--surface); border-radius:12px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.05); display:flex; flex-direction:column; gap:12px;">',
          '  <!-- Card Header -->',
          '  <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap;">',
          '    <div>',
          '      <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">',
          '        <span class="arch-health-chip ' + sevClass + '" style="font-size:10px; font-weight:700; padding:2px 6px;">' + sevLabel + '</span>',
          '        <span class="tag tag--xs" style="text-transform:uppercase; font-size:10px; letter-spacing:0.04em;">' + window.Clarity.utils.escapeHtml(iss.category) + '</span>',
          '        <h4 style="font-size:15px; font-weight:600; color:var(--ink); margin:0;">' + window.Clarity.utils.escapeHtml(iss.title) + '</h4>',
          '      </div>',
          iss.file ? '      <button class="btn btn--ghost btn--sm" data-jump-file="' + window.Clarity.utils.escapeHtml(iss.file) + '" data-jump-line="' + (iss.line || 1) + '" style="padding:0; font-family:var(--font-mono); font-size:12px; color:var(--accent); font-weight:600;">' + window.Clarity.utils.escapeHtml(iss.file) + ':' + (iss.line || 1) + ' <span class="muted" style="font-weight:normal;">(Jump to code →)</span></button>' : '',
          '    </div>',
          '    <div style="display:flex; align-items:center; gap:8px;">',
          iss.fixDiff ? '      <button class="btn btn--primary btn--sm" data-open-fix-issue="' + window.Clarity.utils.escapeHtml(iss.id) + '" style="gap:5px; font-weight:600; padding:5px 12px;"><span>Review Diff & Apply Fix</span></button>' : '',
          '    </div>',
          '  </div>',

          '  <!-- Explanation & Why Clarity Cannot Prove It -->',
          '  <div style="background:var(--surface-muted); border:1px solid var(--line); border-radius:8px; padding:12px 14px; font-size:13px; line-height:1.5;">',
          '    <div style="font-size:11.5px; font-weight:700; text-transform:uppercase; color:#b45309; letter-spacing:0.03em; margin-bottom:4px;">⚠ Connection Not Verified / Static Proof Missing:</div>',
          '    <div style="color:var(--ink);">' + window.Clarity.utils.escapeHtml(iss.explanation) + '</div>',
          '  </div>',

          '  <!-- Potential Causes Grid -->',
          iss.potentialCauses && iss.potentialCauses.length > 0 ? [
            '  <div>',
            '    <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--ink-muted); letter-spacing:0.04em; margin-bottom:6px;">Potential Causes:</div>',
            '    <ul style="margin:0; padding-left:18px; font-size:12.5px; color:var(--ink-muted); line-height:1.5;">',
            iss.potentialCauses.map(c => '<li>' + window.Clarity.utils.escapeHtml(c) + '</li>').join(""),
            '    </ul>',
            '  </div>'
          ].join("") : '',

          '  <!-- Recommended Architecture -->',
          iss.recommendedArchitecture ? [
            '  <div>',
            '    <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--ink-muted); letter-spacing:0.04em; margin-bottom:4px;">Recommended Architecture Flow:</div>',
            '    <pre style="background:var(--surface-muted); border:1px solid var(--line); border-radius:6px; padding:8px 12px; font-size:11.5px; font-family:var(--font-mono); color:var(--ink); margin:0; overflow-x:auto;">' + window.Clarity.utils.escapeHtml(iss.recommendedArchitecture) + '</pre>',
            '  </div>'
          ].join("") : '',

          '  <!-- Suggested Implementation Snippet -->',
          iss.suggestedImplementation ? [
            '  <div>',
            '    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">',
            '      <div style="font-size:11px; font-weight:700; text-transform:uppercase; color:#15803d; letter-spacing:0.04em;">Suggested Implementation:</div>',
            '      <button class="btn btn--ghost btn--sm copy-snippet-btn" data-snippet="' + encodeURIComponent(iss.suggestedImplementation) + '" style="font-size:11px; padding:2px 8px;">Copy Code</button>',
            '    </div>',
            '    <pre class="arch-code-snippet" style="background:var(--surface-muted); border:1px solid var(--line); border-radius:6px; padding:10px 12px; font-size:11.5px; max-height:180px; overflow:auto; margin:0;">' + window.Clarity.utils.escapeHtml(iss.suggestedImplementation) + '</pre>',
            '  </div>'
          ].join("") : '',

          '</div>'
        ].join("");
      }).join("");
    }

    // Render Full Advisor Container Content
    cont.innerHTML = [
      '<!-- Advisor Top Summary Banner -->',
      '<div class="card" style="padding:22px 24px; border:1px solid var(--line); background:var(--surface); border-radius:12px; margin-bottom:20px;">',
      '  <div style="display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;">',
      '    <div>',
      '      <div style="display:flex; align-items:center; gap:8px;">',
      '        <span style="font-size:20px;">🛡️</span>',
      '        <h3 style="font-size:17px; font-weight:700; color:var(--ink); margin:0;">Architecture Advisor & Pipeline Integrity Engine</h3>',
      '      </div>',
      '      <p class="muted" style="font-size:13.5px; line-height:1.5; margin:6px 0 0; max-width:680px;">',
      '        Clarity cross-references your frontend client API calls, server-side route definitions, database schema models, and security boundaries. If Clarity cannot prove a connection, it provides diagnosis and safe repair suggestions.',
      '      </p>',
      '    </div>',
      '    <div style="text-align:right; background:var(--surface-muted); padding:12px 18px; border-radius:10px; border:1px solid var(--line);">',
      '      <div style="font-size:11px; text-transform:uppercase; font-weight:700; color:var(--ink-muted); letter-spacing:0.04em;">Verification Rate</div>',
      '      <div style="font-size:26px; font-weight:800; color:' + ((stats.verificationRate || 100) >= 80 ? '#10b981' : '#f59e0b') + ';">' + (stats.verificationRate || 100) + '%</div>',
      '    </div>',
      '  </div>',

      '  <!-- 4 Stat Counters -->',
      '  <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; margin-top:18px;">',
      '    <div style="padding:12px; background:var(--surface-muted); border-radius:8px; border:1px solid var(--line); text-align:center;">',
      '      <div style="font-size:20px; font-weight:700; color:#10b981;">' + (stats.verifiedConnections || 0) + '</div>',
      '      <div class="muted" style="font-size:11.5px; margin-top:2px;">Verified Links</div>',
      '    </div>',
      '    <div style="padding:12px; background:var(--surface-muted); border-radius:8px; border:1px solid var(--line); text-align:center;">',
      '      <div style="font-size:20px; font-weight:700; color:' + ((stats.unverifiedConnections || 0) > 0 ? '#ef4444' : '#10b981') + ';">' + (stats.unverifiedConnections || 0) + '</div>',
      '      <div class="muted" style="font-size:11.5px; margin-top:2px;">Actionable Issues</div>',
      '    </div>',
      '    <div style="padding:12px; background:var(--surface-muted); border-radius:8px; border:1px solid var(--line); text-align:center;">',
      '      <div style="font-size:20px; font-weight:700; color:' + ((stats.orphanCount || 0) > 0 ? '#f59e0b' : 'var(--ink)') + ';">' + (stats.orphanCount || 0) + '</div>',
      '      <div class="muted" style="font-size:11.5px; margin-top:2px;">Orphan Modules</div>',
      '    </div>',
      '    <div style="padding:12px; background:var(--surface-muted); border-radius:8px; border:1px solid var(--line); text-align:center;">',
      '      <div style="font-size:20px; font-weight:700; color:' + ((stats.unusedModelCount || 0) > 0 ? '#8b5cf6' : 'var(--ink)') + ';">' + (stats.unusedModelCount || 0) + '</div>',
      '      <div class="muted" style="font-size:11.5px; margin-top:2px;">Unused Schemas</div>',
      '    </div>',
      '  </div>',
      '</div>',

      '<!-- Route Verification Matrix Table -->',
      '<div class="card" style="border:1px solid var(--line); background:var(--surface); border-radius:12px; margin-bottom:24px; overflow:hidden;">',
      '  <div style="padding:14px 18px; background:var(--surface-muted); border-bottom:1px solid var(--line); display:flex; align-items:center; justify-content:space-between;">',
      '    <div style="display:flex; align-items:center; gap:8px;">',
      '      <strong style="font-size:14px; color:var(--ink);">Cross-Boundary Route Verification Matrix</strong>',
      '      <span class="muted" style="font-size:12px;">(' + routesMatrix.length + ' detected endpoints)</span>',
      '    </div>',
      '    <span class="muted" style="font-size:11.5px;">Client AST ↔ Server Handlers</span>',
      '  </div>',
      '  <div style="overflow-x:auto;">',
      '    <table style="width:100%; border-collapse:collapse; text-align:left;">',
      '      <thead>',
      '        <tr style="border-bottom:1px solid var(--line); background:var(--surface-muted); font-size:11.5px; text-transform:uppercase; color:var(--ink-muted); letter-spacing:0.04em;">',
      '          <th style="padding:10px 12px;">Frontend Invocation</th>',
      '          <th style="padding:10px 12px;">Status</th>',
      '          <th style="padding:10px 12px;">Backend Target</th>',
      '          <th style="padding:10px 12px;">Diagnostics</th>',
      '          <th style="padding:10px 12px; text-align:right;">Action</th>',
      '        </tr>',
      '      </thead>',
      '      <tbody>' + routesRowsHtml + '</tbody>',
      '    </table>',
      '  </div>',
      '</div>',

      '<!-- Issues Category Filter Pills -->',
      '<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; flex-wrap:wrap; gap:10px;">',
      '  <div class="hstack" style="gap:6px;">',
      '    <button class="btn btn--sm advisor-filter-btn ' + (advisorCategoryFilter === 'all' ? 'btn--primary' : 'btn--outline') + '" data-advisor-cat="all">All Issues (' + totalIssues + ')</button>',
      '    <button class="btn btn--sm advisor-filter-btn ' + (advisorCategoryFilter === 'api_route' ? 'btn--primary' : 'btn--outline') + '" data-advisor-cat="api_route">API & Routing (' + apiCount + ')</button>',
      '    <button class="btn btn--sm advisor-filter-btn ' + (advisorCategoryFilter === 'database' ? 'btn--primary' : 'btn--outline') + '" data-advisor-cat="database">Database (' + dbCount + ')</button>',
      '    <button class="btn btn--sm advisor-filter-btn ' + (advisorCategoryFilter === 'auth' ? 'btn--primary' : 'btn--outline') + '" data-advisor-cat="auth">Auth & Security (' + authCount + ')</button>',
      '    <button class="btn btn--sm advisor-filter-btn ' + (advisorCategoryFilter === 'env' ? 'btn--primary' : 'btn--outline') + '" data-advisor-cat="env">Config & Env (' + envCount + ')</button>',
      '  </div>',
      '  <div class="muted" style="font-size:12px;">Click Review Diff & Apply Fix to resolve issues safely</div>',
      '</div>',

      '<!-- Issues Cards Container -->',
      '<div id="advisorIssuesCardsContainer">' + issuesCardsHtml + '</div>'
    ].join("");

    // Wire Category Filter Buttons
    cont.querySelectorAll(".advisor-filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        advisorCategoryFilter = btn.getAttribute("data-advisor-cat");
        renderAdvisorView();
      });
    });

    // Wire Copy Snippet Buttons
    cont.querySelectorAll(".copy-snippet-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const snippet = decodeURIComponent(btn.getAttribute("data-snippet") || "");
        if (snippet) {
          navigator.clipboard.writeText(snippet);
          window.Clarity.toast.show("Code snippet copied to clipboard", "success");
        }
      });
    });

    // Wire Jump Buttons and Fix Buttons
    wireInspectorJumpButtons(cont);
  }

  // Initial Graph Render & Advisor Report Load
  initCytoscape();
  loadAdvisorReport();
}

/* ============================================================
   Tab 4: Data Flow Pipeline
   ============================================================ */
function renderDataFlowTab(container, analysis, switchTabToFile) {
  const flowsList = (analysis.architecture && analysis.architecture.flows) || [];
  const activeFlow = (flowsList.length > 0) ? flowsList[0] : null;

  container.innerHTML = [
    '<div class="card" style="padding:20px; border:1px solid var(--line); background:var(--surface); margin-bottom:20px;">',
    '  <div class="hstack" style="justify-content:space-between; margin-bottom:8px; flex-wrap:wrap; gap:8px;">',
    '    <h3 style="font-size:16px; font-weight:600; color:var(--ink); margin:0;">End-to-End Execution & Data Pipeline</h3>',
    flowsList.length > 0 ? '    <span class="tag tag--xs tag--info">' + flowsList.length + ' Verified Application Flows</span>' : '',
    '  </div>',
    '  <p style="font-size:14.5px; line-height:1.6; color:var(--ink-muted); margin:0;">' + window.Clarity.utils.escapeHtml((analysis.dataFlow && analysis.dataFlow.summary) || 'System execution trace') + '</p>',
    '</div>',

    '<div class="flow-timeline">',
    (analysis.dataFlow && analysis.dataFlow.steps ? analysis.dataFlow.steps : []).map(step => {
      const filesList = (step.files || []).map(f => {
        return '<button class="arch-file-tag" data-nav-file="' + window.Clarity.utils.escapeHtml(f) + '">' + window.Clarity.utils.escapeHtml(f) + '</button>';
      }).join("");

      return '<div class="flow-step-item">' +
        '<div class="flow-step-marker">' + step.step + '</div>' +
        '<div class="hstack" style="justify-content:space-between; margin-bottom:6px;">' +
          '<strong style="font-size:14.5px; color:var(--ink);">' + window.Clarity.utils.escapeHtml(step.title) + '</strong>' +
          '<span class="muted" style="font-size:12px; font-family:var(--font-mono);">' + window.Clarity.utils.escapeHtml(step.source) + ' → ' + window.Clarity.utils.escapeHtml(step.target) + '</span>' +
        '</div>' +
        '<p style="font-size:13.5px; color:var(--ink-muted); line-height:1.5; margin-bottom:10px;">' + window.Clarity.utils.escapeHtml(step.description) + '</p>' +
        '<div class="arch-files-list">' + filesList + '</div>' +
      '</div>';
    }).join(""),
    '</div>'
  ].join("");

  container.querySelectorAll("[data-nav-file]").forEach(btn => {
    btn.addEventListener("click", () => {
      switchTabToFile(btn.getAttribute("data-nav-file"));
    });
  });
}

/* ============================================================
   Tab 5: APIs Catalog
   ============================================================ */
function renderApisTab(container, analysis, switchTabToFile) {
  const endpoints = analysis.apiIntelligence.endpoints || [];

  if (endpoints.length === 0) {
    container.innerHTML = [
      '<div class="empty-state" style="padding:48px 24px; text-align:center; background:var(--surface); border:1px solid var(--line); border-radius:var(--r-card);">' +
      '<div style="font-size:32px; margin-bottom:12px;">🔌</div>' +
      '<h3 style="font-size:16px; font-weight:600; margin-bottom:6px;">No internal backend endpoints detected</h3>' +
      '<p class="muted">This codebase does not declare Express, Flask, FastAPI, Django, or Spring REST route handlers.</p>' +
      '</div>'
    ].join("");
    return;
  }

  container.innerHTML = [
    '<div class="card" style="padding:16px 20px; border:1px solid var(--line); background:var(--surface); margin-bottom:16px;">',
    '<h3 style="font-size:15px; font-weight:600; color:var(--ink);">Discovered API Endpoints (' + endpoints.length + ')</h3>',
    '<p class="muted" style="font-size:13px;">Extracted directly from backend router patterns with line-level code citations.</p>',
    '</div>',

    '<div class="api-table-wrapper">',
    endpoints.map(ep => {
      const method = ep.method.toUpperCase();
      const methodClass = method === "GET" ? "api-badge--get" : method === "POST" ? "api-badge--post" : method === "PUT" ? "api-badge--put" : method === "DELETE" ? "api-badge--delete" : "api-badge--any";
      return '<div class="api-row">' +
        '<div><span class="api-badge ' + methodClass + '">' + method + '</span></div>' +
        '<div><strong style="font-family:var(--font-mono); font-size:13.5px; color:var(--ink);">' + window.Clarity.utils.escapeHtml(ep.path) + '</strong></div>' +
        '<div><button class="btn btn--ghost btn--sm" data-nav-file="' + window.Clarity.utils.escapeHtml(ep.file) + '" style="padding:0; font-family:var(--font-mono); font-size:12px; color:var(--accent);">' + window.Clarity.utils.escapeHtml(ep.file) + ':' + ep.line + '</button></div>' +
        '<div>' + (ep.authRequired ? '<span class="tag tag--xs" style="background:rgba(239,68,68,0.12); color:#dc2626;">Auth Protected</span>' : '<span class="muted" style="font-size:12px;">Public</span>') + '</div>' +
      '</div>';
    }).join(""),
    '</div>'
  ].join("");

  container.querySelectorAll("[data-nav-file]").forEach(btn => {
    btn.addEventListener("click", () => {
      switchTabToFile(btn.getAttribute("data-nav-file"));
    });
  });
}

/* ============================================================
   Tab 6: Database Intelligence
   ============================================================ */
function renderDatabaseTab(container, analysis, switchTabToFile) {
  const db = analysis.databaseIntelligence;

  if (!db.detected) {
    container.innerHTML = [
      '<div class="empty-state" style="padding:48px 24px; text-align:center; background:var(--surface); border:1px solid var(--line); border-radius:var(--r-card);">' +
      '<div style="font-size:32px; margin-bottom:12px;">🗄️</div>' +
      '<h3 style="font-size:16px; font-weight:600; margin-bottom:6px;">Database Not Detected</h3>' +
      '<p class="muted">No SQL schemas, Prisma/Drizzle configs, Mongoose models, or SQLite migrations were found in this project.</p>' +
      '</div>'
    ].join("");
    return;
  }

  container.innerHTML = [
    '<div class="card" style="padding:20px; border:1px solid var(--line); background:var(--surface); margin-bottom:20px;">',
    '<div class="hstack" style="justify-content:space-between; margin-bottom:8px;">',
    '<h3 style="font-size:16px; font-weight:600; color:var(--ink);">Database Engine: ' + window.Clarity.utils.escapeHtml(db.system || "Detected Database") + '</h3>',
    '<span class="tag tag--xs" style="background:rgba(245,158,11,0.12); color:#d97706; font-weight:600;">Detected</span>',
    '</div>',
    '<p style="font-size:14px; color:var(--ink-muted); line-height:1.5;">' + window.Clarity.utils.escapeHtml(db.description) + '</p>',
    '</div>',

    '<h4 style="font-size:15px; font-weight:600; color:var(--ink); margin-bottom:12px;">Discovered Models / Tables (' + db.models.length + ')</h4>',
    '<div class="grid-2">',
    db.models.map(m => {
      return '<div class="card" style="padding:16px; border:1px solid var(--line); background:var(--surface);">' +
        '<div class="hstack" style="justify-content:space-between; margin-bottom:8px;">' +
          '<strong style="font-size:15px; color:var(--ink); font-family:var(--font-mono);">' + window.Clarity.utils.escapeHtml(m.name) + '</strong>' +
          '<button class="btn btn--ghost btn--sm" data-nav-file="' + window.Clarity.utils.escapeHtml(m.file) + '" style="font-size:12px; font-family:var(--font-mono); color:var(--accent);">' + window.Clarity.utils.escapeHtml(m.file) + '</button>' +
        '</div>' +
        '<div class="muted" style="font-size:12.5px;">Model definition verified in source repository.</div>' +
      '</div>';
    }).join(""),
    '</div>'
  ].join("");

  container.querySelectorAll("[data-nav-file]").forEach(btn => {
    btn.addEventListener("click", () => {
      switchTabToFile(btn.getAttribute("data-nav-file"));
    });
  });
}

/* ============================================================
   Tab 7: Dependencies
   ============================================================ */
function renderDependenciesTab(container, analysis) {
  const deps = analysis.dependencies || [];

  if (deps.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:32px; text-align:center;">No third-party packages or package manifests found.</div>';
    return;
  }

  container.innerHTML = [
    '<div class="card" style="padding:16px 20px; border:1px solid var(--line); background:var(--surface); margin-bottom:16px;">',
    '<h3 style="font-size:15px; font-weight:600; color:var(--ink);">Declared Dependencies (' + deps.length + ')</h3>',
    '<p class="muted" style="font-size:13px;">Extracted from manifest files with active usage frequency across source code.</p>',
    '</div>',

    '<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:12px;">',
    deps.map(d => {
      return '<div class="card" style="padding:12px 14px; border:1px solid var(--line); background:var(--surface); display:flex; flex-direction:column; gap:4px;">' +
        '<div class="hstack" style="justify-content:space-between;">' +
          '<strong style="font-size:13.5px; color:var(--ink); font-family:var(--font-mono);">' + window.Clarity.utils.escapeHtml(d.name) + '</strong>' +
          '<span class="tag tag--xs" style="font-size:11px;">' + (d.version || "latest") + '</span>' +
        '</div>' +
        '<div class="muted" style="font-size:11.5px;">Imported ' + d.usageCount + ' time' + (d.usageCount === 1 ? '' : 's') + ' in codebase</div>' +
      '</div>';
    }).join(""),
    '</div>'
  ].join("");
}

/* ============================================================
   Tab 8: Security Audit Findings
   ============================================================ */
function renderSecurityTab(container, analysis, switchTabToFile) {
  const sec = analysis.securityAnalysis;

  container.innerHTML = [
    '<div class="card" style="padding:20px; border:1px solid var(--line); background:var(--surface); margin-bottom:20px; display:flex; align-items:center; justify-content:space-between;">',
    '<div>',
    '<h3 style="font-size:16px; font-weight:600; color:var(--ink); margin-bottom:4px;">Static Security Health Score</h3>',
    '<p class="muted" style="font-size:13.5px;">Deterministic static risk verification with sensitive credentials automatically redacted.</p>',
    '</div>',
    '<div style="font-size:32px; font-weight:800; color:' + (sec.score >= 80 ? 'var(--success)' : sec.score >= 50 ? 'var(--warning)' : 'var(--danger)') + ';">' + sec.score + '/100</div>',
    '</div>',

    sec.findings.length === 0
      ? '<div class="card" style="padding:32px; text-align:center; border:1px solid var(--line); background:var(--surface);"><div style="font-size:28px; margin-bottom:8px;">🛡️</div><h4 style="font-size:15px; font-weight:600;">No static security risks identified</h4><p class="muted">No hardcoded API credentials, dangerous eval patterns, or raw SQL queries were discovered.</p></div>'
      : sec.findings.map(f => {
          const sevClass = f.severity === "CONFIRMED RISK" ? "severity-pill--confirmed" : f.severity === "POTENTIAL RISK" ? "severity-pill--potential" : "severity-pill--manual";
          return '<div class="security-finding-card">' +
            '<div class="hstack" style="justify-content:space-between;">' +
              '<div class="hstack" style="gap:8px;">' +
                '<span class="severity-pill ' + sevClass + '">' + f.severity + '</span>' +
                '<strong style="font-size:14.5px; color:var(--ink);">' + window.Clarity.utils.escapeHtml(f.title) + '</strong>' +
              '</div>' +
              '<button class="btn btn--ghost btn--sm" data-nav-file="' + window.Clarity.utils.escapeHtml(f.file) + '" style="font-size:12px; font-family:var(--font-mono); color:var(--accent);">' + window.Clarity.utils.escapeHtml(f.file) + ':' + f.line + '</button>' +
            '</div>' +
            '<p style="font-size:13.5px; color:var(--ink-muted); line-height:1.5;">' + window.Clarity.utils.escapeHtml(f.description) + '</p>' +
            (f.redactedSnippet ? '<div class="code-evidence-box"><code>' + window.Clarity.utils.escapeHtml(f.redactedSnippet) + '</code></div>' : '') +
            '<div class="hstack" style="font-size:12.5px; gap:6px; color:var(--ink);"><strong style="color:var(--success);">Remediation:</strong> <span>' + window.Clarity.utils.escapeHtml(f.suggestedFix) + '</span></div>' +
          '</div>';
        }).join("")
  ].join("");

  container.querySelectorAll("[data-nav-file]").forEach(btn => {
    btn.addEventListener("click", () => {
      switchTabToFile(btn.getAttribute("data-nav-file"));
    });
  });
}

/* ============================================================
   Tab 9: Code Quality
   ============================================================ */
function renderQualityTab(container, analysis, switchTabToFile) {
  const cq = analysis.codeQuality;

  container.innerHTML = [
    '<div class="card" style="padding:20px; border:1px solid var(--line); background:var(--surface); margin-bottom:20px; display:flex; align-items:center; justify-content:space-between;">',
    '<div>',
    '<h3 style="font-size:16px; font-weight:600; color:var(--ink); margin-bottom:4px;">Maintainability & Quality Score</h3>',
    '<p class="muted" style="font-size:13.5px;">Monitors test coverage, file modularity, architectural smells, and complexity.</p>',
    '</div>',
    '<div style="font-size:32px; font-weight:800; color:' + (cq.score >= 80 ? 'var(--success)' : 'var(--warning)') + ';">' + cq.score + '/100</div>',
    '</div>',

    cq.issues.length === 0
      ? '<div class="card" style="padding:32px; text-align:center; border:1px solid var(--line); background:var(--surface);"><div style="font-size:28px; margin-bottom:8px;">✨</div><h4 style="font-size:15px; font-weight:600;">High Code Quality</h4><p class="muted">No significant maintainability bottlenecks or code smells found.</p></div>'
      : cq.issues.map(iss => {
          return '<div class="security-finding-card">' +
            '<div class="hstack" style="justify-content:space-between;">' +
              '<strong style="font-size:14.5px; color:var(--ink);">' + window.Clarity.utils.escapeHtml(iss.title) + '</strong>' +
              '<button class="btn btn--ghost btn--sm" data-nav-file="' + window.Clarity.utils.escapeHtml(iss.file) + '" style="font-size:12px; font-family:var(--font-mono); color:var(--accent);">' + window.Clarity.utils.escapeHtml(iss.file) + (iss.line ? ':' + iss.line : '') + '</button>' +
            '</div>' +
            '<p style="font-size:13px; color:var(--ink-muted); line-height:1.5;">' + window.Clarity.utils.escapeHtml(iss.whyItMatters) + '</p>' +
            '<div class="hstack" style="font-size:12.5px; gap:6px; color:var(--ink);"><strong style="color:var(--accent);">Fix:</strong> <span>' + window.Clarity.utils.escapeHtml(iss.suggestedFix) + '</span></div>' +
          '</div>';
        }).join("")
  ].join("");

  container.querySelectorAll("[data-nav-file]").forEach(btn => {
    btn.addEventListener("click", () => {
      switchTabToFile(btn.getAttribute("data-nav-file"));
    });
  });
}

/* ============================================================
   Tab 10: Viva / Defense Preparation
   ============================================================ */
function renderVivaTab(container, analysis, switchTabToFile) {
  const vqs = analysis.knowledgeBase.vivaQuestions || [];

  container.innerHTML = [
    '<div class="card" style="padding:20px; border:1px solid var(--line); background:var(--surface); margin-bottom:20px;">',
    '<h3 style="font-size:16px; font-weight:600; color:var(--ink); margin-bottom:6px;">Project Viva & Defense Technical Questions</h3>',
    '<p class="muted" style="font-size:13.5px;">Curated technical interview and defense questions generated directly from this project\'s specific architecture, database, and endpoints.</p>',
    '</div>',

    '<div style="display:flex; flex-direction:column; gap:16px;">',
    vqs.map((q, idx) => {
      const filesList = q.relatedFiles.map(f => {
        return '<button class="arch-file-tag" data-nav-file="' + window.Clarity.utils.escapeHtml(f) + '">' + window.Clarity.utils.escapeHtml(f) + '</button>';
      }).join("");

      return '<div class="card" style="padding:18px 20px; border:1px solid var(--line); background:var(--surface);">' +
        '<div class="hstack" style="justify-content:space-between; margin-bottom:10px;">' +
          '<strong style="font-size:15px; color:var(--ink);">Q' + (idx + 1) + ': ' + window.Clarity.utils.escapeHtml(q.question) + '</strong>' +
        '</div>' +
        '<div style="background:var(--surface-muted); border-left:3px solid var(--accent); padding:12px 16px; border-radius:0 var(--r-sm) var(--r-sm) 0; font-size:14px; line-height:1.6; color:var(--ink); margin-bottom:12px;">' +
          window.Clarity.utils.escapeHtml(q.answer) +
        '</div>' +
        '<div class="hstack" style="gap:8px; font-size:12px; align-items:center;">' +
          '<span class="muted">Reference Code:</span>' +
          '<div class="arch-files-list">' + filesList + '</div>' +
        '</div>' +
      '</div>';
    }).join(""),
    '</div>'
  ].join("");

  container.querySelectorAll("[data-nav-file]").forEach(btn => {
    btn.addEventListener("click", () => {
      switchTabToFile(btn.getAttribute("data-nav-file"));
    });
  });
}

/* ============================================================
   Tab 11: Generated Assets & File Generation Engine
   ============================================================ */
async function renderArtifactsTab(container, projectId, analysis, switchTab) {
  container.innerHTML = [
    '<div class="artifacts-view" style="padding: 24px; max-width: 1100px; margin: 0 auto;">',
      // Header Section
      '<div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 16px; flex-wrap: wrap;">',
        '<div>',
          '<h2 style="font-size: 20px; font-weight: 700; color: var(--ink); margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">',
            'Universal AI File & Asset Engine',
            '<span class="tag tag--xs" style="background: var(--accent-soft); color: var(--accent); font-weight: 600;">Project Grounded</span>',
          '</h2>',
          '<p style="font-size: 13.5px; color: var(--ink-muted); margin: 0; line-height: 1.5;">',
            'Generate executive Word reports, Excel spreadsheets, PowerPoint slides, printable PDFs, SVG architecture diagrams, or new code features grounded in this codebase.',
          '</p>',
        '</div>',
        '<div style="display: flex; gap: 8px;">',
          '<button class="btn btn--outline btn--sm" id="refreshArtifactsBtn">',
            '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
            ' Refresh Assets',
          '</button>',
        '</div>',
      '</div>',

      // Quick Creation Cards
      '<div style="margin-bottom: 24px;">',
        '<h3 style="font-size: 14px; font-weight: 600; color: var(--ink-secondary); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.04em;">',
          'Quick Generate Templates',
        '</h3>',
        '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">',
          '<div class="card" style="padding: 14px; border: 1px solid #bfdbfe; background: #f8fafc; border-radius: 10px; display: flex; flex-direction: column; justify-content: space-between;">',
            '<div>',
              '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">',
                '<span style="font-size: 18px;">📄</span>',
                '<strong style="font-size: 13.5px; color: #1e40af;">Word Report (.docx)</strong>',
              '</div>',
              '<p style="font-size: 12px; color: var(--ink-muted); line-height: 1.4; margin-bottom: 12px;">Complete executive & technical intelligence document with architecture and viva prep.</p>',
            '</div>',
            '<button class="btn btn--sm btn--outline quick-gen-btn" data-type="document" data-prompt="Generate a comprehensive technical Word report (.docx) for this project" style="width: 100%; border-color: #93c5fd; color: #1d4ed8;">Generate Word Doc</button>',
          '</div>',

          '<div class="card" style="padding: 14px; border: 1px solid #bbf7d0; background: #f8fafc; border-radius: 10px; display: flex; flex-direction: column; justify-content: space-between;">',
            '<div>',
              '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">',
                '<span style="font-size: 18px;">📊</span>',
                '<strong style="font-size: 13.5px; color: #15803d;">Excel Metrics (.xlsx)</strong>',
              '</div>',
              '<p style="font-size: 12px; color: var(--ink-muted); line-height: 1.4; margin-bottom: 12px;">Tabular inventory of all APIs, security findings, dependencies, and file metrics.</p>',
            '</div>',
            '<button class="btn btn--sm btn--outline quick-gen-btn" data-type="spreadsheet" data-prompt="Generate an Excel spreadsheet (.xlsx) with project metrics, APIs, and findings" style="width: 100%; border-color: #86efac; color: #15803d;">Generate Excel Sheet</button>',
          '</div>',

          '<div class="card" style="padding: 14px; border: 1px solid #fed7aa; background: #f8fafc; border-radius: 10px; display: flex; flex-direction: column; justify-content: space-between;">',
            '<div>',
              '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">',
                '<span style="font-size: 18px;">📽️</span>',
                '<strong style="font-size: 13.5px; color: #c2410c;">Slide Deck (.pptx)</strong>',
              '</div>',
              '<p style="font-size: 12px; color: var(--ink-muted); line-height: 1.4; margin-bottom: 12px;">Technical viva presentation deck with slides, bullet breakdowns, and speaker notes.</p>',
            '</div>',
            '<button class="btn btn--sm btn--outline quick-gen-btn" data-type="presentation" data-prompt="Create a PowerPoint presentation deck (.pptx) for this project defense" style="width: 100%; border-color: #fdba74; color: #c2410c;">Generate Slides</button>',
          '</div>',

          '<div class="card" style="padding: 14px; border: 1px solid #fecaca; background: #f8fafc; border-radius: 10px; display: flex; flex-direction: column; justify-content: space-between;">',
            '<div>',
              '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">',
                '<span style="font-size: 18px;">📑</span>',
                '<strong style="font-size: 13.5px; color: #b91c1c;">PDF Summary (.pdf)</strong>',
              '</div>',
              '<p style="font-size: 12px; color: var(--ink-muted); line-height: 1.4; margin-bottom: 12px;">Printable executive report with project stats, architecture notes, and security audit.</p>',
            '</div>',
            '<button class="btn btn--sm btn--outline quick-gen-btn" data-type="pdf" data-prompt="Generate a printable PDF report (.pdf) summarizing this project" style="width: 100%; border-color: #fca5a5; color: #b91c1c;">Generate PDF</button>',
          '</div>',

          '<div class="card" style="padding: 14px; border: 1px solid #e9d5ff; background: #f8fafc; border-radius: 10px; display: flex; flex-direction: column; justify-content: space-between;">',
            '<div>',
              '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">',
                '<span style="font-size: 18px;">📐</span>',
                '<strong style="font-size: 13.5px; color: #7e22ce;">Architecture SVG (.svg)</strong>',
              '</div>',
              '<p style="font-size: 12px; color: var(--ink-muted); line-height: 1.4; margin-bottom: 12px;">Interactive scalable vector diagram showing client, server, and data architecture.</p>',
            '</div>',
            '<button class="btn btn--sm btn--outline quick-gen-btn" data-type="diagram" data-prompt="Generate an architecture diagram in SVG format (.svg) for this project" style="width: 100%; border-color: #d8b4fe; color: #7e22ce;">Generate SVG Diagram</button>',
          '</div>',

          '<div class="card" style="padding: 14px; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 10px; display: flex; flex-direction: column; justify-content: space-between;">',
            '<div>',
              '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">',
                '<span style="font-size: 18px;">📋</span>',
                '<strong style="font-size: 13.5px; color: #334155;">API Catalog (.csv)</strong>',
              '</div>',
              '<p style="font-size: 12px; color: var(--ink-muted); line-height: 1.4; margin-bottom: 12px;">Exportable CSV file listing every detected endpoint, HTTP method, and source file.</p>',
            '</div>',
            '<button class="btn btn--sm btn--outline quick-gen-btn" data-type="spreadsheet" data-prompt="Export all project API routes and endpoints as a CSV file" style="width: 100%; border-color: #94a3b8; color: #334155;">Generate CSV</button>',
          '</div>',
        '</div>',
      '</div>',

      // Custom Natural Language Generator Box
      '<div class="card" style="padding: 20px; border: 1px solid var(--line); background: var(--surface); border-radius: 12px; margin-bottom: 28px;">',
        '<h3 style="font-size: 15px; font-weight: 600; color: var(--ink); margin-bottom: 4px;">',
          'Generate Any File or Code for This Project',
        '</h3>',
        '<p style="font-size: 12.5px; color: var(--ink-muted); margin-bottom: 14px;">',
          'Describe the feature, utility, test suite, documentation, or visual diagram you need. Clarity will ground the code in your existing file structure and imports.',
        '</p>',
        '<div style="display: flex; flex-direction: column; gap: 10px;">',
          '<textarea id="customGenPrompt" rows="3" placeholder="e.g. Create a health check and metrics middleware with memory usage monitoring for this project..." style="width: 100%; padding: 10px 14px; border: 1px solid var(--line); border-radius: 8px; font-size: 13.5px; background: var(--canvas); color: var(--ink); resize: vertical;"></textarea>',
          '<div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">',
            '<input type="text" id="customGenTarget" placeholder="Optional target file path (e.g. src/middleware/metrics.js)" style="flex: 1; min-width: 220px; padding: 8px 12px; border: 1px solid var(--line); border-radius: 6px; font-size: 12.5px; background: var(--canvas); color: var(--ink);" />',
            '<button class="btn btn--primary" id="customGenSubmitBtn" style="padding: 8px 20px;">',
              '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>',
              ' Generate Asset',
            '</button>',
          '</div>',
          '<div id="genStatusMessage" style="font-size: 12.5px; display: none;"></div>',
        '</div>',
      '</div>',

      // Assets List & Filter Bar
      '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; gap: 12px; flex-wrap: wrap;">',
        '<div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;" id="artifactFilterChips">',
          '<button class="btn btn--xs btn--primary art-filter-chip" data-filter="all">All Assets</button>',
          '<button class="btn btn--xs btn--outline art-filter-chip" data-filter="document">Documents</button>',
          '<button class="btn btn--xs btn--outline art-filter-chip" data-filter="spreadsheet">Spreadsheets</button>',
          '<button class="btn btn--xs btn--outline art-filter-chip" data-filter="presentation">Presentations</button>',
          '<button class="btn btn--xs btn--outline art-filter-chip" data-filter="diagram">Diagrams</button>',
          '<button class="btn btn--xs btn--outline art-filter-chip" data-filter="code">Code</button>',
        '</div>',
        '<input type="text" id="artifactSearchInput" placeholder="Filter generated assets..." style="padding: 6px 12px; border: 1px solid var(--line); border-radius: 6px; font-size: 12px; width: 180px; background: var(--canvas); color: var(--ink);" />',
      '</div>',

      // Artifacts List Container
      '<div id="artifactsListContainer">',
        '<div style="text-align: center; padding: 40px; color: var(--ink-muted);">',
          '<span class="spinner" style="width: 20px; height: 20px; margin-bottom: 8px;"></span>',
          '<div>Loading project artifacts...</div>',
        '</div>',
      '</div>',
    '</div>'
  ].join("");

  let currentArtifacts = [];
  let activeFilter = "all";

  async function loadArtifacts() {
    const listCont = document.getElementById("artifactsListContainer");
    try {
      const data = await window.Clarity.api.get("/api/projects/" + projectId + "/artifacts");
      currentArtifacts = (data && data.artifacts) ? data.artifacts : [];
      
      // Update badge
      const badge = document.getElementById("artifactsTabBadge");
      if (badge) badge.textContent = String(currentArtifacts.length);

      renderArtifactsList();
    } catch (err) {
      if (listCont) {
        listCont.innerHTML = '<div style="color: var(--danger); padding: 20px; text-align: center;">Failed to load assets: ' + window.Clarity.utils.escapeHtml(err.message || "") + '</div>';
      }
    }
  }

  function renderArtifactsList() {
    const listCont = document.getElementById("artifactsListContainer");
    if (!listCont) return;

    const query = (document.getElementById("artifactSearchInput")?.value || "").toLowerCase();
    const filtered = currentArtifacts.filter(a => {
      if (activeFilter !== "all" && a.category !== activeFilter) return false;
      if (query && !a.filename.toLowerCase().includes(query) && !(a.description || "").toLowerCase().includes(query)) return false;
      return true;
    });

    if (filtered.length === 0) {
      listCont.innerHTML = [
        '<div style="text-align: center; padding: 48px 24px; background: var(--surface-muted); border-radius: 12px; border: 1px dashed var(--line); color: var(--ink-muted);">',
          '<div style="font-size: 32px; margin-bottom: 8px;">📂</div>',
          '<h4 style="font-size: 15px; font-weight: 600; color: var(--ink); margin-bottom: 4px;">No Generated Assets Found</h4>',
          '<p style="font-size: 13px; max-width: 420px; margin: 0 auto 16px; line-height: 1.4;">',
            currentArtifacts.length === 0
              ? 'Click any template above or describe what to generate to create project-grounded documents, diagrams, or code.'
              : 'No assets matched the selected filter or search keyword.',
          '</p>',
        '</div>'
      ].join("");
      return;
    }

    listCont.innerHTML = filtered.map(a => {
      return window.Clarity.artifact && window.Clarity.artifact.renderCard
        ? window.Clarity.artifact.renderCard(a)
        : '';
    }).join("");

    if (window.Clarity.artifact && window.Clarity.artifact.bindEvents) {
      window.Clarity.artifact.bindEvents(listCont);
    }
  }

  // Filter chips
  document.querySelectorAll(".art-filter-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      activeFilter = chip.getAttribute("data-filter") || "all";
      document.querySelectorAll(".art-filter-chip").forEach(c => {
        const isActive = c.getAttribute("data-filter") === activeFilter;
        c.className = "btn btn--xs " + (isActive ? "btn--primary" : "btn--outline") + " art-filter-chip";
      });
      renderArtifactsList();
    });
  });

  // Search input
  document.getElementById("artifactSearchInput")?.addEventListener("input", renderArtifactsList);

  // Refresh button
  document.getElementById("refreshArtifactsBtn")?.addEventListener("click", loadArtifacts);

  // Quick generation buttons
  document.querySelectorAll(".quick-gen-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const prompt = btn.getAttribute("data-prompt");
      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = "Generating...";
      try {
        const res = await window.Clarity.api.post("/api/projects/" + projectId + "/generate", { prompt });
        window.Clarity.toast.show("Asset generated: " + (res.artifact?.filename || "Success"), "success");
        await loadArtifacts();
        if (res.artifact && window.Clarity.artifact && window.Clarity.artifact.openPreview) {
          window.Clarity.artifact.openPreview(res.artifact);
        }
      } catch (err) {
        window.Clarity.toast.show("Generation failed: " + (err.message || ""), "danger");
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });
  });

  // Custom generation form
  const customSubmitBtn = document.getElementById("customGenSubmitBtn");
  const customPromptInput = document.getElementById("customGenPrompt");
  const customTargetInput = document.getElementById("customGenTarget");
  const statusMsg = document.getElementById("genStatusMessage");

  customSubmitBtn?.addEventListener("click", async () => {
    const prompt = (customPromptInput?.value || "").trim();
    const targetFile = (customTargetInput?.value || "").trim();
    if (!prompt) {
      window.Clarity.toast.show("Please enter a description of what to generate", "warning");
      return;
    }

    customSubmitBtn.disabled = true;
    customSubmitBtn.textContent = "Analyzing & Generating...";
    if (statusMsg) {
      statusMsg.style.display = "block";
      statusMsg.style.color = "var(--ink-muted)";
      statusMsg.textContent = "Analyzing project context, validating code structures, and compiling asset...";
    }

    try {
      const res = await window.Clarity.api.post("/api/projects/" + projectId + "/generate", {
        prompt,
        targetFile: targetFile || undefined,
      });

      window.Clarity.toast.show("Successfully generated " + (res.artifact?.filename || "file"), "success");
      if (customPromptInput) customPromptInput.value = "";
      if (customTargetInput) customTargetInput.value = "";
      if (statusMsg) {
        statusMsg.style.color = "var(--success)";
        statusMsg.textContent = "✓ Generated " + (res.artifact?.filename || "asset") + " successfully.";
      }
      await loadArtifacts();
      if (res.artifact && window.Clarity.artifact && window.Clarity.artifact.openPreview) {
        window.Clarity.artifact.openPreview(res.artifact);
      }
    } catch (err) {
      if (statusMsg) {
        statusMsg.style.color = "var(--danger)";
        statusMsg.textContent = "Failed: " + (err.message || "");
      }
      window.Clarity.toast.show("Generation error: " + (err.message || ""), "danger");
    } finally {
      customSubmitBtn.disabled = false;
      customSubmitBtn.textContent = "Generate Asset";
    }
  });

  // Initial load
  await loadArtifacts();
}

/* ============================================================
   Tab 12: Dedicated Project AI Chat
   ============================================================ */
function renderProjectChatTab(container, projectId, analysis) {
  container.innerHTML = [
    '<div class="project-chat-container">',
    '<div class="project-chat-head">',
    '<div><strong style="font-size:14px; color:var(--ink);">AI Assistant — ' + window.Clarity.utils.escapeHtml(analysis.projectName) + '</strong><span class="muted" style="font-size:12px; margin-left:8px;">Grounded exclusively in this codebase</span></div>',
    '<span class="tag tag--xs" style="background:var(--accent-soft); color:var(--accent); font-weight:600;">Isolated Context</span>',
    '</div>',

    '<div class="project-chat-feed" id="projectChatFeed">',
    '<div class="project-chat-msg project-chat-msg--ai">',
    '<p>Hello! I am your dedicated AI code assistant for <strong>' + window.Clarity.utils.escapeHtml(analysis.projectName) + '</strong> (' + window.Clarity.utils.escapeHtml(analysis.projectType) + ').</p>',
    '<p style="margin-top:6px;">You can ask me about the architecture, how the data flows, specific API endpoints, security concerns, or request creation of Word reports, Excel sheets, PowerPoint slides, architecture diagrams, or code features!</p>',
    '</div>',
    '</div>',

    '<div style="padding:0 16px 8px 16px; background:var(--surface); border-top:1px solid var(--line);">' +
      '<div class="chip-prompts" id="chatChips" style="margin-top:10px; display:flex; flex-wrap:wrap; gap:6px;">' +
        '<button class="chip-prompt" data-prompt="Explain the architecture of this project">Explain architecture</button>' +
        '<button class="chip-prompt" data-prompt="Walk me through the data flow">Data flow walkthrough</button>' +
        '<button class="chip-prompt" data-prompt="List all API endpoints and methods">List API routes</button>' +
        '<button class="chip-prompt" data-prompt="Generate a Word report (.docx) for this project">Word Report</button>' +
        '<button class="chip-prompt" data-prompt="Generate an architecture diagram (.svg) for this project">Architecture SVG</button>' +
        '<button class="chip-prompt" data-prompt="Create an Excel metrics sheet (.xlsx) for this project">Metrics XLSX</button>' +
        '<button class="chip-prompt" data-prompt="Give me 5 viva defense questions for this project">Viva prep Q&A</button>' +
      '</div>' +
    '</div>',

    '<form class="project-chat-input-bar" id="projectChatForm">',
    '<input type="text" id="projectChatInput" placeholder="Ask anything or request file/asset generation for ' + window.Clarity.utils.escapeHtml(analysis.projectName) + '..." autocomplete="off">',
    '<button class="btn btn--primary" type="submit">Send</button>',
    '</form>',
    '</div>'
  ].join("");

  const feed = document.getElementById("projectChatFeed");
  const form = document.getElementById("projectChatForm");
  const input = document.getElementById("projectChatInput");

  async function sendProjectMsg(query) {
    if (!query || !query.trim()) return;
    const userText = query.trim();

    // User message
    const userEl = document.createElement("div");
    userEl.className = "project-chat-msg project-chat-msg--user";
    userEl.textContent = userText;
    feed.appendChild(userEl);
    feed.scrollTop = feed.scrollHeight;

    // AI message container
    const aiEl = document.createElement("div");
    aiEl.className = "project-chat-msg project-chat-msg--ai";
    aiEl.innerHTML = '<span class="spinner" style="width:14px; height:14px; margin-right:6px;"></span> Thinking...';
    feed.appendChild(aiEl);
    feed.scrollTop = feed.scrollHeight;

    try {
      const resp = await fetch(window.Clarity.api.base + "/api/projects/" + projectId + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText }),
      });

      if (!resp.ok) {
        throw new Error("Chat request failed with HTTP " + resp.status);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullText = "";
      aiEl.innerHTML = "";

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const block of lines) {
          const dataLine = block.trim().replace(/^data:\s*/, "");
          if (!dataLine) continue;
          try {
            const parsed = JSON.parse(dataLine);
            if (parsed.content) {
              fullText += parsed.content;
              const rendered = window.Clarity.markdown && window.Clarity.markdown.render
                ? window.Clarity.markdown.render(fullText)
                : window.Clarity.utils.escapeHtml(fullText);
              
              let linkedRender = rendered.replace(/📄\s*([a-zA-Z0-9_\-\.\/]+)(?::(\d+))?/g, (match, path, line) => {
                const lineStr = line ? `, ${line}` : '';
                return `<a href="#" class="file-jump-link" onclick="window.Clarity.jumpToFile('${path}'${lineStr}); return false;" style="color:var(--accent); text-decoration:underline;">${match}</a>`;
              });

              // Post-process for Code Change plans
              const changeMatch = fullText.match(/```json\s*(\{[\s\S]*?"type":\s*"code_change"[\s\S]*?\})\s*```/);
              if (changeMatch) {
                 try {
                    const changePlan = JSON.parse(changeMatch[1]);
                    linkedRender = linkedRender.replace(changeMatch[0], "");
                    
                    let ui = `<div class="code-change-proposal" style="margin-top: 10px; border: 1px solid var(--line); border-radius: 8px; padding: 12px; background: var(--surface-hover);">
                       <h4 style="margin:0 0 8px 0; color:var(--ink);">Proposed Code Changes</h4>`;
                    changePlan.files.forEach((f) => {
                       ui += `<div><span style="font-family:monospace; font-size:12px;"><a href="#" onclick="window.Clarity.jumpToFile('${f.path}'); return false;">${window.Clarity.utils.escapeHtml(f.path)}</a></span></div>`;
                    });
                    ui += `<div style="margin-top: 12px; display: flex; gap: 8px;">
                       <button class="btn btn--sm btn--primary review-changes-btn" data-plan='${window.Clarity.utils.escapeHtml(JSON.stringify(changePlan))}'>Review & Apply Changes</button>
                    </div></div>`;
                    
                    linkedRender += ui;
                 } catch(err) { console.error(err); }
              }

              aiEl.innerHTML = linkedRender;
              
              // Bind apply buttons
              
              const reviewBtn = aiEl.querySelector(".review-diff-btn");
              if (reviewBtn) {
                 reviewBtn.addEventListener("click", () => {
                    const plan = JSON.parse(reviewBtn.getAttribute("data-plan"));
                    let modalHtml = `<div class="modal is-active">
                      <div class="modal-overlay"></div>
                      <div class="modal-dialog" style="max-width: 900px; width: 90%; max-height: 90vh; display: flex; flex-direction: column;">
                        <div class="modal-header">
                          <h2 class="modal-title">Code Diff Review</h2>
                          <button class="modal-close" onclick="this.closest('.modal').remove()">✕</button>
                        </div>
                        <div class="modal-body" style="flex: 1; overflow: auto; background: #1e1e1e; color: #d4d4d4; padding: 16px;">`;
                        
                    plan.files.forEach(f => {
                       modalHtml += `<h4 style="color:#9cdcfe; margin-top:0;">${f.path}</h4>
                       <pre style="white-space: pre-wrap; font-family: monospace; font-size: 13px;">${window.Clarity.utils.escapeHtml(f.content)}</pre><hr style="border-color:#333; margin: 16px 0;" />`;
                    });
                    
                    modalHtml += `</div>
                      </div>
                    </div>`;
                    document.body.insertAdjacentHTML('beforeend', modalHtml);
                    const modal = document.body.lastElementChild;
                    modal.querySelector('.modal-overlay').onclick = () => modal.remove();
                 });
              }

              const changesReviewBtn = aiEl.querySelector(".review-changes-btn");
              if (changesReviewBtn) {
                 changesReviewBtn.addEventListener("click", () => {
                    try {
                       const plan = JSON.parse(changesReviewBtn.getAttribute("data-plan"));
                       if (typeof openCodeChangeModal === 'function') {
                         openCodeChangeModal(plan);
                       }
                    } catch(err) { console.error(err); }
                 });
              }

              feed.scrollTop = feed.scrollHeight;
            }
            if (parsed.artifacts && parsed.artifacts.length > 0) {
              const artHtml = parsed.artifacts.map(a => {
                return window.Clarity.artifact && window.Clarity.artifact.renderCard
                  ? window.Clarity.artifact.renderCard(a)
                  : "";
              }).join("");
              aiEl.insertAdjacentHTML("beforeend", artHtml);
              if (window.Clarity.artifact && window.Clarity.artifact.bindEvents) {
                window.Clarity.artifact.bindEvents(aiEl);
              }
              feed.scrollTop = feed.scrollHeight;
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      aiEl.innerHTML = '<span style="color:var(--danger)">Error: ' + window.Clarity.utils.escapeHtml(err.message || "Failed to communicate with AI") + '</span>';
    }
  }

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = input.value;
    input.value = "";
    sendProjectMsg(val);
  });

  document.querySelectorAll(".chip-prompt").forEach(chip => {
    chip.addEventListener("click", () => {
      sendProjectMsg(chip.getAttribute("data-prompt"));
    });
  });
}

/* ============================================================
   Utility Helpers
   ============================================================ */
function fileTypeIcon(ext) {
  if (!ext) return '📄';
  ext = ext.toLowerCase();
  if (['.png','.jpg','.jpeg','.gif','.webp','.bmp','.svg','.ico'].includes(ext)) return '🖼️';
  if (['.js','.mjs','.cjs'].includes(ext)) return '🟨';
  if (['.jsx','.tsx'].includes(ext)) return '⚛️';
  if (['.ts'].includes(ext)) return '🔷';
  if (['.py'].includes(ext)) return '🐍';
  if (['.java','.class','.jar'].includes(ext)) return '☕';
  if (['.c','.cpp','.h','.hpp'].includes(ext)) return '⚙️';
  if (['.go'].includes(ext)) return '🐹';
  if (['.rb'].includes(ext)) return '💎';
  if (['.php'].includes(ext)) return '🐘';
  if (['.rs'].includes(ext)) return '🦀';
  if (['.json','.yaml','.yml','.toml','.xml'].includes(ext)) return '📋';
  if (['.md','.txt','.rtf'].includes(ext)) return '📝';
  if (['.html','.htm'].includes(ext)) return '🌐';
  if (['.css','.scss','.sass','.less'].includes(ext)) return '🎨';
  if (['.sql','.db','.sqlite'].includes(ext)) return '🗄️';
  if (['.zip','.tar','.gz','.7z'].includes(ext)) return '🗜️';
  return '📄';
}

function getLangColor(lang) {
  const map = {
    "JavaScript": "#f7df1e",
    "TypeScript": "#3178c6",
    "Python": "#3572A5",
    "HTML": "#e34c26",
    "CSS": "#563d7c",
    "SCSS": "#c6538c",
    "Java": "#b07219",
    "C++": "#f34b7d",
    "C": "#555555",
    "Go": "#00ADD8",
    "Ruby": "#701516",
    "PHP": "#4F5D95",
    "Rust": "#dea584",
    "JSON": "#292929",
    "Markdown": "#083fa1",
  };
  return map[lang] || "#6366f1";
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}


// -----------------------------------------------------------------------------
// RUN & TEST ENGINE UI
// -----------------------------------------------------------------------------
let runPollInterval = null;
function renderRunTestTab(container, projectId, analysis) {
  if (runPollInterval) {
    clearInterval(runPollInterval);
    runPollInterval = null;
  }
  container.innerHTML = `
    <div class="run-test-engine">
      <div class="run-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px;">
        <div>
          <h2 style="margin:0;font-size:20px;">Run & Test Engine</h2>
          <p style="margin:4px 0 0 0;color:var(--ink-muted);font-size:14px;">Safely execute, build, and test your project in a sandboxed environment.</p>
        </div>
        <div style="display:flex; gap: 8px;">
          <button id="runBtn" class="btn btn--primary">Run</button>
          <button id="buildBtn" class="btn btn--outline">🔨 Build</button>
          <button id="testBtn" class="btn btn--outline">🧪 Test</button>
          <button id="stopBtn" class="btn btn--outline" style="color:var(--danger);border-color:var(--danger);">⏹ Stop</button>
          <button id="debugRunBtn" class="btn btn--outline" style="margin-left:8px; display:none;">✨ Debug with Copilot</button>
        </div>
      </div>
      <div id="runStatusPanel" style="margin-bottom:16px; padding:16px; border-radius:8px; border:1px solid var(--line); background:var(--surface);">
        <div style="font-weight:600; margin-bottom:8px;">Status: <span id="runState" style="color:var(--ink-muted);">Idle</span></div>
        <div id="runConfig" style="font-size:13px; color:var(--ink-muted);">No active execution.</div>
      </div>
      <div class="terminal-container" style="background:#1e1e1e; color:#d4d4d4; padding:16px; border-radius:8px; font-family:monospace; font-size:13px; height:400px; overflow-y:auto; border:1px solid #333;">
        <pre id="terminalOutput" style="margin:0; white-space:pre-wrap;"></pre>
      </div>
    </div>
  `;

  const runBtn = container.querySelector('#runBtn');
  const buildBtn = container.querySelector('#buildBtn');
  const testBtn = container.querySelector('#testBtn');
  const stopBtn = container.querySelector('#stopBtn');
  const termOut = container.querySelector('#terminalOutput');
  const stateLabel = container.querySelector('#runState');

  const debugBtn = container.querySelector('#debugRunBtn');
  let currentRunLogs = [];
  
  function checkLogsForError(logs, status) {
    if (status === "failed" || (logs && logs.some(l => l.toLowerCase().includes("error") || l.includes("Traceback") || l.includes("Exception")))) {
      debugBtn.style.display = "inline-block";
    } else {
      debugBtn.style.display = "none";
    }
  }

  debugBtn.addEventListener('click', () => {
    // switch to chat tab and send prompt
    const chatBtn = document.querySelector('.project-tab-btn[data-tab="chat"]');
    if (chatBtn) chatBtn.click();
    
    // find chat input and set value
    setTimeout(() => {
      const input = document.getElementById('chatPromptInput');
      const sendBtn = document.getElementById('sendChatBtn');
      if (input && sendBtn) {
        input.value = "Why did the run fail? Here is the recent output:\n" + currentRunLogs.slice(-30).join("");
        sendBtn.click();
      }
    }, 200);
  });

  const configLabel = container.querySelector('#runConfig');

  function updateStatusUI(data) {
    if (!data) return;
    
    // Auto-scroll logic
    const isScrolledToBottom = termOut.scrollHeight - termOut.clientHeight <= termOut.scrollTop + 1;
    
    stateLabel.textContent = data.status.toUpperCase();
    if (data.status === 'running' || data.status === 'starting') {
      stateLabel.style.color = 'var(--accent)';
    } else if (data.status === 'failed') {
      stateLabel.style.color = 'var(--danger)';
    } else if (data.status === 'completed') {
      stateLabel.style.color = 'var(--success-color)';
    } else {
      stateLabel.style.color = 'var(--ink-muted)';
    }

    configLabel.innerHTML = `
      <div>Runtime: ${data.runtime || 'Unknown'}</div>
      ${data.command ? `<div>Command: <code>${data.command}</code></div>` : ''}
      ${data.exitCode !== undefined && data.exitCode !== null ? `<div>Exit Code: ${data.exitCode}</div>` : ''}
      ${data.error ? `<div style="color:var(--danger); margin-top:4px;">Error: ${data.error}</div>` : ''}

      ${data.testResults ? `
        <div style="margin-top: 12px; padding: 12px; background: var(--surface-muted); border-radius: 6px;">
          <strong style="display:block; margin-bottom:4px;">🧪 Test Results</strong>
          <div style="display:flex; gap:16px;">
            <div style="color:var(--ink)">Total: ${data.testResults.total}</div>
            <div style="color:var(--success-color)">Passed: ${data.testResults.passed}</div>
            <div style="color:var(--danger)">Failed: ${data.testResults.failed}</div>
            ${data.testResults.skipped ? `<div style="color:var(--warning-color)">Skipped: ${data.testResults.skipped}</div>` : ''}
          </div>
        </div>
      ` : ''}

    `;

    termOut.textContent = (data.logs || []).join('');
    currentRunLogs = data.logs || [];
    checkLogsForError(data.logs || [], data.status);
    
    if (isScrolledToBottom) {
      termOut.scrollTop = termOut.scrollHeight;
    }
  }

  async function pollStatus() {
    try {
      const res = await fetch(`/api/projects/${projectId}/run/status`);
      if (res.ok) {
        const data = await res.json();
        updateStatusUI(data);
        if (data.status !== 'running' && data.status !== 'starting') {
          clearInterval(runPollInterval);
          runPollInterval = null;
        }
      }
    } catch(e) {}
  }

  async function startCommand(type) {
    if (runPollInterval) clearInterval(runPollInterval);
    termOut.textContent = "Initializing sandboxed execution environment...\n";
    stateLabel.textContent = "STARTING";
    stateLabel.style.color = 'var(--ink-muted)';
    try {
      const res = await fetch(`/api/projects/${projectId}/${type}`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        termOut.textContent += "\n\n[Error] " + (err.error || err.message || "Failed to start execution");
        stateLabel.textContent = "FAILED";
        stateLabel.style.color = 'var(--danger)';
        return;
      }
      const data = await res.json();
      updateStatusUI(data);
      runPollInterval = setInterval(pollStatus, 1000);
    } catch(e) {
      termOut.textContent += "\n\n[Error] " + e.message;
    }
  }

  runBtn.addEventListener('click', () => startCommand('run'));
  buildBtn.addEventListener('click', () => startCommand('build'));
  testBtn.addEventListener('click', () => startCommand('test'));

  stopBtn.addEventListener('click', async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/stop`, { method: "POST" });
      const data = await res.json();
      updateStatusUI(data);
    } catch(e) {
      alert("Failed to stop: " + e.message);
    }
  });

  // Initial fetch
  fetch(`/api/projects/${projectId}/run/status`)
    .then(r => r.json())
    .then(data => {
      updateStatusUI(data);
      if (data.status === 'running' || data.status === 'starting') {
        runPollInterval = setInterval(pollStatus, 1000);
      }
    });
}

const fs = require('fs');

let file = fs.readFileSync('js/pages/project.js', 'utf8');

const startIndex = file.indexOf('async function renderArtifactsTab');
const functionStart = file.substring(startIndex);
let braceCount = 0;
let endIndex = -1;
let started = false;

for (let i = 0; i < functionStart.length; i++) {
  if (functionStart[i] === '{') {
    braceCount++;
    started = true;
  } else if (functionStart[i] === '}') {
    braceCount--;
    if (started && braceCount === 0) {
      endIndex = startIndex + i + 1;
      break;
    }
  }
}

if (endIndex === -1) {
  console.log("Could not find end of function");
  process.exit(1);
}

const newRenderArtifactsTab = `async function renderArtifactsTab(t, e, n, r) {
  t.innerHTML = [
    '<div class="artifacts-workspace" style="max-width: 1000px; margin: 0 auto; padding-bottom: 40px;">',
    
    // Header
    '<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px;">',
    '  <div>',
    '    <h2 style="font-size: 24px; font-weight: 700; color: var(--ink); margin: 0 0 8px 0; letter-spacing: -0.02em;">Assets & Files</h2>',
    '    <p style="font-size: 14px; color: var(--ink-muted); margin: 0; max-width: 600px; line-height: 1.5;">Create and manage project-grounded deliverables. Generate real files using the currently selected project\\'s actual information, architecture, RAG knowledge, screenshots and project intelligence.</p>',
    '  </div>',
    '  <button class="btn btn--outline" id="refreshArtifactsBtn" style="display: flex; align-items: center; gap: 6px;">',
    '    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 1 0 2.13-5.88L2 9"/></svg>',
    '    Refresh Assets',
    '  </button>',
    '</div>',

    // Generation Section
    '<div class="card" style="padding: 24px; border: 1px solid var(--line); background: var(--surface); border-radius: 12px; margin-bottom: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">',
    '  <div style="margin-bottom: 20px;">',
    '    <h3 style="font-size: 16px; font-weight: 600; color: var(--ink); margin: 0 0 4px 0;">Create a Deliverable</h3>',
    '    <p style="font-size: 13px; color: var(--ink-muted); margin: 0;">Choose what you want to generate, then describe what you need.</p>',
    '  </div>',

    // File Type Selection Grid
    '  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 24px;" id="fileTypeSelection">',
    
    '    <button class="file-type-btn is-selected" data-type="pptx" style="display: flex; flex-direction: column; align-items: flex-start; text-align: left; padding: 16px; background: var(--canvas); border: 2px solid var(--primary); border-radius: 8px; cursor: pointer; transition: all 0.2s;">',
    '      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">',
    '        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--primary)" stroke-width="2"><rect width="20" height="15" x="2" y="3" rx="2"/><line x1="2" y1="18" x2="22" y2="18"/></svg>',
    '        <span style="font-weight: 700; font-size: 14px; color: var(--ink);">PPTX</span>',
    '      </div>',
    '      <div style="font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 4px;">Hackathon Presentation</div>',
    '      <div style="font-size: 12px; color: var(--ink-muted); line-height: 1.4;">Create a presentation using real project information.</div>',
    '    </button>',

    '    <button class="file-type-btn" data-type="docx" style="display: flex; flex-direction: column; align-items: flex-start; text-align: left; padding: 16px; background: var(--canvas); border: 1px solid var(--line); border-radius: 8px; cursor: pointer; transition: all 0.2s;">',
    '      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">',
    '        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#6366f1" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    '        <span style="font-weight: 700; font-size: 14px; color: var(--ink);">DOCX</span>',
    '      </div>',
    '      <div style="font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 4px;">Project Report</div>',
    '      <div style="font-size: 12px; color: var(--ink-muted); line-height: 1.4;">Create a detailed technical project report.</div>',
    '    </button>',

    '    <button class="file-type-btn" data-type="pdf" style="display: flex; flex-direction: column; align-items: flex-start; text-align: left; padding: 16px; background: var(--canvas); border: 1px solid var(--line); border-radius: 8px; cursor: pointer; transition: all 0.2s;">',
    '      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">',
    '        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ef4444" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/></svg>',
    '        <span style="font-weight: 700; font-size: 14px; color: var(--ink);">PDF</span>',
    '      </div>',
    '      <div style="font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 4px;">Project Report PDF</div>',
    '      <div style="font-size: 12px; color: var(--ink-muted); line-height: 1.4;">Generate a clean, printable PDF defense summary.</div>',
    '    </button>',

    '    <button class="file-type-btn" data-type="xlsx" style="display: flex; flex-direction: column; align-items: flex-start; text-align: left; padding: 16px; background: var(--canvas); border: 1px solid var(--line); border-radius: 8px; cursor: pointer; transition: all 0.2s;">',
    '      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">',
    '        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#10b981" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>',
    '        <span style="font-weight: 700; font-size: 14px; color: var(--ink);">XLSX</span>',
    '      </div>',
    '      <div style="font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 4px;">Project Analysis</div>',
    '      <div style="font-size: 12px; color: var(--ink-muted); line-height: 1.4;">Export structured project data and analysis.</div>',
    '    </button>',

    '    <button class="file-type-btn" data-type="svg" style="display: flex; flex-direction: column; align-items: flex-start; text-align: left; padding: 16px; background: var(--canvas); border: 1px solid var(--line); border-radius: 8px; cursor: pointer; transition: all 0.2s;">',
    '      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">',
    '        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#f59e0b" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 17 22 12"/></svg>',
    '        <span style="font-weight: 700; font-size: 14px; color: var(--ink);">SVG</span>',
    '      </div>',
    '      <div style="font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 4px;">Architecture Diagram</div>',
    '      <div style="font-size: 12px; color: var(--ink-muted); line-height: 1.4;">Generate a visual system architecture map.</div>',
    '    </button>',
    '  </div>',

    // Instructions Input
    '  <div style="margin-bottom: 16px;">',
    '    <label for="deliverableInstructions" style="display: block; font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 8px;">What should this deliverable contain?</label>',
    '    <textarea id="deliverableInstructions" rows="3" placeholder="e.g. Create a 12-slide hackathon presentation focused on the problem, solution, architecture, RAG workflow, features and impact." style="width: 100%; padding: 12px; border: 1px solid var(--line); border-radius: 8px; font-size: 14px; background: var(--canvas); color: var(--ink); resize: vertical; outline: none; transition: border-color 0.2s;"></textarea>',
    '  </div>',

    // Action Row & Context
    '  <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">',
    '    <div style="display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--ink-muted);">',
    '      <div style="font-weight: 600; color: var(--ink-secondary);">Using current project:</div>',
    '      <div style="display: flex; gap: 12px; flex-wrap: wrap;">',
    '        <span>✓ Project Intelligence</span>',
    '        <span>✓ Project files</span>',
    '        <span>✓ Architecture</span>',
    '        <span>✓ RAG knowledge</span>',
    '      </div>',
    '    </div>',
    '    <div style="display: flex; align-items: center; gap: 12px;">',
    '      <div id="genStatusMessage" style="font-size: 13px; font-weight: 500; display: none;"></div>',
    '      <button class="btn btn--primary" id="generateDeliverableBtn" style="padding: 8px 24px; font-weight: 600;">',
    '        Generate PPTX',
    '      </button>',
    '    </div>',
    '  </div>',
    '</div>',

    // Generated Files Section
    '<div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 16px;">',
    '  <h3 style="font-size: 18px; font-weight: 700; color: var(--ink); margin: 0;">Generated Files</h3>',
    '  <div style="display: flex; align-items: center; gap: 12px;">',
    '    <div style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px;" id="artifactFilterChips">',
    '      <button class="btn btn--xs btn--primary art-filter-chip" data-filter="all" style="white-space: nowrap;">All</button>',
    '      <button class="btn btn--xs btn--outline art-filter-chip" data-filter="pptx">PPTX</button>',
    '      <button class="btn btn--xs btn--outline art-filter-chip" data-filter="docx">DOCX</button>',
    '      <button class="btn btn--xs btn--outline art-filter-chip" data-filter="pdf">PDF</button>',
    '      <button class="btn btn--xs btn--outline art-filter-chip" data-filter="xlsx">XLSX</button>',
    '      <button class="btn btn--xs btn--outline art-filter-chip" data-filter="svg">SVG</button>',
    '    </div>',
    '    <input type="text" id="artifactSearchInput" placeholder="Search assets..." style="padding: 6px 12px; font-size: 13px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); color: var(--ink); outline: none; min-width: 150px;">',
    '  </div>',
    '</div>',

    '<div id="projectArtifactsContainer" style="display: flex; flex-direction: column; gap: 12px;">',
    '  <div style="text-align: center; padding: 48px 24px; color: var(--ink-muted);">Loading assets...</div>',
    '</div>',

    '</div>' // end artifacts-workspace
  ].join("");

  let currentType = "pptx";
  const typeBtns = t.querySelectorAll(".file-type-btn");
  const generateBtn = t.getElementById("generateDeliverableBtn");
  const instructionsInput = t.getElementById("deliverableInstructions");
  const statusMsg = t.getElementById("genStatusMessage");
  let s = "all";
  let o = [];

  typeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      typeBtns.forEach(b => {
        b.classList.remove("is-selected");
        b.style.border = "1px solid var(--line)";
        b.style.background = "var(--canvas)";
      });
      btn.classList.add("is-selected");
      btn.style.border = "2px solid var(--primary)";
      btn.style.background = "var(--canvas)";
      currentType = btn.getAttribute("data-type");
      if (generateBtn) {
        generateBtn.textContent = "Generate " + currentType.toUpperCase();
      }
    });
  });

  async function l() {
    var _, M;
    const A = document.getElementById("projectArtifactsContainer");
    if (!A) return;
    try {
      const z = await window.Clarity.api.get("/api/projects/" + e + "/artifacts");
      o = z.artifacts || [];
      d();
    } catch (z) {
      A.innerHTML = '<div style="color:var(--danger); padding:20px; text-align:center;">Failed to load assets: ' + (z.message || "") + "</div>";
    }
  }

  function d() {
    const _ = document.getElementById("projectArtifactsContainer"),
          M = (document.getElementById("artifactSearchInput")?.value || "").toLowerCase(),
          A = o.filter(N => !(s !== "all" && N.type !== s && N.category !== s && (!N.filename || !N.filename.toLowerCase().endsWith(s))) && !(M && !N.filename.toLowerCase().includes(M) && !(N.description || "").toLowerCase().includes(M)));
    
    if (A.length === 0) {
      _.innerHTML = [
        '<div style="text-align: center; padding: 64px 24px; background: var(--surface); border-radius: 12px; border: 1px dashed var(--line); color: var(--ink-muted);">',
        '<div style="font-size: 32px; margin-bottom: 12px;">📂</div>',
        '<h4 style="font-size: 16px; font-weight: 600; color: var(--ink); margin-bottom: 8px;">No generated files yet</h4>',
        '<p style="font-size: 14px; max-width: 420px; margin: 0 auto; line-height: 1.5;">',
        o.length === 0 ? "Create your first project-grounded deliverable using the generator above." : "No assets matched the selected filter or search keyword.",
        '</p>',
        '</div>'
      ].join("");
      return;
    }
    
    _.innerHTML = A.map(N => {
      if (window.Clarity.artifact && window.Clarity.artifact.renderCard) {
        return window.Clarity.artifact.renderCard(N);
      }
      return '';
    }).join("");
    
    if (window.Clarity.artifact && window.Clarity.artifact.bindEvents) {
      window.Clarity.artifact.bindEvents(_);
    }
  }

  generateBtn?.addEventListener("click", async () => {
    const promptText = (instructionsInput?.value || "").trim();
    if (!promptText) {
      window.Clarity.toast.show("Please describe what to generate", "warning");
      return;
    }
    generateBtn.disabled = true;
    generateBtn.textContent = "Generating...";
    if (statusMsg) {
      statusMsg.style.display = "block";
      statusMsg.style.color = "var(--ink-muted)";
      statusMsg.textContent = "Analyzing project and building content...";
    }
    try {
      const res = await window.Clarity.api.post("/api/projects/" + e + "/generate", { 
        prompt: promptText, 
        format: currentType,
        template: currentType === "pptx" ? "presentation" : currentType === "docx" ? "document" : currentType === "xlsx" ? "spreadsheet" : currentType === "svg" ? "diagram" : "document"
      });
      window.Clarity.toast.show("Successfully generated " + (res.artifact?.filename || "file"), "success");
      if (statusMsg) {
        statusMsg.style.color = "var(--success)";
        statusMsg.textContent = "✓ Generated successfully";
      }
      if (instructionsInput) {
        instructionsInput.value = "";
      }
      await l();
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
      generateBtn.disabled = false;
      generateBtn.textContent = "Generate " + currentType.toUpperCase();
      setTimeout(() => {
        if (statusMsg) {
          statusMsg.style.display = "none";
        }
      }, 4000);
    }
  });

  document.querySelectorAll(".art-filter-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      s = chip.getAttribute("data-filter") || "all";
      document.querySelectorAll(".art-filter-chip").forEach(c => {
        const isActive = c.getAttribute("data-filter") === s;
        c.className = "btn btn--xs " + (isActive ? "btn--primary" : "btn--outline") + " art-filter-chip";
      });
      d();
    });
  });

  document.getElementById("artifactSearchInput")?.addEventListener("input", d);
  document.getElementById("refreshArtifactsBtn")?.addEventListener("click", l);

  const onArtifactDeleted = async () => { await l(); };
  window.addEventListener("artifact:deleted", onArtifactDeleted);
  
  await l();
}`;

file = file.substring(0, startIndex) + newRenderArtifactsTab + file.substring(endIndex);

fs.writeFileSync('js/pages/project.js', file, 'utf8');
console.log("Rewrote renderArtifactsTab UI.");

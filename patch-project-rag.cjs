const fs = require('fs');
let code = fs.readFileSync('js/pages/project.js', 'utf8');

// 1. Add Tab Button
code = code.replace(
  `'<button class="project-tab-btn ' + (activeProjectTab === 'overview' ? 'is-active' : '') + '" data-tab="overview">Overview</button>',`,
  `'<button class="project-tab-btn ' + (activeProjectTab === 'overview' ? 'is-active' : '') + '" data-tab="overview">Overview</button>',\n    '<button class="project-tab-btn ' + (activeProjectTab === 'knowledge' ? 'is-active' : '') + '" data-tab="knowledge">Knowledge RAG</button>',`
);

// 2. Add render logic
const renderLogic = `
  else if (tabId === 'knowledge') {
    renderKnowledgeTab(tabContentEl);
  }`;
code = code.replace(
  `else if (tabId === 'run') {
      renderRunTestTab(tabContentEl);
    }`,
  `else if (tabId === 'run') {
      renderRunTestTab(tabContentEl);
    }\n    ${renderLogic}`
);

// 3. Add function renderKnowledgeTab
const knowledgeFn = `
async function renderKnowledgeTab(container) {
  container.innerHTML = '<div style="padding:20px;color:var(--text-secondary)">Loading Knowledge Engine...</div>';
  
  try {
    const res = await fetch(\`/api/projects/\${currentProjectId}/knowledge\`);
    const data = await res.json();
    
    container.innerHTML = \`
      <div class="project-tab-inner" style="padding: 24px; max-width: 800px; margin: 0 auto;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px;">
          <div>
            <h2 style="margin:0 0 8px 0; font-size:24px; color:var(--text-primary)">🧠 Advanced RAG & Knowledge Engine</h2>
            <p style="margin:0; color:var(--text-secondary); line-height:1.5">
              Clarity AI automatically processes your project into structure-aware chunk embeddings. This powers semantic retrieval for the Copilot.
            </p>
          </div>
          <button id="reindexBtn" class="btn btn--primary">⟳ Reindex Project</button>
        </div>
        
        <div class="architecture-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:32px;">
          <div class="card" style="padding:20px; text-align:center;">
            <div style="font-size:32px; font-weight:600; color:var(--primary-color)">\${data.status}</div>
            <div style="color:var(--text-secondary); margin-top:8px; font-size:14px; text-transform:uppercase; letter-spacing:0.5px">Indexing Status</div>
          </div>
          <div class="card" style="padding:20px; text-align:center;">
            <div style="font-size:32px; font-weight:600; color:var(--text-primary)">\${data.stats.files}</div>
            <div style="color:var(--text-secondary); margin-top:8px; font-size:14px; text-transform:uppercase; letter-spacing:0.5px">Files Indexed</div>
          </div>
          <div class="card" style="padding:20px; text-align:center;">
            <div style="font-size:32px; font-weight:600; color:var(--text-primary)">\${data.stats.chunks}</div>
            <div style="color:var(--text-secondary); margin-top:8px; font-size:14px; text-transform:uppercase; letter-spacing:0.5px">Knowledge Chunks</div>
          </div>
        </div>

        <div class="card" style="padding:24px;">
          <h3 style="margin:0 0 16px 0; font-size:18px;">Knowledge Inspector & RAG Debugger</h3>
          <p style="color:var(--text-secondary); margin-bottom:16px; font-size:14px;">
            Test the retrieval engine by typing a query. The engine uses hybrid search (Semantic + Lexical + Structural + Architecture Graph) to fetch relevant chunks.
          </p>
          <div style="display:flex; gap:8px; margin-bottom:24px;">
            <input type="text" id="ragTestInput" class="form-input" style="flex:1" placeholder="E.g. 'How does authentication work?' or 'Where is the database initialized?'" />
            <button id="ragTestBtn" class="btn btn--outline">Test Search</button>
          </div>
          <div id="ragResults" style="display:flex; flex-direction:column; gap:16px;"></div>
        </div>
      </div>
    \`;

    document.getElementById('reindexBtn').addEventListener('click', async (e) => {
      const btn = e.target;
      btn.textContent = "Indexing...";
      btn.disabled = true;
      try {
        await fetch(\`/api/projects/\${currentProjectId}/knowledge/reindex\`, { method: "POST" });
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
      resContainer.innerHTML = '<div style="color:var(--text-secondary)">Searching knowledge store...</div>';
      
      try {
        // We will add a search endpoint to test the knowledge engine
        const searchRes = await fetch(\`/api/projects/\${currentProjectId}/knowledge/search?q=\${encodeURIComponent(q)}\`);
        const searchData = await searchRes.json();
        
        if (!searchData.results || searchData.results.length === 0) {
           resContainer.innerHTML = '<div style="color:var(--text-secondary)">No evidence found.</div>';
           return;
        }
        
        let html = '';
        for (const item of searchData.results) {
           html += \`
             <div style="border:1px solid rgba(255,255,255,0.1); border-radius:6px; background:rgba(0,0,0,0.2);">
               <div style="padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;">
                 <div style="font-family:var(--font-mono); font-size:13px; color:var(--primary-color)">📄 \${window.Clarity.utils.escapeHtml(item.file)} (Lines \${item.lines})</div>
                 <div style="display:flex; gap:8px; align-items:center;">
                    <span style="font-size:12px; color:var(--text-secondary); background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px;">Score: \${item.score}</span>
                 </div>
               </div>
               <div style="padding:12px 16px; font-size:13px; color:var(--text-secondary); border-bottom:1px solid rgba(255,255,255,0.05);">
                 <strong>Relevance match:</strong> \${window.Clarity.utils.escapeHtml(item.reason)}
               </div>
               <pre style="margin:0; padding:16px; font-family:var(--font-mono); font-size:13px; color:var(--text-primary); overflow-x:auto; background:transparent;">\${window.Clarity.utils.escapeHtml(item.content)}</pre>
             </div>
           \`;
        }
        resContainer.innerHTML = html;
        
      } catch (err) {
        resContainer.innerHTML = '<div style="color:var(--danger-color)">Error performing search</div>';
      }
    });
    
  } catch (err) {
    container.innerHTML = \`<div style="padding:20px;color:var(--danger-color)">Error loading knowledge status: \${err.message}</div>\`;
  }
}
`;
code = code.replace(`window.Clarity = window.Clarity || {};`, knowledgeFn + `\nwindow.Clarity = window.Clarity || {};`);

fs.writeFileSync('js/pages/project.js', code);
console.log("Patched renderKnowledgeTab");

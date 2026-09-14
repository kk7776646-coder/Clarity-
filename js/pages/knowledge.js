window.Clarity = window.Clarity || {};
window.Clarity.pages = window.Clarity.pages || {};

(function() {
  let ragData = {
    projectId: 'global',
    projectName: 'Global Knowledge Base',
    status: 'Ready',
    stats: { documents: 0, chunks: 0, vectors: 0 },
    documents: [],
    settings: { chunkSize: 800, chunkOverlap: 120, similarityThreshold: 0.65 }
  };
  let activeFilter = '';
  let isIndexing = false;
  let searchResults = null;
  let isSearching = false;
  let isAskingAi = false;
  let aiAnswer = null;

  window.Clarity.pages.knowledge = async function renderKnowledgePage() {
    const main = document.getElementById('main');
    if (!main) return;

    main.innerHTML = '<div class="page"><div class="page__inner"><div style="padding:48px 24px; text-align:center; color:var(--ink-muted); font-size:14px;">Loading Knowledge RAG System...</div></div></div>';

    await loadRagData();
    renderPage(main);
  };

  async function loadRagData() {
    try {
      const res = await fetch('/api/knowledge/rag');
      if (res.ok) {
        const data = await res.json();
        ragData = data || ragData;
      }
    } catch (err) {
      console.warn('Failed to load knowledge RAG data:', err);
    }
  }

  function renderPage(main) {
    const docs = (ragData.documents || []).filter(d => {
      if (!activeFilter) return true;
      const q = activeFilter.toLowerCase();
      return (d.name || '').toLowerCase().includes(q) || (d.path || '').toLowerCase().includes(q) || (d.fileType || '').toLowerCase().includes(q);
    });
    const totalChunks = ragData.stats?.chunks || (ragData.documents || []).reduce((acc, d) => acc + (d.chunksCount || 0), 0);
    const totalDocs = (ragData.documents || []).length;
    const isOnline = totalDocs > 0;

    main.innerHTML = `
      <div class="page">
        <div class="page__inner" style="max-width: 1100px; margin: 0 auto; padding-bottom: 60px;">
          <!-- Top Header -->
          <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 16px; flex-wrap: wrap;">
            <div>
              <h1 class="page__title" style="font-size: 24px; font-weight: 700; margin-bottom: 6px;">Knowledge Sources</h1>
              <p class="page__subtitle" style="margin: 0; font-size: 14px; max-width: 680px; color: var(--ink-muted);">
                Upload and manage reference documents, PDFs, notebooks, and specifications to ground Clarity AI in your own material.
              </p>
            </div>
            <div class="hstack" style="gap: 8px;">
              <button id="addRagDocsBtn" class="btn btn--primary" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600;">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>Add Documents</span>
              </button>
              <input type="file" id="kbHiddenFileInput" hidden multiple accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md,.csv,.json,.xml,.yaml,.yml,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.cs,.go,.rs,.php,.rb,.sql,.html,.css,.scss,.sh,.zip" />
              
              <button id="reindexAllBtn" class="btn btn--outline" ${isIndexing ? 'disabled' : ''} style="display: inline-flex; align-items: center; gap: 6px;">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
                <span>${isIndexing ? 'Indexing...' : 'Reindex All'}</span>
              </button>

              <button id="ragSettingsModalBtn" class="btn btn--outline btn--icon" title="RAG Settings" aria-label="RAG Settings">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </button>
            </div>
          </div>

          <!-- Summary Strip -->
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; padding: 14px 20px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; flex-wrap: wrap; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div class="hstack" style="gap: 20px; font-size: 13.5px;">
              <div class="hstack" style="gap: 6px;">
                <span style="color: var(--ink-muted);">Sources:</span>
                <strong style="color: var(--ink); font-family: var(--font-mono);">${totalDocs}</strong>
              </div>
              <div style="width: 1px; height: 16px; background: var(--line);"></div>
              <div class="hstack" style="gap: 6px;">
                <span style="color: var(--ink-muted);">Total Chunks:</span>
                <strong style="color: var(--ink); font-family: var(--font-mono);">${totalChunks.toLocaleString()}</strong>
              </div>
              <div style="width: 1px; height: 16px; background: var(--line);"></div>
              <div class="hstack" style="gap: 6px;">
                <span style="color: var(--ink-muted);">Status:</span>
                <span style="display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: ${isOnline ? 'rgba(16, 185, 129, 0.12)' : 'var(--surface-muted)'}; color: ${isOnline ? '#059669' : 'var(--ink-muted)'};">
                  <span style="width: 6px; height: 6px; border-radius: 50%; background: ${isOnline ? '#10b981' : 'var(--ink-muted)'};"></span>
                  ${isOnline ? 'Ready' : 'No sources added'}
                </span>
              </div>
            </div>
            
            <div style="min-width: 220px;">
              <input type="text" id="filterSourcesInput" class="input" style="height: 34px; font-size: 13px; border-radius: 8px;" placeholder="Filter sources..." value="${window.Clarity.utils.escapeHtml(activeFilter)}" />
            </div>
          </div>

          <!-- Documents Area -->
          ${totalDocs === 0 ? `
            <div class="card" style="padding: 56px 24px; text-align: center; border: 1.5px dashed var(--line); background: var(--surface); border-radius: 14px; margin-bottom: 32px;" id="kbDragDropZone">
              <div style="width: 52px; height: 52px; border-radius: 12px; background: rgba(139, 92, 246, 0.1); color: #8b5cf6; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto;">
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="12" y1="18" x2="12" y2="12"></line>
                  <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
              </div>
              <h3 style="font-size: 17px; font-weight: 600; margin-bottom: 6px; color: var(--ink);">No knowledge sources added yet</h3>
              <p style="color: var(--ink-muted); max-width: 480px; margin: 0 auto 20px auto; font-size: 13.5px; line-height: 1.5;">
                Add documentation, PDFs, Word docs (.docx), Markdown, or code files. Clarity will chunk and index them for intelligent retrieval during conversations in any language.
              </p>
              <button class="btn btn--primary" id="emptyAddDocsTriggerBtn">+ Add Documents</button>
            </div>
          ` : `
            <div class="card" style="padding: 0; border: 1px solid var(--line); background: var(--surface); border-radius: 12px; overflow: hidden; margin-bottom: 36px; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
              <div style="padding: 14px 20px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; background: var(--surface-muted);">
                <h3 style="margin: 0; font-size: 14px; font-weight: 600; color: var(--ink);">Indexed Documents (${docs.length})</h3>
                <span style="font-size: 12px; color: var(--ink-muted);">Auto-synced with vector retrieval</span>
              </div>
              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;" id="kbTable">
                  <thead>
                    <tr style="border-bottom: 1px solid var(--line); background: var(--surface); color: var(--ink-muted); font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.5px; text-align: left;">
                      <th style="padding: 12px 20px; font-weight: 600;">Source</th>
                      <th style="padding: 12px 16px; font-weight: 600;">Type</th>
                      <th style="padding: 12px 16px; font-weight: 600;">Status</th>
                      <th style="padding: 12px 16px; font-weight: 600;">Chunks</th>
                      <th style="padding: 12px 16px; font-weight: 600;">Size</th>
                      <th style="padding: 12px 20px; font-weight: 600; text-align: right;">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${docs.map(docRowHtml).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `}

          <!-- Test Retrieval Playground (Matching Image 2) -->
          <div class="card" style="padding: 24px; border: 1px solid var(--line); background: var(--surface); border-radius: 14px; box-shadow: 0 4px 20px -2px rgba(0,0,0,0.03);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; flex-wrap: wrap; gap: 12px;">
              <div class="hstack" style="gap: 10px;">
                <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(59, 130, 246, 0.1); color: #3b82f6; display: flex; align-items: center; justify-content: center;">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </div>
                <h3 style="font-size: 16px; font-weight: 700; margin: 0; color: var(--ink);">Test Retrieval Playground</h3>
              </div>
              
              <span style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; background: rgba(16, 185, 129, 0.1); color: #059669; border: 1px solid rgba(16, 185, 129, 0.2);">
                <span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981;"></span>
                Vector Store Online
              </span>
            </div>

            <p style="color: var(--ink-muted); margin: 0 0 18px 0; font-size: 13.5px; line-height: 1.45;">
              Simulate queries in real-time to inspect retrieved chunks, similarity rankings, and verify multilingual document extraction (Hinglish, Hindi, English).
            </p>

            <!-- Search Input Bar -->
            <div style="display: flex; gap: 10px; margin-bottom: 14px;">
              <div class="rag-search-wrapper">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--ink-muted);">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input type="text" id="ragPlaygroundInput" class="input" placeholder="Ask a question or enter a prompt (e.g. 'What is the main objective?')" />
                <span style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font-size: 11.5px; font-weight: 500; color: var(--ink-muted); background: var(--bg); padding: 3px 8px; border-radius: 6px; border: 1px solid var(--line);">
                  ↵ Enter
                </span>
              </div>
              <button id="ragSearchBtn" class="btn btn--primary" style="height: 44px; padding: 0 24px; font-weight: 600; border-radius: 10px; font-size: 14px;">
                ${isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>
            <!-- Quick Suggestion Pills -->
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 20px;">
              <span style="font-size: 12.5px; font-weight: 500; color: var(--ink-muted); margin-right: 4px;">Quick queries:</span>
              <button class="rag-pill-btn" data-query="Summary and main objectives of the document">⚡ Main Objectives</button>
              <button class="rag-pill-btn" data-query="is experiment me kya steps aur apparatus hai?">🧪 Experiment Steps</button>
              <button class="rag-pill-btn" data-query="Formula and calculation results">📊 Formulas & Results</button>
              <button class="rag-pill-btn" data-query="मुख्य निष्कर्ष और परिणाम क्या हैं?">🇮🇳 Conclusions</button>
            </div>

            <!-- Direct AI Answer Box (if generated) -->
            ${aiAnswer ? `
              <div style="margin-bottom: 24px; padding: 18px 20px; border-radius: 12px; background: var(--surface-muted); border: 1.5px solid rgba(139, 92, 246, 0.3);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <div class="hstack" style="gap: 8px;">
                    <span style="color: #8b5cf6; font-size: 16px;">✦</span>
                    <strong style="font-size: 13.5px; color: var(--ink);">Grounded AI Answer</strong>
                  </div>
                  <button class="btn btn--outline btn--sm" id="sendToChatBtn" style="font-size: 12px; height: 28px;">
                    Open in Chat →
                  </button>
                </div>
                <div style="font-size: 13.5px; line-height: 1.6; color: var(--ink); white-space: pre-wrap;">${window.Clarity.utils.escapeHtml(aiAnswer.answer)}</div>
              </div>
            ` : ''}

            <!-- Search Results View -->
            <div id="ragSearchResultsContainer">
              ${searchResults ? renderSearchResultsHtml(searchResults) : `
                <div style="text-align: center; padding: 32px 16px; color: var(--ink-muted); font-size: 13px; border: 1px dashed var(--line); border-radius: 10px;">
                  Enter a search query above or click a suggestion to test RAG retrieval from your uploaded documents.
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;

    bindPageEvents();
  }

  function docRowHtml(d) {
    const safeName = window.Clarity.utils.escapeHtml(d.name || d.path || 'document');
    const ext = (d.extension || '').replace('.', '').toUpperCase() || 'DOC';
    const chunks = d.chunksCount || 0;
    const sizeStr = d.sizeFormatted || formatBytes(d.size || 0);

    return `
      <tr style="border-bottom: 1px solid var(--line); transition: background 0.15s ease;" class="kb-table-row">
        <td style="padding: 14px 20px;">
          <div class="hstack" style="gap: 12px;">
            <div style="width: 34px; height: 34px; border-radius: 8px; background: var(--surface-muted); border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 10.5px; color: var(--ink-muted); flex-shrink: 0;">
              ${ext.substring(0, 4)}
            </div>
            <div>
              <div style="font-weight: 600; color: var(--ink); font-size: 13.5px; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${safeName}
              </div>
              <div style="font-size: 11.5px; color: var(--ink-muted); font-family: var(--font-mono);">
                ${window.Clarity.utils.escapeHtml(d.path || d.name)}
              </div>
            </div>
          </div>
        </td>
        <td style="padding: 14px 16px;">
          <span class="tag tag--sm" style="font-size: 11px;">${window.Clarity.utils.escapeHtml(d.fileType || ext)}</span>
        </td>
        <td style="padding: 14px 16px;">
          <span style="display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 500; color: #059669;">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: #10b981;"></span>
            Indexed
          </span>
        </td>
        <td style="padding: 14px 16px;">
          <button class="btn btn--ghost btn--sm view-chunks-btn" data-file-path="${window.Clarity.utils.escapeHtml(d.path || d.name)}" style="padding: 2px 8px; font-size: 12px; font-family: var(--font-mono); color: #8b5cf6;">
            ${chunks} chunks
          </button>
        </td>
        <td style="padding: 14px 16px; color: var(--ink-muted); font-size: 12.5px;">
          ${sizeStr}
        </td>
        <td style="padding: 14px 20px; text-align: right;">
          <div class="hstack" style="gap: 6px; justify-content: flex-end;">
            <button class="btn btn--ghost btn--icon-sm preview-doc-btn" data-doc-path="${window.Clarity.utils.escapeHtml(d.path || d.name)}" title="Preview extracted text" aria-label="Preview">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="btn btn--ghost btn--icon-sm delete-doc-btn" data-doc-id="${d.id || ''}" data-doc-path="${window.Clarity.utils.escapeHtml(d.path || d.name)}" title="Delete document" aria-label="Delete" style="color: var(--danger);">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }

  function renderSearchResultsHtml(res) {
    const hits = res.results || [];
    if (hits.length === 0) {
      return `
        <div style="text-align: center; padding: 36px 16px; color: var(--ink-muted); font-size: 13.5px;">
          No chunks matched your query "${window.Clarity.utils.escapeHtml(res.query)}". Try rephrasing or searching for specific terms in your document.
        </div>
      `;
    }

    return `
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; font-size: 13px;">
          <span style="color: var(--ink-muted);">Found <strong>${hits.length}</strong> matching chunks in <strong>${res.timeMs || 5}ms</strong></span>
          <button id="askAiAboutQueryBtn" class="btn btn--primary btn--sm" style="display: inline-flex; align-items: center; gap: 6px; font-size: 12px;">
            <span>✦ Ask AI to Answer</span>
          </button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${hits.map((h, i) => `
            <div style="padding: 14px 16px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-muted);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <div class="hstack" style="gap: 8px;">
                  <strong style="font-size: 13px; color: var(--ink);">${window.Clarity.utils.escapeHtml(h.filename || h.file)}</strong>
                  <span style="font-size: 11px; color: var(--ink-muted); font-family: var(--font-mono);">Lines ${h.startLine}–${h.endLine}</span>
                </div>
                <span style="display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; background: rgba(16, 185, 129, 0.15); color: #059669;">
                  ${Math.round(h.score * 100)}% Match
                </span>
              </div>
              <div style="font-size: 12.5px; line-height: 1.55; color: var(--ink); font-family: var(--font-mono); background: var(--surface); padding: 10px 12px; border-radius: 6px; border: 1px solid var(--line); white-space: pre-wrap; max-height: 160px; overflow-y: auto;">
                ${window.Clarity.utils.escapeHtml(h.snippet || h.content)}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function bindPageEvents() {
    const fileInput = document.getElementById('kbHiddenFileInput');
    const addBtn = document.getElementById('addRagDocsBtn');
    const emptyAddBtn = document.getElementById('emptyAddDocsTriggerBtn');
    const reindexBtn = document.getElementById('reindexAllBtn');
    const settingsBtn = document.getElementById('ragSettingsModalBtn');
    const filterInput = document.getElementById('filterSourcesInput');
    const searchBtn = document.getElementById('ragSearchBtn');
    const searchInput = document.getElementById('ragPlaygroundInput');
    const dropzone = document.getElementById('kbDragDropZone');

    const triggerUpload = () => fileInput && fileInput.click();
    addBtn?.addEventListener('click', triggerUpload);
    emptyAddBtn?.addEventListener('click', triggerUpload);

    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = '';
        if (files.length > 0) await handleUploadFiles(files);
      });
    }

    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.borderColor = '#8b5cf6'; });
      dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = 'var(--line)'; });
      dropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--line)';
        const files = Array.from(e.dataTransfer.files || []);
        if (files.length > 0) await handleUploadFiles(files);
      });
    }

    reindexBtn?.addEventListener('click', async () => {
      isIndexing = true;
      renderPage(document.getElementById('main'));
      window.Clarity.toast.show('Reindexing all knowledge documents...', 'info');
      try {
        const res = await fetch('/api/knowledge/rag/reindex', { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: ragData.projectId })
        });
        const data = await res.json();
        if (data.success) {
          window.Clarity.toast.show(`Indexed ${data.filesIndexed || 0} files and ${data.chunksIndexed || 0} chunks.`, 'success');
        } else {
          window.Clarity.toast.show('Reindexing completed', 'success');
        }
      } catch (err) {
        window.Clarity.toast.show('Reindexing failed: ' + err.message, 'danger');
      } finally {
        isIndexing = false;
        await loadRagData();
        renderPage(document.getElementById('main'));
      }
    });

    settingsBtn?.addEventListener('click', openRagSettingsModal);

    filterInput?.addEventListener('input', (e) => {
      activeFilter = e.target.value;
      renderPage(document.getElementById('main'));
      const inputRef = document.getElementById('filterSourcesInput');
      if (inputRef) {
        inputRef.focus();
        inputRef.setSelectionRange(inputRef.value.length, inputRef.value.length);
      }
    });

    const executeSearch = async (queryText) => {
      const q = (queryText || (searchInput?.value || '')).trim();
      if (!q) return;
      if (searchInput) searchInput.value = q;
      isSearching = true;
      renderPage(document.getElementById('main'));
      try {
        const res = await fetch('/api/knowledge/rag/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q }),
        });
        const data = await res.json();
        searchResults = data;
      } catch (err) {
        window.Clarity.toast.show('Search failed: ' + err.message, 'danger');
      } finally {
        isSearching = false;
        renderPage(document.getElementById('main'));
      }
    };

    searchBtn?.addEventListener('click', () => executeSearch());
    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') executeSearch();
    });

    document.querySelectorAll('.rag-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const q = btn.getAttribute('data-query');
        executeSearch(q);
      });
    });

    document.getElementById('askAiAboutQueryBtn')?.addEventListener('click', async () => {
      const q = searchInput?.value || searchResults?.query || '';
      if (!q) return;
      window.Clarity.toast.show('Consulting knowledge base...', 'info');
      try {
        const res = await fetch('/api/knowledge/rag/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q }),
        });
        const data = await res.json();
        aiAnswer = data;
        renderPage(document.getElementById('main'));
      } catch (err) {
        window.Clarity.toast.show('AI inquiry failed: ' + err.message, 'danger');
      }
    });

    document.getElementById('sendToChatBtn')?.addEventListener('click', () => {
      const q = searchInput?.value || '';
      window.location.hash = '#/chat';
      setTimeout(() => {
        const composerInput = document.getElementById('composerInput');
        if (composerInput && q) {
          composerInput.value = q;
          composerInput.dispatchEvent(new Event('input'));
          composerInput.focus();
        }
      }, 200);
    });

    // Preview Doc
    document.querySelectorAll('.preview-doc-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const docPath = btn.getAttribute('data-doc-path');
        try {
          const res = await fetch(`/api/knowledge/rag/chunks?filePath=${encodeURIComponent(docPath)}`);
          const data = await res.json();
          const chunks = data.chunks || [];
          const fullText = chunks.map(c => c.content).join('\n\n') || '(No preview content available)';
          
          window.Clarity.modal.open(
            `Document Preview: ${docPath}`,
            `<pre style="white-space: pre-wrap; max-height: 60vh; overflow: auto; background: var(--surface-muted); padding: 14px; border-radius: 8px; font-size: 12.5px; font-family: var(--font-mono);">${window.Clarity.utils.escapeHtml(fullText)}</pre>`,
            `<button class="btn btn--primary" data-modal-close="true">Close</button>`
          );
        } catch {
          window.Clarity.toast.show('Preview unavailable', 'danger');
        }
      });
    });

    // View Chunks Modal
    document.querySelectorAll('.view-chunks-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const docPath = btn.getAttribute('data-file-path');
        try {
          const res = await fetch(`/api/knowledge/rag/chunks?filePath=${encodeURIComponent(docPath)}`);
          const data = await res.json();
          const chunks = data.chunks || [];
          const body = chunks.length === 0
            ? '<div style="padding: 20px; text-align: center; color: var(--ink-muted);">No chunks found for this file.</div>'
            : `<div style="display: flex; flex-direction: column; gap: 12px; max-height: 60vh; overflow-y: auto;">
                ${chunks.map((c, idx) => `
                  <div style="padding: 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-muted);">
                    <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--ink-muted); margin-bottom: 6px;">
                      <strong>Chunk #${idx + 1}</strong>
                      <span>Lines ${c.start_line}–${c.end_line}</span>
                    </div>
                    <pre style="margin: 0; white-space: pre-wrap; font-size: 12px; font-family: var(--font-mono);">${window.Clarity.utils.escapeHtml(c.content)}</pre>
                  </div>
                `).join('')}
              </div>`;

          window.Clarity.modal.open(`Chunks: ${docPath} (${chunks.length})`, body, `<button class="btn btn--primary" data-modal-close="true">Done</button>`);
        } catch (err) {
          window.Clarity.toast.show('Failed to fetch chunks', 'danger');
        }
      });
    });

    // Delete Document
    document.querySelectorAll('.delete-doc-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const docId = btn.getAttribute('data-doc-id');
        const docPath = btn.getAttribute('data-doc-path');
        
        window.Clarity.modal.open(
          'Remove from Knowledge Base?',
          `<div style="font-size: 13.5px; line-height: 1.5; color: var(--ink);">
             Are you sure you want to delete <strong>${window.Clarity.utils.escapeHtml(docPath)}</strong> and its associated index chunks?
           </div>`,
          `<div class="hstack" style="gap: 8px; justify-content: flex-end;">
             <button class="btn btn--outline" data-modal-close="true">Cancel</button>
             <button class="btn btn--danger" id="confirmDeleteKbDocBtn">Delete</button>
           </div>`
        );

        document.getElementById('confirmDeleteKbDocBtn')?.addEventListener('click', async () => {
          window.Clarity.modal.close();
          try {
            const res = await fetch('/api/knowledge/rag/documents', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: docId, path: docPath }),
            });
            const data = await res.json();
            if (data.success) {
              window.Clarity.toast.show('Document removed', 'success');
              await loadRagData();
              renderPage(document.getElementById('main'));
            }
          } catch (err) {
            window.Clarity.toast.show('Failed to delete document', 'danger');
          }
        }, { once: true });
      });
    });
  }

  async function handleUploadFiles(files) {
    if (!files || files.length === 0) return;
    window.Clarity.toast.show(`Processing and indexing ${files.length} document(s)...`, 'info');

    const fd = new FormData();
    files.forEach(f => fd.append('files', f, f.name));

    try {
      const res = await fetch('/api/knowledge/rag/upload', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (data.success) {
        window.Clarity.toast.show(data.message || 'Files uploaded and indexed successfully', 'success');
        await loadRagData();
        renderPage(document.getElementById('main'));
      } else {
        window.Clarity.toast.show(data.error || 'Upload failed', 'danger');
      }
    } catch (err) {
      window.Clarity.toast.show('Upload failed: ' + err.message, 'danger');
    }
  }

  function openRagSettingsModal() {
    const s = ragData.settings || { chunkSize: 800, chunkOverlap: 120, similarityThreshold: 0.65 };
    const body = `
      <div style="display: flex; flex-direction: column; gap: 16px; font-size: 13.5px; margin-top: 8px;">
        <div class="model-form__row">
          <label style="display: block; font-weight: 600; color: var(--ink);">Chunk Size (Characters)</label>
          <input type="number" id="settingChunkSize" class="input" value="${s.chunkSize || 800}" min="200" max="4000" />
          <span style="font-size: 11.5px; color: var(--ink-muted);">Target length of each document segment for vectorization.</span>
        </div>
        <div class="model-form__row">
          <label style="display: block; font-weight: 600; color: var(--ink);">Chunk Overlap (Characters)</label>
          <input type="number" id="settingChunkOverlap" class="input" value="${s.chunkOverlap || 120}" min="0" max="500" />
          <span style="font-size: 11.5px; color: var(--ink-muted);">Overlap between consecutive chunks to preserve semantic context.</span>
        </div>
        <div class="model-form__row">
          <label style="display: block; font-weight: 600; color: var(--ink);">Similarity Threshold (0.00 – 1.00)</label>
          <input type="number" id="settingThreshold" class="input" value="${s.similarityThreshold || 0.65}" min="0.1" max="0.99" step="0.05" />
          <span style="font-size: 11.5px; color: var(--ink-muted);">Minimum similarity score required to include a chunk in prompt context.</span>
        </div>
      </div>
    `;

    const actions = `
      <div class="hstack" style="gap: 8px; justify-content: flex-end;">
        <button class="btn btn--outline" data-modal-close="true">Cancel</button>
        <button class="btn btn--primary" id="saveRagSettingsBtn">Save Settings</button>
      </div>
    `;

    window.Clarity.modal.open('RAG Configuration', body, actions);

    document.getElementById('saveRagSettingsBtn')?.addEventListener('click', async () => {
      const chunkSize = Number(document.getElementById('settingChunkSize')?.value) || 800;
      const chunkOverlap = Number(document.getElementById('settingChunkOverlap')?.value) || 120;
      const similarityThreshold = Number(document.getElementById('settingThreshold')?.value) || 0.65;

      try {
        await fetch('/api/projects/global/rag/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: { chunkSize, chunkOverlap, similarityThreshold } }),
        });
        window.Clarity.modal.close();
        window.Clarity.toast.show('Settings updated. Reindex to apply chunk size changes.', 'success');
        await loadRagData();
        renderPage(document.getElementById('main'));
      } catch (err) {
        window.Clarity.toast.show('Failed to save settings', 'danger');
      }
    });
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
})();

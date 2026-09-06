window.Clarity = window.Clarity || {};
window.Clarity.pages = window.Clarity.pages || {};

window.Clarity.pages.knowledge = async function renderKnowledgePage() {
  const main = document.getElementById('main');
  if (!main) return;

  let files = [];
  let loadError = null;
  try {
    const data = await window.Clarity.api.get("/api/files/shared");
    files = data.files || [];
  } catch (err) {
    loadError = err.message || "Failed to load knowledge base";
  }

  main.innerHTML = [
    '<div class="page"><div class="page__inner">',
    '<header class="page__header">',
    '<div><h1 class="page__title">Knowledge Base</h1>',
    '<p class="page__subtitle">Upload documents (PDF, DOCX, TXT, MD, CSV, JSON, code) to ground the AI\'s answers in your own material.</p></div>',
    '<div class="hstack" style="gap:8px;">',
    '<label class="btn btn--primary" style="cursor:pointer;">',
    '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    ' Upload documents',
    '<input id="kbFileInput" type="file" hidden multiple accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md,.csv,.json,.xml,.yaml,.yml,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.cs,.go,.rs,.php,.rb,.sql,.html,.css,.scss,.sh,.zip">',
    '</label>',
    '<button class="btn btn--ghost btn--sm" id="refreshKbBtn" type="button" title="Refresh" aria-label="Refresh">',
    '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
    ' Refresh</button>',
    '</div></header>',
    loadError ? '<div class="alert alert--danger">' + window.Clarity.utils.escapeHtml(loadError) + '</div>' : '',
    '<div id="kbDropzone" class="dropzone">',
      '<div class="dropzone__inner">',
        '<svg class="icon" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
        '<div><strong>Drop files here</strong> or click <em>Upload documents</em> above.</div>',
        '<div class="muted">Supported: PDF, DOCX, PPTX, TXT, MD, CSV, JSON, code files, ZIP</div>',
      '</div>',
    '</div>',
    '<section class="panel"><div class="panel__head"><h2>Indexed documents</h2><span class="muted">' + files.length + ' file' + (files.length === 1 ? '' : 's') + '</span></div>',
    '<div class="panel__body">',
    files.length === 0
      ? '<div class="empty-state">No documents yet. Upload files above to build your knowledge base.</div>'
      : '<div class="file-table">' + files.map(fileRowHtml).join('') + '</div>',
    '</div></section>',
    '</div></div>'
  ].join('');

  bindKnowledgeEvents();
};

function fileRowHtml(f) {
  const size = formatSize(f.size || 0);
  const type = f.file_type || 'file';
  const date = f.uploaded_at ? new Date(f.uploaded_at * 1000).toLocaleString() : '';
  return '<div class="file-row" data-file-id="' + f.id + '">' +
    '<div class="file-row__icon">' +
      '<svg class="icon" viewBox="0 0 24 24" style="width:18px;height:18px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>' +
    '</div>' +
    '<div class="file-row__main">' +
      '<div class="file-row__name">' + window.Clarity.utils.escapeHtml(f.filename) + '</div>' +
      '<div class="file-row__meta"><span class="tag tag--xs">' + window.Clarity.utils.escapeHtml(type) + '</span> <span class="muted">' + size + ' • ' + window.Clarity.utils.escapeHtml(date) + '</span></div>' +
    '</div>' +
    '<div class="file-row__actions">' +
      '<button class="btn btn--ghost btn--icon-sm" data-kb-action="preview" data-file-id="' + f.id + '" title="Preview">' +
        '<svg class="icon" viewBox="0 0 24 24" style="width:14px;height:14px;"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>' +
      '</button>' +
      '<button class="btn btn--ghost btn--icon-sm" data-kb-action="download" data-file-id="' + f.id + '" title="Download" aria-label="Download file">' +
        '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
      '</button>' +
      '<button class="btn btn--ghost btn--icon-sm" data-kb-action="delete" data-file-id="' + f.id + '" title="Delete" aria-label="Delete file">' +
        '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>' +
      '</button>' +
    '</div>' +
  '</div>';
}

function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function bindKnowledgeEvents() {
  const fileInput = document.getElementById('kbFileInput');
  const dz = document.getElementById('kbDropzone');
  document.getElementById('refreshKbBtn')?.addEventListener('click', () => window.Clarity.app.navigate('#/knowledge'));

  if (fileInput) {
    fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      e.target.value = '';
      if (files.length) await uploadKbFiles(files);
    });
  }
  if (dz) {
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('is-dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('is-dragover'));
    dz.addEventListener('drop', async (e) => {
      e.preventDefault();
      dz.classList.remove('is-dragover');
      const files = Array.from(e.dataTransfer.files || []);
      if (files.length) await uploadKbFiles(files);
    });
  }

  document.querySelectorAll('[data-kb-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const action = btn.getAttribute('data-kb-action');
      const id = btn.getAttribute('data-file-id');
      if (action === 'preview') await previewKbFile(id);
      else if (action === 'download') downloadKbFile(id);
      else if (action === 'delete') await deleteKbFile(id);
    });
  });
}

async function uploadKbFiles(files) {
  const maxSize = 50 * 1024 * 1024;
  const valid = [];
  for (const f of files) {
    if (f.size > maxSize) {
      window.Clarity.toast.show(f.name + ' is too large (max 50MB)', 'danger');
      continue;
    }
    valid.push(f);
  }
  if (valid.length === 0) return;
  window.Clarity.toast.show('Uploading ' + valid.length + ' file(s)...', 'info');
  try {
    const fd = new FormData();
    valid.forEach(f => fd.append('files', f, f.name));
    const resp = await fetch(window.Clarity.api.base + '/api/files/upload', { method: 'POST', body: fd });
    const data = await resp.json();
    let okCount = 0, failCount = 0;
    for (const r of (data.files || [])) {
      if (r.ok) okCount++;
      else { failCount++; window.Clarity.toast.show('Failed: ' + (r.error || r.filename), 'danger'); }
    }
    if (okCount) window.Clarity.toast.show('Uploaded ' + okCount + ' file(s)', 'success');
    window.Clarity.app.navigate('#/knowledge');
  } catch (err) {
    window.Clarity.toast.show('Upload failed: ' + (err.message || ''), 'danger');
  }
}

async function previewKbFile(id) {
  try {
    const data = await window.Clarity.api.get('/api/files/' + id + '/content');
    const content = data.content || '(No text content extracted)';
    const isImage = data.type === 'image';
    const body = isImage
      ? '<div style="text-align:center;"><img src="' + window.Clarity.api.base + '/api/files/' + id + '/raw" style="max-width:100%;max-height:60vh;" /></div>'
      : '<pre style="white-space:pre-wrap;max-height:60vh;overflow:auto;background:var(--surface-muted);padding:12px;border-radius:8px;font-size:12.5px;">' + window.Clarity.utils.escapeHtml(content) + '</pre>';
    window.Clarity.modal.open('File preview', body, '<button class="btn btn--primary" type="button" data-modal-close="true">Close</button>');
  } catch (err) {
    window.Clarity.toast.show('Preview failed: ' + (err.message || ''), 'danger');
  }
}

function downloadKbFile(id) {
  const a = document.createElement('a');
  a.href = window.Clarity.api.base + '/api/files/' + id + '/raw';
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function deleteKbFile(id) {
  if (!confirm('Remove this file from the knowledge base?')) return;
  try {
    await window.Clarity.api.del('/api/files/' + id);
    window.Clarity.toast.show('File removed', 'success');
    window.Clarity.app.navigate('#/knowledge');
  } catch (err) {
    window.Clarity.toast.show('Delete failed: ' + (err.message || ''), 'danger');
  }
}


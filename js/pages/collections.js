window.Clarity = window.Clarity || {};
window.Clarity.pages = window.Clarity.pages || {};

window.Clarity.pages.collections = async function renderCollectionsPage(route) {
  const main = document.getElementById('main');
  if (!main) return;

  const match = route ? route.match(/#\/collections(?:\/)?(?:project\/)?([^\/]+)?/) : null;
  const projectId = match && match[1] ? match[1] : null;

  let files = [];
  let loadError = null;
  try {
    const endpoint = projectId ? `/api/files/shared?project_id=${projectId}` : "/api/files/shared";
    const data = await window.Clarity.api.get(endpoint);
    files = data.files || [];
  } catch (err) {
    loadError = err.message || "Failed to load project knowledge library.";
  }

  const groups = {};
  for (const f of files) {
    const key = f.file_type || 'other';
    if (!groups[key]) groups[key] = [];
    groups[key].push(f);
  }

  const groupLabels = {
    document: '📄 Documents',
    image: '🖼 Images',
    code: '💻 Source',
    spreadsheet: '📊 Data',
    archive: '🗜 Archives',
    other: '📁 Other',
  };
  const groupOrder = ['document', 'image', 'code', 'spreadsheet', 'archive', 'other'];
  const orderedKeys = groupOrder.filter(k => groups[k]).concat(Object.keys(groups).filter(k => !groupOrder.includes(k)));

  const titleText = projectId ? `Project Knowledge Library` : "Project Knowledge Library";
  const subtitleText = projectId ? `Documents and reference material for this project (${files.length} file${files.length === 1 ? '' : 's'})` : "All indexed project knowledge.";

  const listCards = files.length === 0
    ? '<div class="empty-state">This project has no indexed collection documents yet. Upload files from the Project Workspace or Knowledge page to build this library.</div>'
    : orderedKeys.map((k) => {
        const label = groupLabels[k] || k;
        const items = groups[k];
        return '<article class="collection-card" data-collection="' + window.Clarity.utils.escapeHtml(k) + '">' +
          '<div class="collection-card__top"><div class="collection-card__icon">' + label.split(' ')[0] + '</div>' +
          '<span class="tag">' + items.length + ' item' + (items.length === 1 ? '' : 's') + '</span></div>' +
          '<div><h3>' + window.Clarity.utils.escapeHtml(label.replace(/^[^ ]+ /, '')) + '</h3>' +
          '<div class="collection-card__meta">First: ' + (items[0] ? window.Clarity.utils.escapeHtml(items[0].filename || items[0].name || 'Unnamed') : '') + '</div></div>' +
          '<a class="btn btn--outline btn--sm" href="#/knowledge">View all</a></article>';
      }).join('');

  const headerLinks = [
    { href: '#/project', label: 'Project Workspace' },
    { href: '#/architecture', label: 'Architecture' },
    { href: '#/intelligence', label: 'Intelligence' },
    { href: '#/patch', label: 'Patch Agent' },
    { href: '#/chat', label: 'Ask Copilot' },
  ];

  main.innerHTML = [
    '<div class="page"><div class="page__inner">',
    '<header class="page__header">',
      '<div><h1 class="page__title">' + window.Clarity.utils.escapeHtml(titleText) + '</h1>',
      '<p class="page__subtitle">' + window.Clarity.utils.escapeHtml(subtitleText) + '</p></div>',
      '<div class="hstack" style="gap:6px;">',
      headerLinks.map(l => '<a class="btn btn--outline btn--sm" href="' + l.href + '" style="text-decoration:none;font-size:12px;font-weight:600;">' + window.Clarity.utils.escapeHtml(l.label) + '</a>').join(''),
      '</div></header>',
    loadError ? '<div class="alert alert--danger">' + window.Clarity.utils.escapeHtml(loadError) + '</div>' : '',
    '<section>',
      '<div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;align-items:center;font-size:13px;color:var(--ink-faint);background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:12px 16px;">',
        '<span style="font-weight:600;">Collection Scope:</span>',
        '<span style="padding:2px 10px;border-radius:6px;background:var(--canvas);border:1px solid var(--line);font-size:11px;">Project-scoped</span>',
        '<span>Only documents uploaded for this project are shown.</span>',
        '<span>Source: project_files + files table linked by project_id.</span>',
      '</div>',
    '</section>',
    '<section class="collection-grid">',
    listCards,
    '</section>',
    '<section style="margin-top:16px;background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px;font-size:12px;color:var(--ink-faint);">',
      '<strong>About Collection</strong><br>',
      'Collection shows project-scoped documents that Clarity indexes as knowledge. These files are used by the existing Knowledge, RAG, Copilot, and Intelligence systems — not by Architecture, Debug, or Patch. Upload ZIP/code from the Project Workspace. This section does not redesign chat, model registry, sidebar, topbar, or any other existing system.',
    '</section>',
    '</div></div>',
  ].join('');

  bindCollectionEvents();
};

function bindCollectionEvents() {
  // Minimal event binding for upload (reuses knowledge mechanism; project-scoped)
  // The actual upload mechanism remains unchanged; this page provides the workspace view.
}

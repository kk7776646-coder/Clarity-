const fs = require('fs');
let file = fs.readFileSync('js/pages/project.js', 'utf8');

const target = `'<div class="project-chat-head">',
    '<div><strong style="font-size:14px; color:var(--ink);">AI Assistant — ' + window.Clarity.utils.escapeHtml(analysis.projectName) + '</strong><span class="muted" style="font-size:12px; margin-left:8px;">Grounded exclusively in this codebase</span></div>',
    '<span class="tag tag--xs" style="background:var(--accent-soft); color:var(--accent); font-weight:600;">Isolated Context</span>',
    '</div>',`;

const replacement = `'<div class="project-chat-head">',
    '<div><strong style="font-size:14px; color:var(--ink);">AI Assistant — ' + window.Clarity.utils.escapeHtml(analysis.projectName) + '</strong><span class="muted" style="font-size:12px; margin-left:8px;">Grounded exclusively in this codebase</span></div>',
    '<div style="display:flex; align-items:center; gap:12px;">',
    '<span class="tag tag--xs" style="background:var(--accent-soft); color:var(--accent); font-weight:600;">Isolated Context</span>',
    '<div style="position:relative;">',
    '<button class="btn btn--icon-sm btn--ghost" id="exportChatMenuBtn" title="Export chat"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg></button>',
    '<div id="exportChatDropdown" class="dropdown-menu" style="display:none; position:absolute; right:0; top:calc(100% + 4px); background:var(--surface); border:1px solid var(--line); border-radius:var(--r-md); box-shadow:var(--shadow-float); z-index:100; min-width:140px; padding:4px;">',
    '<div style="padding:6px 10px; font-size:11px; font-weight:600; color:var(--ink-muted); text-transform:uppercase; border-bottom:1px solid var(--line); margin-bottom:4px;">Export chat</div>',
    '<button class="dropdown-item" id="exportChatPdfBtn" style="width:100%; text-align:left; padding:8px 10px; background:transparent; border:none; color:var(--ink); font-size:13px; cursor:pointer; border-radius:var(--r-sm);">PDF</button>',
    '<button class="dropdown-item" id="exportChatCancelBtn" style="width:100%; text-align:left; padding:8px 10px; background:transparent; border:none; color:var(--ink); font-size:13px; cursor:pointer; border-radius:var(--r-sm);">Cancel</button>',
    '</div>',
    '</div>',
    '</div>',
    '</div>',`;

if(file.includes(target)) {
  file = file.replace(target, replacement);
  fs.writeFileSync('js/pages/project.js', file, 'utf8');
  console.log("Success replacing chat head");
} else {
  console.log("Target not found!");
}

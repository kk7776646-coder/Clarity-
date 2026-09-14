const fs = require('fs');

let html = fs.readFileSync('public/index.html', 'utf8');

const targetHTML = `<div class="topbar__right">`;
const replaceHTML = `<div class="topbar__right">
            <!-- Export Chat UI -->
            <div style="position:relative;" id="mainExportContainer" hidden>
              <button class="btn btn--ghost btn--icon-sm" id="exportChatMainBtn" type="button" title="Export chat" aria-label="Export chat">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </button>
              <div id="exportChatMainDropdown" class="dropdown-menu" style="display:none; position:absolute; right:0; top:calc(100% + 4px); background:var(--surface); border:1px solid var(--line); border-radius:var(--r-md); box-shadow:var(--shadow-float); z-index:100; min-width:140px; padding:4px;">
                <div style="padding:6px 10px; font-size:11px; font-weight:600; color:var(--ink-muted); text-transform:uppercase; border-bottom:1px solid var(--line); margin-bottom:4px;">Export chat</div>
                <button class="dropdown-item" id="exportChatMainPdfBtn" style="width:100%; text-align:left; padding:8px 10px; background:transparent; border:none; color:var(--ink); font-size:13px; cursor:pointer; border-radius:var(--r-sm);">PDF</button>
                <button class="dropdown-item" id="exportChatMainCancelBtn" style="width:100%; text-align:left; padding:8px 10px; background:transparent; border:none; color:var(--ink); font-size:13px; cursor:pointer; border-radius:var(--r-sm);">Cancel</button>
              </div>
            </div>`;

if (html.includes(targetHTML) && !html.includes("exportChatMainBtn")) {
    html = html.replace(targetHTML, replaceHTML);
    fs.writeFileSync('public/index.html', html, 'utf8');
    console.log("Updated index.html");
}

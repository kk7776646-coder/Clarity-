const fs = require('fs');
let js = fs.readFileSync('js/ui/chat.js', 'utf8');

const exportMenuHtml = `
      <div style="position: absolute; top: 24px; right: 24px; z-index: 100;">
        <div style="position: relative;">
          <button class="btn btn--icon-sm btn--ghost" id="mainChatExportMenuBtn" title="More options" aria-label="More options">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="1.5"></circle>
              <circle cx="12" cy="6" r="1.5"></circle>
              <circle cx="12" cy="18" r="1.5"></circle>
            </svg>
          </button>
          <div id="mainChatExportDropdown" class="dropdown-menu" style="display:none; position:absolute; right:0; top:calc(100% + 4px); background:var(--surface); border:1px solid var(--line); border-radius:var(--r-md); box-shadow:var(--shadow-float); z-index:100; min-width:140px; padding:4px;">
            <div style="padding:6px 10px; font-size:11px; font-weight:600; color:var(--ink-muted); text-transform:uppercase; border-bottom:1px solid var(--line); margin-bottom:4px;">Export</div>
            <button class="dropdown-item" id="mainChatExportPdfBtn" style="width:100%; text-align:left; padding:8px 10px; background:transparent; border:none; color:var(--ink); font-size:13px; cursor:pointer; border-radius:var(--r-sm);">Export as PDF</button>
            <button class="dropdown-item" id="mainChatExportCancelBtn" style="width:100%; text-align:left; padding:8px 10px; background:transparent; border:none; color:var(--ink); font-size:13px; cursor:pointer; border-radius:var(--r-sm);">Cancel</button>
          </div>
        </div>
      </div>
`;

js = js.replace("parts.push('<section class=\"chat-panel\">');", "parts.push('<section class=\"chat-panel\">');\n    if (!isEmpty) parts.push(`" + exportMenuHtml + "`);");

fs.writeFileSync('js/ui/chat.js', js, 'utf8');
console.log("Added 3 dot menu to chat-panel");

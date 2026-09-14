const fs = require('fs');
let js = fs.readFileSync('js/pages/project.js', 'utf8');

// Use start/end boundaries since whitespace formatting may differ
const startMarker = '<div class="run-test-wrapper"';
const endMarker = '  <div id="debugPanel" class="card" style="padding:24px; display:none;">';

const startIndex = js.indexOf(startMarker);
const endIndex = js.indexOf(endMarker, startIndex);

if (startIndex > -1 && endIndex > -1) {
    // we need to include the end of debugPanel
    const debugPanelEndIndex = js.indexOf('</div>\n  </div>', endIndex);
    
    if (debugPanelEndIndex > -1) {
        const fullOldStr = js.substring(startIndex - 30, debugPanelEndIndex + 14); // approximate boundaries
        
        const newUiStr = `  container.innerHTML = [
    '<div class="run-test-wrapper" style="display:flex; flex-direction:column; height: 100%;">',
    
    // Header/Toolbar Area
    '  <div style="padding: 16px 24px; border-bottom: 1px solid var(--line); display:flex; justify-content:space-between; align-items:center; background: var(--surface);">',
    '    <div style="display:flex; align-items:center; gap: 16px;">',
    '       <h1 style="font-size:18px; font-weight:700; margin:0; display:flex; align-items:center; gap:8px;">',
    '         <svg class="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    '         Run & Test workspace',
    '       </h1>',
    '    </div>',
    '    <div style="display:flex; gap: 8px;">',
    '      <button id="vscodeRunBtn" class="btn btn--primary btn--sm" title="Run Project (npm run dev / python main.py)">',
    '        <svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run',
    '      </button>',
    '      <button id="vscodeTestBtn" class="btn btn--outline btn--sm" title="Run Tests (npm test / pytest)">',
    '        <svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/></svg> Test',
    '      </button>',
    '      <button id="vscodeBuildBtn" class="btn btn--outline btn--sm" title="Build Project">',
    '        <svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg> Build',
    '      </button>',
    '    </div>',
    '  </div>',

    // Main workspace content (split view: left panel for terminals, right panel for problems/preview)
    '  <div style="display:flex; flex:1; min-height: 0;">',
    
    // Left: Terminals
    '    <div style="flex:1; display:flex; flex-direction:column; background: #1e1e1e; border-right: 1px solid var(--line);">',
    '      <div style="display:flex; border-bottom: 1px solid #333; background: #252526; padding:0 8px; justify-content:space-between; align-items:flex-end; min-height:36px;">',
    '         <div id="terminalTabsContainer" style="display:flex; gap: 2px; overflow-x:auto;">',
    '            <!-- Tabs will go here -->',
    '         </div>',
    '         <div style="display:flex; align-items:center; padding: 4px; gap:4px;">',
    '            <button id="terminalAddBtn" class="btn btn--ghost btn--icon-sm" style="color:#ccc; padding:4px;" title="New Terminal">',
    '               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    '            </button>',
    '            <button id="terminalClearBtn" class="btn btn--ghost btn--icon-sm" style="color:#ccc; padding:4px;" title="Clear Output">',
    '               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
    '            </button>',
    '            <button id="terminalStopBtn" class="btn btn--ghost btn--icon-sm" style="color:#ff5f56; padding:4px;" title="Stop Process">',
    '               <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    '            </button>',
    '         </div>',
    '      </div>',
    '      <div id="terminalBodyWrapper" style="flex:1; position:relative; overflow:hidden; display:flex; flex-direction:column;">',
    '         <div class="terminal-container" id="terminalScrollContainer" style="flex:1; padding:16px; font-family:\'Menlo\', \'Monaco\', \'Courier New\', monospace; font-size:13px; color:#d4d4d4; overflow-y:auto; scroll-behavior:smooth;">',
    '            <pre id="terminalOutput" style="margin:0; white-space:pre-wrap;"></pre>',
    '         </div>',
    '         <div style="display:flex; align-items:center; border-top:1px solid #333; background:#1e1e1e; padding: 0 14px;">',
    '            <span id="terminalPromptPrefix" style="color:#4ade80; font-family:monospace; font-size:13px; margin-right:8px;">$</span>',
    '            <input type="text" id="terminalInput" placeholder="Type a command (e.g. npm start) or input..." style="flex:1; background:transparent; border:none; color:#d4d4d4; padding:12px 0; font-family:monospace; font-size:13px; outline:none;" autocomplete="off" spellcheck="false" />',
    '         </div>',
    '      </div>',
    '    </div>',

    // Right: Inspector / Preview / Debug
    '    <div style="width: 380px; display:flex; flex-direction:column; background: var(--surface);">',
    '       <div style="display:flex; border-bottom: 1px solid var(--line); background: var(--bg);">',
    '          <button class="tab-btn active" style="padding: 10px 16px; font-size:12px; font-weight:600; background:transparent; border:none; border-bottom: 2px solid var(--accent); cursor:pointer;">Ports & Preview</button>',
    '          <button class="tab-btn" style="padding: 10px 16px; font-size:12px; font-weight:600; color:var(--ink-muted); background:transparent; border:none; cursor:pointer;">Diagnostics</button>',
    '       </div>',
    '       <div style="flex:1; padding: 16px; overflow-y:auto;">',
    '          <div id="inspectorPortPanel">',
    '             <div style="font-size:12px; font-weight:600; color:var(--ink-muted); text-transform:uppercase; margin-bottom:12px;">Active Services</div>',
    '             <div id="inspectorServicesList" style="font-size:13px; color:var(--ink); line-height:1.5;">No active services detected on ports.</div>',
    '          </div>',
    '       </div>',
    '    </div>',

    '  </div>',
    '</div>'
  ].join('');`;
        
        js = js.replace(fullOldStr, newUiStr);
        fs.writeFileSync('js/pages/project.js', js, 'utf8');
        console.log("Success replacing UI string.");
    }
}


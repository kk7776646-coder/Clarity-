const fs = require('fs');

let js = fs.readFileSync('js/pages/project.js', 'utf8');

const targetStr = `// -----------------------------------------------------------------------------
// RUN & TEST ENGINE UI
// -----------------------------------------------------------------------------
let runPollInterval = null;
function renderRunTestTab(container, projectId, analysis) {`;

if (js.includes(targetStr)) {
    // Find where the next major section starts
    const nextSection = `// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------`;
    
    // There is no standard comment block like we thought. Let's find "function fileTypeIcon(ext) {" instead, which we know comes next.
    const fileTypeFunc = `function fileTypeIcon(ext) {`;
    
    const startIndex = js.indexOf(targetStr);
    const endIndex = js.indexOf(fileTypeFunc, startIndex);
    
    if (startIndex > -1 && endIndex > -1) {
        
        // Find the last closing brace before fileTypeIcon
        const functionEndBrace = js.lastIndexOf('}', endIndex);
        
        if (functionEndBrace > startIndex) {
            const slice = js.substring(startIndex, functionEndBrace + 1);
            
            const newCode = `// -----------------------------------------------------------------------------
// RUN & TEST ENGINE UI
// -----------------------------------------------------------------------------
let runPollInterval = null;
function renderRunTestTab(container, projectId, analysis) {
  if (window.runPollInterval) {
    clearInterval(window.runPollInterval);
    window.runPollInterval = null;
  }
  
  let currentSessions = [];
  let activeSessionId = null;
  let isAutoScrolling = true;
  
  container.innerHTML = [
    '<div class="run-test-wrapper" style="display:flex; flex-direction:column; height: 100%; border:1px solid var(--line); border-radius:8px; overflow:hidden;">',
    
    // Header/Toolbar Area
    '  <div style="padding: 12px 16px; border-bottom: 1px solid var(--line); display:flex; justify-content:space-between; align-items:center; background: var(--surface);">',
    '    <div style="display:flex; align-items:center; gap: 12px;">',
    '       <h2 style="font-size:16px; font-weight:700; margin:0; display:flex; align-items:center; gap:8px; color:var(--ink);">',
    '         <svg class="icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    '         VS Code Terminals',
    '       </h2>',
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
    '  <div style="display:flex; flex:1; min-height: 480px; height: calc(100vh - 250px);">',
    
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
    '         <div class="terminal-container" id="terminalScrollContainer" style="flex:1; padding:16px; font-family:\\'Menlo\\', \\'Monaco\\', \\'Courier New\\', monospace; font-size:13px; color:#d4d4d4; overflow-y:auto; scroll-behavior:smooth;">',
    '            <pre id="terminalOutput" style="margin:0; white-space:pre-wrap;"></pre>',
    '         </div>',
    '         <div style="display:flex; align-items:center; border-top:1px solid #333; background:#1e1e1e; padding: 0 14px;">',
    '            <span id="terminalPromptPrefix" style="color:#4ade80; font-family:monospace; font-size:13px; margin-right:8px;">$</span>',
    '            <input type="text" id="terminalInput" placeholder="Type a command (e.g. npm start) or input..." style="flex:1; background:transparent; border:none; color:#d4d4d4; padding:12px 0; font-family:monospace; font-size:13px; outline:none;" autocomplete="off" spellcheck="false" />',
    '         </div>',
    '      </div>',
    '    </div>',

    // Right: Inspector / Preview / Debug
    '    <div style="width: 320px; display:flex; flex-direction:column; background: var(--surface);">',
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
  ].join('');
  
  const runBtn = container.querySelector('#vscodeRunBtn');
  const buildBtn = container.querySelector('#vscodeBuildBtn');
  const testBtn = container.querySelector('#vscodeTestBtn');
  const stopBtn = container.querySelector('#terminalStopBtn');
  const clearBtn = container.querySelector('#terminalClearBtn');
  const termOut = container.querySelector('#terminalOutput');
  const termScroll = container.querySelector('#terminalScrollContainer');
  const termInput = container.querySelector('#terminalInput');
  const tabsContainer = container.querySelector('#terminalTabsContainer');
  const addBtn = container.querySelector('#terminalAddBtn');
  const servicesList = container.querySelector('#inspectorServicesList');
  
  function getTerminalColorClasses(str) {
      if (!str) return "";
      let html = str.replace(/[\\u001b\\u009b][[\\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
      return window.Clarity.utils.escapeHtml(html);
  }

  function renderTabs() {
     if (!tabsContainer) return;
     tabsContainer.innerHTML = currentSessions.map(s => {
         const isActive = s.id === activeSessionId;
         const isRunning = s.status === 'starting' || s.status === 'running';
         const iconColor = isRunning ? '#27c93f' : (s.status === 'failed' ? '#ff5f56' : '#ccc');
         
         return \`<button class="terminal-tab" data-id="\${s.id}" style="
                display:flex; align-items:center; gap:8px; padding: 6px 12px;
                background: \${isActive ? '#1e1e1e' : 'transparent'};
                color: \${isActive ? '#fff' : '#888'};
                border: none; border-top: 2px solid \${isActive ? '#007acc' : 'transparent'};
                border-right: 1px solid #333; cursor:pointer; font-size:12px; height:36px;
            ">
               <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="\${iconColor}" stroke-width="2"><path d="M4 17l6-6-6-6"/><path d="M12 19h8"/></svg>
               \${window.Clarity.utils.escapeHtml(s.title || 'bash')}
            </button>\`;
     }).join('');
     
     tabsContainer.querySelectorAll('.terminal-tab').forEach(t => {
         t.onclick = () => {
             activeSessionId = t.getAttribute('data-id');
             renderActiveSession();
             renderTabs();
         };
     });
  }

  function renderActiveSession() {
      if (!termOut) return;
      const active = currentSessions.find(s => s.id === activeSessionId);
      if (!active) {
          termOut.innerHTML = '<span style="color:#666; font-style:italic;">No active terminal session. Click + to start one.</span>';
          if(stopBtn) stopBtn.style.color = '#666';
          return;
      }
      
      termOut.innerHTML = getTerminalColorClasses(active.logs.join(''));
      if (isAutoScrolling && termScroll) termScroll.scrollTop = termScroll.scrollHeight;
      
      const isRunning = active.status === 'starting' || active.status === 'running';
      if(stopBtn) stopBtn.style.color = isRunning ? '#ff5f56' : '#666';
      
      let servicesHtml = '';
      currentSessions.forEach(s => {
          if (s.port && (s.status === 'starting' || s.status === 'running')) {
              servicesHtml += \`<div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border:1px solid var(--line); border-radius:8px; margin-bottom:8px;">
                   <div>
                      <div style="font-weight:600; display:flex; align-items:center; gap:6px;">
                         <span style="width:8px; height:8px; border-radius:50%; background:#22c55e; display:inline-block;"></span>
                         Port \${s.port}
                      </div>
                      <div class="muted" style="font-size:11px; margin-top:2px;">\${window.Clarity.utils.escapeHtml(s.title)}</div>
                   </div>
                   <a href="\${window.location.protocol}//\${window.location.hostname}:\${s.port}" target="_blank" class="btn btn--sm btn--primary" style="text-decoration:none;">Open Preview</a>
                </div>\`;
          }
      });
      if(servicesList) servicesList.innerHTML = servicesHtml || '<div style="font-size:13px; color:var(--ink-muted);">No active services detected on ports.</div>';
  }

  const fetchTerminals = async () => {
    try {
      const res = await window.Clarity.api.request('/api/projects/' + projectId + '/terminals');
      if (Array.isArray(res)) {
          currentSessions = res;
          if (currentSessions.length > 0 && !activeSessionId) {
              activeSessionId = currentSessions[currentSessions.length - 1].id;
          }
          if (activeSessionId && !currentSessions.find(s => s.id === activeSessionId) && currentSessions.length > 0) {
              activeSessionId = currentSessions[0].id;
          }
          renderTabs();
          renderActiveSession();
      }
    } catch(e) {
      console.warn("Failed to fetch terminals");
    }
  };

  const startPolling = () => {
    if (!window.runPollInterval) {
      window.runPollInterval = setInterval(fetchTerminals, 1000);
    }
  };

  async function spawnTerminal(command, title) {
      try {
          if (termOut) termOut.innerHTML = ''; 
          const res = await window.Clarity.api.request('/api/projects/' + projectId + '/terminals', {
              method: 'POST',
              body: JSON.stringify({ command, title })
          });
          currentSessions.push(res);
          activeSessionId = res.id;
          renderTabs();
          renderActiveSession();
          startPolling();
      } catch(e) {
          window.Clarity.toast.show(e.message, "error");
      }
  }

  let defaultRunCmd = "npm run dev";
  let defaultBuildCmd = "npm run build";
  let defaultTestCmd = "npm test";
  if (analysis && analysis.primaryLanguage === "Python") {
      defaultRunCmd = "python app.py";
  }

  runBtn?.addEventListener('click', () => spawnTerminal(defaultRunCmd, defaultRunCmd));
  buildBtn?.addEventListener('click', () => spawnTerminal(defaultBuildCmd, defaultBuildCmd));
  testBtn?.addEventListener('click', () => spawnTerminal(defaultTestCmd, defaultTestCmd));
  addBtn?.addEventListener('click', () => spawnTerminal("bash", "Terminal"));

  stopBtn?.addEventListener('click', async () => {
      if (!activeSessionId) return;
      try {
          await window.Clarity.api.request('/api/terminals/' + activeSessionId + '/stop', { method: 'POST' });
          fetchTerminals();
      } catch(e) {}
  });
  
  clearBtn?.addEventListener('click', () => {
      if (termOut) termOut.innerHTML = '';
  });

  termInput?.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && termInput.value.trim() && activeSessionId) {
      const input = termInput.value;
      termInput.value = "";
      
      const active = currentSessions.find(s => s.id === activeSessionId);
      if (active && (active.status === 'running' || active.status === 'starting')) {
         try {
           await window.Clarity.api.request('/api/terminals/' + activeSessionId + '/input', {
             method: 'POST',
             body: JSON.stringify({ input })
           });
         } catch (err) {}
      } else {
         spawnTerminal(input, input);
      }
    }
  });

  termScroll?.addEventListener('scroll', () => {
      const isAtBottom = termScroll.scrollHeight - termScroll.clientHeight - termScroll.scrollTop <= 20;
      if (!isAtBottom && isAutoScrolling) {
        isAutoScrolling = false;
      } else if (isAtBottom && !isAutoScrolling) {
        isAutoScrolling = true;
      }
  });

  fetchTerminals();
  startPolling();
}`;
            js = js.replace(slice, newCode);
            fs.writeFileSync('js/pages/project.js', js, 'utf8');
            console.log("Replaced perfectly via strict boundaries.");
        }
    } else {
        console.log("Could not find fileTypeIcon in project.js", endIndex);
    }
} else {
    console.log("Could not find targetStr");
}

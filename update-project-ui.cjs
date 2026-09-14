const fs = require('fs');

let js = fs.readFileSync('js/pages/project.js', 'utf8');

// We are going to replace the simple run/build/test layout with a VS-Code like terminal manager
const targetUiStr = `  container.innerHTML = [
    '<div class="run-test-wrapper" style="padding: 24px; max-width: 1100px; margin:0 auto; display:flex; flex-direction:column; gap:24px;">',
    '  <div>',
    '    <h1 style="font-size:24px; font-weight:700; margin:0 0 8px 0; display:flex; align-items:center; gap:12px;">',
    '      <svg class="icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    '      Run & Test',
    '    </h1>',
    '    <p class="muted">Execute code, run tests, and manage development servers.</p>',
    '  </div>',
    '  <div class="card" style="padding:24px;">',
    '    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">',
    '      <div>',
    '        <div style="font-size:16px; font-weight:600;">Project Execution</div>',
    '        <div class="muted" style="font-size:13px; margin-top:4px;">Run the active project using detected environment settings.</div>',
    '      </div>',
    '      <div style="display:flex; gap: 8px;">',
    '        <button id="runBtn" class="btn btn--primary">',
    '          <svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
    '          <span>Run</span>',
    '        </button>',
    '        <button id="buildBtn" class="btn btn--outline">',
    '          <svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
    '          <span>Build</span>',
    '        </button>',
    '        <button id="testBtn" class="btn btn--outline">',
    '          <svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/></svg>',
    '          <span>Test</span>',
    '        </button>',
    '        <button id="stopBtn" class="btn btn--danger-outline">',
    '          <svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    '          <span>Stop</span>',
    '        </button>',
    '        <button id="debugRunBtn" class="btn btn--outline" style="display:none;">Debug Execution</button>',
    '      </div>',
    '    </div>',
    '    <div id="runStatusPanel" style="margin-bottom:16px; padding:16px; border-radius:8px; border:1px solid var(--line); background:var(--surface);">',
    '      <div style="font-weight:600; margin-bottom:8px;">Status: <span id="runState" style="color:var(--ink-muted);">Idle</span></div>',
    '      <div id="runConfig" style="font-size:13px; color:var(--ink-muted);">No active execution.</div>',
    '    </div>',
    '    <div class="terminal-wrapper" style="border:1px solid #333; border-radius:8px; overflow:hidden; background:#1e1e1e;">',
    '      <div class="terminal-bar" style="display:flex; justify-content:space-between; align-items:center; padding:8px 14px; background:#252526; border-bottom:1px solid #333; font-size:12px; color:#cccccc;">',
    '        <div style="display:flex; align-items:center; gap:8px;">',
    '          <div style="display:flex; gap:5px;">',
    '            <span style="width:10px; height:10px; border-radius:50%; background:#ff5f56; display:inline-block;"></span>',
    '            <span style="width:10px; height:10px; border-radius:50%; background:#ffbd2e; display:inline-block;"></span>',
    '            <span style="width:10px; height:10px; border-radius:50%; background:#27c93f; display:inline-block;"></span>',
    '          </div>',
    '          <span style="font-weight:600; font-family:monospace; margin-left:4px;">Terminal Console</span>',
    '          <span id="terminalRunningBadge" style="display:none; align-items:center; gap:4px; font-size:11px; background:rgba(59,130,246,0.2); color:#60a5fa; padding:2px 6px; border-radius:4px;">',
    '            <span class="spinner" style="width:10px; height:10px; border-width:1.5px;"></span> Streaming',
    '          </span>',
    '        </div>',
    '        <div style="display:flex; align-items:center; gap:8px;">',
    '          <button id="terminalAutoScrollToggleBtn" class="btn btn--sm" style="font-size:11px; padding:3px 9px; display:inline-flex; align-items:center; gap:6px; background:rgba(34,197,94,0.18); color:#4ade80; border:1px solid rgba(34,197,94,0.35); border-radius:4px; cursor:pointer;" title="Toggle automatic scrolling to latest log output">',
    '            <span id="autoScrollDot" style="width:7px; height:7px; border-radius:50%; background:#4ade80; display:inline-block;"></span>',
    '            <span id="autoScrollText">Auto-scroll: ON</span>',
    '          </button>',
    '          <button id="terminalScrollBottomBtn" class="btn btn--sm" style="font-size:11px; padding:3px 9px; background:#333; color:#ccc; border:1px solid #444; border-radius:4px; cursor:pointer; display:inline-flex; align-items:center; gap:4px;" title="Scroll directly to bottom">',
    '            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg> Bottom',
    '          </button>',
    '          <button id="terminalClearBtn" class="btn btn--sm" style="font-size:11px; padding:3px 9px; background:#333; color:#ccc; border:1px solid #444; border-radius:4px; cursor:pointer;" title="Clear console output">',
    '            Clear',
    '          </button>',
    '        </div>',
    '      </div>',
    '      <div class="terminal-container" id="terminalScrollContainer" style="background:#1e1e1e; color:#d4d4d4; padding:16px; font-family:monospace; font-size:13px; height:420px; overflow-y:auto; scroll-behavior:smooth;">',
    '        <pre id="terminalOutput" style="margin:0; white-space:pre-wrap;"></pre>',
    '      </div>',
    '      <div style="display:flex; border-top:1px solid #333; background:#1e1e1e;">',
    '          <span style="color:#4ade80; padding:10px 0 10px 14px; font-family:monospace; font-size:13px;">$</span>',
    '          <input type="text" id="terminalInput" placeholder="Enter command or input to running process (e.g., npm run dev)..." style="flex:1; background:transparent; border:none; color:#d4d4d4; padding:10px; font-family:monospace; font-size:13px; outline:none;" autocomplete="off" spellcheck="false" />',
    '      </div>',
    '    </div>',
    '  </div>',
    '  <div id="testResultsPanel" class="card" style="padding:24px; display:none;">',
    '    <div style="font-size:16px; font-weight:600; margin-bottom:16px;">Test Results</div>',
    '    <div id="testResultsContent"></div>',
    '  </div>',
    '  <div id="debugPanel" class="card" style="padding:24px; display:none;">',
    '    <div style="font-size:16px; font-weight:600; margin-bottom:16px;">Debug Session</div>',
    '    <div class="muted" style="font-size:13px;">Advanced debugging is currently in technical preview.</div>',
    '    <div style="margin-top:16px; display:grid; grid-template-columns:1fr 1fr; gap:16px;">',
    '       <div style="border:1px solid var(--line); border-radius:8px; padding:12px;">',
    '          <div style="font-weight:600; font-size:12px; color:var(--ink-muted); margin-bottom:8px; text-transform:uppercase;">Call Stack</div>',
    '          <div id="debugCallStack" style="font-size:13px; font-family:monospace;">(Not available)</div>',
    '       </div>',
    '       <div style="border:1px solid var(--line); border-radius:8px; padding:12px;">',
    '          <div style="font-weight:600; font-size:12px; color:var(--ink-muted); margin-bottom:8px; text-transform:uppercase;">Variables</div>',
    '          <div id="debugVariables" style="font-size:13px; font-family:monospace;">(Not available)</div>',
    '       </div>',
    '    </div>',
    '  </div>',
    '</div>'
  ].join('');`;

const newUiStr = `  // We render a multi-terminal VS-Code-like interface
  container.innerHTML = [
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
    '      <div style="display:flex; border-bottom: 1px solid #333; background: #252526; padding:0 8px; justify-content:space-between; align-items:flex-end;">',
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

if (js.includes(targetUiStr)) {
    js = js.replace(targetUiStr, newUiStr);
    
    // Now we need to update the terminal logic to handle the new session-based API
    const targetLogicStr = `  let runInterval = null;
  let isAutoScrolling = true;

  const runBtn = container.querySelector('#runBtn');
  const buildBtn = container.querySelector('#buildBtn');
  const testBtn = container.querySelector('#testBtn');
  const stopBtn = container.querySelector('#stopBtn');
  const stateLabel = container.querySelector('#runState');
  const configLabel = container.querySelector('#runConfig');
  const termOut = container.querySelector('#terminalOutput');
  const termScroll = container.querySelector('#terminalScrollContainer');
  const termInput = container.querySelector('#terminalInput');
  const autoScrollBtn = container.querySelector('#terminalAutoScrollToggleBtn');
  const scrollBottomBtn = container.querySelector('#terminalScrollBottomBtn');
  const clearBtn = container.querySelector('#terminalClearBtn');
  const runningBadge = container.querySelector('#terminalRunningBadge');
  const testResultsPanel = container.querySelector('#testResultsPanel');
  const testResultsContent = container.querySelector('#testResultsContent');

  let currentLogs = [];`;

    const newLogicStr = `  let runInterval = null;
  let isAutoScrolling = true;
  
  let currentSessions = [];
  let activeSessionId = null;

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
      // Basic ansi color stripping and html replacement for terminal logs
      let html = str.replace(/\\x1b\\[[0-9;]*m/g, '');
      return window.Clarity.utils.escapeHtml(html);
  }`;

    js = js.replace(targetLogicStr, newLogicStr);
    
    // Then rewrite the update loop and buttons
    const oldLoopStr = `  function getStatusColor(status) {
    switch (status) {
      case "running": return "var(--success)";
      case "starting": return "var(--warning)";
      case "failed": return "var(--danger)";
      case "completed": return "var(--success)";
      case "stopped": return "var(--warning)";
      default: return "var(--ink-muted)";
    }
  }

  function updateRunUI(statusObj) {
    if (!statusObj) return;
    
    stateLabel.textContent = statusObj.status.charAt(0).toUpperCase() + statusObj.status.slice(1);
    stateLabel.style.color = getStatusColor(statusObj.status);
    
    if (statusObj.command) {
      let extInfo = "";
      if (statusObj.port) extInfo += \` (Listening on port \${statusObj.port})\`;
      if (statusObj.exitCode !== undefined) extInfo += \` (Exit code \${statusObj.exitCode})\`;
      configLabel.textContent = \`Command: \${statusObj.command} \${extInfo}\`;
    }

    if (statusObj.status === "running" || statusObj.status === "starting") {
      runningBadge.style.display = "flex";
      runBtn.disabled = true;
      buildBtn.disabled = true;
      testBtn.disabled = true;
      stopBtn.disabled = false;
    } else {
      runningBadge.style.display = "none";
      runBtn.disabled = false;
      buildBtn.disabled = false;
      testBtn.disabled = false;
      stopBtn.disabled = true;
    }

    // Determine if we should append logs
    if (statusObj.logs && statusObj.logs.length > 0) {
      const newLogs = statusObj.logs.slice(currentLogs.length);
      if (newLogs.length > 0) {
        termOut.textContent += newLogs.join("");
        currentLogs = statusObj.logs;
        
        // Auto-scroll logic
        if (isAutoScrolling) {
          termScroll.scrollTop = termScroll.scrollHeight;
        }
      }
    }
    
    // Test Results
    if (statusObj.testResults) {
      testResultsPanel.style.display = "block";
      const tr = statusObj.testResults;
      testResultsContent.innerHTML = \`
        <div style="display:flex; gap:16px; margin-top:12px;">
           <div style="flex:1; padding:12px; background:var(--surface); border:1px solid var(--line); border-radius:8px; text-align:center;">
             <div style="font-size:24px; font-weight:700; color:var(--ink);">\${tr.total}</div>
             <div style="font-size:12px; color:var(--ink-muted);">Total Tests</div>
           </div>
           <div style="flex:1; padding:12px; background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.2); border-radius:8px; text-align:center;">
             <div style="font-size:24px; font-weight:700; color:#16a34a;">\${tr.passed}</div>
             <div style="font-size:12px; color:#15803d;">Passed</div>
           </div>
           <div style="flex:1; padding:12px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); border-radius:8px; text-align:center;">
             <div style="font-size:24px; font-weight:700; color:#dc2626;">\${tr.failed}</div>
             <div style="font-size:12px; color:#b91c1c;">Failed</div>
           </div>
        </div>
      \`;
    } else {
      testResultsPanel.style.display = "none";
    }
  }

  const fetchStatus = async () => {
    try {
      const res = await window.Clarity.api.request('/api/projects/' + projectId + '/run/status');
      updateRunUI(res);
      
      // Stop polling if done
      if (res.status === "completed" || res.status === "failed" || res.status === "stopped" || res.status === "idle") {
         if (runInterval) {
           clearInterval(runInterval);
           runInterval = null;
         }
      }
    } catch(e) {
      console.warn("Failed to fetch run status");
      if (runInterval) {
         clearInterval(runInterval);
         runInterval = null;
      }
    }
  };

  const startPolling = () => {
    if (!runInterval) {
      runInterval = setInterval(fetchStatus, 1500);
    }
  };

  runBtn.addEventListener('click', async () => {
    try {
      termOut.textContent = "";
      currentLogs = [];
      const res = await window.Clarity.api.request('/api/projects/' + projectId + '/run', {
        method: 'POST'
      });
      updateRunUI(res);
      startPolling();
    } catch (err) {
      window.Clarity.toast.show(err.message, "error");
    }
  });

  buildBtn.addEventListener('click', async () => {
    try {
      termOut.textContent = "";
      currentLogs = [];
      const res = await window.Clarity.api.request('/api/projects/' + projectId + '/build', {
        method: 'POST'
      });
      updateRunUI(res);
      startPolling();
    } catch (err) {
      window.Clarity.toast.show(err.message, "error");
    }
  });

  testBtn.addEventListener('click', async () => {
    try {
      termOut.textContent = "";
      currentLogs = [];
      const res = await window.Clarity.api.request('/api/projects/' + projectId + '/test', {
        method: 'POST'
      });
      updateRunUI(res);
      startPolling();
    } catch (err) {
      window.Clarity.toast.show(err.message, "error");
    }
  });

  stopBtn.addEventListener('click', async () => {
    try {
      const res = await window.Clarity.api.request('/api/projects/' + projectId + '/stop', {
        method: 'POST'
      });
      updateRunUI(res);
    } catch (err) {
      window.Clarity.toast.show(err.message, "error");
    }
  });

  termInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && termInput.value.trim()) {
      const input = termInput.value;
      termInput.value = "";
      termOut.textContent += "> " + input + "\\n";
      try {
        await window.Clarity.api.request('/api/projects/' + projectId + '/run/input', {
          method: 'POST',
          body: JSON.stringify({ input })
        });
      } catch (err) {
         console.warn("Input failed", err);
      }
    }
  });

  autoScrollBtn?.addEventListener('click', () => {
    isAutoScrolling = !isAutoScrolling;
    const dot = container.querySelector('#autoScrollDot');
    const txt = container.querySelector('#autoScrollText');
    if (isAutoScrolling) {
      dot.style.background = "#4ade80";
      autoScrollBtn.style.borderColor = "rgba(34,197,94,0.35)";
      autoScrollBtn.style.background = "rgba(34,197,94,0.18)";
      txt.textContent = "Auto-scroll: ON";
    } else {
      dot.style.background = "#9ca3af";
      autoScrollBtn.style.borderColor = "#4b5563";
      autoScrollBtn.style.background = "transparent";
      txt.textContent = "Auto-scroll: OFF";
    }
  });

  scrollBottomBtn?.addEventListener('click', () => {
    termScroll.scrollTop = termScroll.scrollHeight;
  });

  clearBtn?.addEventListener('click', () => {
    termOut.textContent = "";
    currentLogs = [];
  });

  // Initial fetch
  fetchStatus();
  startPolling();`;

    const newLoopStr = `  function renderTabs() {
     tabsContainer.innerHTML = currentSessions.map(s => {
         const isActive = s.id === activeSessionId;
         const isRunning = s.status === 'starting' || s.status === 'running';
         const iconColor = isRunning ? '#27c93f' : (s.status === 'failed' ? '#ff5f56' : '#ccc');
         
         return \`
            <button class="terminal-tab \${isActive ? 'active' : ''}" data-id="\${s.id}" style="
                display:flex; align-items:center; gap:8px; padding: 6px 12px;
                background: \${isActive ? '#1e1e1e' : 'transparent'};
                color: \${isActive ? '#fff' : '#888'};
                border: none; border-top: 1px solid \${isActive ? '#007acc' : 'transparent'};
                border-right: 1px solid #333; cursor:pointer; font-size:12px;
            ">
               <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="\${iconColor}" stroke-width="2"><path d="M4 17l6-6-6-6"/><path d="M12 19h8"/></svg>
               \${window.Clarity.utils.escapeHtml(s.title || 'bash')}
            </button>
         \`;
     }).join('');
     
     // Bind clicks
     tabsContainer.querySelectorAll('.terminal-tab').forEach(t => {
         t.onclick = () => {
             activeSessionId = t.getAttribute('data-id');
             renderActiveSession();
             renderTabs();
         };
     });
  }

  function renderActiveSession() {
      const active = currentSessions.find(s => s.id === activeSessionId);
      if (!active) {
          termOut.innerHTML = '<span style="color:#666; font-style:italic;">No active terminal session. Click + to start one.</span>';
          stopBtn.disabled = true;
          return;
      }
      
      termOut.innerHTML = getTerminalColorClasses(active.logs.join(''));
      if (isAutoScrolling) termScroll.scrollTop = termScroll.scrollHeight;
      
      const isRunning = active.status === 'starting' || active.status === 'running';
      stopBtn.disabled = !isRunning;
      
      // Update Ports Panel
      let servicesHtml = '';
      currentSessions.forEach(s => {
          if (s.port && (s.status === 'starting' || s.status === 'running')) {
              servicesHtml += \`
                <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; border:1px solid var(--line); border-radius:8px; margin-bottom:8px;">
                   <div>
                      <div style="font-weight:600; display:flex; align-items:center; gap:6px;">
                         <span style="width:8px; height:8px; border-radius:50%; background:#22c55e; display:inline-block;"></span>
                         Port \${s.port}
                      </div>
                      <div class="muted" style="font-size:11px; margin-top:2px;">\${window.Clarity.utils.escapeHtml(s.title)}</div>
                   </div>
                   <a href="/api/preview/\${s.port}" target="_blank" class="btn btn--sm btn--primary" style="text-decoration:none;">Open Preview</a>
                </div>
              \`;
          }
      });
      servicesList.innerHTML = servicesHtml || 'No active services detected on ports.';
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
              activeSessionId = currentSessions[0].id; // Fallback if deleted
          }
          renderTabs();
          renderActiveSession();
      }
    } catch(e) {
      console.warn("Failed to fetch terminals");
    }
  };

  const startPolling = () => {
    if (!runInterval) {
      runInterval = setInterval(fetchTerminals, 1000); // Poll terminals 1s
    }
  };

  async function spawnTerminal(command, title) {
      try {
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

  runBtn?.addEventListener('click', () => spawnTerminal("npm run dev", "npm run dev"));
  buildBtn?.addEventListener('click', () => spawnTerminal("npm run build", "npm run build"));
  testBtn?.addEventListener('click', () => spawnTerminal("npm test", "npm test"));
  addBtn?.addEventListener('click', () => spawnTerminal("bash", "bash"));

  stopBtn?.addEventListener('click', async () => {
      if (!activeSessionId) return;
      try {
          await window.Clarity.api.request('/api/terminals/' + activeSessionId + '/stop', { method: 'POST' });
          fetchTerminals();
      } catch(e) {}
  });
  
  clearBtn?.addEventListener('click', () => {
      termOut.innerHTML = ''; // Client side clear
  });

  termInput?.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && termInput.value.trim() && activeSessionId) {
      const input = termInput.value;
      termInput.value = "";
      
      const active = currentSessions.find(s => s.id === activeSessionId);
      if (active && (active.status === 'running' || active.status === 'starting')) {
         // Sending input to running process
         try {
           await window.Clarity.api.request('/api/terminals/' + activeSessionId + '/input', {
             method: 'POST',
             body: JSON.stringify({ input })
           });
         } catch (err) {}
      } else {
         // Spawning new command in the same tab is tricky conceptually, let's just spawn a new terminal for ad-hoc commands for now if idle
         spawnTerminal(input, input);
      }
    }
  });

  fetchTerminals();
  startPolling();`;

    js = js.replace(oldLoopStr, newLoopStr);
    
    fs.writeFileSync('js/pages/project.js', js, 'utf8');
    console.log("Success project.js logic replaced");
} else {
    console.log("Failed to find target in project.js");
}

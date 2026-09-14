const fs = require('fs');
let js = fs.readFileSync('js/pages/project.js', 'utf8');

const startMarker = 'let runInterval = null;';
const endMarker = 'startPolling();';

// Find the logic block inside renderProjectRunTab
const funcStart = js.indexOf('function renderProjectRunTab');
if (funcStart > -1) {
    const startIndex = js.indexOf(startMarker, funcStart);
    const endIndex = js.indexOf(endMarker, startIndex);
    
    if (startIndex > -1 && endIndex > -1) {
        const oldLogicStr = js.substring(startIndex, endIndex + endMarker.length);
        
        const newLogicStr = `let runInterval = null;
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
      if (!str) return "";
      let html = str.replace(/\\x1b\\[[0-9;]*m/g, '');
      return window.Clarity.utils.escapeHtml(html);
  }

  function renderTabs() {
     if (!tabsContainer) return;
     tabsContainer.innerHTML = currentSessions.map(s => {
         const isActive = s.id === activeSessionId;
         const isRunning = s.status === 'starting' || s.status === 'running';
         const iconColor = isRunning ? '#27c93f' : (s.status === 'failed' ? '#ff5f56' : '#ccc');
         
         return \`<button class="terminal-tab \${isActive ? 'active' : ''}" data-id="\${s.id}" style="
                display:flex; align-items:center; gap:8px; padding: 6px 12px;
                background: \${isActive ? '#1e1e1e' : 'transparent'};
                color: \${isActive ? '#fff' : '#888'};
                border: none; border-top: 1px solid \${isActive ? '#007acc' : 'transparent'};
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
          if(stopBtn) stopBtn.disabled = true;
          return;
      }
      
      termOut.innerHTML = getTerminalColorClasses(active.logs.join(''));
      if (isAutoScrolling && termScroll) termScroll.scrollTop = termScroll.scrollHeight;
      
      const isRunning = active.status === 'starting' || active.status === 'running';
      if(stopBtn) stopBtn.disabled = !isRunning;
      
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
      if(servicesList) servicesList.innerHTML = servicesHtml || 'No active services detected on ports.';
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
    if (!runInterval) {
      runInterval = setInterval(fetchTerminals, 1000);
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

  fetchTerminals();
  startPolling();`;

        js = js.replace(oldLogicStr, newLogicStr);
        fs.writeFileSync('js/pages/project.js', js, 'utf8');
        console.log("Success replacing logic string.");
    } else {
        console.log("Could not find start/end markers in project.js");
    }
}

const fs = require('fs');

let js = fs.readFileSync('js/pages/project.js', 'utf8');

// I also want to make sure the tab bar for terminal tabs actually looks okay in this theme
const tabsLogicStart = "tabsContainer.innerHTML = currentSessions.map(s => {";
if (js.includes(tabsLogicStart)) {
    const tabsLogicEnd = "}).join('');";
    const startI = js.indexOf(tabsLogicStart);
    const endI = js.indexOf(tabsLogicEnd, startI);
    if (startI > -1 && endI > -1) {
        const slice = js.substring(startI, endI + tabsLogicEnd.length);
        
        const newLogic = `tabsContainer.innerHTML = currentSessions.map(s => {
         const isActive = s.id === activeSessionId;
         const isRunning = s.status === 'starting' || s.status === 'running';
         const iconColor = isRunning ? '#27c93f' : (s.status === 'failed' ? '#ff5f56' : '#ccc');
         const titleStr = s.title || 'bash';
         
         return \`<button class="terminal-tab" data-id="\${s.id}" style="
                display:flex; align-items:center; gap:8px; padding: 6px 16px;
                background: \${isActive ? '#1e1e1e' : 'rgba(255,255,255,0.02)'};
                color: \${isActive ? '#fff' : '#888'};
                border: none; 
                border-top: 2px solid \${isActive ? '#0ea5e9' : 'transparent'};
                border-right: 1px solid #333; 
                cursor:pointer; 
                font-size:12px; 
                height:36px;
                transition: all 0.2s ease;
                white-space: nowrap;
            ">
               <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="\${iconColor}" stroke-width="2"><path d="M4 17l6-6-6-6"/><path d="M12 19h8"/></svg>
               \${window.Clarity.utils.escapeHtml(titleStr.length > 20 ? titleStr.substring(0,20)+'...' : titleStr)}
               <span class="close-tab-btn" data-id="\${s.id}" style="margin-left:8px; display:\${isActive ? 'block' : 'none'}; opacity:0.5; hover:opacity:1;">
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
               </span>
            </button>\`;
     }).join('');`;
     
        js = js.replace(slice, newLogic);
        
        // Let's also patch the click logic to handle close button
        const clickLogicStart = "tabsContainer.querySelectorAll('.terminal-tab').forEach(t => {";
        const clickLogicEnd = "});";
        const clickStartI = js.indexOf(clickLogicStart);
        const clickEndI = js.indexOf(clickLogicEnd, clickStartI);
        
        if (clickStartI > -1 && clickEndI > -1) {
            const clickSlice = js.substring(clickStartI, clickEndI + clickLogicEnd.length);
            const newClickLogic = `tabsContainer.querySelectorAll('.terminal-tab').forEach(t => {
         t.onclick = (e) => {
             const id = t.getAttribute('data-id');
             const isClose = e.target.closest('.close-tab-btn');
             if (isClose) {
                 e.stopPropagation();
                 // Call stop endpoint which also cleans it up on our backend
                 window.Clarity.api.request('/api/terminals/' + id + '/stop', { method: 'POST' }).catch(()=>{});
                 currentSessions = currentSessions.filter(s => s.id !== id);
                 if (activeSessionId === id) {
                     activeSessionId = currentSessions.length > 0 ? currentSessions[currentSessions.length - 1].id : null;
                 }
                 renderTabs();
                 renderActiveSession();
                 return;
             }
             activeSessionId = id;
             renderActiveSession();
             renderTabs();
         };
     });`;
            js = js.replace(clickSlice, newClickLogic);
            fs.writeFileSync('js/pages/project.js', js, 'utf8');
            console.log("Tab styles updated.");
        }
    }
}

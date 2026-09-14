const fs = require('fs');

let js = fs.readFileSync('js/pages/project.js', 'utf8');

const targetLogic = `if(servicesList) servicesList.innerHTML = servicesHtml || '<div style="font-size:13px; color:var(--ink-muted);">No active services detected on ports.</div>';`;

if (js.includes(targetLogic)) {
    const newLogic = `if(servicesList) servicesList.innerHTML = servicesHtml || '<div style="font-size:13px; color:var(--ink-muted);">No active services detected on ports.</div>';
      
      // Update Diagnostics
      const diagBtn = container.querySelectorAll('.tab-btn')[1];
      const inspectorPortPanel = container.querySelector('#inspectorPortPanel');
      if (!container.querySelector('#inspectorDiagPanel')) {
          const diagPanel = document.createElement('div');
          diagPanel.id = 'inspectorDiagPanel';
          diagPanel.style.display = 'none';
          diagPanel.innerHTML = '<div style="font-size:12px; font-weight:600; color:var(--ink-muted); text-transform:uppercase; margin-bottom:12px;">Problems</div><div id="inspectorDiagList" style="font-size:13px; color:var(--ink); line-height:1.5;">No problems detected.</div>';
          inspectorPortPanel.parentNode.appendChild(diagPanel);
          
          const portBtn = container.querySelectorAll('.tab-btn')[0];
          portBtn.onclick = () => {
              portBtn.classList.add('active');
              portBtn.style.borderBottom = '2px solid var(--accent)';
              portBtn.style.color = 'var(--ink)';
              diagBtn.classList.remove('active');
              diagBtn.style.borderBottom = 'none';
              diagBtn.style.color = 'var(--ink-muted)';
              inspectorPortPanel.style.display = 'block';
              diagPanel.style.display = 'none';
          };
          
          diagBtn.onclick = () => {
              diagBtn.classList.add('active');
              diagBtn.style.borderBottom = '2px solid var(--accent)';
              diagBtn.style.color = 'var(--ink)';
              portBtn.classList.remove('active');
              portBtn.style.borderBottom = 'none';
              portBtn.style.color = 'var(--ink-muted)';
              inspectorPortPanel.style.display = 'none';
              diagPanel.style.display = 'block';
          };
      }
      
      const diagList = container.querySelector('#inspectorDiagList');
      if (diagList) {
          let diagHtml = '';
          if (active && active.diagnostics && active.diagnostics.length > 0) {
              active.diagnostics.forEach(d => {
                  diagHtml += \`<div style="display:flex; gap:8px; padding:12px; border:1px solid var(--danger-border); background:var(--danger-surface); border-radius:8px; margin-bottom:8px;">
                     <svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--danger)" stroke-width="2" style="flex-shrink:0; margin-top:2px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                     <div>
                        <div style="font-weight:600; font-size:13px; color:var(--danger);">\${window.Clarity.utils.escapeHtml(d.file)}:\${d.line}</div>
                        <div style="font-size:12px; color:var(--ink-muted); margin-top:4px; font-family:monospace; word-break:break-all;">\${window.Clarity.utils.escapeHtml(d.message)}</div>
                     </div>
                  </div>\`;
              });
              diagList.innerHTML = diagHtml;
              
              // Update badge on button
              diagBtn.innerHTML = \`Diagnostics <span style="background:var(--danger); color:white; border-radius:12px; padding:2px 6px; font-size:10px; margin-left:4px;">\${active.diagnostics.length}</span>\`;
          } else {
              diagList.innerHTML = '<div style="font-size:13px; color:var(--ink-muted);">No problems detected in current session.</div>';
              diagBtn.innerHTML = 'Diagnostics';
          }
      }`;
      
    js = js.replace(targetLogic, newLogic);
    fs.writeFileSync('js/pages/project.js', js, 'utf8');
    console.log("Diagnostics UI added.");
}

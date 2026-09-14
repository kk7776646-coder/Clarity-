const fs = require('fs');

let js = fs.readFileSync('js/pages/project.js', 'utf8');

const eventTarget = `  if (runBtn) runBtn.addEventListener('click', () => startCommand('run'));`;

const eventReplace = `  if (terminalInput) {
    terminalInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const cmd = terminalInput.value.trim();
        if (!cmd) return;
        terminalInput.value = '';
        
        // If it's just 'clear', clear the screen
        if (cmd.toLowerCase() === 'clear') {
            if (termOut) termOut.textContent = '';
            currentRunLogs = [];
            return;
        }

        // Send to execution engine
        if (runPollInterval) clearInterval(runPollInterval);
        if (termOut) termOut.textContent += "\\n$ " + cmd + "\\n";
        if (stateLabel) {
          stateLabel.textContent = "STARTING";
          stateLabel.style.color = 'var(--ink-muted)';
        }
        try {
          const res = await fetch(\`/api/projects/\${projectId}/run\`, {
            method: "POST",
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: cmd })
          });
          if (!res.ok) {
            const err = await res.json();
            if (termOut) termOut.textContent += "\\n[Error] " + (err.error || err.message || "Failed to start execution");
            if (stateLabel) {
              stateLabel.textContent = "FAILED";
              stateLabel.style.color = 'var(--danger)';
            }
            return;
          }
          const data = await res.json();
          updateStatusUI(data);
          runPollInterval = setInterval(pollStatus, 1000);
        } catch(e) {
          if (termOut) termOut.textContent += "\\n[Error] " + e.message;
        }
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
        if (termOut) termOut.textContent = '';
        currentRunLogs = [];
    });
  }

  if (runBtn) runBtn.addEventListener('click', () => startCommand('run'));`;

if (!js.includes('terminalInput.addEventListener')) {
    js = js.replace(eventTarget, eventReplace);
    fs.writeFileSync('js/pages/project.js', js, 'utf8');
}

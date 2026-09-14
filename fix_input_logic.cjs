const fs = require('fs');
let js = fs.readFileSync('js/pages/project.js', 'utf8');

const targetLogic = `        // Send to execution engine
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
        }`;

const replaceLogic = `        // If project is running, send as stdin
        const isRunning = stateLabel && (stateLabel.textContent === 'RUNNING' || stateLabel.textContent === 'STARTING');
        
        if (isRunning) {
            try {
                await fetch(\`/api/projects/\${projectId}/run/input\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ input: cmd })
                });
            } catch (e) {
                console.error("Failed to send input", e);
            }
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
        }`;

js = js.replace(targetLogic, replaceLogic);
fs.writeFileSync('js/pages/project.js', js, 'utf8');

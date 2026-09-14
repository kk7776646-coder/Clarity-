const fs = require('fs');

let js = fs.readFileSync('js/pages/project.js', 'utf8');

const termWrapperTarget = `<div class="terminal-container" id="terminalScrollContainer" style="background:#1e1e1e; color:#d4d4d4; padding:16px; font-family:monospace; font-size:13px; height:420px; overflow-y:auto; scroll-behavior:smooth;">
          <pre id="terminalOutput" style="margin:0; white-space:pre-wrap;"></pre>
        </div>
      </div>`;

const termWrapperReplace = `<div class="terminal-container" id="terminalScrollContainer" style="background:#1e1e1e; color:#d4d4d4; padding:16px; font-family:monospace; font-size:13px; height:420px; overflow-y:auto; scroll-behavior:smooth;">
          <pre id="terminalOutput" style="margin:0; white-space:pre-wrap;"></pre>
        </div>
        <div style="display:flex; border-top:1px solid #333; background:#1e1e1e;">
            <span style="color:#4ade80; padding:10px 0 10px 14px; font-family:monospace; font-size:13px;">$</span>
            <input type="text" id="terminalInput" placeholder="Type a command (e.g. npm run dev, python script.py) and press Enter..." style="flex:1; background:transparent; border:none; color:#d4d4d4; padding:10px 14px; font-family:monospace; font-size:13px; outline:none;" autocomplete="off" spellcheck="false" />
        </div>
      </div>`;

js = js.replace(termWrapperTarget, termWrapperReplace);

const initTarget = `const autoScrollText = container.querySelector('#autoScrollText');
  const scrollBottomBtn = container.querySelector('#terminalScrollBottomBtn');
  const clearBtn = container.querySelector('#terminalClearBtn');
  const runningBadge = container.querySelector('#terminalRunningBadge');`;

const initReplace = initTarget + `\n  const terminalInput = container.querySelector('#terminalInput');`;

js = js.replace(initTarget, initReplace);

fs.writeFileSync('js/pages/project.js', js, 'utf8');

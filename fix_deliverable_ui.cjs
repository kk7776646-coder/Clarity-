const fs = require('fs');

let js = fs.readFileSync('js/pages/project.js', 'utf8');

const targetGrid = `    // File Type Selection Grid
    '  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 24px;" id="fileTypeSelection">',
    
    '    <button class="file-type-btn is-selected" data-type="pptx" style="display: flex; flex-direction: column; align-items: flex-start; text-align: left; padding: 16px; background: var(--canvas); border: 2px solid var(--primary); border-radius: 8px; cursor: pointer; transition: all 0.2s;">',
    '      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">',
    '        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--primary)" stroke-width="2"><rect width="20" height="15" x="2" y="3" rx="2"/><line x1="2" y1="18" x2="22" y2="18"/></svg>',
    '        <span style="font-weight: 700; font-size: 14px; color: var(--ink);">PPTX</span>',
    '      </div>',
    '      <div style="font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 4px;">Hackathon Presentation</div>',
    '      <div style="font-size: 12px; color: var(--ink-muted); line-height: 1.4;">Create a presentation using real project information.</div>',
    '    </button>',

    '    <button class="file-type-btn" data-type="docx" style="display: flex; flex-direction: column; align-items: flex-start; text-align: left; padding: 16px; background: var(--canvas); border: 1px solid var(--line); border-radius: 8px; cursor: pointer; transition: all 0.2s;">',
    '      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">',
    '        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#6366f1" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    '        <span style="font-weight: 700; font-size: 14px; color: var(--ink);">DOCX</span>',
    '      </div>',
    '      <div style="font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 4px;">Project Report</div>',
    '      <div style="font-size: 12px; color: var(--ink-muted); line-height: 1.4;">Create a detailed technical project report.</div>',
    '    </button>',

    '    <button class="file-type-btn" data-type="pdf" style="display: flex; flex-direction: column; align-items: flex-start; text-align: left; padding: 16px; background: var(--canvas); border: 1px solid var(--line); border-radius: 8px; cursor: pointer; transition: all 0.2s;">',
    '      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">',
    '        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ef4444" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/></svg>',
    '        <span style="font-weight: 700; font-size: 14px; color: var(--ink);">PDF</span>',
    '      </div>',
    '      <div style="font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 4px;">Project Report PDF</div>',
    '      <div style="font-size: 12px; color: var(--ink-muted); line-height: 1.4;">Generate a clean, printable PDF defense summary.</div>',
    '    </button>',

    '    <button class="file-type-btn" data-type="xlsx" style="display: flex; flex-direction: column; align-items: flex-start; text-align: left; padding: 16px; background: var(--canvas); border: 1px solid var(--line); border-radius: 8px; cursor: pointer; transition: all 0.2s;">',
    '      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">',
    '        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#10b981" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>',
    '        <span style="font-weight: 700; font-size: 14px; color: var(--ink);">XLSX</span>',
    '      </div>',
    '      <div style="font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 4px;">Project Analysis</div>',
    '      <div style="font-size: 12px; color: var(--ink-muted); line-height: 1.4;">Export structured project data and analysis.</div>',
    '    </button>',

    '    <button class="file-type-btn" data-type="svg" style="display: flex; flex-direction: column; align-items: flex-start; text-align: left; padding: 16px; background: var(--canvas); border: 1px solid var(--line); border-radius: 8px; cursor: pointer; transition: all 0.2s;">',
    '      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">',
    '        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#f59e0b" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 17 22 12"/></svg>',
    '        <span style="font-weight: 700; font-size: 14px; color: var(--ink);">SVG</span>',
    '      </div>',
    '      <div style="font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 4px;">Architecture Diagram</div>',
    '      <div style="font-size: 12px; color: var(--ink-muted); line-height: 1.4;">Generate a visual system architecture map.</div>',
    '    </button>',
    '  </div>',`;

const replaceGrid = `    // File Type Selection Grid
    '<div style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;" id="fileTypeSelection">',
    '  <button class="file-type-btn is-selected" data-type="pptx" style="display: flex; align-items: center; justify-content: center; width: 64px; height: 64px; background: var(--canvas); border: 2px solid var(--primary); border-radius: 12px; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);" title="Generate PPTX">',
    '    <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">',
    '      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--primary)" stroke-width="2"><rect width="20" height="15" x="2" y="3" rx="2"/><line x1="2" y1="18" x2="22" y2="18"/></svg>',
    '      <span style="font-weight: 700; font-size: 11px; color: var(--ink);">PPTX</span>',
    '    </div>',
    '  </button>',
    '  <button class="file-type-btn" data-type="docx" style="display: flex; align-items: center; justify-content: center; width: 64px; height: 64px; background: var(--canvas); border: 1px solid var(--line); border-radius: 12px; cursor: pointer; transition: all 0.2s;" title="Generate DOCX">',
    '    <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">',
    '      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#6366f1" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    '      <span style="font-weight: 700; font-size: 11px; color: var(--ink);">DOCX</span>',
    '    </div>',
    '  </button>',
    '  <button class="file-type-btn" data-type="pdf" style="display: flex; align-items: center; justify-content: center; width: 64px; height: 64px; background: var(--canvas); border: 1px solid var(--line); border-radius: 12px; cursor: pointer; transition: all 0.2s;" title="Generate PDF">',
    '    <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">',
    '      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#ef4444" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/></svg>',
    '      <span style="font-weight: 700; font-size: 11px; color: var(--ink);">PDF</span>',
    '    </div>',
    '  </button>',
    '  <button class="file-type-btn" data-type="xlsx" style="display: flex; align-items: center; justify-content: center; width: 64px; height: 64px; background: var(--canvas); border: 1px solid var(--line); border-radius: 12px; cursor: pointer; transition: all 0.2s;" title="Generate XLSX">',
    '    <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">',
    '      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#10b981" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>',
    '      <span style="font-weight: 700; font-size: 11px; color: var(--ink);">XLSX</span>',
    '    </div>',
    '  </button>',
    '  <button class="file-type-btn" data-type="svg" style="display: flex; align-items: center; justify-content: center; width: 64px; height: 64px; background: var(--canvas); border: 1px solid var(--line); border-radius: 12px; cursor: pointer; transition: all 0.2s;" title="Generate SVG">',
    '    <div style="display: flex; flex-direction: column; align-items: center; gap: 4px;">',
    '      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#f59e0b" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 17 22 12"/></svg>',
    '      <span style="font-weight: 700; font-size: 11px; color: var(--ink);">SVG</span>',
    '    </div>',
    '  </button>',
    '</div>',`;

if (js.includes(targetGrid)) {
    js = js.replace(targetGrid, replaceGrid);
    fs.writeFileSync('js/pages/project.js', js, 'utf8');
    console.log("Successfully replaced the deliverable grid with square icon buttons.");
} else {
    console.log("Could not find the target grid string in project.js");
}

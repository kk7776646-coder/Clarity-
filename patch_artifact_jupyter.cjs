const fs = require('fs');
let code = fs.readFileSync('js/ui/artifact.js', 'utf8');

code = code.replace(
  /\/\/ 1\. Architecture Diagram/g,
  `// 0. Jupyter Notebook Previewer
    if (art.filename.endsWith(".ipynb")) {
      renderJupyterViewer(body, art);
      return;
    }
    // 1. Architecture Diagram`
);

const jupyterViewer = `
  function renderJupyterViewer(container, art) {
    let nb;
    try {
      nb = JSON.parse(art.content);
    } catch (e) {
      container.innerHTML = '<div style="padding: 20px; color: #ef4444;">Failed to parse Notebook JSON.</div>';
      return;
    }
    const cells = nb.cells || [];
    let html = '<div style="padding: 20px; max-width: 900px; margin: 0 auto; background: #ffffff; color: #111;">';
    html += '<h2 style="margin-bottom: 20px; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">' + escapeHtml(art.filename) + '</h2>';
    
    cells.forEach((cell, idx) => {
      const source = Array.isArray(cell.source) ? cell.source.join('') : (cell.source || '');
      html += '<div style="margin-bottom: 16px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">';
      html += '<div style="background: #f9fafb; padding: 4px 10px; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">' + escapeHtml(cell.cell_type) + '</div>';
      
      if (cell.cell_type === 'markdown') {
        const rendered = window.Clarity.markdown && window.Clarity.markdown.render ? window.Clarity.markdown.render(source) : escapeHtml(source);
        html += '<div style="padding: 12px; font-size: 14px; line-height: 1.6;">' + rendered + '</div>';
      } else if (cell.cell_type === 'code') {
        const highlighted = window.Clarity.highlighter && window.Clarity.highlighter.highlightLines ? 
            window.Clarity.highlighter.highlightLines(source, "file.py").join('\\n') : escapeHtml(source);
        html += '<div style="padding: 12px; background: #0d1117; color: #c9d1d9; font-family: ui-monospace, monospace; font-size: 13px; overflow-x: auto; white-space: pre;">' + highlighted + '</div>';
        
        // Render outputs if any
        if (cell.outputs && cell.outputs.length > 0) {
          html += '<div style="padding: 8px 12px; background: #fdfdfd; border-top: 1px solid #e5e7eb; font-size: 12.5px; font-family: ui-monospace, monospace; color: #333; overflow-x: auto; white-space: pre;">';
          cell.outputs.forEach(out => {
            if (out.text) {
              const text = Array.isArray(out.text) ? out.text.join('') : out.text;
              html += escapeHtml(text);
            } else if (out.data && out.data['text/plain']) {
              const text = Array.isArray(out.data['text/plain']) ? out.data['text/plain'].join('') : out.data['text/plain'];
              html += escapeHtml(text);
            }
          });
          html += '</div>';
        }
      } else {
        html += '<div style="padding: 12px; font-size: 13px;">' + escapeHtml(source) + '</div>';
      }
      
      html += '</div>';
    });
    
    html += '</div>';
    
    // Check dark mode
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      html = html.replace(/background: #ffffff/g, 'background: #1e1e1e').replace(/color: #111/g, 'color: #e5e7eb').replace(/border-color: #e5e7eb/g, 'border-color: #333').replace(/background: #f9fafb/g, 'background: #252526');
    }
    
    container.innerHTML = html;
  }
`;

code = code.replace(/function renderSvgViewer/g, `${jupyterViewer}\n  function renderSvgViewer`);

fs.writeFileSync('js/ui/artifact.js', code);

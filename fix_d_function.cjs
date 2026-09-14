const fs = require('fs');

let js = fs.readFileSync('js/pages/project.js', 'utf8');

const targetD = `  function d() {
    const _ = document.getElementById("projectArtifactsContainer"),
          M = (document.getElementById("artifactSearchInput")?.value || "").toLowerCase(),
          A = o.filter(N => !(s !== "all" && N.type !== s && N.category !== s && (!N.filename || !N.filename.toLowerCase().endsWith(s))) && !(M && !N.filename.toLowerCase().includes(M) && !(N.description || "").toLowerCase().includes(M)));
    
    if (A.length === 0) {
      _.innerHTML = [
        '<div style="text-align: center; padding: 64px 24px; background: var(--surface); border-radius: 12px; border: 1px dashed var(--line); color: var(--ink-muted);">',
        '<div style="font-size: 32px; margin-bottom: 12px;">📂</div>',
        '<h4 style="font-size: 16px; font-weight: 600; color: var(--ink); margin-bottom: 8px;">No generated files yet</h4>',
        '<p style="font-size: 14px; max-width: 420px; margin: 0 auto; line-height: 1.5;">',
        o.length === 0 ? "Create your first project-grounded deliverable using the generator above." : "No assets matched the selected filter or search keyword.",
        '</p>',
        '</div>'
      ].join("");
      return;
    }
    
    _.innerHTML = A.map(N => {
      if (window.Clarity.artifact && window.Clarity.artifact.renderCard) {
        return window.Clarity.artifact.renderCard(N);
      }
      return '';
    }).join("");
    
    if (window.Clarity.artifact && window.Clarity.artifact.bindEvents) {
      window.Clarity.artifact.bindEvents(_);
    }
  }`;

const replaceD = `  function d() {
    const container = document.getElementById("projectArtifactsContainer");
    if (!container) return;
    const searchTerm = (document.getElementById("artifactSearchInput")?.value || "").toLowerCase();
    
    const filtered = o.filter(art => {
        let matchFilter = true;
        if (s !== "all") {
            const ext = (art.filename || "").split('.').pop().toLowerCase();
            matchFilter = (art.type === s || art.category === s || ext === s || art.format === s);
        }
        let matchSearch = true;
        if (searchTerm) {
            matchSearch = (art.filename || "").toLowerCase().includes(searchTerm) || (art.description || "").toLowerCase().includes(searchTerm);
        }
        return matchFilter && matchSearch;
    });
    
    if (filtered.length === 0) {
      container.innerHTML = [
        '<div style="text-align: center; padding: 64px 24px; background: var(--surface); border-radius: 12px; border: 1px dashed var(--line); color: var(--ink-muted);">',
        '<div style="font-size: 32px; margin-bottom: 12px;">📂</div>',
        '<h4 style="font-size: 16px; font-weight: 600; color: var(--ink); margin-bottom: 8px;">No generated files yet</h4>',
        '<p style="font-size: 14px; max-width: 420px; margin: 0 auto; line-height: 1.5;">',
        o.length === 0 ? "Create your first project-grounded deliverable using the generator above." : "No assets matched the selected filter or search keyword.",
        '</p>',
        '</div>'
      ].join("");
      return;
    }
    
    container.innerHTML = filtered.map(art => {
      if (window.Clarity.artifact && window.Clarity.artifact.renderCard) {
        return window.Clarity.artifact.renderCard(art);
      }
      return '';
    }).join("");
    
    if (window.Clarity.artifact && window.Clarity.artifact.bindEvents) {
      window.Clarity.artifact.bindEvents(container);
    }
  }`;

if (js.includes(targetD)) {
    js = js.replace(targetD, replaceD);
    fs.writeFileSync('js/pages/project.js', js, 'utf8');
    console.log("Updated d function.");
} else {
    console.log("targetD not found");
}

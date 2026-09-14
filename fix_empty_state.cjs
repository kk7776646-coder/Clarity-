const fs = require('fs');

let js = fs.readFileSync('js/ui/chat.js', 'utf8');

const targetFunctionStart = `  _renderEmptyState() {`;
const targetFunctionEnd = `  _renderMessage(msg) {`;

if (js.includes(targetFunctionStart) && js.includes(targetFunctionEnd)) {
    const before = js.substring(0, js.indexOf(targetFunctionStart));
    const after = js.substring(js.indexOf(targetFunctionEnd));
    
    const newFunction = `  _renderEmptyState() {
    let projName = "";
    let hasProj = false;
    let projId = "";

    const conv = window.Clarity?.state?.activeConversation;
    if (conv && conv.project_id) {
        projId = conv.project_id;
        const proj = window.Clarity?.state?.projects?.find(p => p.id === projId);
        if (proj) {
            projName = proj.name;
            hasProj = true;
        }
    }

    const title = hasProj ? \`What are you working on in \${window.Clarity.utils.escapeHtml(projName)}?\` : 'What are you working on?';
    const sub = hasProj ? 'Ask me about your project, code, architecture, RAG knowledge, or anything you\\'re building.' : 'Ask me anything to get started.';

    let suggestionsHtml = '';
    if (hasProj) {
       suggestionsHtml = \`
         <div class="chat-empty__suggestions" style="display:flex; flex-wrap:wrap; justify-content:center; gap:8px; margin-top:24px; max-width:600px; margin-left:auto; margin-right:auto;">
           <button class="btn btn--outline btn--sm" data-suggestion="Explain my project">Explain my project</button>
           <button class="btn btn--outline btn--sm" data-suggestion="How does the architecture work?">How does the architecture work?</button>
           <button class="btn btn--outline btn--sm" data-suggestion="Search my project knowledge">Search my project knowledge</button>
           <button class="btn btn--outline btn--sm" data-suggestion="Prepare me for a viva">Prepare me for a viva</button>
         </div>
       \`;
    } else {
       suggestionsHtml = \`
         <div class="chat-empty__suggestions" style="display:flex; flex-wrap:wrap; justify-content:center; gap:8px; margin-top:24px; max-width:600px; margin-left:auto; margin-right:auto;">
           <button class="btn btn--outline btn--sm" data-suggestion="Help me brainstorm an idea">Help me brainstorm an idea</button>
           <button class="btn btn--outline btn--sm" data-suggestion="Explain a complex topic">Explain a complex topic</button>
           <button class="btn btn--outline btn--sm" data-suggestion="Write a script for me">Write a script for me</button>
         </div>
       \`;
    }

    return [
      '<div class="chat-empty" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:20px; text-align:center;">',
      '<div class="chat-empty__inner" style="animation: fade-in 0.4s ease-out forwards;">',
      '<div class="chat-empty__logo" style="margin-bottom: 24px; display:inline-flex; align-items:center; justify-content:center; position:relative; width:64px; height:64px; border-radius:16px; background:var(--surface); box-shadow:var(--shadow-float); border:1px solid var(--line);">',
      '<img src="assets/clarity-icon.png" class="chat-empty__logo-img brand__mark-img--light" style="width:36px; height:36px; object-fit:contain; animation: breath 4s ease-in-out infinite alternate;" alt="Clarity" />',
      '<img src="assets/clarity-icon-white.png" class="chat-empty__logo-img brand__mark-img--dark" style="width:36px; height:36px; object-fit:contain; animation: breath 4s ease-in-out infinite alternate;" alt="Clarity" />',
      '</div>',
      '<h1 class="chat-empty__title" style="font-size:28px; font-weight:700; color:var(--ink); margin-bottom:12px; letter-spacing:-0.02em;">' + title + '</h1>',
      '<p class="chat-empty__sub" style="font-size:15px; color:var(--ink-muted); max-width:480px; margin:0 auto; line-height:1.5;">' + sub + '</p>',
      suggestionsHtml,
      '</div>',
      '</div>',
      '<style>',
      '@keyframes breath { 0% { transform: scale(1); opacity: 0.9; filter: drop-shadow(0 0 2px var(--accent-soft)); } 100% { transform: scale(1.05); opacity: 1; filter: drop-shadow(0 0 8px var(--accent)); } }',
      '</style>'
    ].join("");
  }

`;
    
    js = before + newFunction + after;
    fs.writeFileSync('js/ui/chat.js', js, 'utf8');
    console.log("Updated _renderEmptyState in chat.js");
}

const fs = require('fs');

let js = fs.readFileSync('js/ui/composer.js', 'utf8');

const targetComposerHTML = `'<textarea id="composerInput" rows="1" placeholder="Ask anything about your performance..." aria-label="Message input"></textarea>',`;

if (js.includes(targetComposerHTML)) {
    // We can inject a dynamic check or set a default and modify it immediately
    const replacement = `'<textarea id="composerInput" rows="1" placeholder="Ask Clarity about your project..." aria-label="Message input" style="font-size: 15px; padding: 12px 0;"></textarea>',`;
    js = js.replace(targetComposerHTML, replacement);
    fs.writeFileSync('js/ui/composer.js', js, 'utf8');
    console.log("Updated composer.js placeholder");
}

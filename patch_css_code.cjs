const fs = require('fs');
let code = fs.readFileSync('css/components.css', 'utf8');

code = code.replace(/\.message__content code:not\(\.code-block\)/g, ".message__content :not(.code-block) > code:not([class*='language-'])");

code = code.replace(/\[data-theme="dark"\] \.message__content code:not\(\.code-block\)/g, "[data-theme='dark'] .message__content :not(.code-block) > code:not([class*='language-'])");

code = code.replace(/\.code-block code \{ display: block; padding: 12px 14px; overflow-x: auto;/g, ".code-block code { display: inline-block; min-width: 100%; padding: 12px 14px; overflow: visible; box-sizing: border-box;");

fs.writeFileSync('css/components.css', code);

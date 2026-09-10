const fs = require('fs');
let code = fs.readFileSync('css/components.css', 'utf8');

code = code.replace(/\.message__controls \{[\s\S]*?pointer-events: none; \}/,
  `.message__controls { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; opacity: 0; transition: opacity var(--t-base) var(--ease); }`);

code = code.replace(/\.message:hover \.message__controls, \.message--active \.message__controls, \.message--assistant \.message__controls--error \{ opacity: 1; pointer-events: auto; \}/,
  `.message:hover .message__controls, .message--active .message__controls, .message:focus-within .message__controls, .message--assistant .message__controls--error { opacity: 1; }`);

code = code.replace(/\.message:hover \.message__controls \.message-control, \.message--active \.message__controls \.message-control \{ pointer-events: auto; \}/,
  ``);

fs.writeFileSync('css/components.css', code);

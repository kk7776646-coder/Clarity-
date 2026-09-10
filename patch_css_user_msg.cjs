const fs = require('fs');
let code = fs.readFileSync('css/components.css', 'utf8');

code = code.replace(/\.message--user \.message__content \{/, `.message--user .message__content { white-space: pre-wrap; `);
// If that wasn't matched (it wasn't in the snippet above), let's insert it carefully.
if (!code.includes('white-space: pre-wrap')) {
  code = code.replace(/(\.message--user \.message__bubble \{[^}]*)\}/, "$1 white-space: pre-wrap; }");
}
fs.writeFileSync('css/components.css', code);

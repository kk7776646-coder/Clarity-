const fs = require('fs');
let code = fs.readFileSync('index.html', 'utf8');

code = code.replace(
  /<button class="btn btn--outline btn--sm" id="newChatBtn" type="button" title="Start a new chat">[\s\S]*?<\/button>/,
  ''
);

fs.writeFileSync('index.html', code);

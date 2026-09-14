const fs = require('fs');
let content = fs.readFileSync('js/pages/project.js', 'utf8');

content = content.replace(/document\.querySelector\('chatPromptInput'\)/g, "document.getElementById('chatPromptInput')");
content = content.replace(/document\.querySelector\('sendChatBtn'\)/g, "document.getElementById('sendChatBtn')");
content = content.replace(/const input = document\.querySelector\("projectChatInput"\)/g, 'const input = document.getElementById("projectChatInput")');

fs.writeFileSync('js/pages/project.js', content, 'utf8');

const fs = require('fs');
let content = fs.readFileSync('js/pages/project.js', 'utf8');

// The faulty sed was: sed -i 's/t.getElementById/t.querySelector/g' js/pages/project.js
// This replaced ANY_CHARACTER + "t.getElementById" with ANY_CHARACTER + "t.querySelector"
// So `document.getElementById` became `document.querySelector`.
// Also `t.getElementById` became `t.querySelector`.

// Since we know `.getElementById` is safer to use for those missing '#' or when they were originally `.getElementById`, let's just find `t.querySelector("generateDeliverableBtn")` and manually replace it with `t.querySelector("#generateDeliverableBtn")`, OR change `t.querySelector` back to `document.getElementById` where appropriate.

content = content.replace(/document\.querySelector\("project-card-" \+ id\)/g, 'document.getElementById("project-card-" + id)');
content = content.replace(/document\.querySelector\("L" \+ lineNum\)/g, 'document.getElementById("L" + lineNum)');
content = content.replace(/document\.querySelector\("L" \+ targetLine\)/g, 'document.getElementById("L" + targetLine)');
content = content.replace(/document\.querySelector\(sid\)/g, 'document.getElementById(sid)');
content = content.replace(/t\.querySelector\("generateDeliverableBtn"\)/g, 't.querySelector("#generateDeliverableBtn")');
content = content.replace(/t\.querySelector\("deliverableInstructions"\)/g, 't.querySelector("#deliverableInstructions")');
content = content.replace(/t\.querySelector\("genStatusMessage"\)/g, 't.querySelector("#genStatusMessage")');
content = content.replace(/chatInput = document\.querySelector\("projectChatInput"\)/g, 'chatInput = document.getElementById("projectChatInput")');
content = content.replace(/chatForm = document\.querySelector\("projectChatForm"\)/g, 'chatForm = document.getElementById("projectChatForm")');

fs.writeFileSync('js/pages/project.js', content, 'utf8');

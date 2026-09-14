const fs = require('fs');

let js = fs.readFileSync('js/pages/project.js', 'utf8');

const targetLogic = `window.Clarity.api.request('/api/terminals/' + id + '/stop', { method: 'POST' }).catch(()=>{});`;

if (js.includes(targetLogic)) {
    js = js.replace(targetLogic, `window.Clarity.api.request('/api/terminals/' + id + '/stop?delete=true', { method: 'POST' }).catch(()=>{});`);
    fs.writeFileSync('js/pages/project.js', js, 'utf8');
    console.log("Tab close updated to send delete flag");
}

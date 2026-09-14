const fs = require('fs');

let js = fs.readFileSync('js/ui/composer.js', 'utf8');

const targetMountEnd = `    if (fileCount > 0) this._refreshAttachments();`;
const replaceMountEnd = `    if (fileCount > 0) this._refreshAttachments();

    // Dynamically update placeholder
    const input = container.querySelector("#composerInput");
    if (input) {
        let projName = "";
        const conv = window.Clarity?.state?.activeConversation;
        if (conv && conv.project_id) {
            const projId = conv.project_id;
            const proj = window.Clarity?.state?.projects?.find(p => p.id === projId);
            if (proj) {
                projName = proj.name;
            }
        }
        if (projName) {
            input.placeholder = "Ask anything about " + projName + "...";
        } else {
            input.placeholder = "Ask Clarity about your project...";
        }
    }`;

if (js.includes(targetMountEnd)) {
    js = js.replace(targetMountEnd, replaceMountEnd);
    fs.writeFileSync('js/ui/composer.js', js, 'utf8');
    console.log("Updated composer.js dynamic placeholder");
}

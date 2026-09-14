const fs = require('fs');

function patchFile(filepath) {
    if (!fs.existsSync(filepath)) return;
    let js = fs.readFileSync(filepath, 'utf8');
    
    // Replace the problematic off-screen positioning
    const offScreenRegex = /wrapper\.style\.left\s*=\s*"-9999px";/g;
    
    if (offScreenRegex.test(js)) {
        js = js.replace(offScreenRegex, 'wrapper.style.left = "0";\n          wrapper.style.zIndex = "-9999"; // Hide behind main UI to prevent clipping');
        fs.writeFileSync(filepath, js, 'utf8');
        console.log("Patched " + filepath);
    } else {
        console.log("No offscreen wrapper found in " + filepath);
    }
}

patchFile('js/ui/chat.js');
patchFile('js/pages/project.js');

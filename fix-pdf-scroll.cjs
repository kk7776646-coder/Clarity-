const fs = require('fs');

function patchFile(filepath) {
    if (!fs.existsSync(filepath)) return;
    let js = fs.readFileSync(filepath, 'utf8');
    
    // Replace html2canvas options to include scrollY: 0
    const regex = /html2canvas:\s*\{\s*scale:\s*2,\s*useCORS:\s*true,\s*letterRendering:\s*true,\s*windowWidth:\s*800\s*\}/g;
    
    if (regex.test(js)) {
        js = js.replace(regex, "html2canvas:  { scale: 2, useCORS: true, letterRendering: true, windowWidth: 800, scrollY: 0, scrollX: 0 }");
        fs.writeFileSync(filepath, js, 'utf8');
        console.log("Patched scroll options in " + filepath);
    } else {
        console.log("Regex not found in " + filepath);
    }
}

patchFile('js/ui/chat.js');
patchFile('js/pages/project.js');

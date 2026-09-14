const fs = require('fs');
let js = fs.readFileSync('js/pages/project.js', 'utf8');

const badBlockStart = `      window.Clarity.toast.show("Successfully generated " + (res.artifact?.filename || "file"), "success");`;

const startIndex = js.indexOf(badBlockStart);
if (startIndex !== -1) {
    const endStr = `  document.querySelectorAll(".art-filter-chip").forEach(chip => {`;
    const endIndex = js.indexOf(endStr);
    if (endIndex !== -1) {
        // Find the '  });' before endStr
        let exactEnd = js.lastIndexOf(`  });`, endIndex);
        if (exactEnd !== -1) {
             const slice = js.substring(startIndex, exactEnd + `  });\n`.length);
             js = js.replace(slice, "");
             fs.writeFileSync('js/pages/project.js', js, 'utf8');
             console.log("Fixed syntax error");
        }
    }
}

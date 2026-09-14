const fs = require('fs');
let file = fs.readFileSync('js/pages/project.js', 'utf8');

const targetAutoFixAll = `         if (res && res.fixedContent) {
           currentFileContent = res.fixedContent;
           activeFileRecord.content = res.fixedContent;
           activeFileRecord.lineCount = res.fixedContent.split(/\\r?\\n/).length;
           window.Clarity.toast.show("Auto-Fix applied successfully!", "success");
           renderViewerContent(false);
           await fetchAndRenderDiagnostics(activeFileRecord.path, res.fixedContent);
         }`;

const replaceAutoFixAll = `         if (res && res.fixedContent) {
           currentFileContent = res.fixedContent;
           activeFileRecord.content = res.fixedContent;
           activeFileRecord.lineCount = res.fixedContent.split(/\\r?\\n/).length;
           window.Clarity.toast.show("Auto-Fix applied successfully!", "success");
           if (editingFile) {
              const ta = document.getElementById("vscodeEditTextarea");
              if (ta) {
                  ta.value = res.fixedContent;
                  ta.dispatchEvent(new Event("input"));
              }
           } else {
              renderViewerContent(false);
           }
           await fetchAndRenderDiagnostics(activeFileRecord.path, res.fixedContent);
         }`;

const targetSingleFix = `          if (res && res.fixedContent) {
            currentFileContent = res.fixedContent;
            if (activeFileRecord) {
              activeFileRecord.content = res.fixedContent;
              activeFileRecord.lineCount = res.fixedContent.split(/\\r?\\n/).length;
            }
            window.Clarity.toast.show("Quick Fix applied for line " + line + "!", "success");
            renderViewerContent(false);
            jumpToLine(line, true);
            await fetchAndRenderDiagnostics(file, res.fixedContent);
          }`;

const replaceSingleFix = `          if (res && res.fixedContent) {
            currentFileContent = res.fixedContent;
            if (activeFileRecord) {
              activeFileRecord.content = res.fixedContent;
              activeFileRecord.lineCount = res.fixedContent.split(/\\r?\\n/).length;
            }
            window.Clarity.toast.show("Quick Fix applied for line " + line + "!", "success");
            if (editingFile) {
              const ta = document.getElementById("vscodeEditTextarea");
              if (ta) {
                  ta.value = res.fixedContent;
                  ta.dispatchEvent(new Event("input"));
              }
            } else {
              renderViewerContent(false);
            }
            jumpToLine(line, true);
            await fetchAndRenderDiagnostics(file, res.fixedContent);
          }`;

if (file.includes(targetAutoFixAll) && file.includes(targetSingleFix)) {
  file = file.replace(targetAutoFixAll, replaceAutoFixAll);
  file = file.replace(targetSingleFix, replaceSingleFix);
  fs.writeFileSync('js/pages/project.js', file, 'utf8');
  console.log("Success replacing auto fix frontend logic.");
} else {
  console.log("Could not find exact string targets.");
}

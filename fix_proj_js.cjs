const fs = require('fs');

let js = fs.readFileSync('js/pages/project.js', 'utf8');

const targetPdf = `      if (!window.pdfMake || !window.htmlToPdfmake) {
         window.Clarity.ui.showToast("PDF generation library not loaded.", "error");
         return;
      }`;

const replacePdf = `      if (!window.pdfMake || !window.htmlToPdfmake) {
          try {
              await new Promise((resolve, reject) => {
                 const s1 = document.createElement("script");
                 s1.src = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js";
                 s1.onload = resolve; s1.onerror = reject; document.head.appendChild(s1);
              });
              await new Promise((resolve, reject) => {
                 const s2 = document.createElement("script");
                 s2.src = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js";
                 s2.onload = resolve; s2.onerror = reject; document.head.appendChild(s2);
              });
              await new Promise((resolve, reject) => {
                 const s3 = document.createElement("script");
                 s3.src = "https://cdn.jsdelivr.net/npm/html-to-pdfmake/browser.js";
                 s3.onload = resolve; s3.onerror = reject; document.head.appendChild(s3);
              });
          } catch(e) {
             window.Clarity.ui.showToast("PDF generation library failed to load.", "error");
             return;
          }
      }`;

if (js.includes(targetPdf)) {
    js = js.replace(targetPdf, replacePdf);
    fs.writeFileSync('js/pages/project.js', js, 'utf8');
    console.log("Updated project.js");
}

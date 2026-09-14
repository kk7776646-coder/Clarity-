const fs = require('fs');
let file = fs.readFileSync('js/pages/project.js', 'utf8');

const target = `pdfMake.createPdf(docDefinition).download(safeName);
        window.Clarity.ui.showToast("Chat exported successfully.", "success");`;

const replacement = `const pdf = pdfMake.createPdf(docDefinition);
        pdf.download(safeName);
        window.Clarity.ui.showToast("Chat exported successfully.", "success");

        pdf.getBase64(async (base64) => {
          try {
            await window.Clarity.api.request('/api/projects/' + analysis.projectId + '/artifacts', {
              method: 'POST',
              body: JSON.stringify({
                filename: safeName,
                category: 'pdf',
                description: 'Exported Chat Conversation',
                source: 'Chat Export',
                bufferBase64: base64
              })
            });
            // trigger refresh of artifacts tab if open
            if (window.renderProjectArtifactsTab && document.getElementById('projectArtifactsGrid')) {
               window.renderProjectArtifactsTab(document.getElementById('projectArtifactsGrid').parentElement, analysis.projectId, analysis);
            }
          } catch(e) {
            console.warn("Failed to register artifact:", e);
          }
        });`;

if(file.includes(target)) {
  file = file.replace(target, replacement);
  fs.writeFileSync('js/pages/project.js', file, 'utf8');
  console.log("Success replacing chat logic");
} else {
  console.log("Target not found!");
}

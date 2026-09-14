const fs = require('fs');

let js = fs.readFileSync('js/pages/project.js', 'utf8');

const targetStr = `        const safeName = analysis.projectName.replace(/[^a-zA-Z0-9]/g, '_') + "_chat_" + new Date().toISOString().split('T')[0] + ".pdf";
        
        const pdf = pdfMake.createPdf(docDefinition);
        pdf.download(safeName);
        window.Clarity.toast.show("Chat exported successfully.", "success");

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
          } catch(e) {}
        });
      } catch (err) {
        console.error("PDF Export Error:", err);
        window.Clarity.toast.show("Couldn't export the chat. Please try again.", "error");
      }`;

const replaceStr = `        const safeName = analysis.projectName.replace(/[^a-zA-Z0-9]/g, '_') + "_chat_" + new Date().toISOString().split('T')[0] + ".pdf";
        
        setTimeout(() => {
          try {
            const pdf = pdfMake.createPdf(docDefinition);
            pdf.download(safeName, () => {
              window.Clarity.toast.show("Chat exported successfully.", "success");
            });

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
              } catch(e) {}
            });
          } catch (err) {
            console.error("PDF Export Error:", err);
            window.Clarity.toast.show("Couldn't export the chat. Please try again.", "error");
          }
        }, 50);
      } catch (err) {
        console.error("PDF Export Error:", err);
        window.Clarity.toast.show("Couldn't export the chat. Please try again.", "error");
      }`;

if (js.includes(targetStr)) {
    js = js.replace(targetStr, replaceStr);
    fs.writeFileSync('js/pages/project.js', js, 'utf8');
    console.log("Success project.js");
} else {
    console.log("Target string not found in project.js");
}

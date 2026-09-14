const fs = require('fs');

let js = fs.readFileSync('js/ui/chat.js', 'utf8');

const targetStr = `           const val = htmlToPdfmake(htmlStr, { imagesByReference: true });
           const docDefinition = {
             content: val.content,
             images: val.images,
             defaultStyle: { font: 'Helvetica', fontSize: 11, lineHeight: 1.2 }
           };
           const prefix = projectName ? projectName.replace(/[^a-zA-Z0-9]/g, '_') : 'Clarity';
           const safeName = prefix + "_chat_" + new Date().toISOString().split('T')[0] + ".pdf";
           
           const pdf = pdfMake.createPdf(docDefinition);
           pdf.download(safeName);
           window.Clarity.toast.show("Chat exported successfully.", "success");
           
           // Optionally register as artifact if project_id is available
           const projId = window.Clarity.state.activeConversation?.project_id;
           if (projId) {
             pdf.getBase64(async (base64) => {
               try {
                 await window.Clarity.api.request('/api/projects/' + projId + '/artifacts', {
                   method: 'POST',
                   body: JSON.stringify({
                     filename: safeName,
                     category: 'pdf',
                     description: 'Exported Chat Conversation',
                     source: 'Chat Export',
                     bufferBase64: base64
                   })
                 });
               } catch(e) {}
             });
           }`;

const replaceStr = `           // Give the browser time to render the 'Exporting...' toast before freezing the main thread
           setTimeout(() => {
             try {
               const val = htmlToPdfmake(htmlStr, { imagesByReference: true });
               const docDefinition = {
                 content: val.content,
                 images: val.images,
                 defaultStyle: { font: 'Helvetica', fontSize: 11, lineHeight: 1.2 }
               };
               const prefix = projectName ? projectName.replace(/[^a-zA-Z0-9]/g, '_') : 'Clarity';
               const safeName = prefix + "_chat_" + new Date().toISOString().split('T')[0] + ".pdf";
               
               const pdf = pdfMake.createPdf(docDefinition);
               
               // Use callback to ensure we show success after generation is done
               pdf.download(safeName, () => {
                 window.Clarity.toast.show("Chat exported successfully.", "success");
               });
               
               // Optionally register as artifact if project_id is available
               const projId = window.Clarity.state.activeConversation?.project_id;
               if (projId) {
                 pdf.getBase64(async (base64) => {
                   try {
                     await window.Clarity.api.request('/api/projects/' + projId + '/artifacts', {
                       method: 'POST',
                       body: JSON.stringify({
                         filename: safeName,
                         category: 'pdf',
                         description: 'Exported Chat Conversation',
                         source: 'Chat Export',
                         bufferBase64: base64
                       })
                     });
                   } catch(e) {}
                 });
               }
             } catch (err) {
                 console.error("PDF Export Error:", err);
                 window.Clarity.toast.show("Couldn't export the chat. Please try again.", "error");
             }
           }, 50);`;

if (js.includes(targetStr)) {
    js = js.replace(targetStr, replaceStr);
    fs.writeFileSync('js/ui/chat.js', js, 'utf8');
    console.log("Success");
} else {
    console.log("Target string not found in chat.js");
}

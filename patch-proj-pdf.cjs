const fs = require('fs');
let js = fs.readFileSync('js/pages/project.js', 'utf8');

const regex = /exportPdfBtn\?\.addEventListener\("click", async \(\) => \{[\s\S]*?\} catch \(err\) \{\s*console\.error\("Export error:", err\);\s*window\.Clarity\.toast\.show\("Export failed", "danger"\);\s*\}\s*\}\);\s*\}/m;

const newLogic = `exportPdfBtn?.addEventListener("click", async () => {
      exportDropdown.style.display = "none";
      if (!window.html2pdf) {
            try {
                await new Promise((resolve, reject) => {
                   const s = document.createElement("script");
                   s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
                   s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
                });
            } catch(e) {
               if (window.Clarity && window.Clarity.toast) window.Clarity.toast.show("PDF library failed to load.", "danger");
               return;
            }
      }
            
      const feed = document.getElementById("projectChatFeed");
      if (!feed) return;
      window.Clarity.toast.show("Generating and downloading PDF...", "info");
      
      try {
          const wrapper = document.createElement("div");
          wrapper.id = "mainExportContainer";
          wrapper.style.width = "800px"; 
          wrapper.style.padding = "40px";
          wrapper.style.background = "#ffffff";
          wrapper.style.color = "#000000";
          wrapper.style.position = "absolute";
          wrapper.style.left = "-9999px";
          wrapper.style.top = "0";
          
          const now = new Date();
          const dateStr = now.toLocaleDateString() + " " + now.toLocaleTimeString();
          
          const header = document.createElement("h2");
          header.style.marginBottom = "24px";
          header.style.color = "#1e293b";
          header.style.fontFamily = "Inter, sans-serif";
          header.style.borderBottom = "1px solid #e2e8f0";
          header.style.paddingBottom = "12px";
          header.innerText = "Project Chat Export - " + window.Clarity.utils.escapeHtml(analysis.projectName) + " - " + dateStr;
          wrapper.appendChild(header);

          const clone = feed.cloneNode(true);
          
          clone.style.height = "auto";
          clone.style.maxHeight = "none";
          clone.style.overflow = "visible";
          clone.style.padding = "0";
          clone.style.margin = "0";

          clone.querySelectorAll("button, .spinner, .message__controls, .message__status").forEach(el => el.remove());
          
          const userMsgs = clone.querySelectorAll(".project-chat-msg--user");
          userMsgs.forEach(m => {
            const h = document.createElement("p");
            h.innerHTML = "<strong>You:</strong>";
            h.style.marginBottom = "8px";
            h.style.color = "#4B5563";
            h.style.fontFamily = "Inter, sans-serif";
            h.style.fontSize = "13px";
            m.insertBefore(h, m.firstChild);
            
            m.style.background = "#f3f4f6";
            m.style.color = "#111827";
            m.style.boxShadow = "none";
            m.style.border = "1px solid #e5e7eb";
            m.style.borderRadius = "8px";
            m.style.padding = "16px";
            m.style.marginBottom = "16px";
          });
          
          const aiMsgs = clone.querySelectorAll(".project-chat-msg--ai");
          aiMsgs.forEach(m => {
            const h = document.createElement("p");
            h.innerHTML = "<strong>Assistant:</strong>";
            h.style.marginBottom = "8px";
            h.style.color = "#7C3AED";
            h.style.fontFamily = "Inter, sans-serif";
            h.style.fontSize = "13px";
            m.insertBefore(h, m.firstChild);
            
            m.style.background = "#ffffff";
            m.style.color = "#111827";
            m.style.boxShadow = "none";
            m.style.border = "1px solid #e5e7eb";
            m.style.borderRadius = "8px";
            m.style.padding = "16px";
            m.style.marginBottom = "16px";
          });

          clone.querySelectorAll("pre").forEach(pre => {
             pre.style.whiteSpace = "pre-wrap";
             pre.style.wordBreak = "break-word";
             pre.style.background = "#f8fafc";
             pre.style.border = "1px solid #cbd5e1";
             pre.style.padding = "12px";
             pre.style.borderRadius = "6px";
             pre.style.overflowX = "hidden";
          });
          
          clone.querySelectorAll(".mermaid-container").forEach(c => {
              c.style.background = "#ffffff";
              c.style.border = "1px solid #e5e7eb";
          });

          wrapper.appendChild(clone);
          document.body.appendChild(wrapper);

          const safeName = analysis.projectName.replace(/[^a-zA-Z0-9]/g, '_') + "_chat_" + new Date().toISOString().split('T')[0] + ".pdf";

          const opt = {
            margin:       10, // mm
            filename:     safeName,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, letterRendering: true, windowWidth: 800 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
          };

          // Save and upload to artifacts
          window.html2pdf().set(opt).from(wrapper).outputPdf('datauristring').then(async (pdfBase64) => {
             // 1. Trigger Download
             window.html2pdf().set(opt).from(wrapper).save().then(() => {
                 if (document.body.contains(wrapper)) document.body.removeChild(wrapper);
                 if (window.Clarity && window.Clarity.toast) window.Clarity.toast.show("PDF Export successful!", "success");
             });
             
             // 2. Upload to artifacts
             try {
                const base64Data = pdfBase64.split(',')[1];
                await window.Clarity.api.request('/api/projects/' + analysis.projectId + '/artifacts', {
                  method: 'POST',
                  body: JSON.stringify({
                    filename: safeName,
                    category: 'pdf',
                    description: 'Exported Chat Conversation',
                    source: 'Chat Export',
                    bufferBase64: base64Data
                  })
                });
                if (window.renderProjectArtifactsTab && document.getElementById('projectArtifactsGrid')) {
                   window.renderProjectArtifactsTab(document.getElementById('projectArtifactsGrid').parentElement, analysis.projectId, analysis);
                }
             } catch(e) {
                console.warn("Failed to register artifact:", e);
             }
          }).catch(err => {
             if (document.body.contains(wrapper)) document.body.removeChild(wrapper);
             console.error("PDF Export error:", err);
             if (window.Clarity && window.Clarity.toast) window.Clarity.toast.show("Failed to export PDF.", "danger");
          });
      } catch (err) {
        console.error("Export error:", err);
        window.Clarity.toast.show("Export failed", "danger");
      }
    });
  }`;

if (regex.test(js)) {
   js = js.replace(regex, newLogic);
   fs.writeFileSync('js/pages/project.js', js, 'utf8');
   console.log("Replaced export logic in project.js");
} else {
   console.log("Regex not found in project.js");
   // Let's do a substring replace
   const startStr = `    exportPdfBtn?.addEventListener("click", async () => {`;
   const endStr = `    });\n  }`;
   
   const startIndex = js.indexOf(startStr);
   if (startIndex > -1) {
       let endIdx = js.indexOf(endStr, startIndex);
       if (endIdx > -1) {
           const slice = js.substring(startIndex, endIdx + endStr.length);
           js = js.replace(slice, newLogic);
           fs.writeFileSync('js/pages/project.js', js, 'utf8');
           console.log("Substring replaced export logic in project.js");
       }
   }
}

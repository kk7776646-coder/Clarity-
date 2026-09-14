const fs = require('fs');
let file = fs.readFileSync('js/pages/project.js', 'utf8');

const target = `  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = input.value;
    input.value = "";
    sendProjectMsg(val);
  });
}`;

const replacement = `  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const val = input.value;
    input.value = "";
    sendProjectMsg(val);
  });

  const exportBtn = document.getElementById("exportChatMenuBtn");
  const exportDropdown = document.getElementById("exportChatDropdown");
  const exportPdfBtn = document.getElementById("exportChatPdfBtn");
  const exportCancelBtn = document.getElementById("exportChatCancelBtn");

  if (exportBtn && exportDropdown) {
    exportBtn.addEventListener("click", () => {
      exportDropdown.style.display = exportDropdown.style.display === "none" ? "block" : "none";
    });
    
    document.addEventListener("click", (e) => {
      if (!exportBtn.contains(e.target) && !exportDropdown.contains(e.target)) {
        exportDropdown.style.display = "none";
      }
    });

    exportCancelBtn?.addEventListener("click", () => {
      exportDropdown.style.display = "none";
    });

    exportPdfBtn?.addEventListener("click", async () => {
      exportDropdown.style.display = "none";
      if (!window.pdfMake || !window.htmlToPdfmake) {
         window.Clarity.ui.showToast("PDF generation library not loaded.", "error");
         return;
      }
      
      const feed = document.getElementById("projectChatFeed");
      if (!feed) return;

      window.Clarity.ui.showToast("Exporting chat to PDF...", "info");
      
      try {
        const clone = feed.cloneNode(true);
        clone.querySelectorAll("button, .spinner, .artifact-card").forEach(el => el.remove());
        
        // Convert all images to data URLs for pdfMake
        const imgs = clone.querySelectorAll("img");
        for (let img of imgs) {
          try {
            if (!img.src.startsWith("data:")) {
              const res = await fetch(img.src);
              const blob = await res.blob();
              const reader = new FileReader();
              const dataUrl = await new Promise((resolve) => {
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
              });
              img.src = dataUrl;
            }
          } catch (e) {
            console.warn("Failed to fetch image for PDF:", img.src);
            img.remove();
          }
        }
        
        // Format SVG sizes properly
        clone.querySelectorAll("svg").forEach(svg => {
            if(!svg.getAttribute("width")) svg.setAttribute("width", "500");
            if(!svg.getAttribute("height")) svg.setAttribute("height", "300");
        });

        let htmlStr = \`
          <div style="font-family: Helvetica; font-size: 12pt;">
            <h1 style="font-size: 24pt; margin-bottom: 8px;">Clarity - Project AI Assistant</h1>
            <p style="font-size: 14pt; margin-bottom: 30px; color: #555;">Project: \${window.Clarity.utils.escapeHtml(analysis.projectName)} | Date: \${new Date().toLocaleDateString()}</p>
        \`;
        
        const msgs = clone.querySelectorAll('.project-chat-msg');
        msgs.forEach(msg => {
           const isAi = msg.classList.contains('project-chat-msg--ai');
           const sender = isAi ? 'CLARITY' : 'USER';
           const color = isAi ? '#000000' : '#4f46e5';
           htmlStr += \`
             <div style="margin-top: 15px; margin-bottom: 5px;">
               <strong style="color: \${color}; font-size: 10pt;">\${sender}</strong>
             </div>
             <div style="margin-bottom: 15px; font-size: 11pt; line-height: 1.5;">
               \${msg.innerHTML}
             </div>
             <hr style="color:#eeeeee;">
           \`;
        });
        
        htmlStr += '</div>';

        const val = htmlToPdfmake(htmlStr, {
          imagesByReference: true
        });

        const docDefinition = {
          content: val.content,
          images: val.images,
          defaultStyle: {
            font: 'Helvetica',
            fontSize: 11,
            lineHeight: 1.2
          }
        };

        const safeName = analysis.projectName.replace(/[^a-zA-Z0-9]/g, '_') + "_chat_" + new Date().toISOString().split('T')[0] + ".pdf";
        
        pdfMake.createPdf(docDefinition).download(safeName);
        window.Clarity.ui.showToast("Chat exported successfully.", "success");
      } catch (err) {
        console.error("PDF Export Error:", err);
        window.Clarity.ui.showToast("Couldn't export the chat. Please try again.", "error");
      }
    });
  }
}`;

if(file.includes(target)) {
  file = file.replace(target, replacement);
  fs.writeFileSync('js/pages/project.js', file, 'utf8');
  console.log("Success replacing chat logic");
} else {
  console.log("Target not found!");
}

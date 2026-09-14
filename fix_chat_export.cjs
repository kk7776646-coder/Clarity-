const fs = require('fs');

let js = fs.readFileSync('js/ui/chat.js', 'utf8');

const targetBind = `  _bindChatHeaderMenu() {
    // Export functionality removed per user request
  },`;

const replaceBind = `  async _bindChatHeaderMenu() {
    const container = document.getElementById("mainExportContainer");
    const menuBtn = document.getElementById("exportChatMainBtn");
    const dropdown = document.getElementById("exportChatMainDropdown");
    const cancelBtn = document.getElementById("exportChatMainCancelBtn");
    const pdfBtn = document.getElementById("exportChatMainPdfBtn");
    
    if (!container || !menuBtn || !dropdown || !pdfBtn) return;
    
    const messages = window.Clarity?.state?.activeConversation?.messages || [];
    if (messages.length > 0) {
        container.hidden = false;
    } else {
        container.hidden = true;
    }

    menuBtn.onclick = (e) => {
       e.stopPropagation();
       dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
    };
    cancelBtn.onclick = () => {
       dropdown.style.display = "none";
    };
    document.addEventListener("click", (e) => {
       if (!container.contains(e.target)) dropdown.style.display = "none";
    });

    pdfBtn.onclick = async () => {
       dropdown.style.display = "none";
       window.Clarity.ui.showToast("Exporting chat to PDF...", "info");
       try {
           if (!window.pdfMake) {
              await new Promise((resolve, reject) => {
                 const s1 = document.createElement("script");
                 s1.src = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js";
                 s1.onload = resolve;
                 s1.onerror = reject;
                 document.head.appendChild(s1);
              });
              await new Promise((resolve, reject) => {
                 const s2 = document.createElement("script");
                 s2.src = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js";
                 s2.onload = resolve;
                 s2.onerror = reject;
                 document.head.appendChild(s2);
              });
              await new Promise((resolve, reject) => {
                 const s3 = document.createElement("script");
                 s3.src = "https://cdn.jsdelivr.net/npm/html-to-pdfmake/browser.js";
                 s3.onload = resolve;
                 s3.onerror = reject;
                 document.head.appendChild(s3);
              });
           }

           const feed = document.getElementById("conversationList");
           if (!feed) return;
           const clone = feed.cloneNode(true);
           clone.querySelectorAll("button, .spinner, .msg__actions").forEach(el => el.remove());
           
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
               img.remove();
             }
           }
           
           clone.querySelectorAll("svg").forEach(svg => {
               if(!svg.getAttribute("width")) svg.setAttribute("width", "500");
               if(!svg.getAttribute("height")) svg.setAttribute("height", "300");
           });

           let projectName = "";
           const cid = window.Clarity.state.activeConversation?.id;
           if (cid && window.Clarity.state.conversations) {
               const conv = window.Clarity.state.conversations.find(c => c.id === cid);
               if (conv && conv.project_id) {
                   const proj = window.Clarity.state.projects?.find(p => p.id === conv.project_id);
                   if (proj) projectName = proj.name;
               }
           }
           const titleText = projectName ? \`Project: \${projectName}\` : 'Clarity - AI Assistant';

           let htmlStr = \`
             <div style="font-family: Helvetica; font-size: 12pt;">
               <h1 style="font-size: 24pt; margin-bottom: 8px;">Clarity - Conversation Export</h1>
               <p style="font-size: 14pt; margin-bottom: 30px; color: #555;">\${window.Clarity.utils.escapeHtml(titleText)} | Date: \${new Date().toLocaleDateString()}</p>
           \`;
           
           const msgs = clone.querySelectorAll('.msg');
           msgs.forEach(msg => {
              const isAi = msg.classList.contains('msg--ai');
              const sender = isAi ? 'CLARITY' : 'USER';
              const color = isAi ? '#000000' : '#4f46e5';
              const textContainer = msg.querySelector('.msg__text') || msg;
              htmlStr += \`
                <div style="margin-top: 15px; margin-bottom: 5px;">
                  <strong style="color: \${color}; font-size: 10pt;">\${sender}</strong>
                </div>
                <div style="margin-bottom: 15px; font-size: 11pt; line-height: 1.5;">
                  \${textContainer.innerHTML}
                </div>
                <hr style="color:#eeeeee;">
              \`;
           });
           
           htmlStr += '</div>';
           const val = htmlToPdfmake(htmlStr, { imagesByReference: true });
           const docDefinition = {
             content: val.content,
             images: val.images,
             defaultStyle: { font: 'Helvetica', fontSize: 11, lineHeight: 1.2 }
           };
           const prefix = projectName ? projectName.replace(/[^a-zA-Z0-9]/g, '_') : 'Clarity';
           const safeName = prefix + "_chat_" + new Date().toISOString().split('T')[0] + ".pdf";
           
           const pdf = pdfMake.createPdf(docDefinition);
           pdf.download(safeName);
           window.Clarity.ui.showToast("Chat exported successfully.", "success");
           
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
           window.Clarity.ui.showToast("Couldn't export the chat. Please try again.", "error");
       }
    };
  },`;

if (js.includes(targetBind)) {
    js = js.replace(targetBind, replaceBind);
}

// We also need to call `this._bindChatHeaderMenu();` whenever the chat is rendered.
// It is usually called in `init` or `renderConversation`.
// Let's find `renderConversation` or `init`.
const renderConvTarget = `  async renderConversation(id) {`;
const replaceRenderConv = `  async renderConversation(id) {
    setTimeout(() => this._bindChatHeaderMenu(), 100);`;
if (js.includes(renderConvTarget)) {
   js = js.replace(renderConvTarget, replaceRenderConv);
}

const renderEmptyTarget = `  renderEmpty() {`;
const replaceRenderEmpty = `  renderEmpty() {
    setTimeout(() => this._bindChatHeaderMenu(), 100);`;
if (js.includes(renderEmptyTarget)) {
   js = js.replace(renderEmptyTarget, replaceRenderEmpty);
}

fs.writeFileSync('js/ui/chat.js', js, 'utf8');
console.log("Updated chat.js for PDF export.");

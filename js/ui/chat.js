window.Clarity = window.Clarity || {};

window.Clarity.uiChat = {
  _activeConversation: null,
  _isStreaming: false,
  _abortController: null,
  _attachedFiles: [],
  // No hardcoded model: the active model always comes from the backend registry.
  _activeModel: null,
  _currentProject: null,
  _firstMessagePending: false,
  _previewFile: null,
  _isPreviewOpen: false,

  init() {
    this._loadState();
  },

  _loadState() {
    this._activeConversation = window.Clarity.store.get("active_conversation", null);
    this._activeModel = window.Clarity.store.get("active_model", null);
    if (this._activeConversation) {
      this._attachedFiles = window.Clarity.store.get("chat_attachments", []);
      this._currentProject = window.Clarity.store.get("current_project", null);
    } else {
      this._attachedFiles = [];
      this._currentProject = null;
      window.Clarity.store.remove("chat_attachments");
      window.Clarity.store.remove("current_project");
    }
  },

  _saveState() {
    if (this._activeConversation) {
      window.Clarity.store.set("chat_attachments", this._attachedFiles);
      window.Clarity.store.set("current_project", this._currentProject);
    } else {
      window.Clarity.store.remove("chat_attachments");
      window.Clarity.store.remove("current_project");
    }
    window.Clarity.store.set("active_model", this._activeModel);
  },

  /**
   * The model id sent to the backend. The selector's backend-synced selection
   * is authoritative; the locally cached value is only a fallback for the very
   * first paint. Never a hardcoded or display name.
   */
  _resolveModelId() {
    const fromSelector = window.Clarity.modelSelector && window.Clarity.modelSelector.activeId();
    return fromSelector || this._activeModel || null;
  },

  async startNewConversation() {
    this._activeConversation = null;
    this._firstMessagePending = false;
    this._userScrolledUp = false;
    window.Clarity.store.remove("active_conversation");
    window.Clarity.store.remove("chat_attachments");
    window.Clarity.store.remove("current_project");
    this._attachedFiles = [];
    this._currentProject = null;
    this._saveState();
    if (window.Clarity.composer && typeof window.Clarity.composer.clearAttachments === "function") {
      window.Clarity.composer.clearAttachments();
    }
    this.renderChat();
    setTimeout(() => {
      const input = document.getElementById("composerInput");
      if (input) input.focus();
    }, 50);
  },

  async loadConversation(cid) {
    this._stopStreaming();
    try {
      const data = await window.Clarity.api.get(`/api/conversations/${cid}`);
      this._activeConversation = cid;
      this._firstMessagePending = false;
      window.Clarity.store.set("active_conversation", cid);
      this.renderChat(data.messages);
    } catch (err) {
      this._isStreaming = false;
      this._syncComposerStreaming();
      if (err.status === 404 || (err.data && err.data.type === "not_found")) {
        window.Clarity.store.remove("active_conversation");
        window.Clarity.toast.show("Conversation not found. Starting new chat.", "warning");
        await this.startNewConversation();
      } else {
        window.Clarity.toast.show("Failed to load conversation", "danger");
      }
    }
  },

  async renderChat(messages) {
    try {
      this._stopStreaming();
      const main = document.getElementById("main");
      if (!main) return;

      const list = (messages && messages.length) ? messages : [];
      const html = this._renderChatHtml(list);
      main.innerHTML = html;

      const convEl = document.getElementById("conversationList");
      if (convEl) {
        this._bindScrollListener(convEl);
      }

      this._bindSuggestionChips();
      this._bindMainChatExportMenu();
      this._bindMessageControls();
      this._bindChatHeaderMenu();
      this._updateNewChatButton();
      this._updateComposer();
      this._isStreaming = false;
      this._syncComposerStreaming();

      if (document.getElementById("clarityRobot")) {
        this.setRobotState("idle");
      }

      if (list.length > 0) {
        this._userScrolledUp = false;
        this._scrollToBottom(true);
      }
    } catch (err) {
      console.error("renderChat error:", err);
      const main = document.getElementById("main");
      if (main) {
        main.innerHTML = '<div class="chat-shell"><section class="chat-panel"><div class="chat-empty"><div class="chat-empty__inner"><h1 class="chat-empty__title">Something went wrong</h1><p class="chat-empty__sub">Please refresh the page.</p></div></div></section></div>';
      }
    }
  },

  async _convertSvgToPngDataUrl(svgElement) {
    if (!svgElement) return null;

    // Clone the element and strip any emojis to prevent [X] box rendering on servers without emoji fonts
    const svgClone = svgElement.cloneNode(true);

    // Icon map for replacing emojis/keywords with high-quality vector inline SVGs inside flowchart nodes
    const iconMap = [
      {
        emojis: ["📱", "💬"],
        keywords: ["telegram", "channel", "group"],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" class="diag-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2.5" style="display:inline-block; vertical-align:middle; margin-right:5px; line-height:1;"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      },
      {
        emojis: ["🤖", "⚙️"],
        keywords: ["ai detection", "detection engine", "ai processing"],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" class="diag-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" stroke-width="2.5" style="display:inline-block; vertical-align:middle; margin-right:5px; line-height:1;"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 6v12M6 12h12" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      },
      {
        emojis: ["🔍", "📝"],
        keywords: ["nlp", "pattern", "matching"],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" class="diag-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" style="display:inline-block; vertical-align:middle; margin-right:5px; line-height:1;"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      },
      {
        emojis: ["📷", "🖼️"],
        keywords: ["image", "ocr", "scanner"],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" class="diag-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" style="display:inline-block; vertical-align:middle; margin-right:5px; line-height:1;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`
      },
      {
        emojis: ["👤", "👥"],
        keywords: ["suspicious", "profiling", "user profiling"],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" class="diag-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2.5" style="display:inline-block; vertical-align:middle; margin-right:5px; line-height:1;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
      },
      {
        emojis: ["⚠️", "▲"],
        keywords: ["risk", "analysis", "risk analysis"],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" class="diag-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ea580c" stroke-width="2.5" style="display:inline-block; vertical-align:middle; margin-right:5px; line-height:1;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="9" x2="12" y2="13" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="17" x2="12.01" y2="17" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      },
      {
        emojis: ["🚨", "🔥"],
        keywords: ["alert & action", "action system", "alert and action"],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" class="diag-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" style="display:inline-block; vertical-align:middle; margin-right:5px; line-height:1;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      },
      {
        emojis: ["📦", "🗄️"],
        keywords: ["log database", "database", "storage"],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" class="diag-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" style="display:inline-block; vertical-align:middle; margin-right:5px; line-height:1;"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>`
      },
      {
        emojis: ["🖥️", "📊"],
        keywords: ["dashboard", "admin dashboard", "control panel"],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" class="diag-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2.5" style="display:inline-block; vertical-align:middle; margin-right:5px; line-height:1;"><rect x="2" y="3" width="20" height="14" rx="2" stroke-linecap="round" stroke-linejoin="round"/><line x1="8" y1="21" x2="16" y2="21" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="17" x2="12" y2="21" stroke-linecap="round" stroke-linejoin="round"/></svg>`
      },
      {
        emojis: ["🚫", "🔏"],
        keywords: ["auto-ban", "ban", "report user"],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" class="diag-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2.5" style="display:inline-block; vertical-align:middle; margin-right:5px; line-height:1;"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`
      },
      {
        emojis: ["🔔", "📣"],
        keywords: ["immediate", "authority alert", "authority"],
        svg: `<svg xmlns="http://www.w3.org/2000/svg" class="diag-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5" style="display:inline-block; vertical-align:middle; margin-right:5px; line-height:1;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"/></svg>`
      }
    ];

    try {
      svgClone.querySelectorAll("foreignObject div, foreignObject span, .nodeLabel").forEach(el => {
        const text = (el.textContent || "").toLowerCase().trim();
        const html = el.innerHTML || "";

        const match = iconMap.find(item => {
          const hasEmoji = item.emojis.some(em => html.includes(em));
          if (hasEmoji) return true;
          const hasKeyword = item.keywords.some(kw => text.includes(kw));
          return hasKeyword;
        });

        if (match) {
          if (!el.querySelector(".diag-icon")) {
            el.innerHTML = match.svg + el.innerHTML;
          }
        }
      });
    } catch (err) {
      console.warn("Error enriching flowchart SVGs with high-quality icons:", err);
    }

    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F191}-\u{1F251}\u{1F004}\u{1F0CF}\u{1F170}-\u{1F171}\u{1F17E}-\u{1F17F}\u{1F18E}\u{3030}\u{2B50}\u{2B55}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2b1b}\u{2b1c}\u{2b50}\u{2b55}\u{2194}-\u{2199}\u{21a9}-\u{21aa}\u{231a}-\u{231b}\u{23e9}-\u{23ec}\u{23f0}\u{23f3}\u{24c2}\u{25b6}\u{25c0}\u{2601}-\u{2604}\u{260e}\u{2611}\u{2614}-\u{2615}\u{2618}\u{261d}\u{2620}\u{2622}-\u{2623}\u{2626}\u{262a}\u{262e}-\u{262f}\u{2638}-\u{263a}\u{2640}\u{2642}\u{2648}-\u{2653}\u{265f}\u{2660}\u{2663}\u{2665}-\u{2666}\u{2668}\u{267b}\u{267f}\u{2692}-\u{2697}\u{2699}\u{269b}-\u{269c}\u{26a0}-\u{26a1}\u{26aa}-\u{26ab}\u{26b0}-\u{26b1}\u{26c4}-\u{26c5}\u{26c8}\u{26ce}-\u{26cf}\u{26d1}\u{26d3}-\u{26d4}\u{26e9}-\u{26ea}\u{26f0}-\u{26f5}\u{26f7}-\u{26fa}\u{26fd}\u{2702}\u{2705}\u{2708}-\u{270d}\u{270f}\u{2712}\u{2714}\u{2716}\u{271d}\u{2721}\u{2728}\u{2733}-\u{2734}\u{2744}\u{2747}\u{274c}\u{274e}\u{2753}-\u{2755}\u{2757}\u{2763}-\u{2764}\u{2795}-\u{2797}\u{27a1}\u{27b0}\u{27bf}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{2b50}\u{2b55}\u{303d}\u{3297}\u{3299}]/gu;

    // Process text-containing nodes inside the SVG
    svgClone.querySelectorAll("text, desc, tspan, title, div, span, p").forEach(node => {
      if (node.childNodes && node.childNodes.length > 0) {
        node.childNodes.forEach(child => {
          if (child.nodeType === Node.TEXT_NODE) {
            child.nodeValue = child.nodeValue.replace(emojiRegex, '').trim();
          }
        });
      }
      if (node.textContent) {
        node.textContent = node.textContent.replace(emojiRegex, '').trim();
      }
    });

    // 1. Generate standalone, self-contained SVG string with inlined styles
    let svgStr = "";
    if (window.Clarity && typeof window.Clarity.getStandaloneSvgString === "function") {
      try {
        svgStr = window.Clarity.getStandaloneSvgString(svgClone);
      } catch (e) {
        console.warn("getStandaloneSvgString error:", e);
      }
    }
    if (!svgStr) {
      try {
        if (!svgClone.getAttribute("xmlns")) svgClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        svgStr = new XMLSerializer().serializeToString(svgClone);
      } catch (e) {
        return null;
      }
    }

    // 2. Try server-side @resvg/resvg-js rasterization first (/api/diagrams/render-image)
    try {
      const resp = await fetch("/api/diagrams/render-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          svg: svgStr,
          format: "png",
          width: 1600
        })
      });
      if (resp.ok) {
        const blob = await resp.blob();
        if (blob && blob.size > 100) {
          const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
          if (dataUrl) return dataUrl;
        }
      }
    } catch (err) {
      console.warn("Server-side SVG render error, falling back to client canvas:", err);
    }

    // 3. Client-side canvas rasterization fallback
    try {
      const bbox = svgElement.getBoundingClientRect();
      const width = Math.max(900, Math.round(bbox.width) * 2 || 1200);
      const height = Math.max(500, Math.round(bbox.height) * 2 || 700);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      const pngUrl = await new Promise((resolve) => {
        const img = new Image();
        const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        img.onload = () => {
          try {
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL("image/png"));
          } catch (e) {
            URL.revokeObjectURL(url);
            resolve(null);
          }
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(null);
        };
        img.src = url;
      });

      if (pngUrl) return pngUrl;
    } catch (clientErr) {
      console.warn("Client-side canvas rasterization failed:", clientErr);
    }

    // 4. Safe SVG data URL fallback if rasterization is unavailable
    try {
      return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
    } catch (_) {
      return null;
    }
  },

  async exportChatToPdf(options = {}) {
    const debugExport = true;
    const feed = options.feed || document.getElementById("conversationList") || document.getElementById("projectChatFeed");
    if (!feed) {
      if (window.Clarity && window.Clarity.toast) window.Clarity.toast.show("No chat to export.", "info");
      return;
    }

    if (feed.classList.contains("conversation--empty")) {
      if (window.Clarity && window.Clarity.toast) window.Clarity.toast.show("No chat to export.", "info");
      return;
    }

    let rawMsgs = Array.from(feed.querySelectorAll(".message, .project-chat-msg, .msg"));
    const stateMsgs = window.Clarity?.state?.activeConversation?.messages;
    if (rawMsgs.length === 0 && (!stateMsgs || stateMsgs.length === 0)) {
      if (window.Clarity && window.Clarity.toast) window.Clarity.toast.show("No chat to export.", "info");
      return;
    }

    // Ensure PDF and html2canvas libraries are fully loaded
    if (!window.html2pdf) {
      try {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      } catch (e) {
        if (window.Clarity && window.Clarity.toast) window.Clarity.toast.show("PDF library failed to load.", "danger");
        return;
      }
    }

    if (window.Clarity && window.Clarity.toast) {
      window.Clarity.toast.show("Preparing pixel-perfect PDF export...", "info");
    }

    // Capture current brand & project metadata
    let projectName = options.projectName || "";
    if (!projectName) {
      const cid = window.Clarity?.state?.activeConversation?.id;
      if (cid && window.Clarity?.state?.conversations) {
        const conv = window.Clarity.state.conversations.find(c => c.id === cid);
        if (conv && conv.project_id) {
          const proj = window.Clarity.state.projects?.find(p => p.id === conv.project_id);
          if (proj) projectName = proj.name;
        }
      }
    }

    // Create a beautiful, modal loading layer
    const loadingModal = document.createElement("div");
    loadingModal.id = "clarity-pdf-export-loading";
    loadingModal.style.cssText = "position:fixed; inset:0; background:rgba(15,23,42,0.7); backdrop-filter:blur(4px); z-index:100002; display:flex; align-items:center; justify-content:center; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;";
    loadingModal.innerHTML = `
      <div style="background:var(--surface, #ffffff); border:1px solid var(--line, #e2e8f0); padding:28px 36px; border-radius:12px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.25); display:flex; flex-direction:column; align-items:center; gap:14px; min-width:300px; text-align:center; color:var(--ink, #0f172a);">
        <div class="spinner" style="width:32px; height:32px; border-width:3.5px; border-color:var(--primary, #4f46e5); border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite;"></div>
        <div style="font-weight:700; font-size:16px; margin-top:4px;">Generating Export Document</div>
        <div style="font-size:12.5px; color:var(--ink-muted, #64748b); line-height:1.4;">Capturing live visual diagrams & paging conversation history...</div>
      </div>
    `;
    document.body.appendChild(loadingModal);

    // Create controlled, offscreen rendering viewport host
    const activeTheme = document.documentElement.getAttribute("data-theme") || "light";
    const host = document.createElement("div");
    host.id = "clarity-pdf-export-host";
    host.setAttribute("data-theme", activeTheme);
    host.className = "chat-panel chat-shell";
    host.style.cssText = "position:fixed !important; top:0 !important; left:-9999px !important; width:794px !important; min-width:794px !important; max-width:794px !important; margin:0 !important; padding:0 !important; background:#ffffff !important; z-index:100001 !important; box-sizing:border-box !important; overflow:visible !important; pointer-events:none !important;";

    // Inject print-safe styles matching professional report design
    const styleTag = document.createElement("style");
    styleTag.textContent = `
      #clarity-pdf-export-host {
        background-color: #ffffff !important;
        color: #0f172a !important;
        font-family: "Georgia", "Times New Roman", serif !important; /* Elegant report-grade typeface */
      }
      #clarity-pdf-export-host .pdf-page {
        box-sizing: border-box !important;
        background-color: #ffffff !important;
      }
      #clarity-pdf-export-host .pdf-message-card {
        background-color: #ffffff !important;
        border: 1px solid #e2e8f0 !important;
        box-shadow: none !important;
      }
      #clarity-pdf-export-host .pdf-message-body {
        color: #0f172a !important;
      }
      #clarity-pdf-export-host pre,
      #clarity-pdf-export-host .code-cell,
      #clarity-pdf-export-host .code-block {
        background-color: #f8fafc !important;
        border: 1px solid #e2e8f0 !important;
        color: #0f172a !important;
        font-family: var(--font-mono, monospace) !important;
        font-size: 11.5px !important;
        padding: 10px !important;
        border-radius: 6px !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      #clarity-pdf-export-host code {
        font-family: var(--font-mono, monospace) !important;
      }
      #clarity-pdf-export-host .pdf-diagram-wrapper {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        width: 100% !important;
        margin: 16px 0 !important;
        text-align: center !important;
      }
      #clarity-pdf-export-host table {
        page-break-inside: avoid !important;
        border-color: #e2e8f0 !important;
      }
      #clarity-pdf-export-host th, #clarity-pdf-export-host td {
        border-color: #e2e8f0 !important;
      }
      #clarity-pdf-export-host h1,
      #clarity-pdf-export-host h2,
      #clarity-pdf-export-host h3,
      #clarity-pdf-export-host h4 {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        font-weight: 700 !important;
        color: #0f172a !important;
        margin-top: 18px !important;
        margin-bottom: 10px !important;
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
      #clarity-pdf-export-host p {
        font-size: 13.5px !important;
        line-height: 1.6 !important;
        margin-bottom: 12px !important;
        color: #0f172a !important;
      }
      #clarity-pdf-export-host ul {
        margin-bottom: 14px !important;
        padding-left: 24px !important;
      }
      #clarity-pdf-export-host ol {
        margin-bottom: 14px !important;
        padding-left: 24px !important;
      }
      #clarity-pdf-export-host li {
        font-size: 13.5px !important;
        line-height: 1.6 !important;
        margin-bottom: 6px !important;
        color: #0f172a !important;
        list-style-type: disc !important;
        display: list-item !important;
      }
      #clarity-pdf-export-host ol li {
        list-style-type: decimal !important;
      }
      #clarity-pdf-export-host strong, #clarity-pdf-export-host b {
        font-weight: 700 !important;
        color: #0f172a !important;
      }
      #clarity-pdf-export-host .attachment {
        border: none !important;
        background: transparent !important;
        box-shadow: none !important;
        max-width: 100% !important;
        width: auto !important;
        height: auto !important;
        overflow: visible !important;
        display: block !important;
        margin: 12px 0 !important;
        padding: 0 !important;
      }
      #clarity-pdf-export-host .attachment-image {
        max-width: 100% !important;
        width: 100% !important;
        height: auto !important;
        display: block !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      #clarity-pdf-export-host .attachment-image img,
      #clarity-pdf-export-host .attachment-preview,
      #clarity-pdf-export-host .attachment-preview-img,
      #clarity-pdf-export-host .preview-image {
        max-width: 100% !important;
        max-height: 550px !important;
        width: auto !important;
        height: auto !important;
        object-fit: contain !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
        display: block !important;
        margin: 12px auto !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    `;
    host.appendChild(styleTag);

    const measurer = document.createElement("div");
    measurer.id = "clarity-pdf-measurer";
    measurer.setAttribute("data-theme", activeTheme);
    measurer.className = "chat-panel chat-shell";
    measurer.style.cssText = "position:fixed !important; left:-9999px !important; top:0 !important; width:850px !important; min-width:850px !important; max-width:850px !important; visibility:hidden !important; pointer-events:none !important; box-sizing:border-box !important; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif !important;";
    document.body.appendChild(measurer);

    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString() + " " + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const escapeHtml = (str) => String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

      // Explicitly await document.fonts.ready and ensure that all web fonts are fully loaded
      if (document.fonts && typeof document.fonts.ready !== "undefined") {
        await document.fonts.ready;
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      }

      // Settle active generations/animations
      if (feed.querySelector(".is-generating, .loading, .spinner")) {
        for (let j = 0; j < 50; j++) {
          if (!feed.querySelector(".is-generating, .loading, .spinner")) {
            break;
          }
          await new Promise(r => setTimeout(r, 100));
        }
      }

      // Settle lazy loaded images
      const images = Array.from(feed.querySelectorAll("img"));
      await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }));

      await new Promise(resolve => setTimeout(resolve, 300));

      if (debugExport) {
        console.log("[Clarity Export Debug] Active Theme:", activeTheme);
        console.log("[Clarity Export Debug] devicePixelRatio:", window.devicePixelRatio);
      }

      // Handle fallback if DOM messages are empty
      if (rawMsgs.length === 0 && stateMsgs && stateMsgs.length > 0) {
        const dummyFeed = document.createElement("div");
        dummyFeed.style.display = "none";
        for (const m of stateMsgs) {
          const isU = m.role === "user";
          const el = document.createElement("div");
          el.className = isU ? "message message--user" : "message message--assistant";
          el.setAttribute("data-role", isU ? "user" : "assistant");
          const c = document.createElement("div");
          c.className = "message__content";
          if (isU) {
            c.innerHTML = `<p>${escapeHtml(m.content)}</p>`;
          } else {
            c.innerHTML = window.Clarity?.markdown ? window.Clarity.markdown.render(m.content) : `<p>${escapeHtml(m.content)}</p>`;
          }
          el.appendChild(c);
          dummyFeed.appendChild(el);
        }
        document.body.appendChild(dummyFeed);
        if (window.mermaid && typeof window.mermaid.run === "function") {
          try { await window.mermaid.run({ nodes: dummyFeed.querySelectorAll("pre.mermaid") }); } catch (_) {}
        }
        rawMsgs = Array.from(dummyFeed.querySelectorAll(".message"));
        setTimeout(() => dummyFeed.remove(), 1000);
      }

      // Define standard in-situ element capture via html2canvas (reads live styled DOM)
      const captureElementToPng = async (mc) => {
        if (!mc || !window.html2canvas) return null;

        // Hide control layers and save styles
        const controls = mc.querySelectorAll(".mermaid-controls, .mermaid-fullscreen-header");
        const originalStyles = [];
        controls.forEach(ctrl => {
          originalStyles.push({ el: ctrl, display: ctrl.style.display });
          ctrl.style.setProperty("display", "none", "important");
        });

        // Save original styles for mc and all inner descendants (like .mermaid-viewport, pre.mermaid)
        const childNodes = Array.from(mc.querySelectorAll("*"));
        const savedChildStyles = childNodes.map(el => ({
          el,
          height: el.style.height,
          maxHeight: el.style.maxHeight,
          overflow: el.style.overflow,
          transform: el.style.transform,
          width: el.style.width,
          maxWidth: el.style.maxWidth
        }));

        const originalMcHeight = mc.style.height;
        const originalMcMaxHeight = mc.style.maxHeight;
        const originalMcOverflow = mc.style.overflow;
        const originalMcWidth = mc.style.width;
        const originalMcMaxWidth = mc.style.maxWidth;
        const originalMcTransform = mc.style.transform;

        // Force full height, width, and unclipped expansion on mc and all inner containers
        mc.style.setProperty("height", "auto", "important");
        mc.style.setProperty("max-height", "none", "important");
        mc.style.setProperty("overflow", "visible", "important");
        mc.style.setProperty("width", "auto", "important");
        mc.style.setProperty("max-width", "none", "important");
        mc.style.setProperty("transform", "none", "important");

        childNodes.forEach(el => {
          if (!el.classList.contains("mermaid-controls") && !el.closest(".mermaid-controls")) {
            el.style.setProperty("transform", "none", "important");
            el.style.setProperty("overflow", "visible", "important");
            if (el.tagName && el.tagName.toLowerCase() !== "svg") {
              el.style.setProperty("height", "auto", "important");
              el.style.setProperty("max-height", "none", "important");
              el.style.setProperty("width", "auto", "important");
              el.style.setProperty("max-width", "none", "important");
            }
          }
        });

        // If there's an SVG inside, calculate true getBBox dimensions + safety padding
        const svg = mc.querySelector("svg");
        let origSvgW = "";
        let origSvgH = "";
        let origSvgMinW = "";
        let origSvgMinH = "";
        let origSvgOverflow = "";

        if (svg) {
          origSvgW = svg.style.width;
          origSvgH = svg.style.height;
          origSvgMinW = svg.style.minWidth;
          origSvgMinH = svg.style.minHeight;
          origSvgOverflow = svg.style.overflow;

          let trueW = 0;
          let trueH = 0;

          try {
            const bbox = svg.getBBox();
            if (bbox && bbox.width > 0 && bbox.height > 0) {
              trueW = Math.ceil(bbox.width + Math.max(0, bbox.x) + 40);
              trueH = Math.ceil(bbox.height + Math.max(0, bbox.y) + 40);
            }
          } catch (e) {}

          if (!trueW || !trueH) {
            const viewBox = svg.getAttribute("viewBox");
            if (viewBox) {
              const parts = viewBox.split(/\s+/).map(parseFloat);
              if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
                trueW = Math.ceil(parts[2] + 40);
                trueH = Math.ceil(parts[3] + 40);
              }
            }
          }

          if (!trueW || !trueH) {
            const rect = svg.getBoundingClientRect();
            trueW = Math.ceil(rect.width + 40);
            trueH = Math.ceil(rect.height + 40);
          }

          if (trueW > 0 && trueH > 0) {
            svg.style.setProperty("width", `${trueW}px`, "important");
            svg.style.setProperty("height", `${trueH}px`, "important");
            svg.style.setProperty("min-width", `${trueW}px`, "important");
            svg.style.setProperty("min-height", `${trueH}px`, "important");
            svg.style.setProperty("overflow", "visible", "important");

            mc.style.setProperty("width", `${trueW + 30}px`, "important");
            mc.style.setProperty("height", `${trueH + 30}px`, "important");
            mc.style.setProperty("min-width", `${trueW + 30}px`, "important");
            mc.style.setProperty("min-height", `${trueH + 30}px`, "important");
            mc.style.setProperty("padding", "15px", "important");
            mc.style.setProperty("background", "#ffffff", "important");
          }
        }

        try {
          const canvas = await window.html2canvas(mc, {
            scale: 3, // High scale for crisp text and line art
            backgroundColor: "#ffffff",
            useCORS: true,
            allowTaint: true,
            logging: false,
            imageTimeout: 15000,
          });
          return canvas.toDataURL("image/png");
        } catch (err) {
          console.warn("[Clarity Export Debug] html2canvas live element capture failed, falling back:", err);
          return null;
        } finally {
          // Revert all temporary style changes cleanly
          mc.style.height = originalMcHeight;
          mc.style.maxHeight = originalMcMaxHeight;
          mc.style.overflow = originalMcOverflow;
          mc.style.width = originalMcWidth;
          mc.style.maxWidth = originalMcMaxWidth;
          mc.style.transform = originalMcTransform;

          savedChildStyles.forEach(item => {
            if (item.el && item.el.style) {
              item.el.style.height = item.height;
              item.el.style.maxHeight = item.maxHeight;
              item.el.style.overflow = item.overflow;
              item.el.style.transform = item.transform;
              item.el.style.width = item.width;
              item.el.style.maxWidth = item.maxWidth;
            }
          });

          if (svg) {
            svg.style.width = origSvgW;
            svg.style.height = origSvgH;
            svg.style.minWidth = origSvgMinW;
            svg.style.minHeight = origSvgMinH;
            svg.style.overflow = origSvgOverflow;
          }

          originalStyles.forEach(item => {
            if (item.el && item.el.style) {
              item.el.style.display = item.display;
            }
          });
        }
      };

      // Step 1: Pre-process messages & rasterize all live diagrams/visuals directly from current view
      const preparedMessages = [];

      for (let i = 0; i < rawMsgs.length; i++) {
        const origEl = rawMsgs[i];
        const isUser = origEl.classList.contains("message--user") || origEl.classList.contains("project-chat-msg--user") || origEl.getAttribute("data-role") === "user";

        // Target diagram/chart/interactive SVG elements inside the visible message, filtering out nested elements to prevent duplicated rasterizations
        let liveDiagrams = Array.from(origEl.querySelectorAll(".mermaid-container, pre.mermaid, .diagram-container, .recharts-wrapper, .chart-container, .d3-container"));
        liveDiagrams = liveDiagrams.filter(el => !liveDiagrams.some(other => other !== el && other.contains(el)));
        const rasterizedDiagrams = [];

        for (const mc of liveDiagrams) {
          let pngDataUrl = await captureElementToPng(mc);

          if (!pngDataUrl) {
            const svg = mc.querySelector("svg");
            if (svg) {
              pngDataUrl = await this._convertSvgToPngDataUrl(svg);
            }
          }

          if (pngDataUrl) {
            rasterizedDiagrams.push({ original: mc, pngDataUrl });
          }
        }

        // Clone the content body directly from screen
        let bodyClone = null;
        if (origEl.classList.contains("project-chat-msg")) {
          if (isUser) {
            const raw = origEl.getAttribute("data-raw") || origEl.textContent.trim();
            const p = document.createElement("p");
            p.textContent = raw;
            p.style.cssText = "margin:0; font-size:12.5px; line-height:1.6;";
            bodyClone = document.createElement("div");
            bodyClone.appendChild(p);
          } else {
            bodyClone = origEl.cloneNode(true);
            bodyClone.querySelectorAll(".file-jump-link").forEach(link => {
              const span = document.createElement("span");
              span.textContent = link.textContent;
              span.style.cssText = "color:var(--primary); font-weight:600;";
              link.replaceWith(span);
            });
          }
        } else {
          const innerBody = origEl.querySelector(".message__content") || origEl.querySelector(".message__bubble") || origEl;
          bodyClone = innerBody.cloneNode(true);
        }

        // Strip UI actions, copy/speak buttons, action bars
        bodyClone.querySelectorAll("button, .spinner, .message__controls, .message__status, .dropdown, .dropdown-menu, .explanation-badge, .copy-btn, .speaker-btn, .msg__actions, form, .mermaid-controls, .mermaid-fullscreen-header, .m-fullscreen-btn, .review-changes-btn, .apply-all-artifacts-btn, .download-all-artifacts-btn, .proj-att-remove, .code-cell__btn, .code-copy-btn, .code-cell__header div").forEach(el => el.remove());

        // Transform attachment-file-card containing images into full high-resolution images for the PDF
        bodyClone.querySelectorAll(".attachment-file-card").forEach(card => {
          const img = card.querySelector(".attachment-preview-img");
          if (img) {
            const newImg = document.createElement("img");
            newImg.src = img.src;
            newImg.alt = img.alt || "Uploaded Image";
            newImg.className = "preview-image";
            newImg.style.cssText = "max-width:100% !important; max-height:550px !important; height:auto !important; width:auto !important; object-fit:contain !important; border-radius:8px !important; box-shadow:0 4px 12px rgba(0,0,0,0.08) !important; display:block !important; margin:12px auto !important; page-break-inside:avoid !important; break-inside:avoid !important;";
            card.replaceWith(newImg);
          }
        });

        // Make sure all standard images inside the body fit perfectly in the PDF bounds and never overflow
        bodyClone.querySelectorAll("img").forEach(img => {
          if (!img.classList.contains("user-menu__avatar") && !img.closest(".pdf-diagram-wrapper")) {
            img.style.setProperty("max-width", "100%", "important");
            img.style.setProperty("max-height", "550px", "important");
            img.style.setProperty("width", "auto", "important");
            img.style.setProperty("height", "auto", "important");
            img.style.setProperty("object-fit", "contain", "important");
            img.style.setProperty("border-radius", "8px", "important");
            img.style.setProperty("display", "block", "important");
            img.style.setProperty("margin", "12px auto", "important");
            img.style.setProperty("box-shadow", "0 4px 12px rgba(0,0,0,0.08)", "important");
            img.style.setProperty("page-break-inside", "avoid", "important");
            img.style.setProperty("break-inside", "avoid", "important");
          }
        });

        // Process standard inline SVG icons and Lucide icons to align perfectly
        bodyClone.querySelectorAll("svg").forEach(svg => {
          if (svg.closest(".pdf-diagram-wrapper") || svg.classList.contains("mermaid-viewport") || svg.id?.startsWith("mermaid_") || svg.closest(".diagram-container") || svg.closest(".recharts-wrapper")) {
            return;
          }

          let w = 16;
          let h = 16;

          const classes = Array.from(svg.classList || []);
          classes.forEach(c => {
            if (c === "w-3") { w = 12; }
            else if (c === "w-3.5") { w = 14; }
            else if (c === "w-4") { w = 16; }
            else if (c === "w-4.5") { w = 18; }
            else if (c === "w-5") { w = 20; }
            else if (c === "w-6") { w = 24; }
            else if (c === "w-7") { w = 28; }
            else if (c === "w-8") { w = 32; }
            else if (c === "h-3") { h = 12; }
            else if (c === "h-3.5") { h = 14; }
            else if (c === "h-4") { h = 16; }
            else if (c === "h-4.5") { h = 18; }
            else if (c === "h-5") { h = 20; }
            else if (c === "h-6") { h = 24; }
            else if (c === "h-7") { h = 28; }
            else if (c === "h-8") { h = 32; }
          });

          const attrW = svg.getAttribute("width");
          const attrH = svg.getAttribute("height");
          if (attrW && !attrW.includes("%") && attrW !== "auto") w = parseInt(attrW) || w;
          if (attrH && !attrH.includes("%") && attrH !== "auto") h = parseInt(attrH) || h;

          let color = svg.getAttribute("stroke") || svg.getAttribute("fill") || (isUser ? "#4f46e5" : "#0f172a");

          svg.style.display = "inline-block";
          svg.style.verticalAlign = "middle";
          svg.style.width = `${w}px`;
          svg.style.height = `${h}px`;
          if (!svg.style.color && color) {
            svg.style.color = color;
          }
          svg.setAttribute("width", `${w}`);
          svg.setAttribute("height", `${h}`);
        });

        // Replace diagram containers with captured pixel-perfect images, filtering out nested duplicate diagram nodes
        let cloneDiagramList = Array.from(bodyClone.querySelectorAll(".mermaid-container, pre.mermaid, .diagram-container, .recharts-wrapper, .chart-container, .d3-container"));
        cloneDiagramList = cloneDiagramList.filter(el => !cloneDiagramList.some(other => other !== el && other.contains(el)));
        cloneDiagramList.forEach((cloneMc, idx) => {
          const match = rasterizedDiagrams[idx];
          const originalMc = liveDiagrams[idx];
          const wrapper = document.createElement("div");
          wrapper.className = "pdf-diagram-wrapper";
          wrapper.style.cssText = "width:100% !important; margin:14px 0 !important; text-align:center !important; box-sizing:border-box !important; page-break-inside:avoid !important; break-inside:avoid !important;";

          if (match && match.pngDataUrl) {
            const img = document.createElement("img");
            img.src = match.pngDataUrl;
            img.style.cssText = "max-width:100% !important; width:auto !important; height:auto !important; max-height:750px !important; object-fit:contain !important; border-radius:8px !important; border:1px solid #e2e8f0 !important; background:#ffffff !important; display:block !important; margin:12px auto !important; padding:6px !important; box-sizing:border-box !important; box-shadow:0 1px 3px rgba(0,0,0,0.05) !important; page-break-inside:avoid !important; break-inside:avoid !important;";
            img.alt = "Clarity Diagram";
            wrapper.appendChild(img);
          } else {
            const svgInClone = cloneMc.querySelector("svg");
            if (svgInClone) {
              svgInClone.style.maxWidth = "100%";
              svgInClone.style.width = "auto";
              svgInClone.style.height = "auto";
              svgInClone.style.display = "block";
              svgInClone.style.margin = "10px auto";
              wrapper.appendChild(svgInClone);
            }
          }
          cloneMc.replaceWith(wrapper);
        });

        // Parse top-level blocks from the body
        let blocks = [];
        if (bodyClone.children.length === 0) {
          const p = document.createElement("p");
          p.innerHTML = bodyClone.innerHTML;
          p.className = bodyClone.className;
          blocks.push(p);
        } else {
          blocks = Array.from(bodyClone.children);
        }

        preparedMessages.push({ isUser, blocks });
      }

      // Ensure all cloned images are fully loaded and have correct aspect ratios before starting calculations
      const allClonedImages = [];
      preparedMessages.forEach(msg => {
        msg.blocks.forEach(block => {
          if (block.tagName === "IMG") {
            allClonedImages.push(block);
          }
          block.querySelectorAll("img").forEach(img => allClonedImages.push(img));
        });
      });

      await Promise.all(allClonedImages.map(img => {
        if (img.complete && img.naturalWidth > 0) {
          img.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
          return Promise.resolve();
        }
        return new Promise(resolve => {
          img.onload = () => {
            img.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
            resolve();
          };
          img.onerror = resolve;
        });
      }));

      // Create a pixel-perfect wrapping container for card measurement to ensure wrapped sizes match final output exactly
      const testHost = document.createElement("div");
      testHost.style.cssText = "width:746px !important; min-width:746px !important; max-width:746px !important; box-sizing:border-box !important; padding:0 !important; margin:0 !important; border:none !important; background:transparent !important;";
      measurer.appendChild(testHost);

      function createNewPdfPage(pageNum) {
        const page = document.createElement("div");
        page.className = "pdf-page";
        page.style.cssText = [
          "width: 794px !important",
          "min-width: 794px !important",
          "max-width: 794px !important",
          "height: 1115px !important", // Slightly smaller than 1122.5px to completely prevent subpixel pagebreak loops
          "min-height: 1115px !important",
          "max-height: 1115px !important",
          "overflow: hidden !important",
          "box-sizing: border-box !important",
          "padding: 24px !important",
          "background: #ffffff !important",
          "display: flex !important",
          "flex-direction: column !important",
          "position: relative !important",
          "break-after: page !important",
          "page-break-after: always !important"
        ].join(";");

        const topSection = document.createElement("div");
        topSection.className = "pdf-page-top";
        topSection.style.cssText = "width: 100% !important; box-sizing: border-box !important;";

        if (pageNum === 1) {
          topSection.innerHTML = `
            <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 14px; width: 100%; box-sizing: border-box;">
              <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                <div>
                  <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Clarity Knowledge Report</h1>
                  <p style="margin: 3px 0 0 0; font-size: 11.5px; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${projectName ? 'Project: ' + escapeHtml(projectName) + ' • ' : ''}Exported on ${dateStr}</p>
                </div>
                <div style="font-size: 11.5px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #4f46e5;"></span> Clarity AI
                </div>
              </div>
            </div>
          `;
        } else {
          topSection.innerHTML = `
            <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 7px; margin-bottom: 12px; width: 100%; box-sizing: border-box; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <span><strong>Clarity AI</strong> &bull; ${projectName ? escapeHtml(projectName) + ' &bull; ' : ''}Knowledge Report</span>
              <span>${dateStr}</span>
            </div>
          `;
        }

        const contentArea = document.createElement("div");
        contentArea.className = "pdf-page-content";
        contentArea.style.cssText = "width: 100% !important; flex: 1 !important; display: flex !important; flex-direction: column !important; gap: 10px !important; overflow: hidden !important; box-sizing: border-box !important;";

        const footer = document.createElement("div");
        footer.className = "pdf-page-footer";
        footer.style.cssText = "border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 10px; width: 100%; box-sizing: border-box; display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;";
        footer.innerHTML = `
          <span>Confidential &bull; Generated by Clarity Knowledge Engine</span>
          <span class="pdf-page-number">Page ${pageNum}</span>
        `;

        page.appendChild(topSection);
        page.appendChild(contentArea);
        page.appendChild(footer);

        return { page, contentArea, pageNum };
      }

      function createMessageCard(isUser, isContinuation = false) {
        const card = document.createElement("div");
        card.className = "pdf-message-card";
        card.style.cssText = [
          "width: 100% !important",
          "box-sizing: border-box !important",
          "padding: 14px 18px !important",
          "border-radius: 8px !important",
          "overflow: hidden !important",
          isUser
            ? "background: #f8fafc !important; border: 1px solid #e2e8f0 !important;"
            : "background: #ffffff !important; border: 1px solid #e2e8f0 !important;"
        ].join(";");

        const senderBadge = document.createElement("div");
        senderBadge.style.cssText = `display:flex; align-items:center; gap:8px; margin-bottom:10px; font-size:12px; font-weight:700; color:#1e293b; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;`;
        const continuationText = isContinuation ? ' <span style="font-size:11px; font-weight:400; color:#64748b;">(continued)</span>' : '';
        senderBadge.innerHTML = `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${isUser ? '#64748b' : '#4f46e5'};"></span> ${isUser ? 'You' : 'Clarity AI'}${continuationText}`;
        card.appendChild(senderBadge);

        const body = document.createElement("div");
        body.className = "pdf-message-body";
        body.style.cssText = "width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px;";
        card.appendChild(body);

        return { card, body };
      }

      function measureCardHeightWithBlocks(isUser, existingBlocks, newBlock) {
        const cardObj = createMessageCard(isUser, existingBlocks.length > 0);
        existingBlocks.forEach(b => cardObj.body.appendChild(b.cloneNode(true)));
        if (newBlock) {
          cardObj.body.appendChild(newBlock.cloneNode(true));
        }

        testHost.innerHTML = "";
        testHost.appendChild(cardObj.card);
        const h = cardObj.card.getBoundingClientRect().height || cardObj.card.offsetHeight || 50;
        testHost.innerHTML = "";
        return h;
      }

      // Step 2: Accurate Page Pagination and Card Splitting
      const pages = [];
      let currentPageObj = createNewPdfPage(1);
      pages.push(currentPageObj);

      let completedCardHeights = [];
      let currentCardBlocks = [];

      for (let mIdx = 0; mIdx < preparedMessages.length; mIdx++) {
        const msg = preparedMessages[mIdx];
        const isUser = msg.isUser;
        const blocks = msg.blocks;

        currentCardBlocks = [];

        for (let bIdx = 0; bIdx < blocks.length; bIdx++) {
          const block = blocks[bIdx];

          // Measure potential height with the new block added
          const potentialCardHeight = measureCardHeightWithBlocks(isUser, currentCardBlocks, block);

          // Calculate page layout occupied heights
          const totalCompletedHeight = completedCardHeights.reduce((a, b) => a + b, 0);
          const gapsCount = completedCardHeights.length;
          const totalHeightWithCurrentCard = totalCompletedHeight + (gapsCount * 10) + potentialCardHeight;

          // Slightly less than page height to allow safe padding margins
          const maxPageContentHeight = pages.length === 1 ? 800 : 840;

          if (totalHeightWithCurrentCard <= maxPageContentHeight) {
            currentCardBlocks.push(block);
          } else {
            // Push to new page
            if (currentCardBlocks.length > 0) {
              const finalCardHeight = measureCardHeightWithBlocks(isUser, currentCardBlocks, null);
              const cardObj = createMessageCard(isUser, false);
              currentCardBlocks.forEach(b => cardObj.body.appendChild(b));
              currentPageObj.contentArea.appendChild(cardObj.card);
              completedCardHeights.push(finalCardHeight);

              currentPageObj = createNewPdfPage(pages.length + 1);
              pages.push(currentPageObj);
              completedCardHeights = [];

              currentCardBlocks = [block];
            } else {
              if (completedCardHeights.length > 0) {
                currentPageObj = createNewPdfPage(pages.length + 1);
                pages.push(currentPageObj);
                completedCardHeights = [];
                currentCardBlocks = [block];
              } else {
                // Already on fresh empty page; force it to fit
                currentCardBlocks.push(block);
              }
            }
          }
        }

        // Finalize remaining blocks for message
        if (currentCardBlocks.length > 0) {
          const finalCardHeight = measureCardHeightWithBlocks(isUser, currentCardBlocks, null);
          const cardObj = createMessageCard(isUser, false);
          currentCardBlocks.forEach(b => cardObj.body.appendChild(b));
          currentPageObj.contentArea.appendChild(cardObj.card);
          completedCardHeights.push(finalCardHeight);
        }
      }

      // Step 3: Populate pages to wrapper layout
      const wrapper = document.createElement("div");
      wrapper.id = "clarity-pdf-export-wrapper";
      wrapper.style.cssText = "width:794px !important; min-width:794px !important; max-width:794px !important; margin:0 !important; padding:0 !important; background:#ffffff !important; box-sizing:border-box !important;";

      const totalPages = pages.length;
      pages.forEach((pObj, idx) => {
        const pageNum = idx + 1;
        const numEl = pObj.page.querySelector(".pdf-page-number");
        if (numEl) numEl.textContent = `Page ${pageNum} of ${totalPages}`;

        // Turn off forced pagebreaks on the very last page to prevent blank trailing pages
        if (pageNum === totalPages) {
          pObj.page.style.setProperty("break-after", "avoid", "important");
          pObj.page.style.setProperty("page-break-after", "avoid", "important");
        }
        wrapper.appendChild(pObj.page);
      });

      host.appendChild(wrapper);
      document.body.appendChild(host);

      measurer.remove();

      if (document.fonts && typeof document.fonts.ready !== "undefined") {
        await document.fonts.ready;
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      }

      // Step 4: Run html2pdf render pipeline
      const safeName = (projectName || "Clarity").replace(/[^a-zA-Z0-9_-]/g, '_') + "_report_" + now.toISOString().split('T')[0] + ".pdf";

      const opt = {
        margin: 0,
        filename: safeName,
        image: { type: 'png' },
        html2canvas: {
          scale: 3,
          useCORS: true,
          allowTaint: true,
          letterRendering: true,
          logging: false,
          width: 794,
          windowWidth: 794,
          scrollX: 0,
          scrollY: 0,
          x: 0,
          y: 0
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait',
          compress: true
        },
        pagebreak: { mode: 'css' }
      };

      // Ensure absolutely only one generation run for file saving to prevent state corruption blank pages
      await window.html2pdf().set(opt).from(wrapper).save();

      if (window.Clarity && window.Clarity.toast) {
        window.Clarity.toast.show("Export successful", "success");
      }

      // Save PDF as an artifact to project context if available
      const pId = options.projectId || window.Clarity?.state?.activeConversation?.project_id;
      if (pId && window.Clarity?.api?.request) {
        try {
          // Generate artifact string using a separate html2pdf instance
          const dataUriWorker = window.html2pdf().set(opt).from(wrapper);
          const pdfDataUri = await dataUriWorker.outputPdf('datauristring');
          const base64Data = pdfDataUri ? pdfDataUri.split(',')[1] : null;
          if (base64Data) {
            await window.Clarity.api.request('/api/projects/' + pId + '/artifacts', {
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
              window.renderProjectArtifactsTab(document.getElementById('projectArtifactsGrid').parentElement, pId);
            }
          }
        } catch (_) {}
      }

    } catch (err) {
      console.error("PDF Export error:", err);
      if (window.Clarity && window.Clarity.toast) {
        window.Clarity.toast.show("Couldn't export the chat. Please try again.", "error");
      }
    } finally {
      if (document.body.contains(loadingModal)) loadingModal.remove();
      if (document.body.contains(host)) host.remove();
      if (document.body.contains(measurer)) measurer.remove();
    }
  },

  _bindMainChatExportMenu() {
    const exportBtn = document.getElementById("mainChatExportMenuBtn");
    const exportDropdown = document.getElementById("mainChatExportDropdown");
    const exportPdfBtn = document.getElementById("mainChatExportPdfBtn");
    const exportCancelBtn = document.getElementById("mainChatExportCancelBtn");

    if (exportBtn && exportDropdown) {
      exportBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        exportDropdown.style.display = exportDropdown.style.display === "none" ? "block" : "none";
      });

      if (!this._exportListenersBound) {
        document.addEventListener("click", (e) => {
          const drop = document.getElementById("mainChatExportDropdown");
          const btn = document.getElementById("mainChatExportMenuBtn");
          if (btn && drop && drop.style.display === "block" && !btn.contains(e.target) && !drop.contains(e.target)) {
            drop.style.display = "none";
          }
        });
        document.addEventListener("keydown", (e) => {
          const drop = document.getElementById("mainChatExportDropdown");
          if (e.key === "Escape" && drop && drop.style.display === "block") {
            drop.style.display = "none";
          }
        });
        this._exportListenersBound = true;
      }

      exportCancelBtn?.addEventListener("click", () => {
        exportDropdown.style.display = "none";
      });

      exportPdfBtn?.addEventListener("click", async () => {
        exportDropdown.style.display = "none";
        await this.exportChatToPdf({ feed: document.getElementById("conversationList") });
      });
    }
  },

  _bindSuggestionChips() {
    document.querySelectorAll("[data-suggestion]").forEach(chip => {
      chip.addEventListener("click", () => {
        const text = chip.getAttribute("data-suggestion");
        const input = document.getElementById("composerInput");
        if (input) {
          input.value = text;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.focus();

          // Optionally auto-send
          const sendBtn = document.getElementById("composerSend");
          if (sendBtn) {
              sendBtn.disabled = false;
              sendBtn.click();
          }
        }
      });
    });
  },

  async _bindChatHeaderMenu() {
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
    if (!container._menuListenersBound) {
        document.addEventListener("click", (e) => {
           const cont = document.getElementById("mainExportContainer");
           const drop = document.getElementById("exportChatMainDropdown");
           if (cont && drop && drop.style.display === "block" && !cont.contains(e.target)) {
               drop.style.display = "none";
           }
        });
        document.addEventListener("keydown", (e) => {
           const drop = document.getElementById("exportChatMainDropdown");
           if (e.key === "Escape" && drop && drop.style.display === "block") {
               drop.style.display = "none";
           }
        });
        container._menuListenersBound = true;
    }

    pdfBtn.onclick = async () => {
       dropdown.style.display = "none";
       await this.exportChatToPdf({
         feed: document.getElementById("conversationList") || document.getElementById("projectChatFeed")
       });
    };
  },

  _renderChatHtml(messages) {
    const isEmpty = !messages || messages.length === 0;
    const parts = ['<div class="chat-shell">'];
    parts.push('<section class="chat-panel">');
    parts.push(`
      <div id="mainChatExportContainer" style="position: absolute; top: 18px; right: 20px; z-index: 100; ${isEmpty ? 'display:none;' : ''}">
        <div style="position: relative;">
          <button class="btn btn--icon-sm btn--ghost" id="mainChatExportMenuBtn" title="More options" aria-label="More options">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="1.5"></circle>
              <circle cx="12" cy="6" r="1.5"></circle>
              <circle cx="12" cy="18" r="1.5"></circle>
            </svg>
          </button>
          <div id="mainChatExportDropdown" class="dropdown-menu" style="display:none; position:absolute; right:0; top:calc(100% + 4px); background:var(--surface); border:1px solid var(--line); border-radius:var(--r-md); box-shadow:var(--shadow-float); z-index:100; min-width:140px; padding:4px;">
            <div style="padding:6px 10px; font-size:11px; font-weight:600; color:var(--ink-muted); text-transform:uppercase; border-bottom:1px solid var(--line); margin-bottom:4px;">Chat options</div>
            <button class="dropdown-item" id="mainChatExportPdfBtn" style="width:100%; text-align:left; padding:8px 10px; background:transparent; border:none; color:var(--ink); font-size:13px; cursor:pointer; border-radius:var(--r-sm); display:flex; align-items:center; gap:6px;">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span>Export as PDF</span>
            </button>
            <button class="dropdown-item" id="mainChatExportCancelBtn" style="width:100%; text-align:left; padding:8px 10px; background:transparent; border:none; color:var(--ink-muted); font-size:13px; cursor:pointer; border-radius:var(--r-sm);">Cancel</button>
          </div>
        </div>
      </div>
    `);

    parts.push('<div class="conversation' + (isEmpty ? ' conversation--empty' : '') + '" id="conversationList">');
    if (isEmpty) {
      parts.push(this._renderEmptyState());
    } else {
      for (const msg of messages) {
        parts.push(this._renderMessage(msg));
      }
    }
    parts.push('</div>');
    parts.push('<div class="composer-outer"><div class="composer chat-composer" id="chatComposer"></div></div>');
    parts.push('</section>');
    parts.push('<aside class="preview-panel" id="filePreviewPanel" hidden></aside>');
    parts.push('</div>');
    return parts.join("");
  },

  _renderEmptyState() {
    let projName = "";
    let hasProj = false;
    let projId = "";

    let hasRag = false;
    let hasArch = false;
    let hasViva = false;
    let hasSecurity = false;

    const conv = window.Clarity?.state?.activeConversation;
    if (conv && conv.project_id) {
        projId = conv.project_id;
        const proj = window.Clarity?.state?.projects?.find(p => p.id === projId);
        if (proj) {
            projName = proj.name;
            hasProj = true;

            const analysis = window.Clarity?.state?.projectAnalyses?.[projId];
            if (analysis) {
                if (analysis.architecture && analysis.architecture.length > 0) hasArch = true;
                if (analysis.viva && analysis.viva.length > 0) hasViva = true;
                if (analysis.security && analysis.security.issues) hasSecurity = true;
                if (analysis.ragStatus === "indexed" || true) hasRag = true; // Assume RAG might be available or check actual status if known
            }
        }
    }

    const title = hasProj ? `What are you working on in ${window.Clarity.utils.escapeHtml(projName)}?` : 'What are you working on?';
    const sub = hasProj ? 'Ask me about your project, code, architecture, knowledge, or anything you\'re building.' : 'Ask me anything to get started.';

    let suggestionsHtml = '';
    if (hasProj) {
       suggestionsHtml += `<div class="chat-empty__suggestions" style="display:flex; flex-wrap:wrap; justify-content:center; gap:8px; margin-top:24px; max-width:600px; margin-left:auto; margin-right:auto;">`;
       suggestionsHtml += `<button class="btn btn--outline btn--sm" data-suggestion="Explain my project">Explain my project</button>`;
       if (hasArch) suggestionsHtml += `<button class="btn btn--outline btn--sm" data-suggestion="Explain the system architecture">Explain the system architecture</button>`;
       if (hasRag) suggestionsHtml += `<button class="btn btn--outline btn--sm" data-suggestion="Search my project knowledge">Search my project knowledge</button>`;
       if (hasSecurity) suggestionsHtml += `<button class="btn btn--outline btn--sm" data-suggestion="Check my project's security">Check my project's security</button>`;
       if (hasViva) suggestionsHtml += `<button class="btn btn--outline btn--sm" data-suggestion="Prepare me for the viva">Prepare me for the viva</button>`;
       suggestionsHtml += `</div>`;
    } else {
       suggestionsHtml = `
         <div class="chat-empty__suggestions" style="display:flex; flex-wrap:wrap; justify-content:center; gap:8px; margin-top:24px; max-width:600px; margin-left:auto; margin-right:auto;">
           <button class="btn btn--outline btn--sm" data-suggestion="Help me brainstorm an idea">Help me brainstorm an idea</button>
           <button class="btn btn--outline btn--sm" data-suggestion="Explain a complex topic">Explain a complex topic</button>
           <button class="btn btn--outline btn--sm" data-suggestion="Write a script for me">Write a script for me</button>
         </div>
       `;
    }

    return [
      '<div class="chat-empty" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; padding:20px; text-align:center;">',
      '<div class="chat-empty__inner" style="animation: fade-in 0.4s ease-out forwards;">',
            '<div class="clarity-robot" id="clarityRobot" data-state="idle">',
      '  <div class="clarity-robot__ring"></div>',
      '  <img src="/robot_asset.svg" class="clarity-robot__img" alt="Clarity Robot" />',
      '</div>',
      '<h1 class="chat-empty__title" style="font-size:28px; font-weight:700; color:var(--ink); margin-bottom:12px; letter-spacing:-0.02em;">' + title + '</h1>',
      '<p class="chat-empty__sub" style="font-size:15px; color:var(--ink-muted); max-width:480px; margin:0 auto; line-height:1.5;">' + sub + '</p>',
      suggestionsHtml,
      '</div>',
      '</div>',

    ].join("");
  },

  _renderMessage(msg) {
    const role = msg.role === "user" ? "user" : "assistant";
    const isStreaming = msg.streaming;
    const isError = msg.error;
    const isEmpty = role === "assistant" && !msg.content && !isStreaming;
    const bubbleClass = role === "assistant"
      ? (isError ? "message--assistant message--error" : "message--assistant")
      : "message--user";

    const isCodeExplanation = role === "assistant" && (
      msg.intent === "CODE_EXPLANATION" ||
      msg.intent === "code_explanation" ||
      msg.intent_type === "code_explanation" ||
      (msg.content && String(msg.content).includes("### What this file does"))
    );

    let contentHtml;
    if (isEmpty) {
      contentHtml = '<div class="message__content message__content--empty">No response generated.</div>';
    } else {
      try {
        const rawContent = String(msg.content || "");
        const rendered = window.Clarity.markdown.render(rawContent);
        if (isCodeExplanation) {
          contentHtml = `
            <div class="message__content message__content--code-explanation markdown-body">
              <div class="explanation-badge">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <span>Code Explanation</span>
              </div>
              <div class="explanation-body">${rendered}</div>
            </div>
          `;
        } else {
          contentHtml = '<div class="message__content">' + rendered + "</div>";
        }
        setTimeout(() => {
          if (window.Clarity && window.Clarity.renderMermaid) {
            window.Clarity.renderMermaid();
          }
        }, 50);
      } catch (e) {
        contentHtml = '<div class="message__content"><p class="error-text">Failed to render message.</p></div>';
      }
    }

    const attachmentsHtml = msg.attachments && msg.attachments.length
      ? '<div class="attachments">' + msg.attachments.map(att => {
          if (att.file_id || att.id) {
            return this._renderFileAttachment(att);
          }
          return this._renderAttachment(att);
        }).join("") + "</div>"
      : "";

    const artifactsCount = (msg.artifacts && !isCodeExplanation) ? msg.artifacts.length : 0;
    let artifactsHtml = "";
    if (artifactsCount > 0) {
      const artIds = msg.artifacts.map(a => a.id).filter(Boolean).join(",");
      const hasCode = msg.artifacts.some(a => a.category === "code" || (!a.bufferBase64 && a.content));
      const batchHeader = `
        <div class="artifacts-batch-header" style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--surface-subtle, #f8fafc); border: 1px solid var(--line); border-radius: 10px; margin: 12px 0 8px; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 600; font-size: 13px; color: var(--ink); display: flex; align-items: center; gap: 6px;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
              Generated Files (${artifactsCount})
            </span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
            <button type="button" class="btn btn--sm btn--outline download-all-artifacts-btn" data-art-ids="${artIds}" style="font-size: 12px; display: inline-flex; align-items: center; gap: 5px;">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download All (.zip)
            </button>
            ${hasCode ? `
              <button type="button" class="btn btn--sm btn--ghost apply-all-artifacts-btn" data-art-ids="${artIds}" style="font-size: 12px; display: inline-flex; align-items: center; gap: 5px; color: var(--accent);">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                Apply All to Workspace
              </button>
            ` : ""}
          </div>
        </div>
      `;

      artifactsHtml = '<div class="message__artifacts">' +
        batchHeader +
        msg.artifacts.map(art => {
          return window.Clarity.artifact && window.Clarity.artifact.renderCard
            ? window.Clarity.artifact.renderCard(art)
            : "";
        }).join("") + '</div>';
    }

    const controls = role === "assistant" ? this._renderAssistantControls(msg, isStreaming, isError) : this._renderUserControls(msg);
    const statusDot = isStreaming ? '<div class="message__status status--streaming"></div>' : "";

    if (role === "user") {
      return `<div class="message ${bubbleClass}" data-msg-id="${msg.id || ""}">
        <div class="message__row">
          <div class="message__body">
            <div class="message__bubble">
              ${contentHtml}
              ${attachmentsHtml}
              ${artifactsHtml}
            </div>
            ${controls}
          </div>
        </div>
      </div>`;
    }

    return `<div class="message ${bubbleClass}" data-msg-id="${msg.id || ""}">
      <div class="message__row">
        <div class="message__body">
          <div class="message__bubble">
            ${statusDot}
            ${contentHtml}
            ${attachmentsHtml}
            ${artifactsHtml}
          </div>
          ${controls}
        </div>
      </div>
    </div>`;
  },

  _renderAssistantControls(msg, isStreaming, isError) {
    if (isStreaming) {
      return `<div class="message__controls"><button class="message-control message-control--icon" data-action="stop" type="button" title="Stop generation" aria-label="Stop generation">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
      </button></div>`;
    }
    if (isError) {
      return `<div class="message__controls message__controls--error">
        <button class="message-control message-control--icon" data-action="regenerate" type="button" title="Regenerate response" aria-label="Regenerate response">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
        </button>
        <button class="message-control message-control--icon" data-action="change-model" type="button" title="Change model" aria-label="Change model">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
        </button>
      </div>`;
    }
    const buttons = [
      `<button class="message-control message-control--icon" data-action="copy" type="button" title="Copy response" aria-label="Copy response">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
      </button>`,
      `<button class="message-control message-control--icon" data-action="regenerate" type="button" title="Regenerate response" aria-label="Regenerate response">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
      </button>`,
    ];
    return `<div class="message__controls">${buttons.join("")}</div>`;
  },

  _renderUserControls(msg) {
    if (!msg.id || msg.streaming) return "";
    const buttons = [
      `<button class="message-control message-control--icon" data-action="edit" type="button" title="Edit message" aria-label="Edit message">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
      </button>`,
      `<button class="message-control message-control--icon" data-action="copy" type="button" title="Copy message" aria-label="Copy message">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
      </button>`,
    ];
    return `<div class="message__controls">${buttons.join("")}</div>`;
  },

  _controlBtn(action, label, icon) {
    return `<button class="message-control" data-action="${action}" type="button" title="${label}" aria-label="${label}"></button>`;
  },

  _renderAttachment(att) {
    const isImg = att.type === "image";
    const body = isImg
      ? '<img src="' + (att.url || "") + '" alt="' + (att.name || "attachment") + '" class="attachment-preview" />'
      : '<div class="attachment-file"><svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg><span>' + (att.name || "file") + '</span></div>';
    return `<div class="attachment ${isImg ? "attachment-image" : "attachment-file"}">${body}</div>`;
  },

  _renderFileAttachment(att) {
    const name = att.name || "file";
    const fileId = att.file_id || att.id;
    const isPdf = att.type === "pdf" || (att.mime && att.mime.includes("pdf")) || /\.pdf$/i.test(name);
    const isImage = att.type === "image" || (att.mime && att.mime.startsWith("image/"));
    const icon = isImage
      ? '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>'
      : (isPdf
        ? '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>'
        : '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>');

    const previewHtml = isImage
      ? '<img src="/api/files/' + fileId + '/raw" alt="' + name + '" class="attachment-preview-img" />'
      : '';

    return [
      '<div class="attachment-file-card" data-file-id="' + fileId + '">',
        '<div class="attachment-file-card__icon">' + icon + '</div>',
        '<div class="attachment-file-card__info">',
          '<div class="attachment-file-card__name">' + window.Clarity.utils.escapeHtml(name) + '</div>',
          previewHtml,
        '</div>',
        '<div class="attachment-file-card__actions">',
          '<button type="button" class="btn btn--ghost btn--sm file-preview-btn" data-file-id="' + fileId + '" data-file-name="' + window.Clarity.utils.escapeHtml(name) + '" title="Preview">',
            '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 6v6l4 2"/></svg>',
            ' Preview',
          '</button>',
          '<a href="/api/files/' + fileId + '/raw" download="' + name + '" class="btn btn--ghost btn--sm" title="Download">',
            '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
            ' Download',
          '</a>',
        '</div>',
      '</div>'
    ].join("");
  },

  _updateNewChatButton() {
    const btn = document.getElementById("newChatBtn");
    if (btn) {
      btn.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span class="btn__text">New Chat</span>';
      btn.onclick = () => {
        if (this._isStreaming) {
          this._stopStreaming();
          return;
        }
        this.startNewConversation();
      };
    }
  },

  _updateComposer() {
    const container = document.getElementById("chatComposer");
    if (!container) return;
    this._attachedFiles = (this._attachedFiles || []).filter(a => a && a.id);
    window.Clarity.composer.mount(container, (value, attachments, think) => {
      this._attachedFiles = attachments || [];
      this.sendMessage(value, this._attachedFiles, undefined, think);
    }, this._resolveModelId(), this._attachedFiles);
    window.Clarity.composer.setStreaming(this._isStreaming, () => this._stopStreaming());
  },

  _openFilePreview(att) {
    this._previewFile = att;
    this._isPreviewOpen = true;
    this._renderPreviewPanel();
  },

  _closeFilePreview() {
    this._previewFile = null;
    this._isPreviewOpen = false;
    const previewPanel = document.getElementById("filePreviewPanel");
    if (previewPanel) previewPanel.hidden = true;
    document.body.classList.remove("has-preview");
  },

  _renderPreviewPanel() {
    if (!this._previewFile) return;
    const att = this._previewFile;
    const fileName = att.name || "file";
    const fileId = att.file_id;
    const isImage = att.mime && att.mime.startsWith("image/");

    let contentHtml = "";
    if (isImage) {
      contentHtml = '<img src="/api/files/' + fileId + '/raw" alt="' + window.Clarity.utils.escapeHtml(fileName) + '" class="preview-image" />';
    } else {
      contentHtml = this._buildCodePreview(fileId, fileName, att.content || "");
    }

    const panel = document.getElementById("filePreviewPanel");
    if (!panel) return;

    const icon = isImage
      ? '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>'
      : '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';

    panel.innerHTML = [
      '<div class="preview-header">',
        '<div class="preview-header__info">',
          '<span class="preview-header__icon">' + icon + '</span>',
          '<span class="preview-header__name">' + window.Clarity.utils.escapeHtml(fileName) + '</span>',
          '<span class="preview-header__meta">Python File • 2.1 KB</span>',
        '</div>',
        '<div class="preview-header__actions">',
          '<a href="/api/files/' + fileId + '/raw" download="' + window.Clarity.utils.escapeHtml(fileName) + '" class="btn btn--ghost btn--sm" title="Download">Download</a>',
          '<button class="btn btn--ghost btn--icon-sm" type="button" id="previewCloseBtn" title="Close preview" aria-label="Close preview">',
            '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
          '</button>',
        '</div>',
      '</div>',
      '<div class="preview-body">',
        '<div class="preview-code-wrapper">',
          contentHtml,
        '</div>',
      '</div>',
    ].join("");

    panel.hidden = false;
    document.body.classList.add("has-preview");

    document.getElementById("previewCloseBtn")?.addEventListener("click", () => this._closeFilePreview());
  },

  _buildCodePreview(fileId, fileName, content) {
    // Try to fetch file content from server
    let codeContent = content;
    // If content not passed directly, we rely on fetched data; for now use what we have
    const ext = (fileName || "").split(".").pop() || "txt";
    const langMap = {
      "py": "python", "js": "javascript", "jsx": "javascript",
      "ts": "typescript", "tsx": "typescript",
      "json": "json", "html": "html", "css": "css",
      "md": "markdown", "txt": "plaintext", "csv": "csv"
    };
    const langClass = langMap[ext] || "plaintext";

    const lines = codeContent.split("\n");
    const lineNumbers = lines.map((_, i) => (i + 1)).join("\n");

    return [
      '<div class="preview-code">',
        '<div class="preview-line-numbers">',
          '<pre><code class="language-plaintext">' + window.Clarity.utils.escapeHtml(lineNumbers) + '</code></pre>',
        '</div>',
        '<pre class="preview-source"><code class="language-' + langClass + '">' + window.Clarity.utils.escapeHtml(codeContent) + '</code></pre>',
      '</div>'
    ].join("");
  },

  _bindFilePreviewButtons() {
    document.querySelectorAll(".file-preview-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        const fileId = btn.getAttribute("data-file-id");
        const fileName = btn.getAttribute("data-file-name");
        // Fetch content from server
        fetch(window.Clarity.api.base + "/api/files/" + fileId + "/raw")
          .then(r => r.text())
          .then(text => {
            this._previewFile = { file_id: fileId, name: fileName, content: text, mime: "text/plain" };
            this._openFilePreview(this._previewFile);
          })
          .catch(err => {
            // Fallback: try to get content from message attachments
            const msgEl = btn.closest(".message");
            if (msgEl) {
              const msgId = msgEl.getAttribute("data-msg-id");
              // Try to find content in the message
              this._previewFile = { file_id: fileId, name: fileName, content: "", mime: "text/plain" };
              this._openFilePreview(this._previewFile);
            }
          });
      });
    });
  },

  setRobotState(state) {
    const robot = document.getElementById("clarityRobot");
    if (!robot) return;

    // Check if we're trying to set idle but we are currently streaming
    if (state === "idle" && this._isStreaming) return;

    robot.setAttribute("data-state", state);

    if (state === "responding") {
      setTimeout(() => {
        if (robot.getAttribute("data-state") === "responding") {
          robot.setAttribute("data-state", "idle");
        }
      }, 1500);
    }

    // Clear existing look intervals
    if (this._robotLookInterval) clearInterval(this._robotLookInterval);
    if (this._robotLookTimeout) clearTimeout(this._robotLookTimeout);

    if (state === "idle" || state === "listening" || state === "thinking") {
      this._robotLookInterval = setInterval(() => {
        if (!document.getElementById("clarityRobot")) return clearInterval(this._robotLookInterval);

        const r = Math.random();
        let look = "none";
        if (r > 0.78) look = "left";
        else if (r > 0.56) look = "right";

        robot.setAttribute("data-look", look);

        if (look !== "none") {
          this._robotLookTimeout = setTimeout(() => {
            if (robot.getAttribute("data-state") === state) {
              robot.setAttribute("data-look", "none");
            }
          }, 800 + Math.random() * 1000);
        }
      }, 2800);
    } else {
      robot.setAttribute("data-look", "none");
    }
  },

  _syncComposerStreaming() {
    window.Clarity.composer.setStreaming(this._isStreaming, () => this._stopStreaming());
  },

  async sendMessage(content, attachments, explicitMode, think) {
    if (this._isStreaming) return;
    if (!this._activeConversation) {
      try {
        const defaultTitle = (content && content.trim()) || (attachments && attachments[0] && attachments[0].name) || "New Chat";
        const convData = await window.Clarity.api.post("/api/conversations", {
          title: defaultTitle,
          model_id: this._resolveModelId(),
        });
        this._activeConversation = convData.id;
        this._firstMessagePending = false;
        window.Clarity.store.set("active_conversation", convData.id);
        if (window.Clarity.uiSidebar) window.Clarity.uiSidebar.refresh();
        setTimeout(() => {
          const input = document.getElementById("composerInput");
          if (input) input.focus();
        }, 50);
      } catch (err) {
        window.Clarity.toast.show("Failed to create conversation: " + (err.message || "unknown"), "danger");
        return;
      }
    }
    const cid = this._activeConversation;
    if (!cid) {
      window.Clarity.toast.show("Could not start conversation: no conversation id.", "danger");
      return;
    }

    const hasImages = attachments && attachments.some(a => a.type === "image");
    if (hasImages) {
      const modelId = this._resolveModelId();
      const caps = window.Clarity.modelSelector && window.Clarity.modelSelector.getCapabilities(modelId);
      if (!caps || !caps.vision) {
        this._isStreaming = false;
        this._syncComposerStreaming();
        window.Clarity.toast.show("This model does not support image input. Please select a Vision-capable model.", "danger");
        return;
      }
    }

    this._isStreaming = true;
    this._syncComposerStreaming();
    let convEl = document.getElementById("conversationList");
    if (!convEl) {
      this.renderChat([]);
      convEl = document.getElementById("conversationList");
    }
    if (convEl) {
      convEl.classList.remove("conversation--empty");
      const empty = convEl.querySelector(".chat-empty");
      if (empty) empty.remove();
      this._bindScrollListener(convEl);
    }
    if (!convEl) return;

    const userAttachments = attachments.map(att => {
      const isPdf = att.type === "pdf" || (att.mime && att.mime.includes("pdf")) || /\.pdf$/i.test(att.name || "");
      const isImage = att.type === "image" || (att.mime && att.mime.startsWith("image/"));
      return {
        id: att.id || att.file_id,
        file_id: att.file_id || att.id,
        type: isImage ? "image" : (isPdf ? "pdf" : "file"),
        name: att.name,
        size: att.size || 0,
        url: att.url,
        data: att.data,
        mime: att.mime,
        content: att.content || "",
      };
    });

    const userMsg = {
      role: "user",
      content: content || (userAttachments.length > 0 ? "Shared " + userAttachments.map(a => a.name).join(", ") : ""),
      attachments: userAttachments,
      id: "user_" + Date.now(),
    };

    const botMsg = {
      role: "assistant",
      content: "",
      id: "bot_" + Date.now(),
      streaming: true,
    };

    convEl.innerHTML += this._renderMessage(userMsg) + this._renderMessage(botMsg);
    this._bindMessageControls();
    this._userScrolledUp = false;
    this._scrollToBottom(true);

    const file_ids = attachments
      .map(a => a.file_id || a.id)
      .filter(Boolean);

    const projectId = attachments.find(a => a.type === "project")?.id || (this._activeConversation ? this._currentProject : null);

    const chosenMode = explicitMode || undefined;
    const resolvedFormat = chosenMode === "ppt" ? "pptx" : (chosenMode === "word" ? "docx" : (chosenMode === "excel" ? "xlsx" : (chosenMode === "file" ? "code" : chosenMode)));

    let requestBody = {
      message: content,
      model_id: this._resolveModelId(),
      file_ids,
      project_id: projectId,
      generation_mode: chosenMode,
      format: resolvedFormat,
      explicitFormat: resolvedFormat,
      think: !!think,
    };

    if (this._abortController) {
      this._abortController.abort();
    }
    this._abortController = new AbortController();

    this.setRobotState("thinking");

    try {
      const response = await fetch(window.Clarity.api.base + `/api/conversations/${cid}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: this._abortController.signal,
        credentials: "include",
      });

      if (!response.ok) {
        let detail = response.statusText;
        try {
          const txt = await response.text();
          if (txt) {
            try { detail = JSON.parse(txt).error || txt; } catch (e) { detail = txt; }
          }
        } catch (e) {}
        const err = new Error(detail);
        err.status = response.status;
        err.type = response.status === 404 ? "model_not_found" : (response.status === 401 || response.status === 403 ? "auth_error" : "http_error");
        throw err;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let botContent = "";
      let botAttachments = [];
      let sseBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (value) {
          sseBuffer += decoder.decode(value, { stream: true });
        }
        if (done) {
          if (value) {
            sseBuffer += decoder.decode(value, { stream: false });
          }
          const lines = sseBuffer.split("\n");
          sseBuffer = "";
          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || line === "data:") continue;
            if (!line.startsWith("data:")) continue;
            const jsonStr = line.slice(5).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;
            try {
              const event = JSON.parse(jsonStr);
              if (event.error && event.error.type === "empty_response") {
                this._updateBotMessage(botMsg.id, "", false);
                this._isStreaming = false;
                this._syncComposerStreaming();
                this._saveState();
                this._bindMessageControls();
                this._scrollToBottom();
                if (this._firstMessagePending) {
                  this._firstMessagePending = false;
                }
                this._refreshSidebarAfterMessage();
                return;
              } else if (event.error) {
                this._updateBotMessage(botMsg.id, "", true, event.error);
                this._isStreaming = false;
                this._syncComposerStreaming();
                botMsg.streaming = false;
                botMsg.error = event.error;
                const errEl = document.querySelector(`[data-msg-id="${botMsg.id}"]`);
                if (errEl) {
                  errEl.innerHTML = this._renderMessage(botMsg);
                  this._bindMessageControls();
                  this._renderErrorActions(errEl, event.error, botMsg.id, false);
                }
                this._scrollToBottom();
                this.setRobotState("error");
                return;
              } else if (event.done) {
                if (event.attachments) botAttachments = event.attachments;
                if (event.artifacts) botMsg.artifacts = event.artifacts;
                botMsg.content = botContent;
                botMsg.streaming = false;
                botMsg.attachments = botAttachments;
                const msgEl = document.querySelector(`[data-msg-id="${botMsg.id}"]`);
                if (msgEl) {
                  msgEl.innerHTML = this._renderMessage(botMsg);
                  this._bindMessageControls();
                  this._scrollToBottom();
                }
                this._isStreaming = false;
                this._syncComposerStreaming();
                this._saveState();
                if (this._firstMessagePending) {
                  const trimmedTitle = userMsg.content.trim();
                  if (trimmedTitle) {
                    await this._updateConversationTitle(trimmedTitle);
                  }
                  this._firstMessagePending = false;
                }
                this._refreshSidebarAfterMessage();
                this.setRobotState("responding");
                return;
              } else if (event.artifacts) {
                botMsg.artifacts = event.artifacts;
                const msgEl = document.querySelector(`[data-msg-id="${botMsg.id}"]`);
                if (msgEl) {
                  msgEl.innerHTML = this._renderMessage(botMsg);
                  this._bindMessageControls();
                }
              } else if (event.content) {
                botContent += event.content;
                this._updateBotMessage(botMsg.id, botContent, true);
                this._scrollToBottom();
              }
            } catch (e) {
              console.warn("SSE parse error:", e.message, "for:", jsonStr.slice(0, 100));
            }
          }
          break;
        }
        const lines = sseBuffer.split("\n");
        sseBuffer = lines.pop() || "";
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || line === "data:") continue;
          if (!line.startsWith("data:")) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;
          try {
            const event = JSON.parse(jsonStr);
            if (event.error && event.error.type === "empty_response") {
              this._updateBotMessage(botMsg.id, "", false);
              this._isStreaming = false;
              this._syncComposerStreaming();
              this._saveState();
              this._bindMessageControls();
              this._scrollToBottom();
              if (this._firstMessagePending) {
                this._firstMessagePending = false;
              }
              this._refreshSidebarAfterMessage();
              return;
} else if (event.error) {
              this._updateBotMessage(botMsg.id, "", true, event.error);
              this._isStreaming = false;
              this._syncComposerStreaming();
              botMsg.streaming = false;
              botMsg.error = event.error;
              const errEl = document.querySelector(`[data-msg-id="${botMsg.id}"]`);
              if (errEl) {
                errEl.innerHTML = this._renderMessage(botMsg);
                this._bindMessageControls();
                this._renderErrorActions(errEl, event.error, botMsg.id, false);
              }
              this._scrollToBottom();
              return;
            } else if (event.done) {
              if (event.attachments) botAttachments = event.attachments;
              if (event.artifacts) botMsg.artifacts = event.artifacts;
              botMsg.content = botContent;
              botMsg.streaming = false;
              botMsg.attachments = botAttachments;
              const msgEl = document.querySelector(`[data-msg-id="${botMsg.id}"]`);
              if (msgEl) {
                msgEl.innerHTML = this._renderMessage(botMsg);
                this._bindMessageControls();
                this._scrollToBottom();
              }
              this._isStreaming = false;
              this._syncComposerStreaming();
              this._saveState();
              if (this._firstMessagePending) {
                const trimmedTitle = userMsg.content.trim();
                if (trimmedTitle) {
                  await this._updateConversationTitle(trimmedTitle);
                }
                this._firstMessagePending = false;
              }
              this._refreshSidebarAfterMessage();
              return;
            } else if (event.artifacts) {
              botMsg.artifacts = event.artifacts;
              const msgEl = document.querySelector(`[data-msg-id="${botMsg.id}"]`);
              if (msgEl) {
                msgEl.innerHTML = this._renderMessage(botMsg);
                this._bindMessageControls();
              }
            } else if (event.content) {
              botContent += event.content;
              this._updateBotMessage(botMsg.id, botContent, true);
              this._scrollToBottom();
            }
          } catch (e) {
            console.warn("SSE parse error:", e.message, "for:", jsonStr.slice(0, 100));
          }
        }
      }
} catch (err) {
      if (err.name === "AbortError") return;
      const errInfo = {
        message: err.message || "Connection failed",
        type: err.type || "network_error",
        status: err.status,
      };
      this._updateBotMessage(botMsg.id, errInfo.message, false, errInfo);
      this._isStreaming = false;
      this._syncComposerStreaming();
      botMsg.streaming = false;
      botMsg.error = errInfo;
      const errEl = document.querySelector(`[data-msg-id="${botMsg.id}"]`);
      if (errEl) {
        errEl.innerHTML = this._renderMessage(botMsg);
        this._bindMessageControls();
        this._renderErrorActions(errEl, errInfo, botMsg.id, false);
      }
      this._scrollToBottom();
    } finally {
      this._abortController = null;
    }
  },

  _updateBotMessage(msgId, content, isStreaming, error, attachments) {
    const el = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (!el) return;
    const streaming = isStreaming;
    el.classList.toggle("is-streaming", streaming);

    const isCodeExplanation = (
      el.querySelector(".explanation-badge") ||
      (content && content.includes("### What this file does"))
    );

    const contentEl = el.querySelector(".message__content");
    if (contentEl) {
      if (error) {
        contentEl.innerHTML = this._renderErrorBlock(error);
        contentEl.classList.add("message__content--error");
      } else {
        contentEl.classList.remove("message__content--error");
        if (!content && !streaming) {
          contentEl.innerHTML = '<div class="message__empty">No response generated.</div>';
        } else {
          let html = window.Clarity.markdown.render(content);
          if (streaming) html += '<span class="cursor"></span>';
          if (isCodeExplanation) {
            contentEl.classList.add("message__content--code-explanation", "markdown-body");
            const bodyEl = contentEl.querySelector(".explanation-body");
            if (bodyEl) {
              bodyEl.innerHTML = html;
            } else {
              contentEl.innerHTML = `
                <div class="explanation-badge">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  <span>Code Explanation</span>
                </div>
                <div class="explanation-body">${html}</div>
              `;
            }
          } else {
            contentEl.innerHTML = html;
          }
          if (!streaming && window.Clarity && window.Clarity.renderMermaid) {
            window.Clarity.renderMermaid(contentEl);
          }
        }
      }
    }

    const attachmentsContainer = el.querySelector(".message__attachments");
    if (attachments && attachments.length) {
      const attachmentsHtml = '<div class="attachments">' + attachments.map(att => this._renderFileAttachment(att)).join("") + "</div>";
      if (attachmentsContainer) {
        attachmentsContainer.innerHTML = attachmentsHtml;
      } else {
        const bubble = el.querySelector(".message__bubble");
        if (bubble) {
          bubble.insertAdjacentHTML("beforeend", attachmentsHtml);
        }
      }
    }

    const statusDot = el.querySelector(".message__status");
    if (statusDot) {
      if (error) {
        statusDot.className = "message__status status--error";
      } else if (streaming) {
        statusDot.className = "message__status status--streaming";
      } else {
        statusDot.style.display = "none";
      }
    }

    if (error) {
      el.classList.add("message--error");
    } else {
      el.classList.remove("message--error");
    }

    this._renderErrorActions(el, error, msgId, isStreaming);
  },

  _renderErrorBlock(error) {
    const e = error || {};
    const type = e.type || "chat_error";
    const friendly = this._friendlyError(type, e.message || "Something went wrong.");
    return [
      '<div class="error-block">',
      '<div class="error-block__icon" aria-hidden="true">',
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      '</div>',
      '<div class="error-block__body">',
      '<div class="error-block__title">' + window.Clarity.utils.escapeHtml(friendly.title) + '</div>',
      '<div class="error-block__detail">' + window.Clarity.utils.escapeHtml(friendly.detail) + '</div>',
      '</div>',
      '</div>'
    ].join("");
  },

  _friendlyError(type, raw) {
    const message = String(raw || "");
    if (type === "auth_error" || /invalid.*api key|api_key_invalid|permission_denied/i.test(message)) {
      return { title: "Authentication failed", detail: "The API key is invalid or missing. Update it in Models settings." };
    }
    if (type === "model_not_found" || /model .* not configured/i.test(message)) {
      return { title: "Model not available", detail: "The selected model is not configured. Open Models to choose or add one." };
    }
    if (/503|unavailable|high demand|spikes in demand|overloaded|capacity/i.test(message)) {
      return { title: "Model Provider High Demand", detail: message || "The AI model is temporarily experiencing high traffic spikes. Please click Retry in a few seconds." };
    }
    if (type === "http_error" || /HTTP 4\d\d|HTTP 5\d\d/.test(message)) {
      if (/400/.test(message)) return { title: "Request rejected", detail: "The model rejected the request. Check the model configuration or input." };
      if (/401|403/.test(message)) return { title: "Authentication failed", detail: "The API key is missing or invalid. Update it in Models." };
      if (/404/.test(message)) return { title: "Endpoint not found", detail: "The model URL or model ID is invalid. Check Models." };
      if (/429/.test(message)) return { title: "Rate limited", detail: "Too many requests. Wait a moment and try again." };
      if (/5\d\d/.test(message)) return { title: "Server error", detail: "The model provider returned a temporary error. Try again shortly." };
    }
    if (/image|vision|does not support.*image/i.test(message)) {
      return { title: "Model does not support images", detail: "This model cannot process images. Select a Vision-capable model (e.g. GPT-4o) to use image attachments." };
    }
    if (type === "network_error" || /failed to fetch|networkerror/i.test(message)) {
      return { title: "Connection failed", detail: "Could not reach the model. Check your network and try again." };
    }
    if (type === "abort") {
      return { title: "Stopped", detail: "Generation was stopped." };
    }
    return { title: "Unable to generate response", detail: message || "Try again or change the model." };
  },

  _renderErrorActions(msgEl, error, msgId, isStreaming) {
    if (!error) return;
    let bar = msgEl.querySelector(".message__error-actions");
    if (isStreaming) {
      if (bar) bar.remove();
      return;
    }
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "message__error-actions";
      const body = msgEl.querySelector(".message__body");
      if (body) body.appendChild(bar);
    }
    bar.innerHTML = "";
    const retry = document.createElement("button");
    retry.className = "btn btn--outline btn--sm";
    retry.textContent = "Retry";
    retry.addEventListener("click", () => this._retry(msgId));
    bar.appendChild(retry);
  },

  _stopStreaming() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    this._isStreaming = false;
    this._syncComposerStreaming();
  },

  async _handleControl(action, msgId, convEl) {
    const msgEl = convEl.querySelector(`[data-msg-id="${msgId}"]`);
    if (!msgEl) return;
    const msg = {
      id: msgId,
      role: msgEl.classList.contains("message--user") ? "user" : "assistant",
      content: msgEl.querySelector(".message__content")?.textContent || "",
    };

    switch (action) {
      case "stop":
        this._stopStreaming();
        this._updateBotMessage(msgId, msg.content || "", false);
        break;
      case "copy":
        {
          const text = this._extractText(msgEl);
          try {
            await navigator.clipboard.writeText(text);
            window.Clarity.toast.show("Copied to clipboard", "success");
          } catch (e) {
            window.Clarity.toast.show("Copy failed", "danger");
          }
        }
        break;
      case "edit":
        if (msg.role === "user") this._handleEdit(msg, convEl);
        break;
      case "regenerate":
        await this._regenerate(msgId);
        break;
      case "retry":
        await this._retry(msgId);
        break;
      case "change-model":
        window.location.hash = "#/model";
        break;
    }
  },

  _extractText(element) {
    const content = element.querySelector(".message__content");
    if (!content) return "";
    const cells = content.querySelectorAll(".code-cell");
    if (cells.length > 0) {
      const clone = content.cloneNode(true);
      clone.querySelectorAll(".code-line__num, .code-cell__header, .code-cell__tabs, .code-cell__preview-wrap, .code-cell__footer").forEach(el => el.remove());
      return clone.textContent.trim();
    }
    const codeBlocks = content.querySelectorAll("pre code");
    if (codeBlocks.length > 0) {
      const texts = Array.from(codeBlocks).map(cb => cb.textContent);
      return texts.join("\n\n");
    }
    return content.textContent || "";
  },

  async _regenerate(msgId) {
    const cid = this._activeConversation;
    if (!cid) return;

    const msgs = await this._getMessagesFromDom();
    const botIndex = msgs.findIndex(m => m.id === msgId && m.role === "assistant");
    if (botIndex === -1) return;

    const toRemove = msgs.slice(botIndex);
    const convEl = document.getElementById("conversationList");
    for (const m of toRemove) {
      const el = convEl.querySelector(`[data-msg-id="${m.id}"]`);
      if (el) el.remove();
    }
    this._scrollToBottom();

    this._isStreaming = true;
    const botMsg = {
      role: "assistant",
      content: "",
      id: "bot_" + Date.now(),
      streaming: true,
    };
    convEl.innerHTML += this._renderMessage(botMsg);
    this._bindMessageControls();
    this._userScrolledUp = false;
    this._scrollToBottom(true);

    const userMsgs = msgs.filter(m => m.role === "user");
    const lastUser = userMsgs[userMsgs.length - 1];
    const file_ids = lastUser.attachments
      ? lastUser.attachments.filter(a => a.file_id).map(a => a.file_id)
      : [];

    const hasImages = lastUser.attachments && lastUser.attachments.some(a => a.type === "image");
    if (hasImages) {
      const modelId = this._resolveModelId();
      const caps = window.Clarity.modelSelector && window.Clarity.modelSelector.getCapabilities(modelId);
      if (!caps || !caps.vision) {
        this._isStreaming = false;
        this._syncComposerStreaming();
        window.Clarity.toast.show("This model does not support image input. Please select a Vision-capable model.", "danger");
        return;
      }
    }

    this._abortController = new AbortController();

    try {
      const response = await fetch(window.Clarity.api.base + `/api/conversations/${cid}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_id: this._resolveModelId(),
          file_ids,
          project_id: this._currentProject,
        }),
        signal: this._abortController.signal,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let botContent = "";
      let botAttachments = [];
      let sseBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (value) {
          sseBuffer += decoder.decode(value, { stream: true });
        }
        if (done) {
          if (value) {
            sseBuffer += decoder.decode(value, { stream: false });
          }
          const lines = sseBuffer.split("\n");
          sseBuffer = "";
          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || line === "data:") continue;
            if (!line.startsWith("data:")) continue;
            const jsonStr = line.slice(5).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;
            try {
              const event = JSON.parse(jsonStr);
              if (event.error && event.error.type === "empty_response") {
                this._updateBotMessage(botMsg.id, "", false);
                this._isStreaming = false;
                this._bindMessageControls();
                this._scrollToBottom();
                return;
} else if (event.error) {
                this._updateBotMessage(botMsg.id, "", false, event.error);
                this._isStreaming = false;
                botMsg.streaming = false;
                botMsg.error = event.error;
                const errEl = document.querySelector(`[data-msg-id="${botMsg.id}"]`);
                if (errEl) {
                  errEl.innerHTML = this._renderMessage(botMsg);
                  this._bindMessageControls();
                  this._renderErrorActions(errEl, event.error, botMsg.id, false);
                }
                return;
              } else if (event.done) {
                if (event.attachments) botAttachments = event.attachments;
                botMsg.content = botContent;
                botMsg.streaming = false;
                botMsg.attachments = botAttachments;
                const msgEl = document.querySelector(`[data-msg-id="${botMsg.id}"]`);
                if (msgEl) {
                  msgEl.innerHTML = this._renderMessage(botMsg);
                  this._bindMessageControls();
                  this._scrollToBottom();
                }
                this._isStreaming = false;
                return;
              } else if (event.content) {
                botContent += event.content;
                this._updateBotMessage(botMsg.id, botContent, true);
                this._scrollToBottom();
              }
            } catch (e) {}
          }
          break;
        }
        const lines = sseBuffer.split("\n");
        sseBuffer = lines.pop() || "";
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || line === "data:") continue;
          if (!line.startsWith("data:")) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;
          try {
            const event = JSON.parse(jsonStr);
            if (event.error && event.error.type === "empty_response") {
              this._updateBotMessage(botMsg.id, "", false);
              this._isStreaming = false;
              this._syncComposerStreaming();
              this._bindMessageControls();
              this._scrollToBottom();
              return;
} else if (event.error) {
              this._updateBotMessage(botMsg.id, "", false, event.error);
              this._isStreaming = false;
              this._syncComposerStreaming();
              botMsg.streaming = false;
              botMsg.error = event.error;
              const errEl = document.querySelector(`[data-msg-id="${botMsg.id}"]`);
              if (errEl) {
                errEl.innerHTML = this._renderMessage(botMsg);
                this._bindMessageControls();
                this._renderErrorActions(errEl, event.error, botMsg.id, false);
              }
              return;
            } else if (event.done) {
              if (event.attachments) botAttachments = event.attachments;
              botMsg.content = botContent;
              botMsg.streaming = false;
              botMsg.attachments = botAttachments;
              const msgEl = document.querySelector(`[data-msg-id="${botMsg.id}"]`);
              if (msgEl) {
                msgEl.innerHTML = this._renderMessage(botMsg);
                this._bindMessageControls();
                this._scrollToBottom();
              }
              this._isStreaming = false;
              return;
            } else if (event.content) {
              botContent += event.content;
              this._updateBotMessage(botMsg.id, botContent, true);
              this._scrollToBottom();
            }
          } catch (e) {}
        }
      }
} catch (err) {
      if (err.name === "AbortError") return;
      const errInfo = { message: err.message || "Connection failed", type: "network_error" };
      this._updateBotMessage(botMsg.id, errInfo.message, false, errInfo);
      this._isStreaming = false;
      this._syncComposerStreaming();
      botMsg.streaming = false;
      botMsg.error = errInfo;
      const errEl = document.querySelector(`[data-msg-id="${botMsg.id}"]`);
      if (errEl) {
        errEl.innerHTML = this._renderMessage(botMsg);
        this._bindMessageControls();
        this._renderErrorActions(errEl, errInfo, botMsg.id, false);
      }
    } finally {
      this._abortController = null;
    }
  },

  _retry(msgId) {
    const el = document.querySelector(`[data-msg-id="${msgId}"]`);
    if (el && el.classList.contains("message--error")) {
      el.classList.remove("message--error");
      this._regenerate(msgId);
    }
  },

  _handleEdit(msg, convEl) {
    const msgEl = convEl.querySelector(`[data-msg-id="${msg.id}"]`);
    if (!msgEl) return;
    const bubble = msgEl.querySelector(".message__bubble");
    if (!bubble) return;

    const originalAttachments = msg.attachments || [];
    const originalContent = (msgEl.querySelector(".message__content")?.textContent || "").trim();

    const wrapper = document.createElement("div");
    wrapper.className = "edit-wrapper";
    wrapper.innerHTML = `
      <textarea class="edit-textarea" rows="3" aria-label="Edit message"></textarea>
      <div class="edit-buttons">
        <button class="btn btn--primary btn--sm" type="button" data-edit-action="save">Save & Resend</button>
        <button class="btn btn--ghost btn--sm" type="button" data-edit-action="cancel">Cancel</button>
      </div>
    `;
    const textarea = wrapper.querySelector("textarea");
    textarea.value = msg.content || originalContent;

    const originalContentHtml = bubble.innerHTML;
    bubble.innerHTML = "";
    bubble.appendChild(wrapper);
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);

    const cleanup = () => {
      bubble.innerHTML = originalContentHtml;
    };

    wrapper.querySelector('[data-edit-action="cancel"]').addEventListener("click", cleanup);
    wrapper.querySelector('[data-edit-action="save"]').addEventListener("click", async () => {
      const newValue = textarea.value.trim();
      if (!newValue) return;
      bubble.innerHTML = window.Clarity.markdown.render(newValue);
      if (window.Clarity && window.Clarity.renderMermaid) {
        window.Clarity.renderMermaid(bubble);
      } else if (window.mermaid) {
        try { window.mermaid.run({ querySelector: '.mermaid' }).catch(()=>{}); } catch(e) {}
      }

      const cid = this._activeConversation;
      if (cid) {
        try {
          await window.Clarity.api.post("/api/conversations/" + cid + "/messages/" + msg.id + "/edit", { content: newValue });
        } catch (e) { /* best effort */ }
      }

      this._regenerateAfterEdit(newValue, originalAttachments);
    });
  },

  async _regenerateAfterEdit(newValue, attachments) {
    const cid = this._activeConversation;
    if (!cid) return;

    const convEl = document.getElementById("conversationList");
    if (!convEl) return;
    const botMsg = {
      role: "assistant",
      content: "",
      id: "bot_" + Date.now(),
      streaming: true,
    };
    convEl.innerHTML += this._renderMessage(botMsg);
    this._bindMessageControls();
    this._scrollToBottom();

    const file_ids = attachments.filter(a => a.file_id).map(a => a.file_id);
    const projectId = attachments.find(a => a.type === "project")?.id || this._currentProject;

    const hasImages = attachments.some(a => a.type === "image");
    if (hasImages) {
      const modelId = this._resolveModelId();
      const caps = window.Clarity.modelSelector && window.Clarity.modelSelector.getCapabilities(modelId);
      if (!caps || !caps.vision) {
        this._isStreaming = false;
        this._syncComposerStreaming();
        window.Clarity.toast.show("This model does not support image input. Please select a Vision-capable model.", "danger");
        return;
      }
    }

    this._isStreaming = true;
    this._abortController = new AbortController();

    try {
      const response = await fetch(window.Clarity.api.base + `/api/conversations/${cid}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newValue, model_id: this._resolveModelId(), file_ids, project_id: projectId }),
        signal: this._abortController.signal,
        credentials: "include",
      });
      if (!response.ok) {
        let detail = response.statusText;
        try {
          const txt = await response.text();
          if (txt) { try { detail = JSON.parse(txt).error || txt; } catch (e) { detail = txt; } }
        } catch (e) {}
        const err = new Error(detail);
        err.status = response.status;
        err.type = response.status === 404 ? "model_not_found" : "http_error";
        throw err;
      }
      await this._consumeStream(response, botMsg);
    } catch (err) {
      if (err.name !== "AbortError") {
        this._updateBotMessage(botMsg.id, "", true, {
          message: err.message || "Error",
          type: err.type || "network_error",
          status: err.status,
        });
      }
    } finally {
      this._isStreaming = false;
      this._syncComposerStreaming();
      this._abortController = null;
    }
  },

  async _consumeStream(response, botMsg) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let botContent = "";
    let botAttachments = [];
    let sseBuffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (value) {
          sseBuffer += decoder.decode(value, { stream: false });
        }
        const lines = sseBuffer.split("\n");
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || line === "data:") continue;
          if (!line.startsWith("data:")) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;
          try {
            const event = JSON.parse(jsonStr);
            if (event.error && event.error.type === "empty_response") {
              this._updateBotMessage(botMsg.id, "", false);
              this._isStreaming = false;
              this._syncComposerStreaming();
              this._bindMessageControls();
              this._scrollToBottom();
              this._refreshSidebarAfterMessage();
              return;
} else if (event.error) {
              this._updateBotMessage(botMsg.id, event.error.message || "Error", false, event.error);
              this._isStreaming = false;
              this._syncComposerStreaming();
              botMsg.streaming = false;
              botMsg.error = event.error;
              const errEl = document.querySelector(`[data-msg-id="${botMsg.id}"]`);
              if (errEl) {
                errEl.innerHTML = this._renderMessage(botMsg);
                this._bindMessageControls();
                this._renderErrorActions(errEl, event.error, botMsg.id, false);
              }
              return;
            } else if (event.done) {
              if (event.attachments) botAttachments = event.attachments;
              botMsg.content = botContent;
              botMsg.streaming = false;
              botMsg.attachments = botAttachments;
              const msgEl = document.querySelector(`[data-msg-id="${botMsg.id}"]`);
              if (msgEl) {
                msgEl.innerHTML = this._renderMessage(botMsg);
                this._bindMessageControls();
                this._scrollToBottom();
              }
              this._isStreaming = false;
              this._refreshSidebarAfterMessage();
              return;
            } else if (event.content) {
              botContent += event.content;
              this._updateBotMessage(botMsg.id, botContent, true);
              this._scrollToBottom();
            }
          } catch (e) {
            console.warn("SSE parse error:", e.message, "for:", jsonStr.slice(0, 100));
          }
        }
        break;
      }
      sseBuffer += decoder.decode(value, { stream: true });
      const lines = sseBuffer.split("\n");
      sseBuffer = lines.pop() || "";
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line === "data:") continue;
        if (!line.startsWith("data:")) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr || jsonStr === "[DONE]") continue;
        try {
          const event = JSON.parse(jsonStr);
          if (event.error && event.error.type === "empty_response") {
            this._updateBotMessage(botMsg.id, "", false);
            this._isStreaming = false;
            this._bindMessageControls();
            this._scrollToBottom();
            this._refreshSidebarAfterMessage();
            return;
} else if (event.error) {
            this._updateBotMessage(botMsg.id, event.error.message || "Error", false, event.error);
            this._isStreaming = false;
            botMsg.streaming = false;
            botMsg.error = event.error;
            const errEl = document.querySelector(`[data-msg-id="${botMsg.id}"]`);
            if (errEl) {
              errEl.innerHTML = this._renderMessage(botMsg);
              this._bindMessageControls();
              this._renderErrorActions(errEl, event.error, botMsg.id, false);
            }
            return;
          } else if (event.done) {
            if (event.attachments) botAttachments = event.attachments;
            botMsg.content = botContent;
            botMsg.streaming = false;
            botMsg.attachments = botAttachments;
            const msgEl = document.querySelector(`[data-msg-id="${botMsg.id}"]`);
            if (msgEl) {
              msgEl.innerHTML = this._renderMessage(botMsg);
              this._bindMessageControls();
              this._scrollToBottom();
            }
            this._isStreaming = false;
            this._refreshSidebarAfterMessage();
            return;
          } else if (event.content) {
            botContent += event.content;
            this._updateBotMessage(botMsg.id, botContent, true);
            this._scrollToBottom();
          }
        } catch (e) {
          console.warn("SSE parse error:", e.message, "for:", jsonStr.slice(0, 100));
        }
      }
    }
  },

  _replaceUserMessage(msgId, newContent, convEl) {
    const el = convEl.querySelector(`[data-msg-id="${msgId}"] .message__content`);
    if (el) {
      el.innerHTML = window.Clarity.markdown.render(newContent);
      if (window.Clarity && window.Clarity.renderMermaid) {
        window.Clarity.renderMermaid(el);
      } else if (window.mermaid) {
        try { window.mermaid.run({ querySelector: '.mermaid' }).catch(()=>{}); } catch(e) {}
      }
    }
  },

  _getMessagesFromDom() {
    const convEl = document.getElementById("conversationList");
    if (!convEl) return [];
    const msgs = [];
    convEl.querySelectorAll(".message").forEach(el => {
      const id = el.getAttribute("data-msg-id");
      const role = el.classList.contains("message--user") ? "user" : "assistant";
      const contentEl = el.querySelector(".message__content");
      const content = contentEl ? contentEl.textContent || contentEl.innerText || "" : "";
      msgs.push({ id, role, content });
    });
    return msgs;
  },

  _bindMessageControls() {
    const convEl = document.getElementById("conversationList");
    if (!convEl) return;

    convEl.querySelectorAll(".message-control").forEach(btn => {
      btn.removeEventListener("click", btn._handler);
      const action = btn.getAttribute("data-action");
      const msgEl = btn.closest(".message");
      const msgId = msgEl.getAttribute("data-msg-id");
      btn._handler = (e) => {
        e.stopPropagation();
        this._handleControl(action, msgId, convEl);
      };
      btn.addEventListener("click", btn._handler);
    });

    convEl.querySelectorAll(".code-copy").forEach(btn => {
      btn.removeEventListener("click", btn._handler);
      btn._handler = (e) => {
        e.stopPropagation();
        const codeEl = btn.closest(".code-block").querySelector("code");
        const text = codeEl ? codeEl.textContent : "";
        navigator.clipboard.writeText(text).then(() => {
          window.Clarity.toast.show("Code copied", "success");
        });
      };
      btn.addEventListener("click", btn._handler);
    });

    convEl.querySelectorAll(".code-download").forEach(btn => {
      btn.removeEventListener("click", btn._handler);
      btn._handler = (e) => {
        e.stopPropagation();
        const codeBlock = btn.closest(".code-block");
        const lang = codeBlock.querySelector("code").className.match(/language-(\w+)/)?.[1] || "txt";
        const code = codeBlock.querySelector("code").textContent;
        const blob = new Blob([code], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `snippet.${lang}`;
        a.click();
        URL.revokeObjectURL(url);
      };
      btn.addEventListener("click", btn._handler);
    });

    // Preview buttons for file attachments
    convEl.querySelectorAll(".file-preview-btn").forEach(btn => {
      btn.removeEventListener("click", btn._handler);
      btn._handler = (e) => {
        e.stopPropagation();
        const fileId = btn.getAttribute("data-file-id");
        const fileName = btn.getAttribute("data-file-name");
        // Fetch file content for preview
        fetch(window.Clarity.api.base + "/api/files/" + fileId + "/raw")
          .then(r => r.text())
          .then(text => {
            this._previewFile = { file_id: fileId, name: fileName, content: text, mime: "text/plain" };
            this._openFilePreview(this._previewFile);
          })
          .catch(err => {
            this._previewFile = { file_id: fileId, name: fileName, content: "", mime: "text/plain" };
            this._openFilePreview(this._previewFile);
          });
      };
      btn.addEventListener("click", btn._handler);
    });

    if (window.Clarity.artifact && window.Clarity.artifact.bindEvents) {
      window.Clarity.artifact.bindEvents(convEl);
    }

    // Batch download all artifacts ZIP
    convEl.querySelectorAll(".download-all-artifacts-btn").forEach(btn => {
      btn.removeEventListener("click", btn._batchDlHandler);
      btn._batchDlHandler = async (e) => {
        e.preventDefault();
        const idsStr = btn.getAttribute("data-art-ids") || "";
        const artifactIds = idsStr.split(",").filter(Boolean);
        if (!artifactIds.length) return;

        btn.disabled = true;
        const origText = btn.innerHTML;
        btn.innerHTML = "<span>Creating ZIP...</span>";

        try {
          const resp = await fetch("/api/artifacts/download-zip", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ artifactIds }),
          });

          if (!resp.ok) {
            throw new Error(`Server returned HTTP ${resp.status}`);
          }

          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `artifacts-${Date.now()}.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          window.Clarity.toast.show(`Downloaded ${artifactIds.length} files as ZIP archive`, "success");
        } catch (err) {
          console.error("ZIP download failed:", err);
          window.Clarity.toast.show("ZIP download failed: " + err.message, "danger");
        } finally {
          btn.disabled = false;
          btn.innerHTML = origText;
        }
      };
      btn.addEventListener("click", btn._batchDlHandler);
    });

    // Batch apply all code artifacts to workspace
    convEl.querySelectorAll(".apply-all-artifacts-btn").forEach(btn => {
      btn.removeEventListener("click", btn._batchApplyHandler);
      btn._batchApplyHandler = async (e) => {
        e.preventDefault();
        const idsStr = btn.getAttribute("data-art-ids") || "";
        const artifactIds = idsStr.split(",").filter(Boolean);
        if (!artifactIds.length) return;

        btn.disabled = true;
        const origText = btn.innerHTML;
        btn.innerHTML = "<span>Applying all...</span>";

        let appliedCount = 0;
        let errors = 0;

        for (const id of artifactIds) {
          try {
            await window.Clarity.api.post(`/api/artifacts/${id}/apply`, {});
            appliedCount++;
            // Update individual card if present
            const card = document.getElementById(`art_${id}`);
            if (card) {
              const applyBtn = card.querySelector(".art-apply-btn");
              if (applyBtn) {
                applyBtn.textContent = "✓ Applied";
                applyBtn.classList.add("btn--outline");
              }
              const badgeContainer = card.querySelector(".tag--xs:last-child")?.parentElement;
              if (badgeContainer && !card.querySelector(".tag--applied")) {
                const appliedTag = document.createElement("span");
                appliedTag.className = "tag tag--xs tag--applied";
                appliedTag.style.cssText = "background:#e0e7ff; color:#4338ca; font-weight:600;";
                appliedTag.textContent = "⚡ In Workspace";
                badgeContainer.appendChild(appliedTag);
              }
            }
          } catch (err) {
            errors++;
          }
        }

        btn.innerHTML = `✓ ${appliedCount} Applied`;
        btn.classList.add("btn--outline");
        if (appliedCount > 0) {
          window.Clarity.toast.show(`Applied ${appliedCount} files to project workspace!`, "success");
        } else if (errors > 0) {
          window.Clarity.toast.show("Failed to apply files to workspace", "danger");
        }
      };
      btn.addEventListener("click", btn._batchApplyHandler);
    });

    let activeMessage = null;

    convEl.querySelectorAll(".message").forEach(msgEl => {
      msgEl.removeEventListener("touchstart", msgEl._touchHandler);
      msgEl._touchHandler = (e) => {
        if (e.target.closest(".message-control") || e.target.closest(".code-cell__btn") || e.target.closest("[data-code-action]") || e.target.closest(".code-copy") || e.target.closest(".code-download") || e.target.closest(".edit-wrapper")) return;

        if (activeMessage && activeMessage !== msgEl) {
          activeMessage.classList.remove("message--active");
        }
        msgEl.classList.add("message--active");
        activeMessage = msgEl;
      };
      msgEl.addEventListener("touchstart", msgEl._touchHandler, { passive: true });
      this._postProcessMessage(msgEl);
    });

    const clearActiveState = (e) => {
      if (!e.target.closest(".message") || e.target.closest(".composer")) {
        if (activeMessage) {
          activeMessage.classList.remove("message--active");
          activeMessage = null;
        }
      }
    };
    document.removeEventListener("touchstart", clearActiveState);
    document.addEventListener("touchstart", clearActiveState, { passive: true });
  },

  _postProcessMessage(messageEl) {
    if (!messageEl) return;

    const contentEl = messageEl.querySelector(".message__content");
    if (!contentEl) return;

    const preElements = contentEl.querySelectorAll("pre");
    preElements.forEach(pre => {
      if (pre.closest(".code-cell") || pre.closest(".code-block")) {
        return;
      }

      if (pre.parentNode && pre.parentNode.classList.contains("pre-copy-container")) {
        return;
      }

      const isMermaid = pre.classList.contains("mermaid");

      const wrapper = document.createElement("div");
      wrapper.className = "pre-copy-container";

      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "pre-copy-btn";
      copyBtn.setAttribute("aria-label", "Copy code");
      copyBtn.title = "Copy code";

      copyBtn.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>

      `;

      copyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();

        let text = pre.textContent || "";
        if (isMermaid && pre._rawMermaidCode) {
          text = pre._rawMermaidCode;
        }

        navigator.clipboard.writeText(text).then(() => {
          copyBtn.classList.add("pre-copy-btn--copied");
          const origHtml = copyBtn.innerHTML;
          copyBtn.innerHTML = `
            <svg class="icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Copied ✓</span>
          `;
          if (window.Clarity && window.Clarity.toast) {
            window.Clarity.toast.show("Code copied", "success");
          }
          setTimeout(() => {
            copyBtn.classList.remove("pre-copy-btn--copied");
            copyBtn.innerHTML = origHtml;
          }, 2000);
        }).catch(err => {
          console.error("Failed to copy code block", err);
        });
      });

      wrapper.appendChild(copyBtn);
    });
  },

  _refreshSidebarAfterMessage() {
    if (window.Clarity.uiSidebar) {
      window.Clarity.uiSidebar.loadConversations().then(() => {
        window.Clarity.uiSidebar.render();
      });
    }
  },

  async _updateConversationTitle(title) {
    const cid = this._activeConversation;
    if (!cid || !title) return;
    try {
      await window.Clarity.api.patch(`/api/conversations/${cid}/title`, { title });
    } catch (err) {
      console.error("Failed to update conversation title:", err);
    }
  },

  _userScrolledUp: false,

  _bindScrollListener(convEl) {
    if (!convEl || convEl._scrollBound) return;
    convEl._scrollBound = true;
    convEl.addEventListener("scroll", () => {
      const distanceFromBottom = convEl.scrollHeight - convEl.scrollTop - convEl.clientHeight;
      this._userScrolledUp = distanceFromBottom > 80;
    }, { passive: true });
  },

  _scrollToBottom(force = false) {
    const convEl = document.querySelector(".conversation");
    if (convEl) {
      if (!force && this._userScrolledUp) {
        return;
      }
      convEl.scrollTop = convEl.scrollHeight;
    }
  },

  setModel(modelId, options) {
    const opts = options || {};
    this._activeModel = modelId || null;
    if (opts.persist !== false) this._saveState();
    if (window.Clarity.uiTopbar) {
      window.Clarity.uiTopbar.updateModelChip();
    }
  },

  clearConversation() {
    const cid = this._activeConversation;
    if (cid) {
      window.Clarity.api.del(`/api/conversations/${cid}`).then(() => {
        this._activeConversation = null;
        window.Clarity.store.remove("active_conversation");
        this.renderChat([{ role: "assistant", content: "Chat cleared. Start a new conversation or pick one from the sidebar." }]);
      });
    }
  },

  attachProject(projectId) {
    this._currentProject = projectId;
    this._saveState();
  },
};

window.Clarity.exportChatToPdf = function(opts) {
  return window.Clarity.uiChat.exportChatToPdf(opts);
};


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
    this._attachedFiles = window.Clarity.store.get("chat_attachments", []);
    this._activeModel = window.Clarity.store.get("active_model", null);
    this._currentProject = window.Clarity.store.get("current_project", null);
  },

  _saveState() {
    window.Clarity.store.set("chat_attachments", this._attachedFiles);
    window.Clarity.store.set("active_model", this._activeModel);
    window.Clarity.store.set("current_project", this._currentProject);
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
    this._attachedFiles = [];
    this._currentProject = null;
    this._saveState();
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
      this._bindMessageControls();
      this._updateNewChatButton();
      this._updateComposer();
      this._isStreaming = false;
      this._syncComposerStreaming();
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

  _bindSuggestionChips() {
    document.querySelectorAll("[data-suggestion]").forEach(chip => {
      chip.addEventListener("click", () => {
        const text = chip.getAttribute("data-suggestion");
        const input = document.getElementById("composerInput");
        if (input) {
          input.value = text;
          input.focus();
          const sendBtn = document.getElementById("composerSend");
          if (sendBtn) sendBtn.disabled = false;
        }
      });
    });
  },

  _renderChatHtml(messages) {
    const isEmpty = !messages || messages.length === 0;
    const parts = ['<div class="chat-shell">'];
    parts.push('<section class="chat-panel">');
    parts.push('<div class="conversation' + (isEmpty ? ' conversation--empty' : '') + '" id="conversationList">');
    if (isEmpty) {
      parts.push(this._renderEmptyState());
    } else {
      for (const msg of messages) {
        parts.push(this._renderMessage(msg));
      }
    }
    parts.push('</div>');
    parts.push('<div class="composer-outer"><div class="composer" id="chatComposer"></div></div>');
    parts.push('</section>');
    parts.push('<aside class="preview-panel" id="filePreviewPanel" hidden></aside>');
    parts.push('</div>');
    return parts.join("");
  },

  _renderEmptyState() {
    const modelName = (window.Clarity.modelSelector && window.Clarity.modelSelector.getActive()?.name) || "AI";
    return [
      '<div class="chat-empty">',
      '<div class="chat-empty__inner">',
      '<div class="chat-empty__logo">',
      '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">',
      '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>',
      '<polyline points="3.27 6.96 12 12.01 20.73 6.96"/>',
      '<line x1="12" y1="22.08" x2="12" y2="12"/>',
      '</svg>',
      '</div>',
      '<h1 class="chat-empty__title">What are you working on?</h1>',
      '<p class="chat-empty__sub">Powered by <strong>' + window.Clarity.utils.escapeHtml(modelName) + '</strong>.</p>',
      '</div>',
      '</div>'
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

    let contentHtml;
    if (isEmpty) {
      contentHtml = '<div class="message__content message__content--empty">No response generated.</div>';
    } else {
      try {
        const rawContent = String(msg.content || "");
        const rendered = window.Clarity.markdown.render(rawContent);
        contentHtml = '<div class="message__content">' + rendered + "</div>";
      } catch (e) {
        contentHtml = '<div class="message__content"><p class="error-text">Failed to render message.</p></div>';
      }
    }

    const attachmentsHtml = msg.attachments && msg.attachments.length
      ? '<div class="attachments">' + msg.attachments.map(att => {
          if (att.file_id) {
            return this._renderFileAttachment(att);
          }
          return this._renderAttachment(att);
        }).join("") + "</div>"
      : "";

    const artifactsCount = msg.artifacts ? msg.artifacts.length : 0;
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
      return `<div class="message__controls"><button class="message-control" data-action="stop" type="button" title="Stop generation" aria-label="Stop generation">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
        <span>Stop</span>
      </button></div>`;
    }
    if (isError) {
      return `<div class="message__controls message__controls--error">
        <button class="message-control" data-action="regenerate" type="button" title="Regenerate response" aria-label="Regenerate response">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
          <span>Regenerate</span>
        </button>
        <button class="message-control" data-action="change-model" type="button" title="Change model" aria-label="Change model">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
          <span>Change model</span>
        </button>
      </div>`;
    }
    const buttons = [
      `<button class="message-control" data-action="copy" type="button" title="Copy" aria-label="Copy">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
        <span>Copy</span>
      </button>`,
      `<button class="message-control" data-action="regenerate" type="button" title="Regenerate" aria-label="Regenerate">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
        <span>Regenerate</span>
      </button>`,
    ];
    return `<div class="message__controls">${buttons.join("")}</div>`;
  },

  _renderUserControls(msg) {
    if (!msg.id || msg.streaming) return "";
    const buttons = [
      `<button class="message-control" data-action="edit" type="button" title="Edit" aria-label="Edit message">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
        <span>Edit</span>
      </button>`,
      `<button class="message-control" data-action="copy" type="button" title="Copy" aria-label="Copy">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
        <span>Copy</span>
      </button>`,
    ];
    return `<div class="message__controls">${buttons.join("")}</div>`;
  },

  _controlBtn(action, label, icon) {
    return `<button class="message-control" data-action="${action}" type="button" title="${label}" aria-label="${label}"><span>${label}</span></button>`;
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
    const fileId = att.file_id;
    const isImage = att.mime && att.mime.startsWith("image/");
    const icon = isImage
      ? '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>'
      : '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>';

    const previewHtml = isImage
      ? '<img src="/api/files/' + fileId + '/raw" alt="' + name + '" class="attachment-preview-img" />'
      : '';

    return [
      '<div class="attachment-file-card">',
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
    window.Clarity.composer.mount(container, (value, attachments) => {
      this._attachedFiles = attachments || [];
      this.sendMessage(value, this._attachedFiles);
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

  _syncComposerStreaming() {
    window.Clarity.composer.setStreaming(this._isStreaming, () => this._stopStreaming());
  },

  async sendMessage(content, attachments) {
    if (this._isStreaming) return;
    if (!this._activeConversation) {
      try {
        const convData = await window.Clarity.api.post("/api/conversations", {
          title: content.trim(),
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

    const userAttachments = attachments.map(att => ({
      type: att.type === "image" ? "image" : "file",
      name: att.name,
      url: att.url,
      data: att.data,
      mime: att.mime,
      content: att.content || "",
    }));

    const userMsg = {
      role: "user",
      content: content,
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
      .filter(a => a.file_id)
      .map(a => a.file_id);

    const projectId = attachments.find(a => a.type === "project")?.id || this._currentProject;

    let requestBody = { message: content, model_id: this._resolveModelId(), file_ids, project_id: projectId };

    if (this._abortController) {
      this._abortController.abort();
    }
    this._abortController = new AbortController();

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
          contentEl.innerHTML = html;
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
    if (type === "auth_error") {
      return { title: "Authentication failed", detail: "The API key is invalid or missing. Update it in Models." };
    }
    if (type === "model_not_found" || /model .* not configured/i.test(message)) {
      return { title: "Model not available", detail: "The selected model is not configured. Open Models to choose or add one." };
    }
    if (type === "http_error" || /HTTP 4\d\d|HTTP 5\d\d/.test(message)) {
      if (/400/.test(message)) return { title: "Request rejected", detail: "The model rejected the request. Check the model configuration or input." };
      if (/401|403/.test(message)) return { title: "Authentication failed", detail: "The API key is missing or invalid. Update it in Models." };
      if (/404/.test(message)) return { title: "Endpoint not found", detail: "The model URL or model ID is invalid. Check Models." };
      if (/429/.test(message)) return { title: "Rate limited", detail: "Too many requests. Wait a moment and try again." };
      if (/5\d\d/.test(message)) return { title: "Server error", detail: "The model provider returned an error. Try again shortly." };
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
        if (e.target.closest(".message-control") || e.target.closest(".code-copy") || e.target.closest(".code-download") || e.target.closest(".edit-wrapper")) return;

        if (activeMessage && activeMessage !== msgEl) {
          activeMessage.classList.remove("message--active");
        }
        msgEl.classList.add("message--active");
        activeMessage = msgEl;
      };
      msgEl.addEventListener("touchstart", msgEl._touchHandler, { passive: true });
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


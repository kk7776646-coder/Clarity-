window.Clarity = window.Clarity || {};

window.Clarity.composer = {
  _attachedFiles: [],
  _isStreaming: false,
  _onStop: null,

  mount(container, onSubmit, modelId, existingAttachments) {
    if (!container) return null;

    this._attachedFiles = existingAttachments || [];
    const fileCount = this._attachedFiles.length;

container.innerHTML = [
      '<div class="composer__attachments" id="composerAttachments"></div>',
      '<div class="composer__row">',
        '<div class="composer__field">',
          '<textarea id="composerInput" rows="1" placeholder="Message Clarity" aria-label="Message input"></textarea>',
        '</div>',
        '<div class="composer__actions">',
          '<button class="composer__upload" id="composerUpload" type="button" title="Attach files" aria-label="Attach files">',
            '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
          '</button>',
          '<input type="file" id="composerFileInput" hidden multiple accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md,.csv,.json,.xml,.yaml,.yml,.js,.jsx,.ts,.tsx,.py,.java,.c,.cpp,.cs,.go,.rs,.php,.rb,.sql,.html,.css,.scss,.sh,.zip,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tiff">',
          '<button class="composer__send" id="composerSend" type="button" title="Send message" aria-label="Send message" disabled>',
            '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
          '</button>',
        '</div>',
      '</div>',
    ].join('');

    if (fileCount > 0) this._refreshAttachments();

    const input = container.querySelector("#composerInput");
    const fileInput = container.querySelector("#composerFileInput");
    const uploadBtn = container.querySelector("#composerUpload");
    const sendBtn = container.querySelector("#composerSend");

    const autoResize = () => {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 220) + "px";
    };
    const updateSendState = () => {
      if (this._isStreaming) return;
      const hasContent = String(input.value || "").trim().length > 0 || this._attachedFiles.length > 0;
      sendBtn.disabled = !hasContent;
    };
    input.addEventListener("input", () => { autoResize(); updateSendState(); });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        send();
      }
    });

    const send = () => {
      if (this._isStreaming) return;
      const value = String(input.value || "").trim();
      if (!value && this._attachedFiles.length === 0) return;
      input.value = "";
      autoResize();
      updateSendState();
      if (typeof onSubmit === "function") {
        onSubmit(value, this._attachedFiles.slice());
      }
    };

    sendBtn.addEventListener("click", send);

    uploadBtn.addEventListener("click", () => {
      fileInput.click();
    });

    container.addEventListener("dragover", (e) => {
      e.preventDefault();
      container.classList.add("is-dragover");
    });
    container.addEventListener("dragleave", () => {
      container.classList.remove("is-dragover");
    });
    container.addEventListener("drop", async (e) => {
      e.preventDefault();
      container.classList.remove("is-dragover");
      const files = Array.from(e.dataTransfer.files || []);
      await this._handleFiles(files, fileInput);
    });

    if (fileInput) {
      fileInput.addEventListener("change", async (event) => {
        const files = Array.from(event.target.files || []);
        event.target.value = "";
        await this._handleFiles(files, fileInput);
      });
    }

    this._syncSendButton();
    return { input, sendBtn, fileInput, uploadBtn };
  },

  setStreaming(isStreaming, onStop) {
    this._isStreaming = !!isStreaming;
    this._onStop = onStop || null;
    this._syncSendButton();
  },

  _syncSendButton() {
    const sendBtn = document.getElementById("composerSend");
    if (!sendBtn) return;
    if (this._isStreaming) {
      sendBtn.className = "composer__stop";
      sendBtn.disabled = false;
      sendBtn.title = "Stop generation";
      sendBtn.setAttribute("aria-label", "Stop generation");
      sendBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
      sendBtn.onclick = (e) => {
        e.preventDefault();
        if (this._onStop) this._onStop();
      };
    } else {
      sendBtn.className = "composer__send";
      sendBtn.title = "Send message";
      sendBtn.setAttribute("aria-label", "Send message");
      sendBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
      const hasContent = (document.getElementById("composerInput")?.value || "").trim().length > 0 || this._attachedFiles.length > 0;
      sendBtn.disabled = !hasContent;
    }
  },

  async _handleFiles(files, fileInput) {
    const maxSize = 50 * 1024 * 1024;
    const validFiles = [];
    const errors = [];

    for (const file of files) {
      if (file.size > maxSize) {
        errors.push(`${file.name} is too large (max 50MB)`);
        continue;
      }
      validFiles.push(file);
    }

    for (const err of errors) {
      window.Clarity.toast.show(err, "danger");
    }
    if (validFiles.length === 0) return;

    window.Clarity.toast.show(`Uploading ${validFiles.length} file(s)...`, "info");

    try {
      const formData = new FormData();
      validFiles.forEach(f => formData.append("files", f, f.name));

      const resp = await fetch(window.Clarity.api.base + "/api/files/upload", {
        method: "POST",
        body: formData,
      });
      const data = await resp.json();

      for (const result of (data.files || [])) {
        if (result.ok && result.file_type === "archive") {
          const projectName = validFiles.find(f => f.name === result.filename)?.name || "Uploaded Project";
          const projResp = await fetch(window.Clarity.api.base + "/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: projectName, description: "Auto-created from upload" }),
          });
          const projData = await projResp.json();
          const projectId = projData.id;

          if (result.extracted && result.extracted.length > 0) {
            await fetch(window.Clarity.api.base + `/api/projects/${projectId}/index`, { method: "POST" });
          }

          this._attachedFiles.push({
            id: projectId,
            name: projectName,
            type: "project",
            url: `#/project/${projectId}`,
          });
        } else if (result.ok) {
          if (result.file_type === "image") {
            const url = await this._getFileUrl(result.id);
            this._attachedFiles.push({
              id: result.id,
              file_id: result.id,
              name: result.filename,
              type: "image",
              url: url,
              mime: result.mime,
            });
          } else {
            this._attachedFiles.push({
              id: result.id,
              file_id: result.id,
              name: result.filename,
              type: "file",
              mime: result.mime,
              content: "",
            });
          }
        } else {
          window.Clarity.toast.show(`Failed to upload ${result.filename}: ${result.error || "unknown error"}`, "danger");
        }
      }

      if (validFiles.length > 0) {
        window.Clarity.toast.show(`Uploaded ${validFiles.length} file(s)`, "success");
        this._refreshAttachments();
        this._syncSendButton();
      }
    } catch (err) {
      window.Clarity.toast.show("Upload failed: " + (err.message || "network error"), "danger");
    }
  },

  async _getFileUrl(fileId) {
    return window.Clarity.api.base + `/api/files/${fileId}/raw`;
  },

  async _getFileContent(fileId) {
    try {
      const data = await window.Clarity.api.get(`/api/files/${fileId}/content`);
      return data.content || "";
    } catch (err) {
      return "";
    }
  },

  removeFile(fileId) {
    this._attachedFiles = this._attachedFiles.filter(f => f.id !== fileId);
    this._refreshAttachments();
  },

  _refreshAttachments() {
    const container = document.getElementById("composerAttachments");
    if (!container) return;
    if (this._attachedFiles.length === 0) {
      container.innerHTML = "";
      container.classList.remove("is-active");
    } else {
      container.innerHTML = this._renderAttachments();
      container.classList.add("is-active");
      this._bindRemoveButtons();
    }
    const sendBtn = document.getElementById("composerSend");
    if (sendBtn) {
      const hasContent = (document.getElementById("composerInput")?.value || "").trim().length > 0 || this._attachedFiles.length > 0;
      sendBtn.disabled = !hasContent;
    }
  },

  _renderAttachments() {
    if (this._attachedFiles.length === 0) return "";
    const items = this._attachedFiles.map(att => {
      const isImage = att.type === "image";
      const isProject = att.type === "project";
      const typeIcon = isImage
        ? `<img src="${att.url}" alt="" class="attachment-thumb" />`
        : isProject
        ? `<span class="attachment-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l1.5 2H18.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z"/></svg></span>`
        : `<span class="attachment-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></span>`;
      const safeName = window.Clarity.utils.escapeHtml(att.name || "file");
      return `<span class="attachment-preview-item" data-attach-id="${att.id}" title="${safeName}">
        ${typeIcon}
        <span class="attachment-name">${safeName}</span>
        <button class="attachment-remove" type="button" title="Remove ${safeName}" aria-label="Remove ${safeName}">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </span>`;
    });
    return `<div class="composer__attachments-row">${items.join("")}</div>`;
  },

  _bindRemoveButtons() {
    document.querySelectorAll(".attachment-remove").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const item = btn.closest("[data-attach-id]");
        const fileId = item.getAttribute("data-attach-id");
        this.removeFile(fileId);
        window.Clarity.uiChat._attachedFiles = this._attachedFiles;
        window.Clarity.uiChat._saveState();
      });
    });
  },

  getAttachedFiles() {
    return this._attachedFiles;
  },

  clearAttachments() {
    this._attachedFiles = [];
  },
};


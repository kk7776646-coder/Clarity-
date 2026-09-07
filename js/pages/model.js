window.Clarity = window.Clarity || {};
window.Clarity.pages = window.Clarity.pages || {};

const MODEL_PROVIDERS = [
  { id: "openrouter", label: "OpenRouter", defaultBase: "https://openrouter.ai/api/v1", needsKey: true },
  { id: "openai", label: "OpenAI", defaultBase: "https://api.openai.com/v1", needsKey: true },
  { id: "gemini", label: "Google Gemini", defaultBase: "https://generativelanguage.googleapis.com/v1beta/openai/", needsKey: true },
  { id: "anthropic", label: "Anthropic", defaultBase: "https://api.anthropic.com/v1", needsKey: true },
  { id: "groq", label: "Groq", defaultBase: "https://api.groq.com/openai/v1", needsKey: true },
  { id: "mistral", label: "Mistral AI", defaultBase: "https://api.mistral.ai/v1", needsKey: true },
  { id: "together", label: "Together AI", defaultBase: "https://api.together.xyz/v1", needsKey: true },
  { id: "ollama", label: "Ollama (local)", defaultBase: "http://localhost:11434/v1", needsKey: false },
  { id: "azure", label: "Azure OpenAI", defaultBase: "", needsKey: true },
  { id: "custom", label: "Custom / Other (OpenAI-compatible)", defaultBase: "", needsKey: true },
];

function escapeAttr(s) { return String(s ?? "").replace(/"/g, "&quot;"); }

window.Clarity.pages.model = async function renderModelPage() {
  const main = document.getElementById("main");
  if (!main) return;

  let models = [];
  let activeId = null;
  let loadError = null;
  try {
    const data = await window.Clarity.api.get("/api/models");
    models = data.models || [];
    activeId = data.active;
  } catch (err) {
    loadError = err.message || "Failed to load models";
  }

  const sortedModels = models.slice().sort((a, b) => {
    if (a.id === activeId) return -1;
    if (b.id === activeId) return 1;
    return (a.name || "").localeCompare(b.name || "");
  });
  window.Clarity.pages._modelCache = sortedModels;

  main.innerHTML = [
    '<div class="page"><div class="page__inner">',
    '<header class="page__header">',
    '<div><h1 class="page__title">Model Management</h1>',
    '<p class="page__subtitle">Configure AI models. Each model is a real, complete provider configuration used by the backend for every request.</p></div>',
    '<div class="hstack" style="gap:8px;">',
    '<button class="btn btn--ghost btn--sm" id="refreshModelsBtn" type="button" title="Refresh models" aria-label="Refresh models">',
    '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
    ' Refresh</button>',
    '<button class="btn btn--primary" id="addModelBtn" type="button">',
    '<svg class="icon" viewBox="0 0 24 24" style="width:14px;height:14px;"><path d="M12 5v14M5 12h14"/></svg>',
    ' Add Models</button>',
    '</div></header>',
    loadError ? '<div class="alert alert--danger">' + window.Clarity.utils.escapeHtml(loadError) + '</div>' : '',
    '<section class="model-grid">',
    sortedModels.length === 0 ? '<div class="empty-state">No models configured. Click "Add Models" to add your first one.</div>' : '',
    sortedModels.map(modelCardHtml).join(""),
    '</section>',
    '</div></div>'
  ].join("");

  bindModelPageEvents();
};

function statusBadge(model) {
  const enabled = model.enabled !== false;
  if (!enabled) return '<span class="tag tag--muted">Disabled</span>';
  const s = model.status || "untested";
  if (s === "available") return '<span class="tag tag--ok">Available</span>';
  if (s === "unavailable") return '<span class="tag tag--danger">Unavailable</span>';
  if (s === "auth_error") return '<span class="tag tag--danger">Auth Error</span>';
  if (s === "rate_limit") return '<span class="tag tag--warn">Rate Limited</span>';
  if (s === "config_error") return '<span class="tag tag--danger">Config Error</span>';
  return '<span class="tag tag--muted">Untested</span>';
}

function modelCardHtml(model) {
  const isActive = model.is_active || model.id === (window.Clarity.modelSelector && window.Clarity.modelSelector._active);
  const caps = model.capabilities || {};
  const capTags = [];
  if (caps.text) capTags.push('<span class="tag tag--xs">Text</span>');
  if (caps.vision) capTags.push('<span class="tag tag--xs">Vision</span>');
  if (caps.codeGeneration) capTags.push('<span class="tag tag--xs">Code</span>');
  if (caps.imageGeneration) capTags.push('<span class="tag tag--xs">Image</span>');
  if (caps.fileAnalysis) capTags.push('<span class="tag tag--xs">Files</span>');
  if (caps.streaming) capTags.push('<span class="tag tag--xs">Stream</span>');

  const isUserModel = !!model.isUser;
  const enabled = model.enabled !== false;
  const lastTested = model.lastTestedAt ? new Date(model.lastTestedAt * 1000).toLocaleString() : null;
  const lastErr = model.lastError ? '<div class="muted" style="font-size:12px;color:var(--color-danger,#c0392b);margin-top:4px;">' + window.Clarity.utils.escapeHtml(model.lastError) + '</div>' : '';

  return '<article class="card model-card ' + (isActive ? "is-active" : "") + ' ' + (enabled ? "" : "is-disabled") + '" data-model-id="' + escapeAttr(model.id) + '">' +
    '<div class="card__body">' +
      '<div class="model-card__head">' +
        '<h3>' + window.Clarity.utils.escapeHtml(model.name) + '</h3>' +
        '<span class="tag">' + window.Clarity.utils.escapeHtml(model.provider || "custom") + '</span>' +
        statusBadge(model) +
      '</div>' +
      '<div class="model-card__body">' +
        '<div class="muted">Registry ID: <code>' + window.Clarity.utils.escapeHtml(model.id) + '</code></div>' +
        '<div class="muted">Provider Model: <code>' + window.Clarity.utils.escapeHtml(model.modelName || model.id) + '</code></div>' +
        (model.baseUrl ? '<div class="muted">Base URL: <code>' + window.Clarity.utils.escapeHtml(model.baseUrl) + '</code></div>' : '') +
      '</div>' +
      '<div class="model-card__meta">' + capTags.join("") + '</div>' +
      (lastTested ? '<div class="muted" style="font-size:12px;">Last tested: ' + window.Clarity.utils.escapeHtml(lastTested) + '</div>' : '') +
      lastErr +
      '<div class="model-card__foot">' +
        '<span class="muted">' + (model.contextWindow || "?") + ' ctx</span>' +
        '<div class="hstack" style="gap:6px;">' +
          (isUserModel ? '<button class="btn btn--ghost btn--sm" type="button" data-action="toggle-enabled" data-model-id="' + escapeAttr(model.id) + '" title="' + (enabled ? "Disable" : "Enable") + '">' + (enabled ? "Disable" : "Enable") + '</button>' : '') +
          '<button class="btn btn--' + (isActive ? "primary" : "outline") + ' btn--sm" type="button" data-action="select" data-model-id="' + escapeAttr(model.id) + '"' + (enabled ? "" : " disabled") + '>' + (isActive ? "Active" : "Select") + '</button>' +
          (isUserModel ? '<button class="btn btn--ghost btn--icon-sm" type="button" data-action="edit" data-model-id="' + escapeAttr(model.id) + '" title="Edit" aria-label="Edit model">' +
            '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>' +
          '</button>' : '') +
          (isUserModel ? '<button class="btn btn--ghost btn--icon-sm" type="button" data-action="delete" data-model-id="' + escapeAttr(model.id) + '" title="Delete" aria-label="Delete model">' +
            '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>' +
          '</button>' : '') +
        '</div>' +
      '</div>' +
    '</div>' +
  '</article>';
}

function bindModelPageEvents() {
  document.getElementById("addModelBtn")?.addEventListener("click", () => openAddModelsModal());
  document.getElementById("refreshModelsBtn")?.addEventListener("click", () => {
    if (window.Clarity.modelSelector) window.Clarity.modelSelector.load();
    window.Clarity.app.navigate("#/model");
  });

  document.querySelectorAll('[data-action="select"]').forEach(btn => {
    btn.addEventListener("click", async () => {
      if (btn.disabled) return;
      const id = btn.getAttribute("data-model-id");
      await window.Clarity.modelSelector.select(id);
      window.Clarity.app.navigate("#/model");
    });
  });
  document.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-model-id");
      let model = (window.Clarity.pages._modelCache || []).find(m => m.id === id) ||
                  (window.Clarity.modelSelector && window.Clarity.modelSelector.getModel(id));
      if (!model) {
        try {
          const res = await window.Clarity.api.get("/api/models/" + encodeURIComponent(id));
          model = res;
        } catch (e) {}
      }
      openModelModal(model);
    });
  });
  document.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-model-id");
      if (!confirm("Delete model '" + id + "'? Existing conversations remain intact.")) return;
      try {
        await window.Clarity.api.del("/api/models/" + encodeURIComponent(id));
        window.Clarity.toast.show("Model deleted", "success");
        if (window.Clarity.modelSelector) await window.Clarity.modelSelector.load();
        window.Clarity.app.navigate("#/model");
      } catch (err) {
        window.Clarity.toast.show("Delete failed: " + (err.message || ""), "danger");
      }
    });
  });
  document.querySelectorAll('[data-action="toggle-enabled"]').forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-model-id");
      const willEnable = btn.textContent.trim() === "Enable";
      try {
        await window.Clarity.api.post("/api/models/" + encodeURIComponent(id) + "/enable", { enabled: willEnable });
        window.Clarity.toast.show(willEnable ? "Model enabled" : "Model disabled", "success");
        if (window.Clarity.modelSelector) await window.Clarity.modelSelector.load();
        window.Clarity.app.navigate("#/model");
      } catch (err) {
        window.Clarity.toast.show("Update failed: " + (err.message || ""), "danger");
      }
    });
  });
}

function openModelModal(existing) {
  const isEdit = !!existing;
  const m = existing || {
    id: "", name: "", provider: "openai", baseUrl: "", apiKey: "",
    modelName: "",
    capabilities: { text: true, vision: false, codeGeneration: false, imageGeneration: false, fileAnalysis: false, streaming: true },
    status: "untested", enabled: true,
  };

  const providerOptions = MODEL_PROVIDERS.map(p =>
    '<option value="' + p.id + '" ' + (p.id === m.provider ? "selected" : "") + '>' + p.label + '</option>'
  ).join("");

  const caps = m.capabilities || {};
  const cap = (k, label) => '<label class="check"><input type="checkbox" name="cap_' + k + '" ' + (caps[k] ? "checked" : "") + '><span class="check__label">' + label + '</span></label>';

  const maskedKeyNote = isEdit && m.hasApiKey
    ? '<div class="muted" style="margin-top:4px;">Current key on file: <code>' + window.Clarity.utils.escapeHtml(m.apiKeyMasked || '••••••') + '</code></div>'
    : '';

  const body = [
    '<form id="modelForm" class="model-form" autocomplete="off">',
      '<div class="model-form__section">',
        '<div class="model-form__row">',
          '<label class="model-form__label" for="mf-name">Display name <span class="req">*</span></label>',
          '<input class="input model-form__input" id="mf-name" type="text" name="name" required value="' + escapeAttr(m.name) + '" placeholder="My Llama">',
        '</div>',
        '<div class="model-form__row">',
          '<label class="model-form__label">Provider Model Mappings <span class="req">*</span></label>',
          '<div class="muted" style="margin-bottom:8px;">Add multiple provider model ID mappings. Each mapping creates an independent model entry.</div>',
        '</div>',
        '<div id="modelMappingsContainer">',
          createEditModelMappingHTML(0, { id: m.id, modelName: m.modelName }, true),
        '</div>',
        '<button type="button" class="btn btn--outline btn--sm" id="addMappingBtn" style="margin-top:8px;">',
          '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
          ' Add Model',
        '</button>',
      '</div>',
      '<div class="model-form__section">',
        '<div class="model-form__row model-form__row--2">',
          '<div class="model-form__field">',
            '<label class="model-form__label" for="mf-provider">Provider <span class="req">*</span></label>',
            '<select class="input model-form__input" id="mf-provider" name="provider">' + providerOptions + '</select>',
          '</div>',
          '<div class="model-form__field">',
            '<label class="model-form__label" for="mf-base">Base URL <span class="req">*</span></label>',
            '<input class="input model-form__input" id="mf-base" type="text" name="baseUrl" value="' + escapeAttr(m.baseUrl) + '" placeholder="https://openrouter.ai/api/v1">',
          '</div>',
        '</div>',
        '<div class="model-form__row">',
          '<label class="model-form__label" for="mf-key">API key' + (isEdit ? ' <span class="muted">(leave blank to keep current)</span>' : '') + '</label>',
          '<input class="input model-form__input" id="mf-key" type="password" name="apiKey" value="" placeholder="' + (isEdit && m.hasApiKey ? '•••••••••••• (Saved securely)' : 'sk-...') + '" autocomplete="new-password">',
          maskedKeyNote,
        '</div>',
        '<fieldset class="model-form__caps">',
          '<legend class="model-form__caps-legend">Capabilities</legend>',
          '<div class="check-grid">',
            cap("text", "Text"),
            cap("vision", "Vision"),
            cap("codeGeneration", "Code"),
            cap("imageGeneration", "Image"),
            cap("fileAnalysis", "Files"),
            cap("streaming", "Stream"),
          '</div>',
        '</fieldset>',
      '</div>',
      '<div id="modelTestResult" class="model-form__result" style="display:none"></div>',
    '</form>'
  ].join("");

  const actions = [
    '<button class="btn btn--outline" type="button" data-modal-close="true">Cancel</button>',
    '<button class="btn btn--ghost" type="button" id="modelTestBtn">Test connection</button>',
    '<button class="btn btn--primary" type="button" id="modelSaveBtn">' + (isEdit ? "Save changes" : "Save model") + '</button>',
  ].join("");

  window.Clarity.modal.open(isEdit ? "Edit model" : "Add model", body, actions);

  _modelMappings = [{ id: m.id, modelName: m.modelName }];

  document.getElementById("addMappingBtn")?.addEventListener("click", () => {
    _modelMappings.push({ id: "", modelName: "" });
    const idx = _modelMappings.length - 1;
    const container = document.getElementById("modelMappingsContainer");
    if (container) {
      container.insertAdjacentHTML("beforeend", createEditModelMappingHTML(idx, _modelMappings[idx], false));
    }
  });

  const providerSel = document.getElementById("mf-provider");
  const baseInput = document.getElementById("mf-base");
  providerSel?.addEventListener("change", () => {
    const p = MODEL_PROVIDERS.find(x => x.id === providerSel.value);
    if (p && p.defaultBase) {
      baseInput.value = p.defaultBase;
    }
  });

  document.getElementById("modelTestBtn").addEventListener("click", async () => {
    const payload = collectEditModelForm();
    if (!payload.id || !payload.modelName) {
      showTestResult("At least one Registry ID and Provider Model ID is required.", false);
      return;
    }
    if (!payload.baseUrl && payload.provider !== "ollama" && payload.provider !== "anthropic") {
      showTestResult("Base URL is required for this provider.", false);
      return;
    }
    if (!payload.apiKey && !existing?.hasApiKey && payload.provider !== "ollama") {
      showTestResult("API key is required for this provider.", false);
      return;
    }
    showTestResult("Testing connection with " + payload.modelName + "…", null);
    try {
      const res = await window.Clarity.api.post("/api/models/test", payload);
      const ok = !!res.ok;
      let msg;
      if (ok) {
        msg = "✓ Connection successful — provider responded.";
      } else {
        const type = res.error_type || "";
        if (type === "auth_error") msg = "✗ Connection failed: Invalid API key.";
        else if (type === "model_not_found") msg = "✗ Connection failed: Provider rejected the model ID \"" + payload.modelName + "\".";
        else if (type === "connection_error") msg = "✗ Connection failed: Provider unreachable.";
        else if (type === "rate_limit") msg = "✗ Connection failed: Rate limited by provider.";
        else if (type === "missing_api_key") msg = "✗ API key required.";
        else if (type === "missing_base_url") msg = "✗ API key required.";
        else msg = "✗ Connection failed: " + (res.error || "Unknown error");
      }
      showTestResult(msg + (res.note ? " — " + res.note : ""), ok);
      if (ok) {
        try {
          await window.Clarity.api.post("/api/models/set-active", { model_id: payload.id });
        } catch (e) {}
        if (window.Clarity.modelSelector) await window.Clarity.modelSelector.load();
        window.Clarity.app.navigate("#/model");
        window.Clarity.modal.close();
        window.Clarity.toast.show("Model verified — status: Available", "success");
      }
    } catch (err) {
      showTestResult("✗ Test failed: " + (err.message || ""), false);
    }
  });

  document.getElementById("modelSaveBtn").addEventListener("click", async () => {
    const payload = collectEditModelForm();
    if (!payload.id || !payload.modelName) {
      window.Clarity.toast.show("Registry ID and Provider Model ID are required", "danger");
      return;
    }
    try {
      if (isEdit) {
        await window.Clarity.api.put("/api/models/" + encodeURIComponent(existing.id), payload);
      } else {
        await window.Clarity.api.post("/api/models", payload);
        try {
          await window.Clarity.api.post("/api/models/set-active", { model_id: payload.id });
        } catch (e) {}
      }

      let additionalCount = 0;
      const mappingContainer = document.getElementById("modelMappingsContainer");
      if (mappingContainer) {
        const mappings = mappingContainer.querySelectorAll(".model-mapping");
        for (const el of mappings) {
          const idx = parseInt(el.getAttribute("data-mapping-index"));
          if (isNaN(idx) || idx === 0) continue;

          const addId = el.querySelector("[name='mappings[" + idx + "][id]']")?.value?.trim();
          const addModelName = el.querySelector("[name='mappings[" + idx + "][modelName]']")?.value?.trim();
          if (!addId || !addModelName) continue;

          const additionalPayload = {
            name: addModelName.split("/").pop() || addId,
            id: addId,
            modelName: addModelName,
            provider: payload.provider,
            baseUrl: payload.baseUrl,
            apiKey: payload.apiKey,
            capabilities: payload.capabilities,
            status: "untested",
            enabled: true,
          };
          try {
            await window.Clarity.api.post("/api/models", additionalPayload);
            additionalCount++;
          } catch (e) {
            console.warn("Failed to create additional model:", e);
          }
        }
      }

      if (isEdit) {
        window.Clarity.toast.show("Model updated" + (additionalCount > 0 ? " and " + additionalCount + " additional model(s) added" : ""), "success");
      } else {
        window.Clarity.toast.show("Model added" + (additionalCount > 0 ? " and " + additionalCount + " additional model(s) added" : ""), "success");
      }
      if (window.Clarity.modelSelector) await window.Clarity.modelSelector.load();
      window.Clarity.modal.close();
      window.Clarity.app.navigate("#/model");
    } catch (err) {
      window.Clarity.toast.show("Save failed: " + (err.message || ""), "danger");
    }
  });
}

function createEditModelMappingHTML(index, mapping, isFirst) {
  const removeBtn = isFirst
    ? ''
    : '<button type="button" class="btn btn--ghost btn--sm" onclick="removeEditModelMapping(' + index + ')" style="margin-left:auto;">Remove</button>';

  return [
    '<div class="model-mapping" id="editModelMapping' + index + '" data-mapping-index="' + index + '" style="display:flex;gap:12px;align-items:flex-start;margin-bottom:8px;">',
      '<div style="flex:1;">',
        '<label class="model-form__label" for="mapping-id-' + index + '">Registry ID <span class="req">*</span></label>',
        '<input class="input model-form__input" id="mapping-id-' + index + '" type="text" name="mappings[' + index + '][id]" required ' + (isFirst ? 'readonly' : '') + ' value="' + escapeAttr(mapping.id || "") + '" placeholder="my-llama">',
        isFirst ? '<div class="muted">Local identifier; cannot be changed.</div>' : '<div class="muted">Local identifier; never sent to provider.</div>',
      '</div>',
      '<div style="flex:1;">',
        '<label class="model-form__label" for="mapping-mname-' + index + '">Provider model ID <span class="req">*</span></label>',
        '<input class="input model-form__input" id="mapping-mname-' + index + '" type="text" name="mappings[' + index + '][modelName]" required value="' + escapeAttr(mapping.modelName || "") + '" placeholder="meta-llama/llama-3.3-70b-instruct">',
        '<div class="muted">Exact ID the provider API expects.</div>',
      '</div>',
      removeBtn,
    '</div>'
  ].join("");
}

function removeEditModelMapping(index) {
  const entry = document.getElementById("editModelMapping" + index);
  if (entry) {
    entry.remove();
    _modelMappings[index] = null;
  }
}

function collectEditModelForm() {
  const name = document.getElementById("mf-name")?.value?.trim() || "";
  const provider = document.getElementById("mf-provider")?.value || "openai";
  const baseUrl = document.getElementById("mf-base")?.value?.trim() || "";
  const apiKey = document.getElementById("mf-key")?.value || "";

  const capabilities = {
    text: document.querySelector("[name='cap_text']")?.checked || false,
    vision: document.querySelector("[name='cap_vision']")?.checked || false,
    codeGeneration: document.querySelector("[name='cap_codeGeneration']")?.checked || false,
    imageGeneration: document.querySelector("[name='cap_imageGeneration']")?.checked || false,
    fileAnalysis: document.querySelector("[name='cap_fileAnalysis']")?.checked || false,
    streaming: document.querySelector("[name='cap_streaming']")?.checked || false,
  };

  const mappingContainer = document.getElementById("modelMappingsContainer");
  let mappingId = "";
  let mappingModelName = "";

  if (mappingContainer) {
    const firstMapping = mappingContainer.querySelector(".model-mapping");
    if (firstMapping) {
      const idx = firstMapping.getAttribute("data-mapping-index");
      mappingId = firstMapping.querySelector("[name='mappings[" + idx + "][id]']")?.value?.trim() || "";
      mappingModelName = firstMapping.querySelector("[name='mappings[" + idx + "][modelName]']")?.value?.trim() || "";
    }
  }

  return {
    name: name || mappingModelName.split("/").pop() || mappingId,
    id: mappingId,
    modelName: mappingModelName,
    provider,
    baseUrl,
    apiKey,
    capabilities,
  };
}

let _modelMappings = [];

function openAddModelsModal() {
  _modelMappings = [
    { id: "", modelName: "", displayName: "" },
  ];

  const providerOptions = MODEL_PROVIDERS.map(p =>
    '<option value="' + p.id + '">' + p.label + '</option>'
  ).join("");

  const body = [
    '<form id="addModelsForm" class="add-models-form" autocomplete="off">',
      '<p class="muted" style="margin-bottom:16px;">',
        'Add multiple models using the same provider connection. The API key is stored once and shared by every model below.',
      '</p>',

      '<div class="model-form__section">',
        '<div class="model-form__section-title">Provider configuration</div>',
        '<div class="model-form__row model-form__row--2">',
          '<div class="model-form__field">',
            '<label class="model-form__label" for="mf-provider">Provider <span class="req">*</span></label>',
            '<select class="input model-form__input" id="mf-provider" name="provider">' + providerOptions + '</select>',
          '</div>',
          '<div class="model-form__field">',
            '<label class="model-form__label" for="mf-base">Base URL <span class="req">*</span></label>',
            '<input class="input model-form__input" id="mf-base" type="text" name="baseUrl" value="" placeholder="https://openrouter.ai/api/v1">',
          '</div>',
        '</div>',
        '<div class="model-form__row">',
          '<label class="model-form__label" for="mf-key">API key <span class="req">*</span></label>',
          '<input class="input model-form__input" id="mf-key" type="password" name="apiKey" value="" placeholder="sk-or-v1-..." autocomplete="new-password">',
          '<div class="muted">One API key can power multiple models. It is stored once and reused for every model in this form.</div>',
        '</div>',
      '</div>',

      '<div class="model-form__section">',
        '<div class="model-form__section-title">Models using this API key</div>',
        '<div id="modelMappingsContainer">',
          createModelMappingHTML(0, _modelMappings[0]),
        '</div>',
        '<button type="button" class="btn btn--outline btn--sm" id="addMappingBtn" style="margin-top:8px;">',
          '<svg class="icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
          ' Add Another Model',
        '</button>',
      '</div>',

      '<div id="addModelsResult" class="model-form__result" style="display:none;"></div>',
    '</form>'
  ].join("");

  const actions = [
    '<button class="btn btn--outline" type="button" data-modal-close="true">Cancel</button>',
    '<button class="btn btn--primary" type="button" id="saveModelsBtn">Save Models</button>',
  ].join("");

  window.Clarity.modal.open("Add Models", body, actions);

  document.getElementById("mf-provider")?.addEventListener("change", () => {
    const sel = document.getElementById("mf-provider");
    const baseInput = document.getElementById("mf-base");
    if (sel && baseInput) {
      const p = MODEL_PROVIDERS.find(x => x.id === sel.value);
      if (p && p.defaultBase && !baseInput.value) {
        baseInput.value = p.defaultBase;
      }
    }
  });

  document.getElementById("addMappingBtn")?.addEventListener("click", () => {
    _modelMappings.push({ id: "", modelName: "", displayName: "" });
    const idx = _modelMappings.length - 1;
    const container = document.getElementById("modelMappingsContainer");
    if (container) {
      container.insertAdjacentHTML("beforeend", createModelMappingHTML(idx, _modelMappings[idx]));
    }
  });

  document.getElementById("saveModelsBtn")?.addEventListener("click", async () => {
    const payloads = collectAddModelsFormNew();
    if (!payloads || payloads.length === 0) {
      showAddModelsResultNew("At least one model mapping with Registry ID and Provider Model ID is required.", false);
      return;
    }

    let successCount = 0;
    let failCount = 0;
    const errors = [];

    for (const payload of payloads) {
      if (!payload.id || !payload.modelName) {
        failCount++;
        errors.push("Mapping '" + (payload.id || 'unnamed') + "' is missing required fields.");
        continue;
      }

      try {
        await window.Clarity.api.post("/api/models", payload);
        successCount++;
      } catch (err) {
        failCount++;
        errors.push("Failed to add '" + (payload.id) + "': " + (err.message || "Unknown error"));
      }
    }

    if (successCount > 0) {
      window.Clarity.toast.show(successCount + " model(s) added" + (failCount > 0 ? " (" + failCount + " failed)" : ""), failCount > 0 ? "warning" : "success");
      if (window.Clarity.modelSelector) await window.Clarity.modelSelector.load();
      window.Clarity.modal.close();
      window.Clarity.app.navigate("#/model");
    } else {
      showAddModelsResultNew("Failed to add models:\n" + errors.join("\n"), false);
    }
  });
}

function createModelMappingHTML(index, mapping) {
  const removeBtn = index === 0
    ? ''
    : '<button type="button" class="btn btn--ghost btn--sm" onclick="removeModelMapping(' + index + ')" style="margin-left:auto;">Remove</button>';

  return [
    '<div class="model-mapping card" id="modelMapping' + index + '" data-mapping-index="' + index + '" style="padding:12px;margin-bottom:12px;">',
      '<div class="hstack" style="justify-content:space-between;align-items:center;margin-bottom:8px;">',
        '<strong style="font-size:13px;">Model ' + (index + 1) + '</strong>',
        removeBtn,
      '</div>',
      '<div class="model-form__row">',
        '<label class="model-form__label" for="mapping-name-' + index + '">Display name <span class="req">*</span></label>',
        '<input class="input model-form__input" id="mapping-name-' + index + '" type="text" name="mappings[' + index + '][displayName]" value="' + escapeAttr(mapping.displayName || "") + '" placeholder="Llama 3.3 70B">',
      '</div>',
      '<div class="model-form__row model-form__row--2">',
        '<div class="model-form__field">',
          '<label class="model-form__label" for="mapping-id-' + index + '">Registry ID <span class="req">*</span></label>',
          '<input class="input model-form__input" id="mapping-id-' + index + '" type="text" name="mappings[' + index + '][id]" required value="' + escapeAttr(mapping.id || "") + '" placeholder="llama-3-70b">',
        '</div>',
        '<div class="model-form__field">',
          '<label class="model-form__label" for="mapping-mname-' + index + '">Provider model ID <span class="req">*</span></label>',
          '<input class="input model-form__input" id="mapping-mname-' + index + '" type="text" name="mappings[' + index + '][modelName]" required value="' + escapeAttr(mapping.modelName || "") + '" placeholder="meta-llama/llama-3.3-70b-instruct">',
        '</div>',
      '</div>',
      '<fieldset class="model-form__caps" style="margin-top:8px;">',
        '<legend class="model-form__caps-legend">Capabilities</legend>',
        '<div class="check-grid">',
          '<label class="check"><input type="checkbox" name="mappings[' + index + '][cap_text]" checked><span class="check__label">Text</span></label>',
          '<label class="check"><input type="checkbox" name="mappings[' + index + '][cap_streaming]" checked><span class="check__label">Stream</span></label>',
          '<label class="check"><input type="checkbox" name="mappings[' + index + '][cap_codeGeneration]"><span class="check__label">Code</span></label>',
          '<label class="check"><input type="checkbox" name="mappings[' + index + '][cap_fileAnalysis]"><span class="check__label">Files</span></label>',
          '<label class="check"><input type="checkbox" name="mappings[' + index + '][cap_vision]"><span class="check__label">Vision</span></label>',
        '</div>',
      '</fieldset>',
    '</div>'
  ].join("");
}

function removeModelMapping(index) {
  const entry = document.getElementById("modelMapping" + index);
  if (entry) {
    entry.remove();
    _modelMappings[index] = null;
  }
}

function collectAddModelsFormNew() {
  const payloads = [];

  const provider = document.getElementById("mf-provider")?.value || "openai";
  const baseUrl = document.getElementById("mf-base")?.value?.trim() || "";
  const apiKey = document.getElementById("mf-key")?.value || "";

  const mappingContainer = document.getElementById("modelMappingsContainer");
  if (!mappingContainer) return payloads;

  const mappings = mappingContainer.querySelectorAll(".model-mapping");
  mappings.forEach((el) => {
    const idx = el.getAttribute("data-mapping-index");
    if (_modelMappings[idx] === null) return;

    const displayName = el.querySelector("[name='mappings[" + idx + "][displayName]']")?.value?.trim() || "";
    const mappingId = el.querySelector("[name='mappings[" + idx + "][id]']")?.value?.trim() || "";
    const mappingModelName = el.querySelector("[name='mappings[" + idx + "][modelName]']")?.value?.trim() || "";

    if (!mappingId && !mappingModelName) return;

    const capabilities = {
      text: el.querySelector("[name='mappings[" + idx + "][cap_text]']")?.checked || false,
      vision: el.querySelector("[name='mappings[" + idx + "][cap_vision]']")?.checked || false,
      codeGeneration: el.querySelector("[name='mappings[" + idx + "][cap_codeGeneration]']")?.checked || false,
      imageGeneration: false,
      fileAnalysis: el.querySelector("[name='mappings[" + idx + "][cap_fileAnalysis]']")?.checked || false,
      streaming: el.querySelector("[name='mappings[" + idx + "][cap_streaming]']")?.checked || false,
    };

    const name = displayName || mappingModelName.split("/").pop() || mappingId;

    payloads.push({
      name,
      id: mappingId,
      modelName: mappingModelName,
      provider,
      baseUrl,
      apiKey,
      capabilities,
      status: "untested",
      enabled: true,
    });
  });

  return payloads;
}

function showAddModelsResultNew(msg, ok) {
  const el = document.getElementById("addModelsResult");
  if (!el) return;
  el.textContent = msg;
  el.className = "alert " + (ok === null ? "alert--info" : ok ? "alert--success" : "alert--danger");
  el.style.display = "";
}

function showTestResult(msg, ok) {
  const el = document.getElementById("modelTestResult");
  if (!el) return;
  el.textContent = msg;
  el.className = "alert " + (ok === null ? "alert--info" : ok ? "alert--success" : "alert--danger");
  el.style.display = "";
}

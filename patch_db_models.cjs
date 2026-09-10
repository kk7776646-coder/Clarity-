const fs = require('fs');
let code = fs.readFileSync('db.ts', 'utf8');

const crudFunctions = `
export function dbGetModels(): any[] {
  return db.prepare("SELECT * FROM models").all();
}

export function dbGetModel(id: string): any {
  return db.prepare("SELECT * FROM models WHERE id = ?").get(id);
}

export function dbSaveModel(model: any) {
  const stmt = db.prepare(\`
    INSERT INTO models (id, name, provider, base_url, api_key, model_name, model_type, capabilities, context_window, max_output_tokens, default_temperature, default_top_p, supports_streaming, enabled, status, is_user)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      provider = excluded.provider,
      base_url = excluded.base_url,
      api_key = excluded.api_key,
      model_name = excluded.model_name,
      model_type = excluded.model_type,
      capabilities = excluded.capabilities,
      context_window = excluded.context_window,
      max_output_tokens = excluded.max_output_tokens,
      default_temperature = excluded.default_temperature,
      default_top_p = excluded.default_top_p,
      supports_streaming = excluded.supports_streaming,
      enabled = excluded.enabled,
      status = excluded.status,
      is_user = excluded.is_user
  \`);
  
  stmt.run(
    model.id, model.name, model.provider, model.baseUrl || model.base_url || null, model.apiKey || model.api_key || null,
    model.modelName || model.model_name || "", model.modelType || model.model_type || "text",
    typeof model.capabilities === 'string' ? model.capabilities : JSON.stringify(model.capabilities || {}),
    model.contextWindow || model.context_window || 0, model.maxOutputTokens || model.max_output_tokens || 0,
    model.defaultTemperature || model.default_temperature || 0.7, model.defaultTopP || model.default_top_p || 1.0,
    model.supportsStreaming !== false ? 1 : 0, model.enabled !== false ? 1 : 0,
    model.status || "available", model.isUser ? 1 : 0
  );
}

export function dbDeleteModel(id: string) {
  db.prepare("DELETE FROM models WHERE id = ?").run(id);
}
`;

if (!code.includes("dbGetModels")) {
  code += crudFunctions;
  fs.writeFileSync('db.ts', code);
}

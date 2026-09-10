const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace default models with an empty array or a valid default if we need it
code = code.replace(/const defaultModels: ModelItem\[\] = \[\s*\{[\s\S]*?\}\s*\];/g, "const defaultModels: ModelItem[] = [];");

// We need to add the imports for dbGetModels, dbGetModel, dbSaveModel, dbDeleteModel
code = code.replace(
  /createProject as dbCreateProject,/g,
  "createProject as dbCreateProject,\n  dbGetModels,\n  dbSaveModel,\n  dbDeleteModel,"
);

// We should populate the models Map from SQLite when server starts.
code = code.replace(
  /const models = new Map<string, ModelItem>\(defaultModels\.map\(\(m\) => \[m\.id, \{ \.\.\.m \} \]\)\);/g,
  `const models = new Map<string, ModelItem>();
// Initialize models from DB
try {
  const dbModels = dbGetModels();
  for (const row of dbModels) {
    models.set(row.id, {
      id: row.id,
      name: row.name,
      provider: row.provider,
      baseUrl: row.base_url,
      apiKey: row.api_key,
      modelName: row.model_name,
      modelType: row.model_type,
      capabilities: typeof row.capabilities === 'string' ? JSON.parse(row.capabilities) : row.capabilities,
      contextWindow: row.context_window,
      maxOutputTokens: row.max_output_tokens,
      defaultTemperature: row.default_temperature,
      defaultTopP: row.default_top_p,
      supportsStreaming: row.supports_streaming === 1,
      enabled: row.enabled === 1,
      status: row.status,
      isUser: row.is_user === 1
    });
  }
} catch (err) {
  console.error("Error loading models from DB", err);
}`
);

// In POST /api/models, PUT /api/models/:id, we need to call dbSaveModel
code = code.replace(
  /models\.set\(id, newModel\);/g,
  `models.set(id, newModel);\n    try { dbSaveModel(newModel); } catch(err) { console.error(err); }`
);

code = code.replace(
  /models\.set\(id, updated\);/g,
  `models.set(id, updated);\n    try { dbSaveModel(updated); } catch(err) { console.error(err); }`
);

// In DELETE /api/models/:id
code = code.replace(
  /models\.delete\(id\);/g,
  `models.delete(id);\n    try { dbDeleteModel(id); } catch(err) { console.error(err); }`
);

fs.writeFileSync('server.ts', code);

const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace the defaultModels array with just the real one (or empty).
// Actually, let's keep one generic default model that uses process.env.GEMINI_API_KEY
// and call it "Gemini 3.6 Flash" so it represents the actual model.
const newDefaultModels = `
const defaultModels: ModelItem[] = [
  {
    id: "clarity-gemini",
    name: "Gemini 3.6 Flash",
    provider: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    apiKey: process.env.GEMINI_API_KEY || "",
    modelName: "gemini-3.6-flash",
    modelType: "text",
    capabilities: {
      text: true,
      vision: true,
      imageGeneration: false,
      codeGeneration: true,
      fileAnalysis: true,
      streaming: true,
    },
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    defaultTemperature: 0.7,
    defaultTopP: 1.0,
    supportsStreaming: true,
    enabled: true,
    status: process.env.GEMINI_API_KEY ? "available" : "untested",
    isUser: false,
  }
];
`;

code = code.replace(/const defaultModels: ModelItem\[\] = \[\s*\{[\s\S]*?\}\s*\];/g, newDefaultModels.trim());
fs.writeFileSync('server.ts', code);

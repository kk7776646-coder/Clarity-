const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const startIdx = code.indexOf('const defaultModels: ModelItem[] = [');
const endIdx = code.indexOf('const models = new Map<string, ModelItem>');

if (startIdx !== -1 && endIdx !== -1) {
  const newDefaultModels = `const defaultModels: ModelItem[] = [
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
];\n\n`;

  code = code.substring(0, startIdx) + newDefaultModels + code.substring(endIdx);
  fs.writeFileSync('server.ts', code);
}

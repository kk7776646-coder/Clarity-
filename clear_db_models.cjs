const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('./data/clarity.db');
db.exec(`
  DELETE FROM models WHERE name IN ('Clarity (Gemini 3.1 Flash Lite)', 'Gemini 3.1 Flash Lite', 'GPT-4o Mini', 'Claude 3.5 Sonnet', 'Llama 3.3 70B (Groq)');
`);
console.log('Fake models deleted from DB.');

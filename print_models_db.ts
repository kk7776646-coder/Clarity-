import { dbGetModels, dbGetModel } from './db.ts';

async function main() {
  try {
    const models = dbGetModels();
    console.log("DB Models Total:", models.length);
    for (const m of models) {
      console.log(`- ID: ${m.id}, Name: ${m.name}, Provider: ${m.provider}, ModelName: ${m.modelName}, ApiKey: ${m.apiKey ? (m.apiKey.substring(0, 4) + "...") : "none"}`);
    }
  } catch (e) {
    console.error("Failed to query DB models:", e);
  }
}

main();

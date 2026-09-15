import { GoogleGenAI } from "@google/genai";

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  const ai = new GoogleGenAI({ apiKey });
  try {
    const list = await ai.models.list();
    console.log("Supported Models:");
    for (const m of list.models || []) {
      console.log(`- Name: ${m.name}, DisplayName: ${m.displayName}, SupportedMethods: ${m.supportedGenerationMethods?.join(", ")}`);
    }
  } catch (e) {
    console.error("List models failed:", e);
  }
}

listModels();

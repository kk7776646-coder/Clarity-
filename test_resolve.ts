import { resolveModelConfig, listUserModels, getUserModel } from './server.ts';
import { dbSaveUser, dbGetSession, dbGetUser } from './db.ts';

const userId = "user_default";
const userModels = listUserModels(userId);
console.log("userModels length:", userModels.length);
if (userModels.length > 0) {
  console.log("First userModel:", userModels[0].id, "enabled:", userModels[0].enabled);
}

const res = resolveModelConfig("clarity-gemini", userId);
console.log("resolveModelConfig result:", res ? res.id : "null");

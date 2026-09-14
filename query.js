import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync("data/clarity.db");
const stmt = db.prepare("SELECT project_id, name, length(content) as len, typeof(content) as typ, substr(content, 1, 100) as sub FROM project_files WHERE name LIKE '%house_price_prediction.ipynb%'");
console.log(stmt.all());

import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync("data/clarity.db");
const stmt = db.prepare("SELECT id, content FROM project_files WHERE name LIKE '%house_price_prediction.ipynb%'");
const files = stmt.all();

for (const file of files) {
  let content = file.content;
  if (!content) continue;
  
  try {
    JSON.parse(content);
    console.log(`File ${file.id} is already valid JSON`);
  } catch (e) {
    console.log(`Fixing file ${file.id}...`);
    let fixedContent = content;
    const lastCellIndex = fixedContent.lastIndexOf('"cell_type"');
    if (lastCellIndex > 0) {
        let braceIndex = fixedContent.lastIndexOf('{', lastCellIndex);
        if (braceIndex > 0) {
            fixedContent = fixedContent.substring(0, braceIndex);
            fixedContent = fixedContent.replace(/,\s*$/, "");
            fixedContent += "\n]}";
            try {
                JSON.parse(fixedContent);
                console.log(`Fixed file ${file.id}`);
                const update = db.prepare("UPDATE project_files SET content = ? WHERE id = ?");
                update.run(fixedContent, file.id);
            } catch(err) {
                console.error(`Still failed: ${err.message}`);
            }
        }
    }
  }
}

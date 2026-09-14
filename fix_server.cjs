const fs = require('fs');
let file = fs.readFileSync('server.ts', 'utf8');

const target = `app.get("/api/projects/:pid/artifacts", (req, res) => {`;
const replacement = `app.post("/api/projects/:pid/artifacts", (req, res) => {
    const pid = req.params.pid;
    const { filename, content, bufferBase64, category, description, source } = req.body || {};
    if (!filename || !category) return res.status(400).json({ error: "filename and category are required" });
    
    const art = {
      id: "art_" + Math.random().toString(36).substring(2, 9),
      projectId: pid,
      userId: "local",
      filename,
      extension: filename.split('.').pop(),
      mimeType: "application/pdf",
      size: bufferBase64 ? Math.floor((bufferBase64.length * 3) / 4) : 0,
      category,
      description: description || "Exported asset",
      bufferBase64,
      content,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      source: source || "Upload",
      validation: { status: "unverified", message: "Pending validation" }
    };
    projectArtifacts.set(art.id, art);
    res.json({ artifact: art });
  });

  app.get("/api/projects/:pid/artifacts", (req, res) => {`;

if (file.includes(target)) {
  file = file.replace(target, replacement);
  fs.writeFileSync('server.ts', file, 'utf8');
  console.log("Success adding artifacts route");
} else {
  console.log("Target not found!");
}

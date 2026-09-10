const fs = require('fs');
let code = fs.readFileSync('src/project-workspace.jsx', 'utf8');

const targetStr = `                    fetch("/api/projects/" + p.id, { method: "DELETE" })
                      .then(() => {
                        setProjects(projects.filter(proj => proj.id !== p.id));
                      });`;

const replacement = `                    fetch("/api/projects/" + p.id, { method: "DELETE", credentials: "include" })
                      .then(r => r.json())
                      .then(() => {
                        setProjects(projects.filter(proj => proj.id !== p.id));
                      })
                      .catch(err => console.error("Failed to delete project", err));`;

code = code.replace(targetStr, replacement);
fs.writeFileSync('src/project-workspace.jsx', code);
console.log("Patched delete project 2");

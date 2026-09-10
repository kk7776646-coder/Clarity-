const fs = require('fs');
let code = fs.readFileSync('src/project-workspace.jsx', 'utf8');

const targetStr = `            React.createElement("div", { style: { display: "flex", gap: 8, fontSize: 12, color: "var(--primary)", fontWeight: 600 } },
              React.createElement("span", {}, "Open"),
              React.createElement("span", {}, health ? \`Health: \${health?.technical_health_score || 0}\` : "Not analyzed")
            )
          ))`;

const replacement = `            React.createElement("div", { style: { display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" } },
              React.createElement("div", { style: { display: "flex", gap: 8, fontSize: 12, color: "var(--primary)", fontWeight: 600 } },
                React.createElement("span", {}, "Open"),
                React.createElement("span", {}, health ? \`Health: \${health?.technical_health_score || 0}\` : "Not analyzed")
              ),
              React.createElement("button", { 
                className: "btn btn--sm", 
                style: { background: "var(--danger, #dc2626)", color: "white", border: "none", padding: "4px 8px", fontSize: 11, cursor: "pointer", borderRadius: 4 },
                onClick: (e) => {
                  e.preventDefault();
                  if (confirm("Are you sure you want to delete this project?")) {
                    fetch("/api/projects/" + p.id, { method: "DELETE" })
                      .then(() => {
                        setProjects(projects.filter(proj => proj.id !== p.id));
                      });
                  }
                }
              }, "Delete")
            )
          ))`;

code = code.replace(targetStr, replacement);
fs.writeFileSync('src/project-workspace.jsx', code);
console.log("Patched delete project");

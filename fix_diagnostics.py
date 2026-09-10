import re
with open('db.ts', 'r') as f:
    text = f.read()

replacement = """export function deleteArchitectureForProject(projectId: string): void {
  runTransaction(() => {
    db.prepare("DELETE FROM architecture_nodes WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM architecture_edges WHERE project_id = ?").run(projectId);
  });
}

export function saveDiagnostics(projectId: string, diags: Array<Omit<DbDiagnostic, "id" | "project_id" | "created_at"> & { id?: string }>) {
  runTransaction(() => {
    db.prepare("DELETE FROM diagnostics WHERE project_id = ?").run(projectId);
    const stmt = db.prepare(`
      INSERT INTO diagnostics (id, project_id, file_id, severity, category, message, line, column, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const now = Date.now();
    for (const d of diags) {
      const id = d.id || `diag_${projectId}_${Math.random().toString(36).substr(2, 9)}`;
      stmt.run(
        id,
        projectId,
        d.file_id || null,
        d.severity || "info",
        d.category || "general",
        d.message,
        d.line !== undefined ? d.line : null,
        d.column !== undefined ? d.column : null,
        d.status || "open",
        now
      );
    }
  });
}

export function getDiagnostics(projectId: string): DbDiagnostic[] {"""

new_text = text.replace("export function getDiagnostics(projectId: string): DbDiagnostic[] {", replacement)
with open('db.ts', 'w') as f:
    f.write(new_text)


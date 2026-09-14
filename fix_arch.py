import re
with open('db.ts', 'r') as f:
    text = f.read()

def replace_save_arch(m):
    return """export function saveArchitecture(
  projectId: string,
  nodes: Array<{ id: string; node_type?: string; name: string; file_id?: string | null; metadata?: any }>,
  edges: Array<{ id: string; source_node_id: string; target_node_id: string; relationship?: string; confidence?: number; evidence?: string | null }>
) {
  runTransaction(() => {
    db.prepare("DELETE FROM architecture_nodes WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM architecture_edges WHERE project_id = ?").run(projectId);

    const insertNode = db.prepare(`
      INSERT INTO architecture_nodes (id, project_id, node_type, name, file_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const seenNodes = new Set();
    for (const n of nodes) {
      if (!n.id) continue;
      const internalId = projectId + "_" + n.id;
      if (seenNodes.has(internalId)) continue;
      seenNodes.add(internalId);

      const nodeType = n.node_type || (n as any).type || "component";
      const nodeName = n.name || (n as any).label || n.id;
      const fileId = n.file_id || ((n as any).files && (n as any).files[0]) || null;
      const meta = n.metadata ? n.metadata : {
        subType: (n as any).subType,
        description: (n as any).description,
        files: (n as any).files,
        level: (n as any).level,
        evidence: (n as any).evidence,
        metrics: (n as any).metrics,
      };
      insertNode.run(
        internalId,
        projectId,
        nodeType,
        nodeName,
        fileId,
        meta ? JSON.stringify(meta) : null
      );
    }

    const insertEdge = db.prepare(`
      INSERT INTO architecture_edges (id, project_id, source_node_id, target_node_id, relationship, confidence, evidence)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const seenEdges = new Set();
    let edgeCounter = 0;
    for (const e of edges) {
      edgeCounter++;
      const src = e.source_node_id || (e as any).source || (e as any).from;
      const tgt = e.target_node_id || (e as any).target || (e as any).to;
      let edgeId = e.id || `${src}_${tgt}_${edgeCounter}`;
      const internalEdgeId = projectId + "_" + edgeId;
      if (seenEdges.has(internalEdgeId)) continue;
      seenEdges.add(internalEdgeId);

      const evidenceStr = e.evidence ? (typeof e.evidence === 'string' ? e.evidence : JSON.stringify(e.evidence)) : null;
      insertEdge.run(
        internalEdgeId,
        projectId,
        projectId + "_" + src,
        projectId + "_" + tgt,
        e.relationship || (e as any).label || "depends_on",
        e.confidence !== undefined ? e.confidence : 1.0,
        evidenceStr
      );
    }
  });
}
"""

new_text = re.sub(r'export function saveArchitecture\([\s\S]*?\}\s*\}\s*\)\;\s*\}', replace_save_arch, text)
if new_text != text:
    with open('db.ts', 'w') as f:
        f.write(new_text)
    print("Replaced saveArchitecture")
else:
    print("Not replaced")

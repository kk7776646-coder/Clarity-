const fs = require('fs');
let text = fs.readFileSync('db.ts', 'utf-8');

const target = `export function saveArchitecture(
  projectId: string,
  nodes: Array<{ id: string; node_type?: string; name: string; file_id?: string | null; metadata?: any }>,
  edges: Array<{ id: string; source_node_id: string; target_node_id: string; relationship?: string; confidence?: number; evidence?: string | null }>
) {
  runTransaction(() => {
    db.prepare("DELETE FROM architecture_nodes WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM architecture_edges WHERE project_id = ?").run(projectId);

    const insertNode = db.prepare(\`
      INSERT INTO architecture_nodes (id, project_id, node_type, name, file_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    \`);
    for (const n of nodes) {
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
        n.id,
        projectId,
        nodeType,
        nodeName,
        fileId,
        JSON.stringify(meta)
      );
    }

    const insertEdge = db.prepare(\`
      INSERT INTO architecture_edges (id, project_id, source_node_id, target_node_id, relationship, confidence, evidence)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    \`);
    for (const e of edges) {
      const evidenceStr = e.evidence ? (typeof e.evidence === 'string' ? e.evidence : JSON.stringify(e.evidence)) : null;
      insertEdge.run(
        e.id,
        projectId,
        e.source_node_id,
        e.target_node_id,
        e.relationship || (e as any).label || "depends_on",
        e.confidence !== undefined ? e.confidence : 1.0,
        evidenceStr
      );
    }
  });
}`;

const replacement = `export function saveArchitecture(
  projectId: string,
  nodes: Array<{ id: string; node_type?: string; name: string; file_id?: string | null; metadata?: any }>,
  edges: Array<{ id: string; source_node_id: string; target_node_id: string; relationship?: string; confidence?: number; evidence?: string | null }>
) {
  runTransaction(() => {
    db.prepare("DELETE FROM architecture_nodes WHERE project_id = ?").run(projectId);
    db.prepare("DELETE FROM architecture_edges WHERE project_id = ?").run(projectId);

    const insertNode = db.prepare(\`
      INSERT INTO architecture_nodes (id, project_id, node_type, name, file_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    \`);
    
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
        JSON.stringify(meta)
      );
    }

    const insertEdge = db.prepare(\`
      INSERT INTO architecture_edges (id, project_id, source_node_id, target_node_id, relationship, confidence, evidence)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    \`);
    
    const seenEdges = new Set();
    let edgeCounter = 0;
    for (const e of edges) {
      edgeCounter++;
      let edgeId = e.id || \`\${e.source_node_id}_\${e.target_node_id}_\${edgeCounter}\`;
      const internalEdgeId = projectId + "_" + edgeId;
      if (seenEdges.has(internalEdgeId)) continue;
      seenEdges.add(internalEdgeId);
      
      const evidenceStr = e.evidence ? (typeof e.evidence === 'string' ? e.evidence : JSON.stringify(e.evidence)) : null;
      insertEdge.run(
        internalEdgeId,
        projectId,
        projectId + "_" + e.source_node_id,
        projectId + "_" + e.target_node_id,
        e.relationship || (e as any).label || "depends_on",
        e.confidence !== undefined ? e.confidence : 1.0,
        evidenceStr
      );
    }
  });
}`;

if (text.includes(target)) {
  text = text.replace(target, replacement);
  fs.writeFileSync('db.ts', text, 'utf-8');
  console.log("Successfully replaced saveArchitecture!");
} else {
  console.error("Target not found!");
}

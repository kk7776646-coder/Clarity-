import re
with open('db.ts', 'r') as f:
    text = f.read()

def replace_get_arch(m):
    return """export function getArchitecture(projectId: string) {
  const nodes = db.prepare("SELECT * FROM architecture_nodes WHERE project_id = ?").all(projectId) as any[];
  const edges = db.prepare("SELECT * FROM architecture_edges WHERE project_id = ?").all(projectId) as any[];
  
  const prefix = projectId + "_";
  return {
    nodes: nodes.map(n => {
      let outId = n.id;
      if (outId.startsWith(prefix)) outId = outId.substring(prefix.length);
      return { ...n, id: outId, metadata: n.metadata ? JSON.parse(n.metadata) : null };
    }),
    edges: edges.map(e => {
      let outId = e.id;
      let srcId = e.source_node_id;
      let tgtId = e.target_node_id;
      if (outId.startsWith(prefix)) outId = outId.substring(prefix.length);
      if (srcId.startsWith(prefix)) srcId = srcId.substring(prefix.length);
      if (tgtId.startsWith(prefix)) tgtId = tgtId.substring(prefix.length);
      return { ...e, id: outId, source_node_id: srcId, target_node_id: tgtId, source: srcId, target: tgtId };
    })
  };
}"""

new_text = re.sub(r'export function getArchitecture\([\s\S]*?\}\s*\}', replace_get_arch, text)
if new_text != text:
    with open('db.ts', 'w') as f:
        f.write(new_text)
    print("Replaced getArchitecture")
else:
    print("Not replaced")

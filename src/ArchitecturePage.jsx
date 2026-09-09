import React, { useState, useEffect, useRef } from "react";

export default function ArchitecturePage({ projectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [versionId, setVersionId] = useState(null);
  const [availableVersions, setAvailableVersions] = useState([]);
  const svgRef = useRef(null);

  useEffect(() => {
    if (!projectId) return;
    const url = versionId ? `/api/projects/${projectId}/architecture?version_id=${versionId}` : `/api/projects/${projectId}/architecture`;
    fetch(url, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        if (d && d.versions) {
          setAvailableVersions(d.versions);
        }
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [projectId, versionId]);

  const nodes = (data && data.nodes) ? data.nodes : [];
  const edges = (data && data.edges) ? data.edges : [];
  const modules = (data && data.modules) ? data.modules : [];
  const entryPoints = (data && data.entry_points) ? data.entry_points : [];
  const summary = (data && data.summary) ? data.summary : {};

  const filteredNodes = nodes.filter((n) => {
    if (filter !== "all" && n.type !== filter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (n.name || "").toLowerCase().includes(q);
      const matchPath = (n.path || "").toLowerCase().includes(q);
      const matchType = (n.type || "").toLowerCase().includes(q);
      return matchName || matchPath || matchType;
    }
    return true;
  });
  const nodeIds = new Set(filteredNodes.map((n) => n.id));
  const visibleEdges = edges.filter((ed) => nodeIds.has(ed.from_node) && nodeIds.has(ed.to_node));

  const nodeTypeColors = {
    file: "var(--primary)",
    function: "#2563eb",
    class: "#9333ea",
    api: "#10b981",
    module: "#f59e0b",
    database: "#ef4444",
    external_service: "#64748b",
    config: "#14b8a6",
    package: "#78716c",
    directory: "#6b7280",
    symbol: "#0ea5e9",
    infrastructure: "#525252",
    project: "#9ca3af",
  };

  const handleNodeClick = (node) => {
    setSelectedNode(node);
  };

  const renderStatus = () => {
    if (loading) {
      return React.createElement("div", { className: "p-8 text-center text-muted", style: { color: "var(--ink-faint)" } }, "Loading architecture...");
    }
    if (error) {
      return React.createElement("div", { className: "p-8 text-center text-muted", style: { color: "var(--ink-faint)" } }, "Error loading architecture.");
    }
    if (!data || !data.ok || !data.nodes) {
      return React.createElement("div", { className: "p-8 text-center text-muted", style: { color: "var(--ink-faint)" } }, "Architecture not available. Run analysis first.");
    }
    return null;
  };

  const renderGraph = () => {
    if (!data || !data.ok || !data.nodes) return null;
    return React.createElement(
      "section",
      { style: { marginBottom: 24, border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface)", overflow: "hidden", position: "relative", minHeight: 400, maxHeight: 560, userSelect: "none" } },
      React.createElement(
        "svg",
        {
          ref: svgRef,
          viewBox: "0 0 800 450",
          style: { width: "100%", height: "100%", display: "block", background: "var(--canvas)" },
          onWheel: (e) => {
            e.preventDefault();
            setZoom(Math.min(Math.max(zoom - e.deltaY * 0.001, 0.5), 2.5));
          },
          onMouseDown: (e) => {
            const startX = e.clientX, startY = e.clientY, startPan = pan;
            const onMove = (ev) => {
              setPan({ x: startPan.x + (ev.clientX - startX) * 0.02, y: startPan.y + (ev.clientY - startY) * 0.02 });
            };
            const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          },
        },
        ...Array.from({ length: 20 }, (_, i) => Array.from({ length: 10 }, (_, j) => React.createElement("circle", { key: `dot-${i}-${j}`, cx: 40 + j * 70, cy: 40 + i * 60, r: 0.5, fill: "var(--line)", opacity: 0.3 }))),
        ...filteredNodes.map((n) => {
          const hashCode = (str) => { let h = 0; for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i); return Math.abs(h); };
          const hVal = hashCode(String(n.id || n.name || ""));
          const x = 120 + (n.type === "api" ? 520 : (n.type === "module" ? 320 : 140 + (hVal % 200)));
          const y = 40 + (hVal % 300);
          return React.createElement(
            "g",
            { key: n.id, transform: `translate(${x},${y})`, onClick: () => handleNodeClick(n), style: { cursor: "pointer" } },
            React.createElement("circle", { r: n.type === "api" ? 24 : (n.type === "file" ? 16 : 12), fill: nodeTypeColors[n.type] || "var(--line-strong)", stroke: selectedNode && selectedNode.id === n.id ? "var(--primary)" : "var(--line)", strokeWidth: selectedNode && selectedNode.id === n.id ? 3 : 1 }),
            React.createElement("text", { x: 0, y: -8, textAnchor: "middle", style: { fontSize: 10, fill: "var(--ink)", fontWeight: 600 } }, String(n.name || n.id).slice(0, 12)),
            React.createElement("text", { x: 0, y: 14, textAnchor: "middle", style: { fontSize: 9, fill: "var(--ink-faint)" } }, n.type)
          );
        }),
        ...visibleEdges.map((ed, idx) => {
          const srcX = 120, srcY = 80 + idx * 60;
          const dstX = 520, dstY = 120 + idx * 80;
          return React.createElement(
            "line",
            { key: ed.id || `e-${idx}`, x1: srcX, y1: srcY, x2: dstX, y2: dstY, stroke: "var(--line-strong)", strokeWidth: 2, strokeLinecap: "round", markerEnd: "url(#arrow)" }
          );
        }),
        React.createElement(
          "defs",
          {},
          React.createElement("marker", { id: "arrow", markerWidth: 8, markerHeight: 8, refX: 6, refY: 3, orient: "auto", markerUnits: "strokeWidth" },
            React.createElement("polygon", { points: "0,0 6,3 0,6", fill: "var(--line-strong)", stroke: "none" })
          )
        )
      ),
      React.createElement(
        "div",
        { style: { position: "absolute", top: 12, right: 12, background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, padding: 10, fontSize: 11, color: "var(--ink)", maxWidth: 260, boxShadow: "var(--shadow)", zIndex: 10 } },
        selectedNode ? React.createElement(
          "div", {},
          React.createElement("strong", { style: { color: "var(--primary)" } }, selectedNode.name || selectedNode.id),
          React.createElement("div", { style: { marginTop: 4 } }, `Type: ${selectedNode.type}`),
          selectedNode.path ? React.createElement("div", {}, `File: ${selectedNode.path}`) : '',
          selectedNode.symbol_name ? React.createElement("div", {}, `Symbol: ${selectedNode.symbol_name}`) : '',
          selectedNode.language ? React.createElement("div", {}, `Lang: ${selectedNode.language}`) : '',
          selectedNode.line_start ? React.createElement("div", {}, `Lines: ${selectedNode.line_start}${selectedNode.line_end ? ` - ${selectedNode.line_end}` : ''}`) : '',
          selectedNode.version_id ? React.createElement("div", {}, `Version: ${selectedNode.version_id}`) : '',
          selectedNode.file_path ? React.createElement("div", {}, `Source: ${selectedNode.file_path}`) : ''
        ) : "Click a node to inspect details."
      )
    );
  };

  return React.createElement(
    "div",
    { className: "arch-page", style: { maxWidth: 1200, margin: "0 auto", padding: 24, color: "var(--ink)", fontFamily: "var(--font-body)", minHeight: "100vh" } },
    renderStatus(),
    (!loading && !error && data && data.ok && data.nodes) ? React.createElement(
      "div", {},
      React.createElement("h1", { style: { fontSize: 24, fontWeight: 600, marginBottom: 4 } }, "Project Architecture"),
      React.createElement("p", { style: { color: "var(--ink-faint)", marginBottom: 16, fontSize: 13 } }, `Project: ${projectId}`),
      React.createElement(
        "div",
        { style: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 } },
        [
          { label: "Files", value: summary.files || 0 },
          { label: "Symbols", value: summary.symbols || 0 },
          { label: "APIs", value: summary.apis || 0 },
          { label: "Modules", value: summary.modules || 0 },
          { label: "Edges", value: summary.edges || 0 },
          { label: "Entry Points", value: (data.entry_points || []).length },
          { label: "Internal Deps", value: summary.internal_dependencies || 0 },
          { label: "External Deps", value: summary.external_dependencies || 0 },
          { label: "Cycles", value: String(summary.cycles_detected || false) },
        ].map((m) => React.createElement(
          "div",
          { key: m.label, style: { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 16, minWidth: 120, flex: "1 1 0", color: "var(--ink)", fontFamily: "var(--font-body)" } },
          React.createElement("div", { style: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ink-faint)", marginBottom: 4 } }, m.label),
          React.createElement("div", { style: { fontSize: 22, fontWeight: 600, color: "var(--primary)" } }, String(m.value))
        ))
      ),
      React.createElement(
        "div",
        { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 16 } },
        React.createElement("label", {}, React.createElement("span", { style: { fontSize: 12, color: "var(--ink-faint)", marginRight: 8 } }, "Node type:"),
          React.createElement(
            "select",
            { value: filter, onChange: (e) => setFilter(e.target.value), style: { fontSize: 12, padding: 4, borderRadius: 6, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)" } },
            ["all", "file", "function", "class", "api", "module", "database", "external_service", "config"].map((f) => React.createElement("option", { key: f, value: f }, f))
          )
        ),
        React.createElement("button", { onClick: () => { setFilter("all"); setSelectedNode(null); setZoom(1); setPan({ x: 0, y: 0 }); }, style: { fontSize: 12, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", cursor: "pointer" } }, "Reset view"),
        React.createElement("span", { style: { fontSize: 11, color: "var(--ink-faint)", marginLeft: "auto" } }, `Showing ${filteredNodes.length} node(s), ${visibleEdges.length} edge(s)`),
        React.createElement("label", { style: { fontSize: 12, color: "var(--ink-faint)", marginLeft: 12 } }, "Version:",
          React.createElement(
            "select",
            { value: versionId || "", onChange: (e) => setVersionId(e.target.value || null), style: { fontSize: 11, padding: 4, borderRadius: 6, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", marginLeft: 4 } },
            React.createElement("option", { value: "" }, "Latest"),
            ...(availableVersions.length > 0 ? availableVersions.map((v) => React.createElement("option", { key: v.id || v.version_id || String(v), value: v.id || v.version_id || String(v) }, v.label || v.id || v.version_id || String(v))) : [])
          )
        )
      ),
      renderGraph()
    ) : null
  );
};

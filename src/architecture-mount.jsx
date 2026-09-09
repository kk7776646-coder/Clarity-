import React from "react";
import { createRoot } from "react-dom/client";
import ArchitecturePage from "./ArchitecturePage";

let architectureRoot = null;

window.Clarity = window.Clarity || {};
window.Clarity.architecture = {
  render(containerId = "arch-mount") {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.hidden = false;
    if (!architectureRoot) {
      architectureRoot = createRoot(container);
    }

    // Extract project ID from the current hash or data attribute
    const hash = window.location.hash || "";
    let pid = container.getAttribute("data-project-id") || null;
    if (!pid) {
      const m = hash.match(/#\/project\/([^\/]+)/);
      if (m) pid = m[1];
    }
    // Also support direct route format: #/project/<id>/architecture
    const architectureMatch = hash.match(/#\/project\/([^\/]+)\/architecture/);
    if (architectureMatch) pid = architectureMatch[1];

    if (!pid) {
      architectureRoot.render(
        React.createElement("div", { style: { padding: 40, textAlign: "center", color: "var(--ink-faint)", fontFamily: "var(--font-body)", minHeight: "100vh" } },
          React.createElement("h2", { style: { fontSize: 24, fontWeight: 600, marginBottom: 12 } }, "Project context required"),
          React.createElement("p", { style: { fontSize: 14, color: "var(--ink-faint)" } }, "Select a project from the Project Workspace to view its architecture.")
        )
      );
      return;
    }

    architectureRoot.render(React.createElement(ArchitecturePage, { projectId: pid }));
  },
};

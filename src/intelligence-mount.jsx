import React from "react";
import { createRoot } from "react-dom/client";
import IntelligencePage from "./IntelligencePage";

let intelligenceRoot = null;

window.Clarity = window.Clarity || {};
window.Clarity.intelligence = {
  render(containerId = "intelligence-mount", projectId = null) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.hidden = false;
    if (!intelligenceRoot) {
      intelligenceRoot = createRoot(container);
    }

    const hash = window.location.hash || "";
    let pid = projectId || container.getAttribute("data-project-id") || null;
    if (!pid) {
      const m = hash.match(/#\/project\/([^\/]+)/);
      if (m) pid = m[1];
    }
    const intMatch = hash.match(/#\/project\/([^\/]+)\/intelligence/);
    if (intMatch) pid = intMatch[1];

    if (!pid) {
      intelligenceRoot.render(
        React.createElement("div", { style: { padding: 40, textAlign: "center", color: "var(--ink-faint)", fontFamily: "var(--font-body)", minHeight: "100vh" } },
          React.createElement("h2", { style: { fontSize: 24, fontWeight: 600, marginBottom: 12 } }, "Project context required"),
          React.createElement("p", { style: { fontSize: 14, color: "var(--ink-faint)" } }, "Select a project from the Project Workspace to view its intelligence.")
        )
      );
      return;
    }

    intelligenceRoot.render(React.createElement(IntelligencePage, { projectId: pid }));
  },
};

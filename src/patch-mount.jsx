import React from "react";
import { createRoot } from "react-dom/client";
import PatchAgentPage from "./PatchAgentPage";

let patchRoot = null;

window.Clarity = window.Clarity || {};
window.Clarity.patchAgent = {
  render(containerId = "patch-mount", projectId = null) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.hidden = false;
    if (!patchRoot) {
      patchRoot = createRoot(container);
    }

    const hash = window.location.hash || "";
    let pid = projectId || container.getAttribute("data-project-id") || null;
    if (!pid) {
      const m = hash.match(/#\/project\/([^\/]+)/);
      if (m) pid = m[1];
    }
    const patchMatch = hash.match(/#\/project\/([^\/]+)\/patch/);
    if (patchMatch) pid = patchMatch[1];

    if (!pid) {
      patchRoot.render(
        React.createElement("div", { style: { padding: 40, textAlign: "center", color: "var(--ink-faint)", fontFamily: "var(--font-body)", minHeight: "100vh" } },
          React.createElement("h2", { style: { fontSize: 24, fontWeight: 600, marginBottom: 12 } }, "Project context required"),
          React.createElement("p", { style: { fontSize: 14, color: "var(--ink-faint)" } }, "Select a project from the Project Workspace to view its patches.")
        )
      );
      return;
    }

    patchRoot.render(React.createElement(PatchAgentPage, { projectId: pid }));
  },
};

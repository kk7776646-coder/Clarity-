import React from "react";
import { createRoot } from "react-dom/client";
import ProjectWorkspace from "./project-workspace";

let workspaceRoot = null;

window.Clarity = window.Clarity || {};

window.Clarity.projectWorkspace = {
  render(containerId = "project-workspace-mount", route = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.hidden = false;

    Object.assign(container.style, {
      position: "fixed",
      inset: "0",
      width: "100%",
      height: "100%",
      overflow: "auto",
      zIndex: "100",
      background: "var(--bg, var(--surface, #fff))",
      boxSizing: "border-box",
    });

    if (!workspaceRoot) {
      workspaceRoot = createRoot(container);
    }

    workspaceRoot.render(
      React.createElement(ProjectWorkspace, {
        route: route || "#/project",
      })
    );
  },
};

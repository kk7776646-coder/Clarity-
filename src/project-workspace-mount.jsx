import React from "react";
import { createRoot } from "react-dom/client";
import ProjectWorkspace from "./project-workspace";

let workspaceRoot = null;
window.Clarity = window.Clarity || {};

window.Clarity.projectWorkspace = {
  render(containerId = "main", route = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

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

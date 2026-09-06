import React from "react";

export default function App() {
  return React.createElement(
    "div",
    { className: "app-root-vite", "data-theme": "light" },
    React.createElement(
      "header",
      { className: "topbar" },
      React.createElement("h1", null, "Clarity — AI Chat")
    ),
    React.createElement("main", { id: "main" }),
    React.createElement("aside", { id: "filePreviewPanel", hidden: true })
  );
}

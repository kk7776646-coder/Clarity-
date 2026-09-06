import React from "react";
import ReactDOM from "react-dom/client";

const App = () => {
  return React.createElement("div", {
    className: "app-root",
    id: "app",
    style: { display: "none" },
  });
};

const root = ReactDOM.createRoot(document.getElementById("app") || document.body);
root.render(React.createElement(App));

// Initialize existing vanilla JS application
if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", () => {
    const appEl = document.getElementById("app");
    if (appEl) appEl.hidden = false;
  });
}

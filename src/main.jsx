import React from "react";
import ReactDOM from "react-dom/client";

// Import all existing vanilla JS modules so Vite bundles them correctly
import "../js/lib/utils.js";
import "../js/lib/icons.js";
import "../js/lib/dom.js";
import "../js/lib/store.js";
import "../js/lib/markdown.js";
import "../js/data/nav.js";
import "../js/services/api.js";
import "../js/services/settings.js";
import "../js/services/theme.js";
import "../js/services/auth.js";
import "../js/ui/toast.js";
import "../js/ui/tooltip.js";
import "../js/ui/modal.js";
import "../js/ui/sources.js";
import "../js/ui/composer.js";
import "../js/ui/chat.js";
import "../js/ui/model-selector.js";
import "../js/ui/sidebar.js";
import "../js/ui/topbar.js";
import "../js/pages/home.js";
import "../js/pages/knowledge.js";
import "../js/pages/collections.js";
import "../js/pages/history.js";
import "../js/pages/settings.js";
import "../js/pages/model.js";
import "../js/pages/project.js";
import "../js/app.js";

import "../css/tokens.css";
import "../css/base.css";
import "../css/layout.css";
import "../css/components.css";
import "../css/pages.css";

const App = () => {
  return React.createElement("div", {
    className: "app-root-vite",
    id: "app",
  });
};

const root = ReactDOM.createRoot(document.getElementById("app"));
root.render(React.createElement(App));

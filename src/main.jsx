// Initialize existing Clarity vanilla JS application
// This script loads all modules. Application bootstrap (init) is performed
// by js/app.js itself, so do NOT register a second DOMContentLoaded listener
// here — two listeners caused init() to run twice and every UI handler to
// be attached twice, cancelling each other out.

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

// Initialize CSS
import "../css/tokens.css";
import "../css/base.css";
import "../css/layout.css";
import "../css/components.css";
import "../css/pages.css";


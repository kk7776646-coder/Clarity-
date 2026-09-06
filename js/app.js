window.NexaRAG = window.NexaRAG || {};

window.NexaRAG.app = {
  async init() {
    const state = window.NexaRAG.settings.get();
    if (window.NexaRAG.theme && typeof window.NexaRAG.theme.init === "function") {
      window.NexaRAG.theme.init();
    }
    window.NexaRAG.settings.applyTheme(state.theme || "system");
    document.documentElement.setAttribute("data-density", state.density || "comfortable");

    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
      const isMobile = window.innerWidth < 1024;
      // On mobile start closed (off-canvas), on desktop start open.
      sidebar.classList.toggle("is-open", !isMobile);
      if (!isMobile) sidebar.classList.remove("is-rail");
    }
    if (window.NexaRAG.sources && typeof window.NexaRAG.sources.toggle === "function") {
      window.NexaRAG.sources.toggle(false);
    }

    window.NexaRAG.uiChat.init();
    window.NexaRAG.uiTopbar.renderThemeToggle();
    window.NexaRAG.uiSidebar.render();

    this.bindGlobalEvents();

    // Auth gate first: nothing that needs a session is requested until the
    // session is known, so no request can 401 during startup.
    const user = await window.NexaRAG.auth.refresh();
    if (!user) {
      window.NexaRAG.auth.renderGate();
    } else {
      window.NexaRAG.auth.clearGate();
      window.NexaRAG.uiTopbar.renderUserMenu();
      await window.NexaRAG.uiTopbar.initModelSelector();
      await window.NexaRAG.uiSidebar.refresh();
      const hash = (window.location.hash || "").trim();
      if (!hash || hash === "#/") {
        window.location.hash = "#/chat";
      }
      await this.navigate(window.NexaRAG.utils.routeFromHash());
    }

    // React to future auth changes (logout, session expiry).
    window.NexaRAG.auth.onChange((nextUser) => {
      if (!nextUser) {
        window.NexaRAG.auth.renderGate();
        return;
      }
      window.NexaRAG.auth.clearGate();
      window.NexaRAG.uiTopbar.renderUserMenu();
    });
  },

  async afterLogin() {
    window.NexaRAG.auth.clearGate();
    window.NexaRAG.uiTopbar.renderUserMenu();
    await window.NexaRAG.uiTopbar.initModelSelector();
    if (window.NexaRAG.uiSidebar) await window.NexaRAG.uiSidebar.refresh();
    if (window.location.hash !== "#/chat") {
      window.location.hash = "#/chat";
    }
    await this.navigate(window.NexaRAG.utils.routeFromHash());
  },

  bindGlobalEvents() {
    const sidebar = document.getElementById("sidebar");
    const brand = document.querySelector(".brand");
    const sidebarCollapse = document.getElementById("sidebarCollapse");
    const scrim = document.getElementById("scrim");

    const setSidebarOpen = (open) => {
      if (!sidebar) return;
      const isOpen = open === undefined ? !sidebar.classList.contains("is-open") : open;
      sidebar.classList.toggle("is-open", isOpen);
      if (isOpen) {
        sidebar.classList.remove("is-rail");
      }
      if (scrim) scrim.hidden = !isOpen;
    };

    if (brand) {
      brand.addEventListener("click", (event) => {
        const isMobile = window.innerWidth < 1024;
        if (isMobile && sidebar) {
          event.preventDefault();
          // Always open on mobile when tapping it.
          sidebar.classList.add("is-open");
          if (scrim) scrim.hidden = false;
        } else if (sidebar && sidebar.classList.contains("is-rail")) {
          event.preventDefault();
          sidebar.classList.remove("is-rail");
        }
      });
    }
    if (sidebarCollapse) {
      sidebarCollapse.addEventListener("click", () => {
        if (!sidebar) return;
        const willBeRail = !sidebar.classList.contains("is-rail");
        sidebar.classList.toggle("is-rail");
        if (sidebar.classList.contains("is-rail")) {
          sidebar.classList.add("is-open");
          sidebarCollapse.setAttribute("data-tooltip", "Expand sidebar");
          sidebarCollapse.setAttribute("aria-label", "Expand sidebar");
          sidebarCollapse.setAttribute("title", "Expand sidebar");
        } else {
          sidebarCollapse.setAttribute("data-tooltip", "Collapse sidebar");
          sidebarCollapse.setAttribute("aria-label", "Collapse sidebar");
          sidebarCollapse.setAttribute("title", "Collapse sidebar");
        }
        if (window.NexaRAG.uiTooltip) window.NexaRAG.uiTooltip.refresh();
      });
    }
    if (scrim) {
      scrim.addEventListener("click", () => {
        setSidebarOpen(false);
      });
    }

    document.querySelectorAll("[data-theme-set]").forEach((button) => {
      button.addEventListener("click", () => {
        const theme = button.getAttribute("data-theme-set");
        window.NexaRAG.settings.applyTheme(theme);
      });
    });

    const topbarBurger = document.getElementById("topbarBurger");
    if (topbarBurger) {
      topbarBurger.addEventListener("click", () => {
        if (!sidebar) return;
        // Always open full sidebar on mobile when burger is clicked.
        sidebar.classList.remove("is-rail");
        sidebar.classList.add("is-open");
        if (scrim) scrim.hidden = false;
      });
    }

    const newChatBtn = document.getElementById("newChatBtn");
    if (newChatBtn) {
      newChatBtn.addEventListener("click", () => {
        window.NexaRAG.uiChat.startNewConversation();
        window.location.hash = "#/chat";
      });
    }

    const sidebarNewChat = document.getElementById("sidebarNewChat");
    if (sidebarNewChat) {
      sidebarNewChat.addEventListener("click", () => {
        window.NexaRAG.uiChat.startNewConversation();
        window.location.hash = "#/chat";
      });
    }

    const refreshConv = document.getElementById("refreshConversations");
    if (refreshConv) {
      refreshConv.addEventListener("click", () => {
        window.NexaRAG.uiSidebar.loadConversations();
      });
    }

    window.addEventListener("hashchange", () => {
      this.navigate(window.NexaRAG.utils.routeFromHash());
    });

    window.addEventListener("resize", () => {
      const dd = document.getElementById("modelSelectorDropdown");
      if (dd && !dd.hidden) {
        const chip = document.getElementById("modelChip");
        if (chip) {
          const rect = chip.getBoundingClientRect();
          dd.style.top = (rect.bottom + 8) + "px";
          dd.style.left = (rect.left) + "px";
        }
      }
    });
  },

  async navigate(route) {
    const path = String(route || "#/chat");
    if (path === "#/explore") {
      window.location.hash = "#/knowledge";
      return;
    }
    const main = document.getElementById("main");
    if (!main) return;

    if (path.startsWith("#/chat/")) {
      const cid = path.replace("#/chat/", "");
      if (cid) {
        await window.NexaRAG.uiChat.loadConversation(cid);
      } else {
        window.NexaRAG.uiChat.renderChat();
      }
      return;
    }

    const page = (
      path === "#/" || path === "#/chat" ? "chat" :
      path === "#/home" ? "home" :
      path === "#/knowledge" ? "knowledge" :
      path === "#/collections" ? "collections" :
      path === "#/history" ? "history" :
      path === "#/settings" ? "settings" :
      path === "#/model" ? "model" :
      path === "#/project" || path.startsWith("#/project/") ? "project" :
      "chat"
    );

    if (page === "chat") {
      const cid = window.NexaRAG.store.get("active_conversation");
      if (cid) {
        await window.NexaRAG.uiChat.loadConversation(cid);
      } else {
        window.NexaRAG.uiChat.renderChat();
      }
    } else {
      const handler = window.NexaRAG.pages && window.NexaRAG.pages[page];
      if (typeof handler === "function") await handler(path);
    }

    if (window.NexaRAG.uiSidebar) window.NexaRAG.uiSidebar.render();
    if (window.NexaRAG.uiTopbar) {
      window.NexaRAG.uiTopbar.renderThemeToggle();
      await window.NexaRAG.uiTopbar.initModelSelector();
    }
  },
};

document.addEventListener("DOMContentLoaded", function () {
  window.NexaRAG.app.init();
});

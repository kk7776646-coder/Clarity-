window.Clarity = window.Clarity || {};

window.Clarity.app = {
  async init() {
    const state = window.Clarity.settings.get();
    if (window.Clarity.theme && typeof window.Clarity.theme.init === "function") {
      window.Clarity.theme.init();
    }
    window.Clarity.settings.applyTheme(state.theme || "system");
    document.documentElement.setAttribute("data-density", state.density || "comfortable");

    const sidebar = document.getElementById("sidebar");
    if (sidebar) {
      const isMobile = window.innerWidth < 1024;
      // On mobile start closed (off-canvas), on desktop start open.
      sidebar.classList.toggle("is-open", !isMobile);
      if (!isMobile) sidebar.classList.remove("is-rail");
    }
    if (window.Clarity.sources && typeof window.Clarity.sources.toggle === "function") {
      window.Clarity.sources.toggle(false);
    }

    window.Clarity.uiChat.init();
    window.Clarity.uiTopbar.renderThemeToggle();
    window.Clarity.uiSidebar.render();

    this.bindGlobalEvents();

    // Auth gate first: nothing that needs a session is requested until the
    // session is known, so no request can 401 during startup.
    const user = await window.Clarity.auth.refresh();
    if (!user) {
      window.Clarity.auth.renderGate();
    } else {
      window.Clarity.auth.clearGate();
      window.Clarity.uiTopbar.renderUserMenu();
      await window.Clarity.uiTopbar.initModelSelector();
      await window.Clarity.uiSidebar.refresh();
      const hash = (window.location.hash || "").trim();
      if (!hash || hash === "#/") {
        window.location.hash = "#/chat";
      }
      await this.navigate(window.Clarity.utils.routeFromHash());
    }

    // React to future auth changes (logout, session expiry).
    window.Clarity.auth.onChange((nextUser) => {
      if (!nextUser) {
        window.Clarity.auth.renderGate();
        return;
      }
      window.Clarity.auth.clearGate();
      window.Clarity.uiTopbar.renderUserMenu();
    });
  },

  async afterLogin() {
    window.Clarity.auth.clearGate();
    window.Clarity.uiTopbar.renderUserMenu();
    await window.Clarity.uiTopbar.initModelSelector();
    if (window.Clarity.uiSidebar) await window.Clarity.uiSidebar.refresh();
    if (window.location.hash !== "#/chat") {
      window.location.hash = "#/chat";
    }
    await this.navigate(window.Clarity.utils.routeFromHash());
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
          sidebar.classList.add("is-open");
          if (scrim) scrim.hidden = false;
          return;
        }
        if (sidebar && sidebar.classList.contains("is-rail")) {
          event.preventDefault();
          sidebar.classList.remove("is-rail");
        }
      });
      brand.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        const isMobile = window.innerWidth < 1024;
        if (isMobile) return;
        if (sidebar && sidebar.classList.contains("is-rail")) {
          event.preventDefault();
          sidebar.classList.remove("is-rail");
        }
      });
    }
if (sidebarCollapse) {
      const syncCollapseAffordance = () => {
        const isRail = sidebar && sidebar.classList.contains("is-rail");
        const label = isRail ? "Expand sidebar" : "Collapse sidebar";
        sidebarCollapse.setAttribute("data-tooltip", label);
        sidebarCollapse.setAttribute("aria-label", label);
        sidebarCollapse.setAttribute("title", label);
        sidebarCollapse.setAttribute("aria-expanded", isRail ? "false" : "true");
      };
      sidebarCollapse.addEventListener("click", () => {
        if (!sidebar) return;
        sidebar.classList.toggle("is-rail");
        if (sidebar.classList.contains("is-rail")) {
          sidebar.classList.add("is-open");
        }
        syncCollapseAffordance();
        if (window.Clarity.uiTooltip) window.Clarity.uiTooltip.refresh();
      });
      syncCollapseAffordance();
    }
    // Single source of truth: re-sync every toggleable affordance whenever the
    // sidebar's expanded/collapsed state changes. The brand is the new
    // collapsed-mode toggle.
    const syncSidebarState = () => {
      const isRail = sidebar && sidebar.classList.contains("is-rail");
      const brand = document.getElementById("sidebarBrand");
      if (brand) {
        brand.setAttribute("aria-expanded", isRail ? "false" : "true");
        brand.setAttribute("aria-label", isRail ? "Open sidebar" : "Go to home");
        if (isRail) {
          brand.setAttribute("role", "button");
          brand.setAttribute("tabindex", "0");
          brand.setAttribute("title", "Open sidebar");
          brand.setAttribute("data-tip-bound", "1");
        } else {
          brand.removeAttribute("role");
          brand.removeAttribute("tabindex");
          brand.removeAttribute("data-tip-bound");
        }
      }
    };
    if (sidebar) {
      new MutationObserver(syncSidebarState).observe(sidebar, { attributes: true, attributeFilter: ["class"] });
      syncSidebarState();
    }
    if (scrim) {
      scrim.addEventListener("click", () => {
        setSidebarOpen(false);
      });
    }

    document.querySelectorAll("[data-theme-set]").forEach((button) => {
      button.addEventListener("click", () => {
        const theme = button.getAttribute("data-theme-set");
        window.Clarity.settings.applyTheme(theme);
      });
    });

    const topbarBurger = document.getElementById("topbarBurger");
    if (topbarBurger) {
      const syncBurgerAffordance = () => {
        const isMobile = window.innerWidth < 1024;
        const isOpen = sidebar && sidebar.classList.contains("is-open");
        const label = isOpen ? "Close navigation" : "Open navigation";
        topbarBurger.setAttribute("aria-label", label);
        topbarBurger.setAttribute("title", label);
        topbarBurger.setAttribute("aria-expanded", isOpen ? "true" : "false");
        topbarBurger.setAttribute("data-tooltip", label);
        topbarBurger.hidden = !isMobile;
      };
      topbarBurger.addEventListener("click", () => {
        if (!sidebar) return;
        const isMobile = window.innerWidth < 1024;
        if (!isMobile) return;
        const isCurrentlyOpen = sidebar.classList.contains("is-open");
        if (isCurrentlyOpen) {
          setSidebarOpen(false);
        } else {
          sidebar.classList.remove("is-rail");
          setSidebarOpen(true);
        }
        syncBurgerAffordance();
      });
      window.addEventListener("resize", syncBurgerAffordance);
      syncBurgerAffordance();
      if (window.Clarity.uiTooltip) window.Clarity.uiTooltip.bind(topbarBurger);
    }

    const newChatBtn = document.getElementById("newChatBtn");
    if (newChatBtn) {
      newChatBtn.addEventListener("click", () => {
        window.Clarity.uiChat.startNewConversation();
        window.location.hash = "#/chat";
      });
    }

    const sidebarNewChat = document.getElementById("sidebarNewChat");
    if (sidebarNewChat) {
      sidebarNewChat.addEventListener("click", () => {
        window.Clarity.uiChat.startNewConversation();
        window.location.hash = "#/chat";
      });
    }

    const refreshConv = document.getElementById("refreshConversations");
    if (refreshConv) {
      refreshConv.addEventListener("click", () => {
        window.Clarity.uiSidebar.loadConversations();
      });
    }

    window.addEventListener("hashchange", () => {
      this.navigate(window.Clarity.utils.routeFromHash());
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
        await window.Clarity.uiChat.loadConversation(cid);
      } else {
        window.Clarity.uiChat.renderChat();
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
      const cid = window.Clarity.store.get("active_conversation");
      if (cid) {
        await window.Clarity.uiChat.loadConversation(cid);
      } else {
        window.Clarity.uiChat.renderChat();
      }
    } else {
      const handler = window.Clarity.pages && window.Clarity.pages[page];
      if (typeof handler === "function") await handler(path);
    }

    if (window.Clarity.uiSidebar) window.Clarity.uiSidebar.render();
    if (window.Clarity.uiTopbar) {
      window.Clarity.uiTopbar.renderThemeToggle();
      await window.Clarity.uiTopbar.initModelSelector();
    }
  },
};

document.addEventListener("DOMContentLoaded", function () {
  window.Clarity.app.init();
});


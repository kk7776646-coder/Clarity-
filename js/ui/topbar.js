window.Clarity = window.Clarity || {};

window.Clarity.uiTopbar = {
  _menuBound: false,

  _getInitials(name) {
    if (!name) return "?";
    const parts = String(name).trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  },

  updateModelChip() {
    if (window.Clarity.modelSelector) {
      window.Clarity.modelSelector.renderChip("modelChip");
    }
  },

  renderThemeToggle() {
    const btn = document.getElementById("themeToggleBtn");
    if (!btn || btn._bound) return;
    btn._bound = true;
    const syncLabel = () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      btn.setAttribute("aria-label", "Toggle theme (current: " + current + ")");
    };
    syncLabel();
    btn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      const next = current === "dark" ? "light" : "dark";
      window.Clarity.settings.applyTheme(next);
      window.Clarity.toast.show("Theme switched to " + next, "success");
      syncLabel();
    });
  },

  async initModelSelector() {
    if (window.Clarity.modelSelector) {
      await window.Clarity.modelSelector.load();
    }
    this._bindModelDropdown();
  },

  /**
   * The top-right profile control. Shows a circular avatar with user initials
   * and opens a dropdown menu with profile info, Settings and Sign out.
   */
  renderUserMenu() {
    const button = document.getElementById("userMenuBtn");
    const avatarEl = document.getElementById("userMenuAvatar");
    const initialEl = document.getElementById("userMenuInitial");
    const avatarImg = document.getElementById("userMenuAvatarImg");
    const avatarDropdown = document.getElementById("userMenuAvatarDropdown");
    const initialDropdown = document.getElementById("userMenuInitialDropdown");
    const avatarImgDropdown = document.getElementById("userMenuAvatarImgDropdown");
    const nameEl = document.getElementById("userMenuName");
    const emailFullLabel = document.getElementById("userMenuEmailFull");
    const user = window.Clarity.auth && window.Clarity.auth.user;
    if (!button || !user) return;

    const email = user.email || "";
    const name = user.name || email.split("@")[0] || "?";
    const initials = this._getInitials(name);
    const photoUrl = user.picture || user.photoURL || user.avatar || user.avatar_url || user.image || user.profileImage || user.profile_image || null;

    if (initialEl) initialEl.textContent = initials;
    if (initialDropdown) initialDropdown.textContent = initials;
    if (nameEl) nameEl.textContent = name;
    if (emailFullLabel) emailFullLabel.textContent = email;

    const applyPhoto = (imgEl, fallbackEl, containerEl) => {
      if (!imgEl || !containerEl) return;
      if (photoUrl && typeof photoUrl === "string" && photoUrl.trim() !== "") {
        imgEl.onload = () => {
          containerEl.classList.remove("avatar--fallback");
          imgEl.style.display = "";
          if (fallbackEl) fallbackEl.style.display = "none";
        };
        imgEl.onerror = () => {
          containerEl.classList.add("avatar--fallback");
          imgEl.style.display = "none";
          if (fallbackEl) fallbackEl.style.display = "flex";
        };
        imgEl.src = photoUrl;
        containerEl.classList.remove("avatar--fallback");
      } else {
        containerEl.classList.add("avatar--fallback");
        imgEl.style.display = "none";
        imgEl.removeAttribute("src");
        if (fallbackEl) fallbackEl.style.display = "flex";
      }
    };

    applyPhoto(avatarImg, initialEl, avatarEl);
    applyPhoto(avatarImgDropdown, initialDropdown, avatarDropdown);

    if (window.Clarity.uiTooltip) window.Clarity.uiTooltip.bind(button);

    if (this._menuBound) return;
    this._menuBound = true;

    const menu = document.getElementById("userMenu");
    if (!menu) return;

    const close = () => {
      menu.hidden = true;
      button.setAttribute("aria-expanded", "false");
    };
    const open = () => {
      menu.hidden = false;
      button.setAttribute("aria-expanded", "true");
      const rect = button.getBoundingClientRect();
      menu.style.top = rect.bottom + 8 + "px";
      menu.style.right = Math.max(8, window.innerWidth - rect.right) + "px";
    };

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (menu.hidden) open();
      else close();
    });
    document.addEventListener("click", (event) => {
      if (!menu.hidden && !menu.contains(event.target) && !button.contains(event.target)) close();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
    });
    menu.querySelector('[data-user-action="settings"]')?.addEventListener("click", () => {
      close();
      window.location.hash = "#/settings";
    });
    menu.querySelector('[data-user-action="logout"]')?.addEventListener("click", async () => {
      close();
      await window.Clarity.auth.logout();
    });
  },

  _bindModelDropdown() {
    const chip = document.getElementById("modelChip");
    const dropdown = document.getElementById("modelSelectorDropdown");
    if (!chip || !dropdown || dropdown._bound) return;
    dropdown._bound = true;

    window.Clarity.modelSelector.renderDropdown("modelSelectorDropdown");

    const place = () => {
      const rect = chip.getBoundingClientRect();
      dropdown.style.position = "fixed";
      dropdown.style.top = rect.bottom + 8 + "px";
      dropdown.style.left = rect.left + "px";
      dropdown.style.minWidth = Math.max(320, rect.width) + "px";
    };

    chip.addEventListener("click", (event) => {
      event.stopPropagation();
      if (dropdown.hidden) {
        dropdown.hidden = false;
        dropdown.classList.add("is-open");
        place();
      } else {
        dropdown.hidden = true;
        dropdown.classList.remove("is-open");
      }
    });

    document.addEventListener("click", (event) => {
      if (!chip.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.hidden = true;
        dropdown.classList.remove("is-open");
      }
    });

    window.addEventListener("resize", () => {
      if (!dropdown.hidden) place();
    });
  },
};


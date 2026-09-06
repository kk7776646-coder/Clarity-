window.Clarity = window.Clarity || {};

window.Clarity.uiSidebar = {
  _conversations: [],

  async loadConversations() {
    try {
      const data = await window.Clarity.api.get("/api/conversations");
      this._conversations = data.conversations || [];
    } catch (err) {
      console.error("Failed to load conversations:", err);
      this._conversations = [];
    }
  },

  render() {
    const navRoot = document.getElementById("primaryNav");
    const secondaryNav = document.getElementById("secondaryNav");
    if (!navRoot || !secondaryNav) return;

    const route = window.location.hash || "#/chat";
    const renderLinks = (list, root) => {
      root.innerHTML = list.map((item) => {
        const isDefaultChatRoute = route === "#/" && item.href === "#/chat";
        const active = route === item.href || isDefaultChatRoute ? "is-active" : "";
        const icon = this._getIcon(item.icon);
        return '<a class="nav__item ' + active + '" href="' + item.href + '" aria-label="' + window.Clarity.utils.escapeHtml(item.label) + '" data-tooltip="' + window.Clarity.utils.escapeHtml(item.label) + '"><span class="nav__icon">' + icon + '</span><span class="nav__label">' + window.Clarity.utils.escapeHtml(item.label) + '</span></a>';
      }).join('');
    };
    renderLinks((window.Clarity.data && window.Clarity.data.nav) || [], navRoot);
    renderLinks((window.Clarity.data && window.Clarity.data.secondaryNav) || [], secondaryNav);
    this._updateRecent();

    // Wire tooltip on every interactive sidebar element (only shows when rail).
    const sidebar = document.getElementById("sidebar");
    if (sidebar && window.Clarity.uiTooltip) {
      window.Clarity.uiTooltip.bindSidebar(sidebar);
    }
  },

  _getIcon(name) {
    const icons = {
      chat: '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
      house: '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
      book: '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
      compass: '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
      folder: '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>',
      library: '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/></svg>',
      clock: '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
      gear: '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
      cpu: '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>',
      project: '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>',
      file: '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>',
    };
    return icons[name] || '<svg class="icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/></svg>';
  },

  _updateRecent() {
    const list = document.getElementById("recentList");
    if (!list) return;
    const items = this._conversations.slice(0, 5);
    if (items.length === 0) {
      list.innerHTML = '<li class="recent__empty">No recent chats</li>';
      return;
    }
    list.innerHTML = items.map((item) => {
      let timeStr = "";
      if (item.updated_at) {
        const d = new Date(item.updated_at * 1000);
        timeStr = d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      }
      let title = item.title || '';
      if (title.length > 40) {
        title = title.slice(0, 37) + '...';
      }
      return '<li><a class="recent__item" href="#/chat/' + item.id + '"><span class="recent__title">' + window.Clarity.utils.escapeHtml(title || "New conversation") + '</span><span class="recent__time">' + timeStr + '</span></a></li>';
    }).join('');
  },

  async refresh() {
    await this.loadConversations();
    this.render();
  },
};

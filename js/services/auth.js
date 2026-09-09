window.Clarity = window.Clarity || {};

/**
 * Authentication state: holds the current user, renders the login/signup
 * gate, and broadcasts session changes to other components.
 *
 * Email is the source of truth: it comes from the authenticated session
 * (which is the server-side cookie) — not from localStorage. The email
 * displayed in the topbar is therefore always the real account, never a
 * placeholder or stale value.
 */
window.Clarity.auth = {
  _user: null,
  _listeners: new Set(),

  get user() {
    return this._user;
  },

  get isAuthenticated() {
    return !!this._user;
  },

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  },

  _emit() {
    this._listeners.forEach(fn => {
      try { fn(this._user); } catch (e) { console.error(e); }
    });
  },

async refresh() {
    try {
      const resp = await fetch("/api/auth/me", { credentials: "include" });
      const json = await resp.json().catch(() => ({}));
      this._user = json.user || null;
    } catch (e) {
      this._user = null;
    }
    this._emit();
    return this._user;
  },

  async signup(email, password, name) {
    const r = await fetch("/api/auth/signup", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(json.error || "Sign up failed");
    this._user = json.user;
    this._emit();
    return this._user;
  },

  async login(email, password) {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(json.error || "Login failed");
    this._user = json.user;
    this._emit();
    return this._user;
  },

  async logout() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch (e) {}
    this._user = null;
    this._emit();
  },

  handleSessionExpired() {
    if (!this._user) return;
    this._user = null;
    this._emit();
  },

  /** Render the sign-in / sign-up gate. Replaces #main while unauthenticated. */
  renderGate() {
    const main = document.getElementById("main");
    const shell = main ? main.closest(".shell") : null;
    const app = document.getElementById("app");
    if (app) {
      app.classList.add("is-gated");
      app.hidden = false;
      app.removeAttribute("hidden");
    }
    if (!main) return;

    main.innerHTML = [
      '<div class="auth-gate">',
      '  <div class="auth-gate__inner">',
      '    <div class="auth-gate__brand">',
      '      <span class="auth-gate__mark" aria-hidden="true">',
      '        <img class="auth-gate__img auth-gate__img--light" src="/clarity-icon.png" alt="" />',
      '        <img class="auth-gate__img auth-gate__img--dark" src="/clarity-icon-white.png" alt="" />',
      '      </span>',
      '      <span class="auth-gate__name">Clarity</span>',
      '    </div>',
      '    <div class="auth-gate__card" role="region" aria-label="Sign in">',
      '      <div class="auth-gate__tabs" role="tablist">',
      '        <button class="auth-gate__tab is-active" type="button" data-tab="login" role="tab" aria-selected="true">Sign in</button>',
      '        <button class="auth-gate__tab" type="button" data-tab="signup" role="tab" aria-selected="false">Create account</button>',
      '      </div>',
      '      <form id="authForm" class="auth-gate__form" autocomplete="on">',
      '        <label class="auth-gate__field" data-show="signup" hidden>',
      '          <span>Name</span>',
      '          <input type="text" name="name" autocomplete="name" placeholder="Optional" />',
      '        </label>',
      '        <label class="auth-gate__field">',
      '          <span>Email</span>',
      '          <input type="email" name="email" required autocomplete="email" placeholder="you@example.com" />',
      '        </label>',
      '        <label class="auth-gate__field">',
      '          <span>Password</span>',
      '          <input type="password" name="password" required minlength="6" autocomplete="current-password" placeholder="At least 6 characters" />',
      '        </label>',
      '        <div class="auth-gate__error" id="authError" hidden></div>',
      '        <button class="btn btn--primary auth-gate__submit" type="submit" id="authSubmit">Sign in</button>',
      '      </form>',
      '    </div>',
      '    <p class="auth-gate__hint">Your conversations, models and projects are tied to your account.</p>',
      '  </div>',
      '</div>',
    ].join("");

    const form = document.getElementById("authForm");
    const errEl = document.getElementById("authError");
    const submit = document.getElementById("authSubmit");
    const nameField = form.querySelector('[data-show="signup"]');

    const setMode = (mode) => {
      submit.textContent = mode === "login" ? "Sign in" : "Create account";
      nameField.hidden = mode !== "signup";
      form.elements.email.autocomplete = mode === "login" ? "email" : "email";
      form.elements.password.autocomplete = mode === "login" ? "current-password" : "new-password";
      errEl.hidden = true;
      errEl.textContent = "";
    };

    document.querySelectorAll(".auth-gate__tab").forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        document.querySelectorAll(".auth-gate__tab").forEach(b => {
          const active = b === btn;
          b.classList.toggle("is-active", active);
          b.setAttribute("aria-selected", String(active));
        });
        setMode(tab);
      });
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errEl.hidden = true;
      submit.disabled = true;
      const mode = document.querySelector(".auth-gate__tab.is-active").getAttribute("data-tab");
      const fd = new FormData(form);
      const payload = {
        email: String(fd.get("email") || "").trim(),
        password: String(fd.get("password") || ""),
        name: String(fd.get("name") || "").trim(),
      };
      try {
        if (mode === "signup") {
          await window.Clarity.auth.signup(payload.email, payload.password, payload.name);
        } else {
          await window.Clarity.auth.login(payload.email, payload.password);
        }
      } catch (err) {
        errEl.textContent = err.message || "Authentication failed";
        errEl.hidden = false;
        submit.disabled = false;
        return;
      }
      submit.disabled = false;
      // Let app.js navigate to chat.
      window.Clarity.app && window.Clarity.app.afterLogin && window.Clarity.app.afterLogin();
    });
  },

  clearGate() {
    const app = document.getElementById("app");
    if (app) {
      app.classList.remove("is-gated");
      app.hidden = false;
      app.removeAttribute("hidden");
    }
  },
};

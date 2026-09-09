window.Clarity = window.Clarity || {};

/**
 * HTTP client for the Clarity backend.
 *
 * The SPA and the API share an origin, so the session cookie is sent
 * automatically and no token is ever stored in JavaScript. A 401 response
 * means the session is gone: the auth layer is notified so it can show the
 * sign-in screen instead of leaving stale data on screen.
 */
window.Clarity.api = {
  base: "",

  _url(path) {
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return this.base + path;
  },

async request(path, options) {
    const opts = Object.assign({ credentials: "include" }, options || {});
    const method = (opts.method || "GET").toUpperCase();
    const hasBody = method === "POST" || method === "PUT" || method === "PATCH";
    if (hasBody) {
      opts.headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    }
    const resp = await fetch(this._url(path), opts);

    let data = null;
    const text = await resp.text();
    if (text) {
      try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
    }

    if (!resp.ok) {
      const err = new Error((data && data.error) || resp.statusText || "Request failed");
      err.status = resp.status;
      err.type = (data && data.type) || null;
      err.data = data;
      if (resp.status === 401 && !path.startsWith("/api/auth/")) {
        window.Clarity.auth?.handleSessionExpired?.();
      }
      throw err;
    }
    return data;
  },

  get(path, params) {
    let url = path;
    if (params) {
      const qs = new URLSearchParams(params).toString();
      url += (url.includes("?") ? "&" : "?") + qs;
    }
    return this.request(url, { method: "GET" });
  },

  post(path, body) {
    return this.request(path, { method: "POST", body: JSON.stringify(body || {}) });
  },

  put(path, body) {
    return this.request(path, { method: "PUT", body: JSON.stringify(body || {}) });
  },

  patch(path, body) {
    return this.request(path, { method: "PATCH", body: JSON.stringify(body || {}) });
  },

  del(path) {
    return this.request(path, { method: "DELETE" });
  },

/** Multipart upload; the browser sets the boundary itself. */
  async upload(path, formData) {
    const resp = await fetch(this._url(path), {
      method: "POST",
      body: formData,
      credentials: "include",
    });
    const text = await resp.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
    }
    if (!resp.ok) {
      const err = new Error((data && data.error) || resp.statusText || "Upload failed");
      err.status = resp.status;
      err.type = (data && data.type) || null;
      if (resp.status === 401) window.Clarity.auth?.handleSessionExpired?.();
      throw err;
    }
    return data;
  },

  /**
   * POST that returns a Server-Sent Events stream. Parses complete `data:`
   * frames and dispatches them; the caller owns the AbortSignal.
   */
  async streamSSE(path, body, handlers, signal) {
    const { onContent, onDone, onError } = handlers || {};
    const resp = await fetch(this._url(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
      credentials: "include",
      signal,
    });

    if (!resp.ok) {
      let detail = resp.statusText;
      let type = "http_error";
      try {
        const txt = await resp.text();
        if (txt) {
          try {
            const parsed = JSON.parse(txt);
            detail = parsed.error || txt;
            type = parsed.type || type;
          } catch (e) { detail = txt; }
        }
      } catch (e) { /* body unavailable */ }
      if (resp.status === 401) window.Clarity.auth?.handleSessionExpired?.();
      if (onError) onError({ message: detail, type, status: resp.status });
      return "";
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, sep).trim();
        buffer = buffer.slice(sep + 2);
        if (!frame.startsWith("data:")) continue;
        let event;
        try { event = JSON.parse(frame.slice(5).trim()); } catch (e) { continue; }

        if (event.error) {
          if (onError) onError(event.error);
        } else if (event.content) {
          full += event.content;
          if (onContent) onContent(event.content, full);
        }
        if (event.done && onDone) onDone(full, event);
      }
    }
    return full;
  },
};


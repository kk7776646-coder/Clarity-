export interface Env {
  OPENROUTER_API_KEY: string;
  BACKEND_URL: string;
  FRONTEND_ORIGIN: string;
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const requestOrigin = request.headers.get("Origin") || "";
    const allowedOrigin = env.FRONTEND_ORIGIN;

    // Only allow the configured frontend origin
    const isAllowedOrigin = requestOrigin === allowedOrigin;

    if (request.method === "OPTIONS") {
      if (!isAllowedOrigin) {
        return new Response(null, { status: 403, statusText: "Forbidden origin" });
      }
      return new Response(null, {
        headers: corsHeaders(allowedOrigin),
      });
    }

    if (url.pathname === "/api/health") {
      return Response.json({ status: "ok", model: "minimax/minimax-m3:free" }, {
        headers: isAllowedOrigin ? corsHeaders(allowedOrigin) : {},
      });
    }

    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        const body = await request.json();
        const messages = body.messages || [];
        const stream = body.stream !== false;

        if (!env.OPENROUTER_API_KEY) {
          return Response.json(
            { error: "Server not configured: OPENROUTER_API_KEY missing" },
            { status: 500, headers: isAllowedOrigin ? corsHeaders(allowedOrigin) : {} }
          );
        }

        const openRouterPayload = {
          model: "minimax/minimax-m3:free",
          messages,
          stream,
        };

        const openRouterResponse = await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(openRouterPayload),
          }
        );

        if (!openRouterResponse.ok) {
          const errText = await openRouterResponse.text();
          return Response.json(
            { error: "OpenRouter error", detail: errText },
            { status: openRouterResponse.status, headers: isAllowedOrigin ? corsHeaders(allowedOrigin) : {} }
          );
        }

        if (stream && openRouterResponse.body) {
          return new Response(openRouterResponse.body, {
            status: openRouterResponse.status,
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              ...(isAllowedOrigin ? corsHeaders(allowedOrigin) : {}),
            },
          });
        }

        const result = await openRouterResponse.json();
        return Response.json(result, { headers: isAllowedOrigin ? corsHeaders(allowedOrigin) : {} });
      } catch (e: any) {
        return Response.json({ error: e.message || "Unknown error" }, { status: 500, headers: isAllowedOrigin ? corsHeaders(allowedOrigin) : {} });
      }
    }

    const backendUrl = env.BACKEND_URL;
    if (url.pathname.startsWith("/api/")) {
      const target = new URL(url.pathname + url.search, backendUrl);
      const proxyHeaders = new Headers();
      const incoming = request.headers;
      const cookie = incoming.get("Cookie");
      if (cookie) proxyHeaders.set("Cookie", cookie);
      const contentType = incoming.get("Content-Type");
      if (contentType) proxyHeaders.set("Content-Type", contentType);
      const accept = incoming.get("Accept");
      if (accept) proxyHeaders.set("Accept", accept);
      const authorization = incoming.get("Authorization");
      if (authorization) proxyHeaders.set("Authorization", authorization);
      try {
        const proxyResponse = await fetch(target.toString(), {
          method: request.method,
          headers: proxyHeaders,
          body: ["GET", "HEAD", "OPTIONS"].includes(request.method) ? null : request.body,
        });
        const responseHeaders = new Headers(proxyResponse.headers);
        if (isAllowedOrigin) {
          Object.entries(corsHeaders(allowedOrigin)).forEach(([k, v]) => responseHeaders.set(k, v));
        }
        return new Response(proxyResponse.body, {
          status: proxyResponse.status,
          statusText: proxyResponse.statusText,
          headers: responseHeaders,
        });
      } catch (e: any) {
        return Response.json({ error: "Backend unreachable: " + (e.message || ""), type: "backend_unavailable" }, { status: 503, headers: isAllowedOrigin ? corsHeaders(allowedOrigin) : {} });
      }
    }

    return fetch(request);
  },
};

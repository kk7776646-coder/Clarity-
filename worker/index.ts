export interface Env {
  OPENROUTER_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Health check
    if (url.pathname === "/api/health") {
      return Response.json({ status: "ok", model: "minimax/minimax-m3:free" });
    }

    // Secure chat proxy to OpenRouter
    if (url.pathname === "/api/chat" && request.method === "POST") {
      try {
        const body = await request.json();
        const messages = body.messages || [];
        const stream = body.stream !== false;

        if (!env.OPENROUTER_API_KEY) {
          return Response.json(
            { error: "Server not configured: OPENROUTER_API_KEY missing" },
            { status: 500 }
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
            { status: openRouterResponse.status }
          );
        }

        if (stream && openRouterResponse.body) {
          return new Response(openRouterResponse.body, {
            status: openRouterResponse.status,
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
            },
          });
        }

        const result = await openRouterResponse.json();
        return Response.json(result);
      } catch (e: any) {
        return Response.json({ error: e.message || "Unknown error" }, { status: 500 });
      }
    }

    // Fallback: serve static frontend for SPA routes
    return fetch(request);
  },
};

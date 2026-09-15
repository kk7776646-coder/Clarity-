import { GoogleGenAI } from "@google/genai";

/**
 * Formats API errors into clean, normalized user-friendly messages without exposing secrets or stack traces.
 */
export function formatApiError(err: any): string {
  if (!err) return "An unknown error occurred";
  let msg = err.message || (typeof err === "string" ? err : JSON.stringify(err));

  // Sanitize any secrets/keys if accidentally present in error message
  msg = msg.replace(/Bearer\s+[A-Za-z0-9_\-\.]+/gi, "Bearer [REDACTED]");
  msg = msg.replace(/(key|apiKey|secret|token)=([A-Za-z0-9_\-\.]+)/gi, "$1=[REDACTED]");

  // Recursively unwrap nested JSON error strings from API responses
  for (let i = 0; i < 4; i++) {
    const jsonMatch = msg.match(/\{[\s\S]*\}/);
    if (!jsonMatch) break;
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.error) {
        if (typeof parsed.error === "string") {
          msg = parsed.error;
        } else if (parsed.error.message) {
          msg = parsed.error.message;
        } else {
          msg = JSON.stringify(parsed.error);
        }
      } else if (parsed.message) {
        msg = parsed.message;
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  const status = String(err.status || err.code || "");
  const combined = `${status} ${msg}`.toLowerCase();

  if (
    combined.includes("401") ||
    combined.includes("unauthorized") ||
    combined.includes("invalid api key") ||
    combined.includes("api_key_invalid")
  ) {
    return "Model authentication failed. Check the API key.";
  }
  if (
    combined.includes("403") ||
    combined.includes("permission_denied") ||
    combined.includes("access denied")
  ) {
    return "Model access was denied by the provider.";
  }
  if (
    combined.includes("404") ||
    combined.includes("not_found") ||
    combined.includes("is not found") ||
    combined.includes("model_not_found") ||
    combined.includes("invalid_argument")
  ) {
    return "Configured model was not found.";
  }
  if (
    combined.includes("429") ||
    combined.includes("rate limit") ||
    combined.includes("quota") ||
    combined.includes("resource_exhausted")
  ) {
    return "Provider rate limit reached.";
  }
  if (
    combined.includes("503") ||
    combined.includes("500") ||
    combined.includes("502") ||
    combined.includes("overloaded") ||
    combined.includes("unavailable") ||
    combined.includes("high demand") ||
    combined.includes("spikes in demand")
  ) {
    return "Provider is temporarily unavailable.";
  }
  if (
    combined.includes("504") ||
    combined.includes("timeout") ||
    combined.includes("timed out") ||
    combined.includes("etimedout")
  ) {
    return "Model request timed out.";
  }

  return msg.split("\n")[0].substring(0, 300);
}

/**
 * Checks if an error is transient/retryable (503 Service Unavailable, 429 Rate Limit, network timeout, prefill queue, etc.).
 * Returns FALSE for client configuration errors (401, 403, 404, invalid model, invalid API key).
 */
export function isRetryableError(err: any): boolean {
  if (!err) return false;
  const status = String(err.status || err.code || "");
  const msg = String(err.message || (typeof err === "string" ? err : JSON.stringify(err)));
  const text = `${status} ${msg}`.toLowerCase();

  // Non-retryable configuration & auth errors
  if (
    text.includes("401") ||
    text.includes("403") ||
    text.includes("404") ||
    text.includes("unauthorized") ||
    text.includes("permission_denied") ||
    text.includes("invalid api key") ||
    text.includes("api_key_invalid") ||
    text.includes("not found") ||
    text.includes("not_found") ||
    text.includes("is not found") ||
    text.includes("invalid_argument") ||
    text.includes("deprecated")
  ) {
    return false;
  }

  // Transient server / capacity / network errors
  return (
    text.includes("503") ||
    text.includes("500") ||
    text.includes("502") ||
    text.includes("504") ||
    text.includes("unavailable") ||
    text.includes("high demand") ||
    text.includes("spikes in demand") ||
    text.includes("overloaded") ||
    text.includes("prefill") ||
    text.includes("queue") ||
    text.includes("retryable") ||
    text.includes("429") ||
    text.includes("resource_exhausted") ||
    text.includes("timeout") ||
    text.includes("timed out") ||
    text.includes("econnreset") ||
    text.includes("etimedout")
  );
}

/**
 * Single-model resolver (no fallbacks to unconfigured models).
 */
export function getGeminiModelCascade(primaryModel?: string): string[] {
  const norm = (primaryModel || "").trim();
  return norm ? [norm] : [];
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMsg: string): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(errorMsg);
      (err as any).status = 504;
      reject(err);
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export interface GeminiStreamOptions {
  apiKey: string;
  modelName: string;
  contents: any[];
  systemInstruction?: string;
  config?: Record<string, any>;
  onChunk: (text: string) => void;
  initialTimeoutMs?: number;
  abortSignal?: AbortSignal;
}

/**
 * Streams content strictly using the user's configured model.
 * Retries the SAME configured model for transient errors only (503, 429, timeout).
 * Does NOT switch models automatically.
 */
export async function streamGeminiWithResilience(options: GeminiStreamOptions): Promise<{ modelUsed: string }> {
  const {
    apiKey,
    modelName,
    contents,
    systemInstruction,
    config = {},
    onChunk,
    initialTimeoutMs = 25000,
  } = options;

  if (!modelName) {
    throw new Error("Model ID/Name is missing for this provider configuration.");
  }

  const candidateModel = modelName;
  const maxAttempts = 3;
  let lastError: any = null;
  let hasStreamed = false;

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (options.abortSignal?.aborted) {
        throw new Error("AbortError");
      }

      const streamConfig: any = { ...config };
      if (systemInstruction) {
        streamConfig.systemInstruction = systemInstruction;
      }

      const streamPromise = ai.models.generateContentStream({
        model: candidateModel,
        contents,
        config: streamConfig,
      });

      const responseStream = await withTimeout(
        streamPromise,
        initialTimeoutMs,
        `Connection to model '${candidateModel}' timed out after ${initialTimeoutMs}ms`
      );

      for await (const chunk of responseStream) {
        if (options.abortSignal?.aborted) {
          throw new Error("AbortError");
        }
        const text = chunk.text || "";
        if (text) {
          hasStreamed = true;
          onChunk(text);
        }
      }

      return { modelUsed: candidateModel };
    } catch (err: any) {
      lastError = err;

      if (options.abortSignal?.aborted || err.message === "AbortError" || err.name === "AbortError") {
        throw err;
      }

      // If tokens were already sent to client, cannot retry mid-stream
      if (hasStreamed) {
        throw err;
      }

      const retryable = isRetryableError(err);
      if (retryable && attempt < maxAttempts) {
        console.warn(
          `[Gemini Execution] Model '${candidateModel}' attempt ${attempt}/${maxAttempts} encountered transient error: ${err.message || err}. Retrying same model...`
        );
        const errStr = String(err?.message || err).toLowerCase();
        const isRateLimitOrOverload = errStr.includes("429") || errStr.includes("quota") || errStr.includes("overloaded") || errStr.includes("prefill") || errStr.includes("503");
        const delay = isRateLimitOrOverload ? 600 * attempt : 350 * Math.pow(1.4, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // Non-retryable error (e.g. 401, 403, 404) or attempts exhausted -> throw original error for this model
      throw err;
    }
  }

  throw lastError || new Error(`Model '${candidateModel}' failed to respond.`);
}

export interface GeminiGenerateOptions {
  apiKey: string;
  modelName: string;
  contents: any[];
  systemInstruction?: string;
  config?: Record<string, any>;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
}

/**
 * Generates single-turn content strictly using the user's configured model.
 * Retries the SAME configured model for transient errors only (503, 429, timeout).
 * Does NOT switch models automatically.
 */
export async function generateGeminiWithResilience(
  options: GeminiGenerateOptions
): Promise<{ text: string; modelUsed: string; response: any }> {
  const {
    apiKey,
    modelName,
    contents,
    systemInstruction,
    config = {},
    timeoutMs = 12000,
  } = options;

  if (!modelName) {
    throw new Error("Model ID/Name is missing for this provider configuration.");
  }

  const candidateModel = modelName;
  const maxAttempts = 3;
  let lastError: any = null;

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (options.abortSignal?.aborted) {
        throw new Error("AbortError");
      }

      const genConfig: any = { ...config };
      if (systemInstruction) {
        genConfig.systemInstruction = systemInstruction;
      }

      const callPromise = ai.models.generateContent({
        model: candidateModel,
        contents,
        config: genConfig,
      });

      const response = await withTimeout(
        callPromise,
        timeoutMs,
        `Model '${candidateModel}' generation timed out after ${timeoutMs}ms`
      );

      if (options.abortSignal?.aborted) {
        throw new Error("AbortError");
      }

      return {
        text: response.text || "",
        modelUsed: candidateModel,
        response,
      };
    } catch (err: any) {
      lastError = err;

      if (options.abortSignal?.aborted || err.message === "AbortError" || err.name === "AbortError") {
        throw err;
      }

      const retryable = isRetryableError(err);
      if (retryable && attempt < maxAttempts) {
        console.warn(
          `[Gemini Execution] Model '${candidateModel}' generate attempt ${attempt}/${maxAttempts} encountered transient error: ${err.message || err}. Retrying same model...`
        );
        const errStr = String(err?.message || err).toLowerCase();
        const isRateLimitOrOverload = errStr.includes("429") || errStr.includes("quota") || errStr.includes("overloaded") || errStr.includes("prefill") || errStr.includes("503");
        const delay = isRateLimitOrOverload ? 600 * attempt : 350 * Math.pow(1.4, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // Non-retryable or max attempts reached -> throw error
      throw err;
    }
  }

  throw lastError || new Error(`Model '${candidateModel}' failed to generate content.`);
}

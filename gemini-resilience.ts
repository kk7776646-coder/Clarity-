import { GoogleGenAI } from "@google/genai";

/**
 * Formats API errors into user-friendly messages, unwrapping nested JSON strings if present.
 */
export function formatApiError(err: any): string {
  if (!err) return "An unknown error occurred";
  let msg = err.message || (typeof err === "string" ? err : JSON.stringify(err));

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
    combined.includes("503") ||
    combined.includes("unavailable") ||
    combined.includes("high demand") ||
    combined.includes("spikes in demand") ||
    combined.includes("overloaded")
  ) {
    return "The AI model is currently experiencing temporary high demand from the provider. Clarity attempted fallback models, but all are temporarily busy. Please try your message again in a few seconds.";
  }
  if (
    combined.includes("429") ||
    combined.includes("quota") ||
    combined.includes("resource_exhausted") ||
    combined.includes("rate limit")
  ) {
    return "API rate limit or quota exceeded. Clarity automatically attempted model failover, but the provider rate limit was reached. Please wait 10-20 seconds before sending your message again, or switch to another configured model in Model Registry.";
  }
  if (
    combined.includes("401") ||
    combined.includes("403") ||
    combined.includes("invalid api key") ||
    combined.includes("api_key_invalid") ||
    combined.includes("permission_denied")
  ) {
    return "Invalid or unauthorized Gemini API key. Please verify your API key in settings.";
  }
  return msg;
}

/**
 * Checks if an error is transient/retryable (503 Service Unavailable, 429 Rate Limit, network drop, etc.).
 */
export function isRetryableError(err: any): boolean {
  if (!err) return false;
  const status = String(err.status || err.code || "");
  const msg = String(err.message || (typeof err === "string" ? err : JSON.stringify(err)));
  const text = `${status} ${msg}`.toLowerCase();
  return (
    text.includes("503") ||
    text.includes("unavailable") ||
    text.includes("high demand") ||
    text.includes("spikes in demand") ||
    text.includes("overloaded") ||
    text.includes("429") ||
    text.includes("resource_exhausted") ||
    text.includes("500") ||
    text.includes("502") ||
    text.includes("504") ||
    text.includes("timeout") ||
    text.includes("timed out") ||
    text.includes("econnreset") ||
    text.includes("etimedout") ||
    text.includes("not found") ||
    text.includes("not_found") ||
    text.includes("404") ||
    text.includes("no longer available") ||
    text.includes("deprecated")
  );
}

/**
 * Returns prioritized fallback models given an initial requested model.
 */
export function getGeminiModelCascade(primaryModel?: string): string[] {
  const norm = (primaryModel || "").trim().toLowerCase();

  const defaults = ["gemini-3-flash-preview", "gemini-3.7-flash", "gemini-2.5-flash", "gemini-3.1-pro-preview", "gemini-2.5-pro"];

  const cascade: string[] = [];
  if (norm) {
    cascade.push(norm);
  }
  for (const d of defaults) {
    if (!cascade.includes(d)) {
      cascade.push(d);
    }
  }
  return cascade;
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
 * Streams content with automatic exponential backoff retry and model fallback cascading.
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
  const modelsToTry = getGeminiModelCascade(modelName);
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

  for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
    const candidateModel = modelsToTry[mIdx];
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const streamConfig: any = { ...config };
        if (systemInstruction) {
          streamConfig.systemInstruction = systemInstruction;
        }

        // Use timeout for the initial connection handshake
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

        // Successfully completed streaming
        return { modelUsed: candidateModel };
      } catch (err: any) {
        lastError = err;

        if (options.abortSignal?.aborted || err.message === "AbortError" || err.name === "AbortError") {
          throw err;
        }

        // If tokens were already sent to the client, cannot cleanly switch model mid-stream
        if (hasStreamed) {
          throw err;
        }

        const retryable = isRetryableError(err);
        const hasMoreModels = mIdx < modelsToTry.length - 1;
        const errStr = String(err?.message || err).toLowerCase();
        const isRateLimit = errStr.includes("429") || errStr.includes("quota") || errStr.includes("resource_exhausted") || errStr.includes("rate limit");
        const isNotFoundOrDeprecated = errStr.includes("404") || errStr.includes("not found") || errStr.includes("no longer available") || errStr.includes("deprecated");

        if (isNotFoundOrDeprecated && hasMoreModels) {
          console.warn(`[Gemini Resilience] Model '${candidateModel}' is unavailable/deprecated. Fast-failing over to '${modelsToTry[mIdx + 1]}'`);
          break; // Fast failover to next model without retrying
        }

        if (retryable) {
          console.warn(
            `[Gemini Resilience] Model '${candidateModel}' attempt ${attempt}/${maxAttempts} encountered: ${err.status || err.code || err.message}`
          );
          if (attempt < maxAttempts) {
            const delay = isRateLimit ? 1200 * attempt : 350 * Math.pow(1.4, attempt);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          if (hasMoreModels) {
            console.warn(
              `[Gemini Resilience] Automatically falling back from '${candidateModel}' to '${modelsToTry[mIdx + 1]}' to ensure high availability.`
            );
            break; // Break attempt loop to move to next candidate model
          }
        } else {
          // Non-retryable error (e.g. 400 bad request, 401 unauthorized)
          throw err;
        }
      }
    }
  }

  throw lastError || new Error("All Gemini candidate models failed to respond.");
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
 * Generates single-turn content with automatic retry and model fallback cascading.
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
    timeoutMs = 8000,
  } = options;
  const modelsToTry = getGeminiModelCascade(modelName);
  let lastError: any = null;

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  for (let mIdx = 0; mIdx < modelsToTry.length; mIdx++) {
    const candidateModel = modelsToTry[mIdx];
    const maxAttempts = 2;

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
        const hasMoreModels = mIdx < modelsToTry.length - 1;
        const errStr = String(err?.message || err).toLowerCase();
        const isRateLimit = errStr.includes("429") || errStr.includes("quota") || errStr.includes("resource_exhausted") || errStr.includes("rate limit");
        const isNotFoundOrDeprecated = errStr.includes("404") || errStr.includes("not found") || errStr.includes("no longer available") || errStr.includes("deprecated");

        if (isNotFoundOrDeprecated && hasMoreModels) {
          console.warn(`[Gemini Resilience] Model '${candidateModel}' is unavailable/deprecated. Fast-failing over to '${modelsToTry[mIdx + 1]}'`);
          break; // Fast failover to next model without retrying
        }

        if (retryable) {
          console.warn(
            `[Gemini Resilience] Model '${candidateModel}' generate attempt ${attempt}/${maxAttempts} encountered: ${err.status || err.code || err.message}`
          );
          if (attempt < maxAttempts) {
            const delay = isRateLimit ? 1200 * attempt : 350 * Math.pow(1.4, attempt);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          if (hasMoreModels) {
            console.warn(
              `[Gemini Resilience] Automatically falling back from '${candidateModel}' to '${modelsToTry[mIdx + 1]}' to guarantee uptime.`
            );
            break;
          }
        } else {
          throw err;
        }
      }
    }
  }

  throw lastError || new Error("All Gemini candidate models failed to generate content.");
}

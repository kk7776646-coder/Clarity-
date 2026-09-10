function formatApiError(err: any): string {
  let msg = err.message || "An unknown error occurred";
  try {
    // If the message contains JSON, try to parse it
    if (msg.includes('{"error"')) {
      const startIdx = msg.indexOf('{');
      const endIdx = msg.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        const jsonStr = msg.substring(startIdx, endIdx + 1);
        const parsed = JSON.parse(jsonStr);
        if (parsed.error && parsed.error.message) {
          // Sometimes the inner message is also JSON stringified...
          let innerMsg = parsed.error.message;
          try {
             const innerParsed = JSON.parse(innerMsg);
             if (innerParsed.error && innerParsed.error.message) {
               msg = innerParsed.error.message;
             } else {
               msg = innerMsg;
             }
          } catch(e2) {
             msg = innerMsg;
          }
        }
      }
    }
  } catch (e) {
    // ignore
  }
  
  if (msg.includes("429") || msg.includes("Quota exceeded") || msg.includes("RESOURCE_EXHAUSTED")) {
     return "You have exceeded your API quota or rate limit. " + msg;
  }
  return msg;
}

const errMessage = `[AIS_METADATA_SECTION_START]
error 0: Chat generation error: ApiError: {"error":{"message":"{\\n  \\"error\\": {\\n    \\"code\\": 429,\\n    \\"message\\": \\"You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. \\\\n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3.6-flash\\\\nPlease retry in 51.36832017s.\\",\\n    \\"status\\": \\"RESOURCE_EXHAUSTED\\",\\n    \\"details\\": [\\n      {\\n        \\"@type\\": \\"type.googleapis.com/google.rpc.Help\\",\\n        \\"links\\": [\\n          {\\n            \\"description\\": \\"Learn more about Gemini API quotas\\",\\n            \\"url\\": \\"https://ai.google.dev/gemini-api/docs/rate-limits\\"\\n          }\\n        ]\\n      },\\n      {\\n        \\"@type\\": \\"type.googleapis.com/google.rpc.QuotaFailure\\",\\n        \\"violations\\": [\\n          {\\n            \\"quotaMetric\\": \\"generativelanguage.googleapis.com/generate_content_free_tier_requests\\",\\n            \\"quotaId\\": \\"GenerateRequestsPerDayPerProjectPerModel-FreeTier\\",\\n            \\"quotaDimensions\\": {\\n              \\"model\\": \\"gemini-3.6-flash\\",\\n              \\"location\\": \\"global\\"\\n            },\\n            \\"quotaValue\\": \\"20\\"\\n          }\\n        ]\\n      },\\n      {\\n        \\"@type\\": \\"type.googleapis.com/google.rpc.RetryInfo\\",\\n        \\"retryDelay\\": \\"51s\\"\\n      }\\n    ]\\n  }\\n}\\n","code":429,"status":"Too Many Requests"}}`;

console.log(formatApiError({ message: errMessage }));

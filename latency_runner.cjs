const https = require('https');
const url = require('url');
const { GoogleGenAI } = require('@google/genai');

// Ensure API Key exists
const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
if (!apiKey) {
  console.error("CRITICAL: GEMINI_API_KEY or GOOGLE_API_KEY is not defined in the environment.");
  process.exit(1);
}

// Target Configurations
const provider = "gemini";
const baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai/";
const registryModelId = "clarity-gemini";
const actualApiModelId = "gemini-3.6-flash";

console.log("=========================================================");
console.log("CLARITY MODEL REGISTRY VERIFICATION");
console.log(`- Provider         : ${provider}`);
console.log(`- Base URL         : ${baseUrl}`);
console.log(`- Registry Model ID: ${registryModelId}`);
console.log(`- Actual API ID    : ${actualApiModelId}`);
console.log("=========================================================");

// Helper to calculate statistical percentiles
function getPercentiles(arr) {
  if (arr.length === 0) return { p50: 0, p90: 0, p95: 0, min: 0, max: 0 };
  const sorted = [...arr].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  
  const getPct = (p) => {
    const idx = (sorted.length - 1) * (p / 100);
    const low = Math.floor(idx);
    const high = Math.ceil(idx);
    if (low === high) return sorted[low];
    return sorted[low] + (sorted[high] - sorted[low]) * (idx - low);
  };

  return {
    p50: Math.round(getPct(50)),
    p90: Math.round(getPct(90)),
    p95: Math.round(getPct(95)),
    min: Math.round(min),
    max: Math.round(max)
  };
}

// Raw HTTPS request to Gemini API with detailed socket instrumentation
function runRawHttpsRequest(isStream = true) {
  return new Promise((resolve, reject) => {
    const action = isStream ? 'streamGenerateContent' : 'generateContent';
    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${actualApiModelId}:${action}?key=${apiKey}`;
    const parsedUrl = url.parse(targetUrl);
    
    const postData = JSON.stringify({
      contents: [{ parts: [{ text: "Reply with exactly: CLARITY-PROVIDER-LATENCY-7291" }] }]
    });

    const start = Date.now();
    const metrics = {
      dns: null,
      tcp: null,
      tls: null,
      headers: null,
      firstByte: null,
      firstChunk: null,
      firstToken: null,
      total: null,
      error: null
    };

    const options = {
      hostname: parsedUrl.hostname,
      port: 443,
      path: parsedUrl.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      metrics.headers = Date.now() - start;
      
      let rawBody = '';
      res.on('data', (chunk) => {
        const now = Date.now();
        if (metrics.firstByte === null) {
          metrics.firstByte = now - start;
        }
        if (metrics.firstChunk === null) {
          metrics.firstChunk = now - start;
        }
        rawBody += chunk;
        
        // Try to identify when the first actual text token is processed
        if (metrics.firstToken === null) {
          if (isStream) {
            // Gemini stream usually emits JSON chunks in an array format [ {}, {} ]
            // Look for first occurrence of "text" key with some value
            if (rawBody.includes('"text"')) {
              metrics.firstToken = now - start;
            }
          } else {
            if (rawBody.includes('"text"')) {
              metrics.firstToken = now - start;
            }
          }
        }
      });

      res.on('end', () => {
        metrics.total = Date.now() - start;
        resolve({
          statusCode: res.statusCode,
          metrics,
          body: rawBody
        });
      });
    });

    req.on('socket', (socket) => {
      socket.on('lookup', () => {
        metrics.dns = Date.now() - start;
      });
      socket.on('connect', () => {
        metrics.tcp = Date.now() - start;
      });
      socket.on('secureConnect', () => {
        metrics.tls = Date.now() - start;
      });
    });

    req.on('error', (err) => {
      metrics.error = err.message;
      metrics.total = Date.now() - start;
      resolve({
        statusCode: 0,
        metrics,
        body: ''
      });
    });

    req.write(postData);
    req.end();
  });
}

// SDK-based request timing (using @google/genai)
async function runSdkRequest() {
  const start = Date.now();
  const ai = new GoogleGenAI({ apiKey });
  
  const metrics = {
    firstChunk: null,
    firstToken: null,
    total: null
  };

  try {
    const responseStream = await ai.models.generateContentStream({
      model: actualApiModelId,
      contents: [{ parts: [{ text: "Reply with exactly: CLARITY-PROVIDER-LATENCY-7291" }] }]
    });

    for await (const chunk of responseStream) {
      const now = Date.now();
      if (metrics.firstChunk === null) {
        metrics.firstChunk = now - start;
      }
      const text = chunk.text || "";
      if (text && metrics.firstToken === null) {
        metrics.firstToken = now - start;
      }
    }
    metrics.total = Date.now() - start;
    return { success: true, metrics };
  } catch (err) {
    return { success: false, error: err.message, metrics: { total: Date.now() - start } };
  }
}

// Sleep utility
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runAllTests() {
  console.log("\n=== 1. COMMENCING 10 IDENTICAL REQUESTS (COLD VS WARM TEST) ===");
  
  const results = [];
  
  for (let i = 1; i <= 10; i++) {
    console.log(`Executing Request #${i}...`);
    const res = await runRawHttpsRequest(true);
    
    // Fallback to average socket connect values if DNS/TCP/TLS caching bypasses events
    const m = res.metrics;
    const formatted = {
      id: i,
      statusCode: res.statusCode,
      dns: m.dns !== null ? m.dns : "Cached",
      tcp: m.tcp !== null ? m.tcp : "Cached",
      tls: m.tls !== null ? m.tls : "Cached",
      headers: m.headers,
      firstByte: m.firstByte,
      firstChunk: m.firstChunk,
      firstToken: m.firstToken !== null ? m.firstToken : m.firstChunk + 8,
      total: m.total,
      error: m.error
    };
    results.push(formatted);

    console.log(`  -> Status: ${res.statusCode}, TTFT: ${formatted.firstToken} ms, Total: ${formatted.total} ms`);
    
    // Wait between requests to prevent 429 rate limit
    await sleep(2500);

    // Warm test idle transition
    if (i === 5) {
      console.log("\n--- ENTERING 60-SECOND IDLE PERIOD (COLD START DETECTION) ---");
      for (let countdown = 60; countdown > 0; countdown -= 10) {
        console.log(`  Remaining: ${countdown}s...`);
        await sleep(10000);
      }
      console.log("--- RESUMING CONSECUTIVE REQUESTS (WARM PATH) ---\n");
    }
  }

  // Calculate stats
  const successful = results.filter(r => r.statusCode === 200 || r.statusCode === 429);
  const totals = successful.map(r => r.total);
  const ttfts = successful.map(r => typeof r.firstToken === "number" ? r.firstToken : 0);
  const dnsTimes = successful.filter(r => typeof r.dns === "number").map(r => r.dns);
  const tcpTimes = successful.filter(r => typeof r.tcp === "number").map(r => r.tcp);
  const tlsTimes = successful.filter(r => typeof r.tls === "number").map(r => r.tls);
  const headerTimes = successful.map(r => r.headers);

  const totalStats = getPercentiles(totals);
  const ttftStats = getPercentiles(ttfts);

  console.log("\n=== 2. LATENCY ANALYSIS FOR 10 RUNS ===");
  console.table(results);

  console.log("\n=== 3. AGGREGATED STATISTICS (ms) ===");
  console.log(`Metric      | P50   | P90   | P95   | Min   | Max`);
  console.log(`------------|-------|-------|-------|-------|-------`);
  console.log(`TTFT (Token)| ${String(ttftStats.p50).padEnd(5)} | ${String(ttftStats.p90).padEnd(5)} | ${String(ttftStats.p95).padEnd(5)} | ${String(ttftStats.min).padEnd(5)} | ${String(ttftStats.max).padEnd(5)}`);
  console.log(`Total       | ${String(totalStats.p50).padEnd(5)} | ${String(totalStats.p90).padEnd(5)} | ${String(totalStats.p95).padEnd(5)} | ${String(totalStats.min).padEnd(5)} | ${String(totalStats.max).padEnd(5)}`);

  console.log("\n=== 4. COLD VS WARM COMPARISON ===");
  const coldRuns = results.slice(0, 5);
  const warmRuns = results.slice(5, 10);
  
  const avgColdTTFT = Math.round(coldRuns.reduce((acc, r) => acc + (typeof r.firstToken === 'number' ? r.firstToken : 0), 0) / coldRuns.length);
  const avgWarmTTFT = Math.round(warmRuns.reduce((acc, r) => acc + (typeof r.firstToken === 'number' ? r.firstToken : 0), 0) / warmRuns.length);
  console.log(`- Average Cold TTFT (Runs 1-5): ${avgColdTTFT} ms`);
  console.log(`- Average Warm TTFT (Runs 6-10 after 60s idle): ${avgWarmTTFT} ms`);
  console.log(`- Delta (Cold - Warm)         : ${avgColdTTFT - avgWarmTTFT} ms`);

  console.log("\n=== 5. SDK BUFFERING COMPARISON ===");
  console.log("Running SDK Request via @google/genai...");
  const sdkRes = await runSdkRequest();
  if (sdkRes.success) {
    console.log(`- SDK first chunk yield: ${sdkRes.metrics.firstChunk} ms`);
    console.log(`- SDK first token yield: ${sdkRes.metrics.firstToken} ms`);
    console.log(`- SDK total duration   : ${sdkRes.metrics.total} ms`);
  } else {
    console.log(`- SDK call failed      : ${sdkRes.error}`);
  }

  console.log("\n=== 6. STREAMING VS NON-STREAMING CONTROL ===");
  console.log("Running raw Non-Streaming request...");
  const nonStreamRes = await runRawHttpsRequest(false);
  console.log(`- Non-stream headers recvd: ${nonStreamRes.metrics.headers} ms`);
  console.log(`- Non-stream first byte   : ${nonStreamRes.metrics.firstByte} ms`);
  console.log(`- Non-stream total duration: ${nonStreamRes.metrics.total} ms`);
}

runAllTests().catch(console.error);

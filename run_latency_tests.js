async function runSingleTest(prompt) {
  const cid = "test_conv_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  const start = Date.now();
  
  const res = await fetch(`http://localhost:3000/api/conversations/${cid}/chat`, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": "Bearer default_token"
    },
    body: JSON.stringify({ message: prompt })
  });
  
  if (!res.ok) {
    throw new Error(`Chat failed with status ${res.status}: ${await res.text()}`);
  }
  
  const decoder = new TextDecoder();
  let sseBuffer = "";
  let metrics = null;
  let textReceived = "";
  let firstVisibleTokenTime = 0;
  
  for await (const chunk of res.body) {
    if (firstVisibleTokenTime === 0) {
      firstVisibleTokenTime = Date.now() - start;
    }
    const chunkText = decoder.decode(chunk, { stream: true });
    sseBuffer += chunkText;
    const lines = sseBuffer.split("\n");
    sseBuffer = lines.pop() || "";
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("data:")) {
        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr) continue;
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.content) {
            textReceived += parsed.content;
          }
          if (parsed.done && parsed.metrics) {
            metrics = parsed.metrics;
          }
        } catch (e) {
          // ignore parsing error
        }
      }
    }
  }
  
  const totalRoundtrip = Date.now() - start;
  
  return {
    prompt,
    text: textReceived,
    frontendFirstVisibleTokenMs: firstVisibleTokenTime,
    totalRoundtripMs: totalRoundtrip,
    metrics: metrics || {}
  };
}

async function main() {
  console.log("Starting Clarity Second-Pass Latency Control Tests...\n");
  
  const testA_results = [];
  const testB_results = [];
  const testC_results = [];
  
  // TEST A: reply with exactly CLARITY-SPEED-TEST
  console.log("=== RUNNING TEST A: tiny response ===");
  for (let i = 1; i <= 3; i++) {
    console.log(`Test A Run ${i}...`);
    try {
      const res = await runSingleTest("Reply with exactly: CLARITY-SPEED-TEST");
      testA_results.push(res);
      console.log(`  -> TTFT: ${res.metrics.timeToFirstTokenMs || "N/A"} ms, Connect: ${res.metrics.providerConnectMs || "N/A"} ms, Stream: ${res.metrics.providerStreamingMs || "N/A"} ms`);
    } catch (err) {
      console.error(`  -> Failed: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // TEST B: Explain what Clarity is in exactly 3 short sentences
  console.log("\n=== RUNNING TEST B: normal response ===");
  for (let i = 1; i <= 3; i++) {
    console.log(`Test B Run ${i}...`);
    try {
      const res = await runSingleTest("Explain what Clarity is in exactly 3 short sentences.");
      testB_results.push(res);
      console.log(`  -> TTFT: ${res.metrics.timeToFirstTokenMs || "N/A"} ms, Connect: ${res.metrics.providerConnectMs || "N/A"} ms, Stream: ${res.metrics.providerStreamingMs || "N/A"} ms`);
    } catch (err) {
      console.error(`  -> Failed: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // TEST C: Explain architecture in detail
  console.log("\n=== RUNNING TEST C: longer response ===");
  for (let i = 1; i <= 3; i++) {
    console.log(`Test C Run ${i}...`);
    try {
      const res = await runSingleTest("Explain Clarity's architecture, RAG pipeline, Model Registry, Supabase persistence, and streaming in detail.");
      testC_results.push(res);
      console.log(`  -> TTFT: ${res.metrics.timeToFirstTokenMs || "N/A"} ms, Connect: ${res.metrics.providerConnectMs || "N/A"} ms, Stream: ${res.metrics.providerStreamingMs || "N/A"} ms`);
    } catch (err) {
      console.error(`  -> Failed: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  
  console.log("\n=== FINAL LATENCY CONTROL TEST RESULTS ===");
  
  function getAverage(array, key) {
    const valid = array.filter(r => r.metrics && typeof r.metrics[key] === "number");
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, r) => acc + r.metrics[key], 0);
    return Math.round(sum / valid.length);
  }
  
  function getAvgTotal(array) {
    const sum = array.reduce((acc, r) => acc + r.totalRoundtripMs, 0);
    return Math.round(sum / array.length);
  }
  
  const allResults = [...testA_results, ...testB_results, ...testC_results];
  
  console.log("\nAverage Metrics Across All 9 Successful Runs:");
  console.log(`Auth MS                  : ${getAverage(allResults, 'authMs')} ms`);
  console.log(`Model Lookup MS          : ${getAverage(allResults, 'modelLookupMs')} ms`);
  console.log(`Conversation Loading MS  : ${getAverage(allResults, 'conversationLoadMs')} ms`);
  console.log(`RAG Retrieval MS         : ${getAverage(allResults, 'ragRetrievalMs')} ms`);
  console.log(`Context Build MS         : ${getAverage(allResults, 'contextBuildMs')} ms`);
  console.log(`Provider Connect MS      : ${getAverage(allResults, 'providerConnectMs')} ms`);
  console.log(`Provider First Chunk MS  : ${getAverage(allResults, 'providerFirstChunkMs')} ms`);
  console.log(`Provider First Token MS  : ${getAverage(allResults, 'providerFirstTokenMs')} ms`);
  console.log(`TTFT (Time To First Tok) : ${getAverage(allResults, 'timeToFirstTokenMs')} ms`);
  console.log(`Streaming Duration MS    : ${getAverage(allResults, 'providerStreamingMs')} ms`);
  console.log(`Persistence MS           : ${getAverage(allResults, 'persistenceMs')} ms`);
  console.log(`Total Roundtrip MS       : ${getAverage(allResults, 'totalResponseMs')} ms`);
  console.log(`Frontend Visible MS      : ${Math.round(allResults.reduce((acc, r) => acc + r.frontendFirstVisibleTokenMs, 0) / allResults.length)} ms`);
}

main().catch(console.error);

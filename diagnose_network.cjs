const https = require('https');
const url = require('url');

function runRawNetworkTest(apiKey, modelId = 'gemini-3.6-flash') {
  return new Promise((resolve, reject) => {
    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
    const parsedUrl = url.parse(targetUrl);
    
    const postData = JSON.stringify({
      contents: [{ parts: [{ text: "Reply with exactly: CLARITY-PROVIDER-LATENCY-7291" }] }]
    });

    const timings = {
      start: Date.now(),
      dnsLookup: null,
      tcpConnect: null,
      tlsHandshake: null,
      requestSent: null,
      responseHeaders: null,
      firstByte: null,
      total: null
    };

    let dnsTime = 0;
    let tcpTime = 0;
    let tlsTime = 0;

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
      timings.responseHeaders = Date.now() - timings.start;
      
      let bodyReceived = false;
      res.on('data', (chunk) => {
        if (!bodyReceived) {
          timings.firstByte = Date.now() - timings.start;
          bodyReceived = true;
        }
      });

      let responseText = '';
      res.on('data', (chunk) => {
        responseText += chunk;
      });

      res.on('end', () => {
        timings.total = Date.now() - timings.start;
        resolve({
          timings,
          statusCode: res.statusCode,
          dnsTime,
          tcpTime,
          tlsTime,
          text: responseText
        });
      });
    });

    req.on('socket', (socket) => {
      socket.on('lookup', () => {
        dnsTime = Date.now() - timings.start;
        timings.dnsLookup = dnsTime;
      });
      socket.on('connect', () => {
        tcpTime = Date.now() - timings.start;
        timings.tcpConnect = tcpTime;
      });
      socket.on('secureConnect', () => {
        tlsTime = Date.now() - timings.start;
        timings.tlsHandshake = tlsTime;
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
    timings.requestSent = Date.now() - timings.start;
  });
}

// Read API key from env for the diagnostic script
const apiKey = process.env.GEMINI_API_KEY || '';
if (!apiKey) {
  console.error("GEMINI_API_KEY not configured in environment.");
  process.exit(1);
}

console.log("Running Raw Network TLS/TCP/DNS Diagnostic Test...");
runRawNetworkTest(apiKey)
  .then((res) => {
    console.log("Status Code:", res.statusCode);
    console.log("Timings (ms):");
    console.log("  DNS Lookup      :", res.timings.dnsLookup);
    console.log("  TCP Connect     :", res.timings.tcpConnect);
    console.log("  TLS Handshake   :", res.timings.tlsHandshake);
    console.log("  Request Sent    :", res.timings.requestSent);
    console.log("  Response Headers:", res.timings.responseHeaders);
    console.log("  First Byte      :", res.timings.firstByte);
    console.log("  Total Duration  :", res.timings.total);
  })
  .catch(console.error);

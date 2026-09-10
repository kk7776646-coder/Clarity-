const http = require('http');

async function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    else if (method === 'POST') req.write("{}");
    req.end();
  });
}

async function run() {
  const projA = await request('POST', '/api/projects', { name: "Project C", description: "payment app" });
  console.log("Create Proj:", projA);
  const pidA = projA.body.id;
  
  const fReq = await request('POST', '/api/projects/' + pidA + '/files', {
    path: "src/payment.js",
    content: "function processPayment() { return 'payment processed'; }"
  });
  console.log("Create file:", fReq);

  const reReq = await request('POST', '/api/projects/' + pidA + '/knowledge/reindex');
  console.log("Reindex:", reReq);

  const searchA = await request('GET', '/api/projects/' + pidA + '/knowledge/search?q=payment');
  console.log("Search A:", searchA);
}
run().catch(console.error);

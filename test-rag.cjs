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
  console.log("Creating Project A (Payment)");
  const projA = await request('POST', '/api/projects', { name: "Project A", description: "payment app" });
  const pidA = projA.body.id;
  
  await request('POST', '/api/projects/' + pidA + '/files', {
    path: "src/payment.js",
    content: "function processPayment() { return 'payment processed'; }"
  });

  console.log("Creating Project B (Hospital)");
  const projB = await request('POST', '/api/projects', { name: "Project B", description: "hospital app" });
  const pidB = projB.body.id;
  
  await request('POST', '/api/projects/' + pidB + '/files', {
    path: "src/patients.js",
    content: "function getPatientRecords() { return 'patient records'; }"
  });

  // Reindex both just in case
  await request('POST', '/api/projects/' + pidA + '/knowledge/reindex');
  await request('POST', '/api/projects/' + pidB + '/knowledge/reindex');

  console.log("Searching Project A for payment");
  const searchA = await request('GET', '/api/projects/' + pidA + '/knowledge/search?q=payment');
  console.log(searchA.body.results.map(r => r.file));
  
  console.log("Searching Project B for payment");
  const searchB = await request('GET', '/api/projects/' + pidB + '/knowledge/search?q=payment');
  console.log(searchB.body.results.map(r => r.file));
  
  console.log("Searching Project B for patients");
  const searchB2 = await request('GET', '/api/projects/' + pidB + '/knowledge/search?q=patients');
  console.log(searchB2.body.results.map(r => r.file));

  console.log("Deleting Project A payment file");
  await request('DELETE', '/api/projects/' + pidA + '/files?path=src/payment.js');

  console.log("Searching Project A for payment after delete");
  const searchA2 = await request('GET', '/api/projects/' + pidA + '/knowledge/search?q=payment');
  console.log(searchA2.body.results.map(r => r.file));
}

run().catch(console.error);

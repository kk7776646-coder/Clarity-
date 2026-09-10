async function run() {
  console.log("Creating project...");
  const res = await fetch("http://127.0.0.1:3000/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Project C" })
  });
  const data = await res.json();
  console.log("Create proj:", data);
  const pidA = data.id;

  const fReq = await fetch("http://127.0.0.1:3000/api/projects/" + pidA + "/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "src/payment.js", content: "function processPayment() { return 'ok'; }" })
  });
  console.log("Create file:", await fReq.json());

  const reReq = await fetch("http://127.0.0.1:3000/api/projects/" + pidA + "/knowledge/reindex", {
    method: "POST"
  });
  console.log("Reindex:", await reReq.json());

  const searchA = await fetch("http://127.0.0.1:3000/api/projects/" + pidA + "/knowledge/search?q=payment");
  console.log("Search A:", await searchA.json());
}
run().catch(console.error);
async function testIncremental() {
  const pid = require('./package.json').lastProjectId || 'proj_1788986326021'; 
  
  // Update file
  const fReq2 = await fetch("http://127.0.0.1:3000/api/projects/" + pid + "/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "src/payment.js", content: "function processPayment() { return 'success'; }\nfunction refund() { return 'done'; }" })
  });
  console.log("Update file:", await fReq2.json());

  // Search for 'refund' without reindexing
  const searchRefund = await fetch("http://127.0.0.1:3000/api/projects/" + pid + "/knowledge/search?q=refund");
  console.log("Search Refund:", await searchRefund.json());
}
testIncremental().catch(console.error);

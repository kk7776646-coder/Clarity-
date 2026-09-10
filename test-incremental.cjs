async function run() {
  console.log("Creating project...");
  const res = await fetch("http://127.0.0.1:3000/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Project Incremental" })
  });
  const data = await res.json();
  const pidA = data.id;

  await fetch("http://127.0.0.1:3000/api/projects/" + pidA + "/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "src/payment.js", content: "function processPayment() { return 'ok'; }" })
  });

  await fetch("http://127.0.0.1:3000/api/projects/" + pidA + "/knowledge/reindex", { method: "POST" });

  const fReq2 = await fetch("http://127.0.0.1:3000/api/projects/" + pidA + "/files", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "src/payment.js", content: "function processPayment() { return 'success'; }\nfunction refund() { return 'done'; }" })
  });
  console.log("Edit:", await fReq2.json());

  const searchRefund = await fetch("http://127.0.0.1:3000/api/projects/" + pidA + "/knowledge/search?q=refund");
  console.log("Search Refund after edit:", await searchRefund.json());
}
run().catch(console.error);

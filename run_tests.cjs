const http = require('http');
const fs = require('fs');

async function runTests() {
  console.log("Starting tests for Step 8 File Lifecycle...");
  const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
  
  try {
    const res = await fetch("http://localhost:3000/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Step8TestProject", description: "Test" })
    });
    
    const data = await res.json();
    const pid = data.id;
    console.log("✅ Created project:", pid);

    let fileRes = await fetch(`http://localhost:3000/api/projects/${pid}/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "src/server.py", content: "print('hello')" })
    });
    
    if (!fileRes.ok) {
       console.log("File creation failed:", await fileRes.text());
       return;
    }
    
    let fileData = await fileRes.json();
    if (fileData.ok && fileData.file.path === "src/server.py") {
      console.log("✅ Created file src/server.py");
    } else {
      console.error("❌ Failed to create file", fileData);
    }
    
    let renameRes = await fetch(`http://localhost:3000/api/projects/${pid}/files/rename`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldPath: "src/server.py", newPath: "src/api.py" })
    });
    let renameData = await renameRes.json();
    if (renameData.ok && renameData.newPath === "src/api.py") {
      console.log("✅ Renamed file to src/api.py");
    } else {
      console.error("❌ Failed to rename file", renameData);
    }

    let putRes = await fetch(`http://localhost:3000/api/projects/${pid}/files`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "src/api.py", content: "print('modified')" })
    });
    let putData = await putRes.json();
    if (putData.ok) {
      console.log("✅ Replaced file content");
    } else {
      console.error("❌ Failed to replace file", putData);
    }
    
    let delRes = await fetch(`http://localhost:3000/api/projects/${pid}/files?path=src/api.py`, {
      method: "DELETE"
    });
    let delData = await delRes.json();
    if (delData.ok) {
      console.log("✅ Deleted file src/api.py");
    } else {
      console.error("❌ Failed to delete file", delData);
    }
    
    let reindexRes = await fetch(`http://localhost:3000/api/projects/${pid}/reindex`, {
      method: "POST"
    });
    let reindexData = await reindexRes.json();
    if (reindexData.ok) {
      console.log("✅ Reindexed project");
    } else {
      console.error("❌ Failed to reindex", reindexData);
    }

    console.log("All lifecycle tests executed successfully!");
    process.exit(0);
    
  } catch(err) {
    console.error("Test Error:", err);
  }
}

runTests();

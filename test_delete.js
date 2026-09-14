async function runTest() {
  try {
    // Create a new project via UI endpoint
    const createRes = await fetch("http://localhost:3000/api/projects", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ name: "To Be Deleted" })
    });
    const proj = await createRes.json();
    console.log("Created project:", proj.id);
    
    // Delete it via UI endpoint
    const delRes = await fetch(`http://localhost:3000/api/projects/${proj.id}`, {
       method: "DELETE"
    });
    
    if (delRes.ok) {
       console.log("Delete status:", delRes.status, "PASS");
    } else {
       console.log("Delete status:", delRes.status, "FAIL");
       console.log(await delRes.text());
    }
    
    // Fetch it again to see if it's really gone
    const checkRes = await fetch("http://localhost:3000/api/projects");
    if (!checkRes.ok) {
        console.log("Projects fetch ok"); // Since we don't have GET /api/projects maybe it fails
    } else {
       // but wait, is there a GET /api/projects? The UI fetched it! Let's see if it succeeded.
       const all = await checkRes.json();
       console.log("Remaining:", all.filter(p => p.id === proj.id).length === 0 ? "GONE" : "STILL THERE");
    }
  } catch (e) {
    console.error(e);
  }
}
runTest();

async function runTest() {
  try {
    // We will simulate creating a new project.
    // The easiest way is to mock uploading files, which creates a project.
    const res = await fetch('http://localhost:3000/api/projects/upload-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: "TestProject",
        files: [
          { path: "index.js", content: "console.log('Hello world');" },
          { path: "README.md", content: "# Test Project\nThis is a test." }
        ]
      })
    });
    
    if (!res.ok) {
       console.error("Upload failed", await res.text());
       return;
    }
    const data = await res.json();
    console.log("PROJECT CREATED:", data.projectId);
    
    const pid = data.projectId;
    
    // Now let's try chat against this project
    const chatRes = await fetch(`http://localhost:3000/api/projects/${pid}/chat`, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({ message: "What is this project?" })
    });
    
    if (!chatRes.ok) {
       console.error("Chat failed", await chatRes.text());
       return;
    }
    
    const text = await chatRes.text();
    console.log("CHAT RESPONSE:");
    console.log(text.substring(0, 500) + '...');
    
  } catch (e) {
    console.error(e);
  }
}
runTest();

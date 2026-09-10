const http = require('http');

async function runTest() {
  try {
    // 1. Get models to check if fake ones are removed
    const modelsRes = await fetch('http://localhost:3000/api/models');
    const models = await modelsRes.json();
    console.log("MODELS:", models.models.map(m => m.name));

    // 2. Create a test project
    const createRes = await fetch('http://localhost:3000/api/github/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl: 'https://github.com/expressjs/express', branch: 'master' })
    });
    // This might fail if github import is not implemented exactly like this, let's just use upload-files or something simpler.
  } catch (e) {
    console.error(e);
  }
}
runTest();

async function runTest() {
  try {
    const modelsRes = await fetch('http://localhost:3000/api/models');
    const models = await modelsRes.json();
    console.log("MODELS:", models.models.map(m => m.name));
  } catch (e) {
    console.error(e);
  }
}
runTest();

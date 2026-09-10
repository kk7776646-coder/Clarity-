const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('./data/clarity.db');

async function runTest() {
  try {
    const pid = "test_pid_" + Date.now();
    // 1. Insert a test project directly into DB
    // Assuming schema has id, user_id, name, created_at, updated_at
    const userId = "default_user"; // Need an actual user id. Let's see what users exist.
    const users = db.prepare('SELECT id FROM users LIMIT 1').all();
    if (users.length === 0) {
       console.log("No users found");
       return;
    }
    const uid = users[0].id;
    
    db.prepare('INSERT INTO projects (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
      pid, uid, "Test Proj", Date.now(), Date.now()
    );
    
    // Insert a file
    db.prepare('INSERT INTO project_files (id, project_id, filename, file_type, size, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      "fid_1", pid, "index.js", "text", 20, "console.log('hi');", Date.now()
    );
    
    // Now restart the server or wait for it to pick up? 
    // Wait, the server uses an in-memory Map `projects`. We should just use an existing project from the Map, or hit the API that creates projects.
    console.log("Inserted into DB, but server memory might not know it.");
  } catch(e) {
    console.error(e);
  }
}
runTest();

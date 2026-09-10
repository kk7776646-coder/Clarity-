const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');

async function runTest() {
  const db = new DatabaseSync('./data/clarity.db');
  
  const uid = "user_default";

  const pid = "test_del_" + Date.now();
  db.prepare('INSERT OR IGNORE INTO users (id, email, name, created_at) VALUES (?, ?, ?, ?)').run(uid, 'test@test.com', 'Test', Date.now());
  db.prepare('INSERT INTO projects (id, name, created_at, updated_at, metadata) VALUES (?, ?, ?, ?, ?)').run(
    pid, "To Be Deleted", Date.now(), Date.now(), JSON.stringify({ user_id: uid })
  );
  db.prepare('INSERT INTO project_files (id, project_id, filename, file_type, size, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    "fid_1", pid, "temp.txt", "text", 5, "hello", Date.now()
  );
  fs.mkdirSync(`./data/storage/${pid}`, { recursive: true });
  fs.writeFileSync(`./data/storage/${pid}/temp.txt`, "hello");
  
  // We must hit the API through fetch to test the DELETE route, but since we updated the DB behind the back of the server memory Map, the memory map won't know about it.
  // Unless we hit the upload API to create it... but wait, we can just restart the server so it loads the DB into memory!
  console.log(pid);
}
runTest();

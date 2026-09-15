const http = require("http");
const os = require("os");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
        });
      });
    });
    req.on("error", reject);
    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function verify() {
  const targetEmail = process.argv[2];
  const targetPassword = process.argv[3];
  const expectedUserId = process.argv[4];
  const expectedProjectId = process.argv[5];
  const expectedConvId = process.argv[6];

  console.log("Verifying post-restart login for:", targetEmail);

  // 1. LOGIN
  const loginRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { email: targetEmail, password: targetPassword }
  );

  console.log("Post-restart login HTTP status:", loginRes.status);
  const user = loginRes.data?.user;
  const token = loginRes.data?.token;

  if (loginRes.status !== 200 || user?.id !== expectedUserId) {
    console.error("FAIL: Login failed or user ID mismatch", loginRes.data);
    process.exit(1);
  }
  console.log("USER: PASS, User ID:", user.id);

  // 2. FETCH PROJECT
  const projRes = await request({
    hostname: "localhost",
    port: 3000,
    path: `/api/projects/${expectedProjectId}`,
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("Project fetch HTTP status:", projRes.status);
  const proj = projRes.data?.project || projRes.data;
  if (projRes.status !== 200 || proj?.id !== expectedProjectId) {
    console.error("FAIL: Project not found post-restart", projRes.data);
    process.exit(1);
  }
  console.log("PROJECT: PASS, Project ID:", proj.id);

  // 3. FETCH CONVERSATION
  const convRes = await request({
    hostname: "localhost",
    port: 3000,
    path: `/api/conversations/${expectedConvId}`,
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log("Conversation fetch HTTP status:", convRes.status);
  const conv = convRes.data?.conversation || convRes.data;
  if (convRes.status !== 200 || conv?.id !== expectedConvId) {
    console.error("FAIL: Conversation not found post-restart", convRes.data);
    process.exit(1);
  }
  console.log("CONVERSATION: PASS, Conv ID:", expectedConvId);

  // 4. CHECK SQLITE PERSISTENCE
  const dbPath = path.join(os.homedir(), ".local", "share", "clarity", "database", "clarity.db");
  const sqliteDb = new DatabaseSync(dbPath);
  const dbUser = sqliteDb.prepare("SELECT * FROM users WHERE id = ?").get(expectedUserId);
  const dbProj = sqliteDb.prepare("SELECT * FROM projects WHERE id = ?").get(expectedProjectId);
  const dbConv = sqliteDb.prepare("SELECT * FROM conversations WHERE id = ?").get(expectedConvId);

  if (dbUser && dbProj && dbConv) {
    console.log("SQLITE DATABASE INTEGRITY: PASS");
  } else {
    console.error("FAIL: SQLite missing rows");
    process.exit(1);
  }

  console.log("ALL POST-RESTART TESTS PASSED!");
}

verify().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});

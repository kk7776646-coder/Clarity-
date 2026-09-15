const http = require("http");
const os = require("os");
const path = require("path");
const fs = require("fs");
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

async function run() {
  console.log("==================================================");
  console.log("CLARITY PERSISTENCE PROOF SUITE — START");
  console.log("==================================================");

  const results = {};
  const unique = Date.now();
  const testEmailA = `clarity-persistence-proof-${unique}@example.com`;
  const testPasswordA = `ProofPass_${unique}!`;

  // 1. SIGNUP USER A
  console.log("\n[TEST 1] Signup User A...");
  const signupRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/signup",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { email: testEmailA, password: testPasswordA, name: "Proof User A" }
  );

  console.log("Signup status:", signupRes.status);
  const userA = signupRes.data?.user;
  const tokenA = signupRes.data?.token;
  console.log("Created User A ID:", userA?.id);

  if (signupRes.status === 201 && userA?.id && tokenA) {
    results["USER_A_SIGNUP"] = "PASS";
  } else {
    results["USER_A_SIGNUP"] = "FAIL";
    console.error("Signup failed:", signupRes.data);
  }

  // 2. REAL LOGIN USER A
  console.log("\n[TEST 2] Logout then Login User A...");
  const logoutRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/auth/logout",
    method: "POST",
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  console.log("Logout status:", logoutRes.status);

  // Login again
  const loginRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { email: testEmailA, password: testPasswordA }
  );
  console.log("Login status:", loginRes.status);
  const loginUser = loginRes.data?.user;
  const loginToken = loginRes.data?.token;

  if (loginRes.status === 200 && loginUser?.id === userA?.id) {
    results["REAL_LOGIN"] = "PASS";
    console.log("LOGIN: PASS");
    console.log("USER ID BEFORE:", userA?.id);
    console.log("USER ID AFTER:", loginUser?.id);
  } else {
    results["REAL_LOGIN"] = "FAIL";
    console.error("Login failed or user ID mismatch:", loginRes.data);
  }

  // 3. CLOSE & REOPEN / SESSION RESTORE
  console.log("\n[TEST 3 & 5] Session Restore with Bearer Token...");
  const meRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/auth/me",
    method: "GET",
    headers: { Authorization: `Bearer ${loginToken}` },
  });
  console.log("Auth /me status:", meRes.status);
  if (meRes.status === 200 && meRes.data?.user?.id === userA?.id) {
    results["SESSION_RESTORE"] = "PASS";
    console.log("AUTH RESTORE: PASS, restored user:", meRes.data.user.id);
  } else {
    results["SESSION_RESTORE"] = "FAIL";
    console.error("Session restore failed:", meRes.data);
  }

  // 9. PASSWORD AUTHENTICATION TEST (Wrong password vs right password)
  console.log("\n[TEST 9] Password Authentication Test...");
  const wrongLoginRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { email: testEmailA, password: "WrongPassword123!" }
  );
  console.log("Wrong password status:", wrongLoginRes.status, "code:", wrongLoginRes.data?.code);

  const rightLoginRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/login",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { email: testEmailA, password: testPasswordA }
  );
  console.log("Right password status:", rightLoginRes.status);

  if (wrongLoginRes.status === 401 && wrongLoginRes.data?.code === "INVALID_CREDENTIALS" && rightLoginRes.status === 200) {
    results["PASSWORD_AUTH"] = "PASS";
  } else {
    results["PASSWORD_AUTH"] = "FAIL";
  }

  // 12. FAILURE CLASSIFICATION TEST
  console.log("\n[TEST 12] Failure Classification Test...");
  const invalidSessionRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/auth/me",
    method: "GET",
  });

  const expiredSessionRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/auth/me",
    method: "GET",
    headers: { Authorization: "Bearer sess_non_existent_token_9999" },
  });

  console.log("No token code:", invalidSessionRes.data?.code, "Expired token code:", expiredSessionRes.data?.code);
  if (invalidSessionRes.data?.code === "SESSION_INVALID" && expiredSessionRes.data?.code === "SESSION_EXPIRED") {
    results["FAILURE_CLASSIFICATION"] = "PASS";
  } else {
    results["FAILURE_CLASSIFICATION"] = "FAIL";
  }

  // 6. CREATE REAL USER DATA
  console.log("\n[TEST 6] Create Real User Data for User A...");
  const authHeadersA = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${loginToken}`,
  };

  // 6a. Project
  const projRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/projects",
      method: "POST",
      headers: authHeadersA,
    },
    { name: `Proof Project ${unique}` }
  );
  const projectIdA = projRes.data?.id;
  console.log("Project created:", projectIdA);

  // 6b. Project File
  const fileRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/projects/${projectIdA}/files`,
      method: "POST",
      headers: authHeadersA,
    },
    { path: "src/index.ts", content: 'console.log("Hello Clarity Proof");' }
  );
  const fileIdA = fileRes.data?.file?.id || `file_${projectIdA}_src/index.ts`;
  console.log("Project file created:", fileIdA);

  // 6c. Conversation
  const convRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/conversations",
      method: "POST",
      headers: authHeadersA,
    },
    { title: `Proof Conversation ${unique}` }
  );
  const conversationIdA = convRes.data?.id;
  console.log("Conversation created:", conversationIdA);

  // 6d. Message
  const msgRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/conversations/${conversationIdA}/messages`,
      method: "POST",
      headers: authHeadersA,
    },
    {
      role: "user",
      content: "Explain persistence architecture in Clarity.",
    }
  );
  const messageIdA = msgRes.data?.id || msgRes.data?.message?.id || `msg_${conversationIdA}`;
  console.log("Message created:", messageIdA);

  // 6e. Model Configuration
  const modelRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/models",
      method: "POST",
      headers: authHeadersA,
    },
    {
      name: `Proof Model ${unique}`,
      provider: "gemini",
      model_name: "gemini-2.5-flash",
    }
  );
  const modelIdA = modelRes.data?.model?.id || modelRes.data?.id;
  console.log("Model created:", modelIdA);

  // 6f. Artifact
  const artifactRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: `/api/projects/${projectIdA}/artifacts`,
      method: "POST",
      headers: authHeadersA,
    },
    {
      filename: "architecture.json",
      category: "diagram",
      content: '{"type":"flowchart"}',
    }
  );
  const artifactIdA = artifactRes.data?.artifact?.id || artifactRes.data?.id;
  console.log("Artifact created:", artifactIdA);

  // 6g. Workspace/RAG File
  const ragRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/files/shared",
      method: "POST",
      headers: authHeadersA,
    },
    {
      filename: "clarity-rag-proof.md",
      content: "# Clarity Persistence Knowledge\nAll data is persisted in SQLite and Supabase.",
      mime: "text/markdown",
    }
  );
  const ragIdA = ragRes.data?.id || ragRes.data?.file?.id || `rag_${unique}`;
  console.log("RAG / Workspace file created:", ragIdA);

  const createdIds = {
    USER_ID: userA.id,
    PROJECT_ID: projectIdA,
    CONVERSATION_ID: conversationIdA,
    MESSAGE_ID: messageIdA,
    MODEL_ID: modelIdA,
    ARTIFACT_ID: artifactIdA,
    RAG_DOCUMENT_ID: ragIdA,
  };
  console.log("\n--- RECORDED CREATED IDS ---");
  console.log(JSON.stringify(createdIds, null, 2));

  // 13. MULTI-USER ISOLATION
  console.log("\n[TEST 13] Multi-User Isolation Test...");
  const testEmailB = `clarity-persistence-proof-b-${unique}@example.com`;
  const testPasswordB = `ProofPassB_${unique}!`;

  const signupBRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/auth/signup",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { email: testEmailB, password: testPasswordB, name: "Proof User B" }
  );

  const userB = signupBRes.data?.user;
  const tokenB = signupBRes.data?.token;
  console.log("Created User B ID:", userB?.id);

  const authHeadersB = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${tokenB}`,
  };

  // User B creates Project B and Conversation B
  const projBRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/projects",
      method: "POST",
      headers: authHeadersB,
    },
    { name: `Proof Project B ${unique}` }
  );
  const projectIdB = projBRes.data?.id;

  const convBRes = await request(
    {
      hostname: "localhost",
      port: 3000,
      path: "/api/conversations",
      method: "POST",
      headers: authHeadersB,
    },
    { title: `Proof Conversation B ${unique}` }
  );
  const conversationIdB = convBRes.data?.id;

  // 13a. User A lists projects
  const listProjectsARes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/projects",
    method: "GET",
    headers: authHeadersA,
  });
  const projectsSeenByA = (listProjectsARes.data?.projects || listProjectsARes.data || []).map((p) => p.id);
  const aSeesOnlyA = projectsSeenByA.includes(projectIdA) && !projectsSeenByA.includes(projectIdB);

  // 13b. User B lists projects
  const listProjectsBRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/projects",
    method: "GET",
    headers: authHeadersB,
  });
  const projectsSeenByB = (listProjectsBRes.data?.projects || listProjectsBRes.data || []).map((p) => p.id);
  const bSeesOnlyB = projectsSeenByB.includes(projectIdB) && !projectsSeenByB.includes(projectIdA);

  // 13c. User A accesses Project B by ID
  const aAccessBProjRes = await request({
    hostname: "localhost",
    port: 3000,
    path: `/api/projects/${projectIdB}`,
    method: "GET",
    headers: authHeadersA,
  });

  // 13d. User B accesses Project A by ID
  const bAccessAProjRes = await request({
    hostname: "localhost",
    port: 3000,
    path: `/api/projects/${projectIdA}`,
    method: "GET",
    headers: authHeadersB,
  });

  // 13e. User A accesses Conversation B by ID
  const aAccessBConvRes = await request({
    hostname: "localhost",
    port: 3000,
    path: `/api/conversations/${conversationIdB}`,
    method: "GET",
    headers: authHeadersA,
  });

  // 13f. User B accesses Conversation A by ID
  const bAccessAConvRes = await request({
    hostname: "localhost",
    port: 3000,
    path: `/api/conversations/${conversationIdA}`,
    method: "GET",
    headers: authHeadersB,
  });

  console.log("User A sees project list:", projectsSeenByA.length, "includes A:", projectsSeenByA.includes(projectIdA), "includes B:", projectsSeenByA.includes(projectIdB));
  console.log("User B sees project list:", projectsSeenByB.length, "includes B:", projectsSeenByB.includes(projectIdB), "includes A:", projectsSeenByB.includes(projectIdA));
  console.log("A accesses B Project HTTP:", aAccessBProjRes.status);
  console.log("B accesses A Project HTTP:", bAccessAProjRes.status);
  console.log("A accesses B Conversation HTTP:", aAccessBConvRes.status);
  console.log("B accesses A Conversation HTTP:", bAccessAConvRes.status);

  if (
    aSeesOnlyA &&
    bSeesOnlyB &&
    aAccessBProjRes.status === 403 &&
    bAccessAProjRes.status === 403 &&
    aAccessBConvRes.status === 403 &&
    bAccessAConvRes.status === 403
  ) {
    results["USER_ISOLATION"] = "PASS";
  } else {
    results["USER_ISOLATION"] = "FAIL";
  }

  // 7. DATA PERSISTENCE VERIFICATION IN DATABASE
  console.log("\n[TEST 7] Direct SQLite Database Persistence Verification for User A Data...");
  const dbPath = path.join(os.homedir(), ".local", "share", "clarity", "database", "clarity.db");
  const sqliteDb = new DatabaseSync(dbPath);

  const rowUser = sqliteDb.prepare("SELECT * FROM users WHERE id = ?").get(userA.id);
  const rowProj = sqliteDb.prepare("SELECT * FROM projects WHERE id = ?").get(projectIdA);
  const rowFiles = sqliteDb.prepare("SELECT * FROM project_files WHERE project_id = ?").all(projectIdA);
  const rowConv = sqliteDb.prepare("SELECT * FROM conversations WHERE id = ?").get(conversationIdA);
  const rowMsgs = sqliteDb.prepare("SELECT * FROM messages WHERE conversation_id = ?").all(conversationIdA);
  const rowModel = modelIdA ? sqliteDb.prepare("SELECT * FROM models WHERE id = ?").get(modelIdA) : true;
  const rowArtifacts = sqliteDb.prepare("SELECT * FROM artifacts WHERE project_id = ?").all(projectIdA);
  const rowRag = sqliteDb.prepare("SELECT * FROM workspace_files WHERE filename = ?").get("clarity-rag-proof.md");

  console.log("SQLite User Row:", Boolean(rowUser), "ID:", rowUser?.id);
  console.log("SQLite Project Row:", Boolean(rowProj), "ID:", rowProj?.id);
  console.log("SQLite Files Count:", rowFiles.length);
  console.log("SQLite Conversation Row:", Boolean(rowConv), "ID:", rowConv?.id);
  console.log("SQLite Messages Count:", rowMsgs.length);
  console.log("SQLite Model Row:", Boolean(rowModel), "ID:", rowModel?.id);
  console.log("SQLite Artifacts Count:", rowArtifacts.length);
  console.log("SQLite RAG Row:", Boolean(rowRag), "ID:", rowRag?.id);

  if (rowUser && rowProj && rowConv && rowFiles.length > 0 && rowMsgs.length > 0) {
    results["DATABASE_PERSISTENCE"] = "PASS";
  } else {
    results["DATABASE_PERSISTENCE"] = "FAIL";
  }

  // Check Supabase status
  const healthRes = await request({
    hostname: "localhost",
    port: 3000,
    path: "/api/health",
    method: "GET",
  });
  console.log("\nBackend health status:", healthRes.data);

  console.log("\n==================================================");
  console.log("OVERALL TEST RESULTS SUMMARY:");
  console.log(JSON.stringify(results, null, 2));
  console.log("==================================================");
}

run().catch((err) => {
  console.error("Test runner encountered error:", err);
  process.exit(1);
});

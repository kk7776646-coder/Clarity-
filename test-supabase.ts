import { verifySupabaseConnection, isSupabaseConfigured } from "./supabase.js";

async function runTest() {
  console.log("=== SUPABASE INTEGRATION TEST ===");
  console.log("SUPABASE_URL present:", Boolean(process.env.SUPABASE_URL));
  console.log("SUPABASE_ANON_KEY present:", Boolean(process.env.SUPABASE_ANON_KEY));
  console.log("SUPABASE_SERVICE_ROLE_KEY present:", Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY));
  console.log("isSupabaseConfigured():", isSupabaseConfigured());

  const report = await verifySupabaseConnection();
  console.log("\n--- TEST RESULTS ---");
  console.log(`- Supabase connection: ${report.supabaseConnection}`);
  console.log(`- PostgreSQL access: ${report.postgreSqlAccess}`);
  console.log(`- Storage access: ${report.storageAccess}`);
  console.log(`- Auth integration: ${report.authIntegration}`);
  console.log(`- User/project isolation: ${report.userProjectIsolation}`);
  
  if (report.details?.error) {
    console.log("Details / Notes:", report.details.error);
  }
  if (report.details?.tablesFound) {
    console.log("Tables verified:", report.details.tablesFound.join(", "));
  }
  if (report.details?.bucketsFound) {
    console.log("Storage buckets verified:", report.details.bucketsFound.join(", "));
  }
}

runTest().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});

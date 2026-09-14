=== ROOT CAUSE ===
Production Cloudflare Worker (worker/index.ts) only handled /api/auth/*, /api/chat, /api/health.
Every other /api/* request fell back to fetch(request), serving the static SPA -> 404 for data endpoints.
Flask backend (server/app.py) had all routes but was unreachable in production.
FIX: Added proxy block to worker/index.ts routing remaining /api/* to BACKEND_URL (default localhost:5000).

=== SECTION STATUS ===
New Chat    -> API-BACKED BUT BROKEN -> FIXED (POST /api/conversations proxied)
Chat        -> API-BACKED BUT BROKEN -> FIXED (POST /api/conversations/{cid}/chat + regenerate proxied)
Home        -> API-BACKED BUT BROKEN -> FIXED (GET /api/conversations, /api/files/shared, /api/projects proxied)
Projects    -> API-BACKED BUT BROKEN -> FIXED (all /api/projects/* and /api/files/upload proxied)
Collections -> API-BACKED BUT BROKEN -> FIXED (GET /api/files/shared proxied)
History     -> API-BACKED BUT BROKEN -> FIXED (GET /api/conversations -> 404 confirmed; now proxied)
Recent      -> API-BACKED BUT BROKEN -> FIXED (GET /api/conversations feeds list; "No recent chats" only when empty)
Model       -> API-BACKED BUT BROKEN -> FIXED (GET /api/models -> 404 confirmed; test connection present; now proxied)
Settings    -> FRONTEND ONLY (localStorage/app_settings; links to #/model, no server API calls)

=== MAPPING (abbreviated) ===
New Chat      sidebarNewChat / newChatBtn  -> api.post /api/conversations        -> worker(proxied) -> server create_conversation -> chat_service / SQLite -> login_required
Chat send     chat.js sendMessage          -> fetch POST /api/conversations/{cid}/chat -> worker(proxied) -> server chat         -> chat_service / SQLite -> login_required
Chat stream   chat.js _consumeStream        -> same endpoint (SSE)              -> worker(proxied) -> server chat         -> adapter / SQLite     -> login_required
Chat regen    chat.js _regenerate            -> fetch POST /api/conversations/{cid}/regenerate -> worker(proxied) -> server regenerate -> chat_service / SQLite -> login_required
Chat edit     chat.js _handleEdit            -> api.post /api/conversations/{cid}/messages/{m}/edit -> worker(proxied) -> server edit_message -> chat_service / SQLite -> login_required
History load  pages/history.js              -> api.get /api/conversations        -> worker(proxied) -> server get_conversations -> chat_service / SQLite -> login_required
History clear pages/history.js              -> api.del /api/conversations        -> worker(proxied) -> server delete_all_conversations -> chat_service / SQLite -> login_required
Recent load   sidebar/uiSidebar.refresh     -> api.get /api/conversations        -> worker(proxied) -> server get_conversations -> chat_service / SQLite -> login_required
Model list    pages/model.js                 -> api.get /api/models              -> worker(proxied) -> server list_models -> ModelConfig / SQLite -> login_required
Model add     pages/model.js (openAddModelsModal) -> api.post /api/models        -> worker(proxied) -> server create_model -> ModelConfig / SQLite -> login_required
Model edit    pages/model.js (openModelModal)  -> api.put /api/models/{id}       -> worker(proxied) -> server update_model -> ModelConfig / SQLite -> login_required
Model delete  pages/model.js                 -> api.del /api/models/{id}         -> worker(proxied) -> server delete_model -> ModelConfig / SQLite -> login_required
Model enable  pages/model.js                 -> api.post /api/models/{id}/enable -> worker(proxied) -> server enable_model -> ModelConfig / SQLite -> login_required
Model select  pages/model.js                 -> api.post /api/models/set-active  -> worker(proxied) -> server set_active_model -> auth_service / SQLite -> login_required
Model test    pages/model.js (modelTestBtn)   -> api.post /api/models/test        -> worker(proxied) -> server test_model -> ModelConfig.get_adapter().test_connection() -> Adapter / SQLite -> login_required
Model caps    model-selector.js              -> api.get /api/models/{id}/capabilities -> worker(proxied) -> server model_capabilities -> ModelConfig / Adapter -> login_required
Project list  pages/project.js               -> api.get /api/projects            -> worker(proxied) -> server list_projects_route -> codebase_service / SQLite -> login_required
Project def   pages/project.js               -> api.get /api/projects/default    -> worker(proxied) -> server default_project_route -> codebase_service / SQLite -> login_required
Project create pages/project.js              -> api.post /api/projects           -> worker(proxied) -> server create_project_route -> codebase_service / SQLite -> login_required
Project delete pages/project.js             -> api.del /api/projects/{pid}       -> worker(proxied) -> server delete_project_route -> codebase_service / SQLite -> login_required
Project tree  pages/project.js               -> api.get /api/projects/{pid}/tree -> worker(proxied) -> server project_tree -> codebase_service / SQLite -> login_required
Project index pages/project.js             -> api.post /api/projects/{pid}/index -> worker(proxied) -> server index_project -> codebase_service / SQLite -> login_required
Project file  pages/project.js               -> api.get /api/projects/{pid}/file?path=... -> worker(proxied) -> server project_file_content -> codebase_service / SQLite -> login_required
Project search pages/project.js             -> api.get /api/projects/{pid}/search?q=... -> worker(proxied) -> server search_project -> codebase_service / SQLite -> login_required
Collection load pages/collections.js         -> api.get /api/files/shared        -> worker(proxied) -> server list_user_files -> file_service / SQLite -> login_required
Home           pages/home.js                 -> api.get /api/conversations + /api/files/shared + /api/projects -> all proxied -> server routes -> services / SQLite -> login_required
Settings       pages/settings.js              -> NO API CALLS (localStorage/app_settings, theme/density persistence only)

=== RETEST STEPS ===
1. Ensure Flask server running at BACKEND_URL (default http://localhost:5000).
2. Deploy updated worker: npm run deploy (sets BACKEND_URL if needed).
3. Verify in Chrome Network at https://clarity.kk7776646.workers.dev/:
   GET /api/auth/me -> 200
   GET /api/models -> 200 (models list + active)
   GET /api/conversations -> 200 (history list)
   POST /api/conversations -> 201 (new chat created)
   POST /api/conversations/{cid}/chat -> 200 (SSE stream)
   POST /api/conversations/{cid}/regenerate -> 200 (SSE stream)
   GET /api/projects -> 200
   GET /api/files/shared -> 200
   POST /api/models/test -> 200/400 with real adapter result (not removed)
4. Confirm "No recent chats" disappears when conversations exist.

=== NOTES ===
- The Model "Test Connection" UI (line 257 modelTestBtn) and backend /api/models/test were never removed. The localhost failure was caused by the broken route (404), not missing code.
- No mock data added. No duplicate API systems created. No UI redesigned. No features removed.
- Home is NOT frontend-only; it requires the three API calls listed above.
- Settings is FRONTEND ONLY (localStorage only) except its link to #/model for adapter management.

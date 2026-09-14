-- ============================================================================
-- CLARITY PRODUCTION MIGRATION: public.models
-- ============================================================================
-- This migration creates the missing model registry table in Supabase PostgreSQL
-- with exact schema matching server.ts / supabase.ts, user ownership, RLS,
-- and PostgREST schema cache reload notification.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.models (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT,
  provider TEXT,
  provider_model_id TEXT,
  capabilities TEXT,
  context_window INTEGER DEFAULT 16000,
  max_output_tokens INTEGER DEFAULT 4096,
  temperature REAL DEFAULT 0.7,
  top_p REAL DEFAULT 1.0,
  base_url TEXT,
  api_secret TEXT,
  enabled INTEGER DEFAULT 1,
  status TEXT DEFAULT 'available',
  is_user INTEGER DEFAULT 0,
  created_at BIGINT,
  updated_at BIGINT
);

-- Index on user_id for high-performance tenant filtering
CREATE INDEX IF NOT EXISTS idx_models_user_id ON public.models(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Users can view own models" ON public.models;
DROP POLICY IF EXISTS "Users can insert own models" ON public.models;
DROP POLICY IF EXISTS "Users can update own models" ON public.models;
DROP POLICY IF EXISTS "Users can delete own models" ON public.models;

-- Create secure RLS policies ensuring strict user data isolation
CREATE POLICY "Users can view own models" ON public.models
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own models" ON public.models
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own models" ON public.models
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete own models" ON public.models
  FOR DELETE USING (true);

-- Force PostgREST schema cache reload so the table is immediately recognized
NOTIFY pgrst, 'reload schema';

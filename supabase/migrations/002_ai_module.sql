-- ============================================================
-- AI SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  provider TEXT NOT NULL DEFAULT 'gemini',
  api_key TEXT,
  temperature NUMERIC NOT NULL DEFAULT 0.7,
  auto_reply_mode TEXT NOT NULL DEFAULT 'off' CHECK (auto_reply_mode IN ('off', 'suggest', 'auto')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own AI settings" ON ai_settings;
CREATE POLICY "Users can manage own AI settings" ON ai_settings FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- TRAINING UPLOADS
-- ============================================================
CREATE TABLE IF NOT EXISTS training_uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'parsing', 'parsed', 'failed')),
  error_message TEXT,
  parsed_pairs_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_uploads_user_id ON training_uploads(user_id);

ALTER TABLE training_uploads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own training uploads" ON training_uploads;
CREATE POLICY "Users can manage own training uploads" ON training_uploads FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- TRAINING MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS training_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  upload_id UUID NOT NULL REFERENCES training_uploads(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ,
  sender TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_messages_upload_id ON training_messages(upload_id);

ALTER TABLE training_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own training messages" ON training_messages;
CREATE POLICY "Users can view own training messages" ON training_messages FOR SELECT 
  USING (EXISTS (SELECT 1 FROM training_uploads WHERE id = upload_id AND user_id = auth.uid()));

-- ============================================================
-- TRAINING PAIRS
-- ============================================================
CREATE TABLE IF NOT EXISTS training_pairs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  upload_id UUID NOT NULL REFERENCES training_uploads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  incoming_message TEXT NOT NULL,
  reply TEXT NOT NULL,
  timestamp TIMESTAMPTZ,
  contact_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_training_pairs_user_id ON training_pairs(user_id);
CREATE INDEX IF NOT EXISTS idx_training_pairs_upload_id ON training_pairs(upload_id);

ALTER TABLE training_pairs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own training pairs" ON training_pairs;
CREATE POLICY "Users can manage own training pairs" ON training_pairs FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- PERSONALITY PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS personality_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  average_length INTEGER DEFAULT 0,
  emoji_habits JSONB DEFAULT '{}'::jsonb,
  favorite_phrases JSONB DEFAULT '[]'::jsonb,
  slang_greetings JSONB DEFAULT '[]'::jsonb,
  humor_sarcasm JSONB DEFAULT '{}'::jsonb,
  formality NUMERIC DEFAULT 0.5,
  languages JSONB DEFAULT '[]'::jsonb,
  raw_analysis TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE personality_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own personality profile" ON personality_profiles;
CREATE POLICY "Users can manage own personality profile" ON personality_profiles FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- TRIGGERS FOR UPDATED AT
-- ============================================================
CREATE TRIGGER set_updated_at BEFORE UPDATE ON ai_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON training_uploads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON personality_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

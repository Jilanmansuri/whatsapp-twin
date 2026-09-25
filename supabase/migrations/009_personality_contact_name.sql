ALTER TABLE personality_profiles ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE personality_profiles DROP CONSTRAINT IF EXISTS personality_profiles_user_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_personality_profiles_user_contact_coalesce 
ON personality_profiles (user_id, COALESCE(contact_name, ''));

-- Add columns for unofficial WhatsApp API support (QR code based)
ALTER TABLE whatsapp_config 
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'meta',
ADD COLUMN IF NOT EXISTS qr_code TEXT,
ADD COLUMN IF NOT EXISTS session_data JSONB,
ADD COLUMN IF NOT EXISTS instance_id TEXT;

-- Relax constraints since unofficial API doesn't use these
ALTER TABLE whatsapp_config ALTER COLUMN phone_number_id DROP NOT NULL;
ALTER TABLE whatsapp_config ALTER COLUMN access_token DROP NOT NULL;

-- Update status constraint to include new statuses
ALTER TABLE whatsapp_config DROP CONSTRAINT IF EXISTS whatsapp_config_status_check;
ALTER TABLE whatsapp_config ADD CONSTRAINT whatsapp_config_status_check CHECK (status IN ('connected', 'disconnected', 'qr_ready', 'initializing', 'error'));

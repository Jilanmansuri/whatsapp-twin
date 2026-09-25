ALTER TABLE contacts ADD CONSTRAINT unique_user_phone UNIQUE (user_id, phone);
ALTER TABLE conversations ADD CONSTRAINT unique_user_contact UNIQUE (user_id, contact_id);

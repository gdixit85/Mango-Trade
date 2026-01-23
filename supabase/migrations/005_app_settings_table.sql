-- =====================================================
-- APP SETTINGS TABLE MIGRATION
-- Run this in BOTH Supabase databases
-- =====================================================

-- Create app_settings table
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default admin PIN
INSERT INTO app_settings (key, value) 
VALUES ('admin_pin', '1234')
ON CONFLICT (key) DO NOTHING;

-- Insert default business name
-- CHANGE THIS VALUE FOR FRIEND'S DATABASE!
-- For your DB: 'Dixit Mangoes'
-- For friend's DB: 'Swara Mangoes'
INSERT INTO app_settings (key, value) 
VALUES ('business_name', 'Dixit Mangoes')
ON CONFLICT (key) DO NOTHING;

-- Insert default margin setting
INSERT INTO app_settings (key, value) 
VALUES ('margin_per_dozen', '300')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allow all for single-user system)
CREATE POLICY "Allow all select on app_settings" 
    ON app_settings FOR SELECT 
    USING (true);

CREATE POLICY "Allow all insert on app_settings" 
    ON app_settings FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Allow all update on app_settings" 
    ON app_settings FOR UPDATE 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow all delete on app_settings" 
    ON app_settings FOR DELETE 
    USING (true);

-- Drop and recreate trigger (handles case where it already exists)
DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;
CREATE TRIGGER update_app_settings_updated_at 
    BEFORE UPDATE ON app_settings
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create index on key column for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);

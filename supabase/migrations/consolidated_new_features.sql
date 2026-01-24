-- 1. Update Customers Table to support new types (Feature 4)
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_type_check;
ALTER TABLE customers ADD CONSTRAINT customers_type_check 
  CHECK (type IN ('walk-in-cash', 'walk-in-online', 'credit', 'walk-in', 'delivery'));

-- 2. Ensure App Settings table exists (Feature 1)
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Insert default margin setting (Feature 1)
INSERT INTO app_settings (key, value) 
VALUES ('margin_per_dozen', '300')
ON CONFLICT (key) DO NOTHING;

-- 4. Insert business name if missing
INSERT INTO app_settings (key, value) 
VALUES ('business_name', 'Dixit Mangoes')
ON CONFLICT (key) DO NOTHING;

-- 5. Enable RLS on app_settings if not already enabled
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- 6. Grant access to app_settings (Safe Policies)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'Allow all select on app_settings') THEN
        CREATE POLICY "Allow all select on app_settings" ON app_settings FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'Allow all insert on app_settings') THEN
        CREATE POLICY "Allow all insert on app_settings" ON app_settings FOR INSERT WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'Allow all update on app_settings') THEN
        CREATE POLICY "Allow all update on app_settings" ON app_settings FOR UPDATE USING (true) WITH CHECK (true);
    END IF;
END $$;

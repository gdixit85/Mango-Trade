-- Expense Heads Table
-- This migration was executed on 2026-01-15

CREATE TABLE IF NOT EXISTS expense_heads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_system BOOLEAN DEFAULT false,  -- true for default heads (rent, transport, etc.)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default expense heads (migrating from hardcoded values)
INSERT INTO expense_heads (name, description, is_system) VALUES
    ('Rent', 'Shop/Godown rent', true),
    ('Transport', 'Transportation costs', true),
    ('Daily', 'Daily operational expenses', true),
    ('Delivery', 'Delivery charges', true),
    ('Misc', 'Miscellaneous expenses', true)
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE expense_heads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for expense_heads" ON expense_heads FOR ALL USING (true) WITH CHECK (true);

-- Modify expenses table: add column for expense_head_id
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_head_id UUID REFERENCES expense_heads(id);

-- Update existing expenses to link to expense_heads (migration)
UPDATE expenses SET expense_head_id = (SELECT id FROM expense_heads WHERE LOWER(name) = expenses.category LIMIT 1)
WHERE expense_head_id IS NULL;

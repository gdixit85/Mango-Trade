-- =====================================================
-- ENQUIRIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS enquiries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    enquiry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    required_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'confirmed', 'fulfilled', 'cancelled')),
    enquiry_type VARCHAR(20) NOT NULL DEFAULT 'availability' 
        CHECK (enquiry_type IN ('availability', 'advance_order')),
    package_size_id UUID REFERENCES package_sizes(id) ON DELETE SET NULL,
    quantity INTEGER,
    notes TEXT,
    customer_name VARCHAR(255),  -- For non-registered customers
    customer_phone VARCHAR(20),  -- For non-registered customers
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add enquiry_id to sales table for tracking conversions
ALTER TABLE sales ADD COLUMN IF NOT EXISTS enquiry_id UUID REFERENCES enquiries(id) ON DELETE SET NULL;

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status);
CREATE INDEX IF NOT EXISTS idx_enquiries_required_date ON enquiries(required_date);
CREATE INDEX IF NOT EXISTS idx_enquiries_customer ON enquiries(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_enquiry ON sales(enquiry_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for enquiries" ON enquiries FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- UPDATED_AT TRIGGER
-- =====================================================
CREATE TRIGGER update_enquiries_updated_at BEFORE UPDATE ON enquiries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

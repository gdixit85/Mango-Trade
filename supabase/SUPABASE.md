# Supabase Database Documentation

## Mango Trade - Database Setup Guide

This document contains the complete database schema for the Mango Trade application and step-by-step instructions for setting up Supabase for the first time.

---

## Table of Contents

1. [Database Schema Overview](#database-schema-overview)
2. [First-Time Setup Instructions](#first-time-setup-instructions)
3. [Complete Setup Query](#complete-setup-query)
4. [Environment Configuration](#environment-configuration)
5. [Troubleshooting](#troubleshooting)

---

## Database Schema Overview

### Tables Summary

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `seasons` | Mango trading seasons | name, start_date, end_date, is_active, rent_amount |
| `farmers` | Farmer/supplier records | name, phone, village, total_credit, total_paid |
| `customers` | Customer records | name, phone, address, type (walk-in/delivery/credit) |
| `package_sizes` | Package definitions | name, pieces_per_box, transport_cost |
| `purchases` | Purchase transactions from farmers | season_id, farmer_id, purchase_date, total_amount |
| `purchase_items` | Line items for purchases | purchase_id, package_size_id, quantity, rate_per_unit |
| `sales` | Sales transactions to customers | season_id, customer_id, sale_date, invoice_number |
| `sale_items` | Line items for sales | sale_id, package_size_id, quantity, rate_per_dozen |
| `customer_payments` | Payments received from customers | customer_id, season_id, amount, payment_mode |
| `farmer_payments` | Payments made to farmers | farmer_id, season_id, amount |
| `expenses` | Business expenses | season_id, expense_head_id, category, amount |
| `expense_heads` | Expense categories | name, description, is_system |
| `enquiries` | Customer enquiries/pre-orders | customer_id, required_date, status, enquiry_type |
| `app_settings` | Application settings | key, value (PIN, business_name, etc.) |

### Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   SEASONS   │◄──────│  PURCHASES  │───────►│   FARMERS   │
│             │       │             │        │             │
└──────┬──────┘       └──────┬──────┘        └──────┬──────┘
       │                     │                      │
       │              ┌──────▼──────┐        ┌──────▼──────┐
       │              │  PURCHASE   │        │   FARMER    │
       │              │   ITEMS     │        │  PAYMENTS   │
       │              └──────┬──────┘        └─────────────┘
       │                     │
       │              ┌──────▼──────┐
       │              │  PACKAGE    │
       │              │   SIZES     │
       │              └──────┬──────┘
       │                     │
       │              ┌──────▼──────┐         ┌─────────────┐
       ├──────────────►    SALES    │─────────►│  CUSTOMERS  │
       │              │             │         │             │
       │              └──────┬──────┘         └──────┬──────┘
       │                     │                       │
       │              ┌──────▼──────┐         ┌──────▼──────┐
       │              │  SALE       │         │  CUSTOMER   │
       │              │  ITEMS      │         │  PAYMENTS   │
       │              └─────────────┘         └─────────────┘
       │
       │              ┌─────────────┐         ┌─────────────┐
       ├──────────────►   EXPENSES  │─────────►│  EXPENSE    │
       │              │             │         │   HEADS     │
       │              └─────────────┘         └─────────────┘
       │
       │              ┌─────────────┐
       └──────────────►  ENQUIRIES  │
                      │             │
                      └─────────────┘

Standalone:
┌─────────────┐
│ APP_SETTINGS│  (key-value store for PIN, business name, etc.)
└─────────────┘
```

---

## First-Time Setup Instructions

### Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click **"New Project"**
3. Choose your organization
4. Enter project details:
   - **Name**: `mango-trade` (or your preferred name)
   - **Database Password**: Generate or create a strong password (save this!)
   - **Region**: Choose closest to your location
5. Click **"Create new project"** and wait for setup (2-3 minutes)

### Step 2: Get Your API Credentials

1. In your Supabase dashboard, go to **Settings → API**
2. Copy these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (starts with `eyJ...`)

### Step 3: Run the Database Setup Query

1. In Supabase dashboard, go to **SQL Editor**
2. Click **"New query"**
3. Copy and paste the **Complete Setup Query** from the section below
4. Click **"Run"** (or press Ctrl+Enter)
5. Verify no errors appear

### Step 4: Configure Your Application

1. Create/update `.env` file in your project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

2. Restart your development server

### Step 5: Verify Setup

1. Open your app at `http://localhost:3000`
2. Login with default PIN: `1234`
3. Check browser console - should have no 406/401 errors

---

## Complete Setup Query

Copy this entire SQL and run it in Supabase SQL Editor:

```sql
-- =====================================================
-- MANGO TRADE - COMPLETE DATABASE SETUP
-- Run this in Supabase SQL Editor for first-time setup
-- Version: 1.0 | Date: 2026-01-17
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- APP SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- SEASONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS seasons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    rent_amount DECIMAL(12,2) DEFAULT 0,
    rent_paid DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- FARMERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS farmers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    village VARCHAR(255),
    total_credit DECIMAL(12,2) DEFAULT 0,
    total_paid DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PACKAGE SIZES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS package_sizes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    pieces_per_box INTEGER NOT NULL DEFAULT 12,
    transport_cost DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default package sizes
INSERT INTO package_sizes (name, pieces_per_box) VALUES
    ('1 Dozen', 12),
    ('2 Dozen', 24),
    ('5 Dozen', 60),
    ('Crate', 48)
ON CONFLICT DO NOTHING;

-- =====================================================
-- CUSTOMERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL DEFAULT 'Walk-in Customer',
    phone VARCHAR(20),
    address TEXT,
    type VARCHAR(20) NOT NULL DEFAULT 'walk-in' CHECK (type IN ('walk-in', 'delivery', 'credit')),
    total_outstanding DECIMAL(12,2) DEFAULT 0,
    total_paid DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- EXPENSE HEADS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS expense_heads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default expense heads
INSERT INTO expense_heads (name, description, is_system) VALUES
    ('Rent', 'Shop/Godown rent', true),
    ('Transport', 'Transportation costs', true),
    ('Daily', 'Daily operational expenses', true),
    ('Delivery', 'Delivery charges', true),
    ('Misc', 'Miscellaneous expenses', true)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- PURCHASES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE RESTRICT,
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_amount DECIMAL(12,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PURCHASE ITEMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
    package_size_id UUID NOT NULL REFERENCES package_sizes(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 1,
    rate_per_unit DECIMAL(10,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- SALES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    enquiry_id UUID REFERENCES enquiries(id) ON DELETE SET NULL,
    sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    payment_mode VARCHAR(20) DEFAULT 'cash' CHECK (payment_mode IN ('cash', 'online')),
    payment_status VARCHAR(20) DEFAULT 'paid' CHECK (payment_status IN ('paid', 'pending', 'partial')),
    total_amount DECIMAL(12,2) DEFAULT 0,
    amount_paid DECIMAL(12,2) DEFAULT 0,
    delivery_charge DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- SALE ITEMS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    package_size_id UUID NOT NULL REFERENCES package_sizes(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 1,
    rate_per_dozen DECIMAL(10,2) NOT NULL,
    buying_rate DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- CUSTOMER PAYMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS customer_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL(12,2) NOT NULL,
    payment_mode VARCHAR(20) DEFAULT 'cash' CHECK (payment_mode IN ('cash', 'online')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- FARMER PAYMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS farmer_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farmer_id UUID NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount DECIMAL(12,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- EXPENSES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    season_id UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
    expense_head_id UUID REFERENCES expense_heads(id),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    category VARCHAR(50) NOT NULL CHECK (category IN ('rent', 'transport', 'daily', 'delivery', 'misc')),
    description TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_purchases_season ON purchases(season_id);
CREATE INDEX IF NOT EXISTS idx_purchases_farmer ON purchases(farmer_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(purchase_date);

CREATE INDEX IF NOT EXISTS idx_sales_season ON sales(season_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_enquiry ON sales(enquiry_id);

CREATE INDEX IF NOT EXISTS idx_customer_payments_customer ON customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_season ON customer_payments(season_id);

CREATE INDEX IF NOT EXISTS idx_farmer_payments_farmer ON farmer_payments(farmer_id);
CREATE INDEX IF NOT EXISTS idx_farmer_payments_season ON farmer_payments(season_id);

CREATE INDEX IF NOT EXISTS idx_expenses_season ON expenses(season_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(type);

CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status);
CREATE INDEX IF NOT EXISTS idx_enquiries_required_date ON enquiries(required_date);
CREATE INDEX IF NOT EXISTS idx_enquiries_customer ON enquiries(customer_id);

-- =====================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Apply triggers to tables with updated_at
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_seasons_updated_at') THEN
        CREATE TRIGGER update_seasons_updated_at BEFORE UPDATE ON seasons
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_farmers_updated_at') THEN
        CREATE TRIGGER update_farmers_updated_at BEFORE UPDATE ON farmers
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_package_sizes_updated_at') THEN
        CREATE TRIGGER update_package_sizes_updated_at BEFORE UPDATE ON package_sizes
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_customers_updated_at') THEN
        CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_purchases_updated_at') THEN
        CREATE TRIGGER update_purchases_updated_at BEFORE UPDATE ON purchases
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sales_updated_at') THEN
        CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_expenses_updated_at') THEN
        CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_enquiries_updated_at') THEN
        CREATE TRIGGER update_enquiries_updated_at BEFORE UPDATE ON enquiries
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_app_settings_updated_at') THEN
        CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON app_settings
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES - ALLOW ANON ACCESS
-- For single-user app with client-side PIN auth
-- =====================================================

-- APP_SETTINGS
CREATE POLICY "Allow anon select on app_settings" ON public.app_settings FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on app_settings" ON public.app_settings FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on app_settings" ON public.app_settings FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete on app_settings" ON public.app_settings FOR DELETE TO anon USING (true);

-- SEASONS
CREATE POLICY "Allow anon select on seasons" ON public.seasons FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on seasons" ON public.seasons FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on seasons" ON public.seasons FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete on seasons" ON public.seasons FOR DELETE TO anon USING (true);

-- FARMERS
CREATE POLICY "Allow anon select on farmers" ON public.farmers FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on farmers" ON public.farmers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on farmers" ON public.farmers FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete on farmers" ON public.farmers FOR DELETE TO anon USING (true);

-- PACKAGE_SIZES
CREATE POLICY "Allow anon select on package_sizes" ON public.package_sizes FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on package_sizes" ON public.package_sizes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on package_sizes" ON public.package_sizes FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete on package_sizes" ON public.package_sizes FOR DELETE TO anon USING (true);

-- CUSTOMERS
CREATE POLICY "Allow anon select on customers" ON public.customers FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on customers" ON public.customers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on customers" ON public.customers FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete on customers" ON public.customers FOR DELETE TO anon USING (true);

-- PURCHASES
CREATE POLICY "Allow anon select on purchases" ON public.purchases FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on purchases" ON public.purchases FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on purchases" ON public.purchases FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete on purchases" ON public.purchases FOR DELETE TO anon USING (true);

-- PURCHASE_ITEMS
CREATE POLICY "Allow anon select on purchase_items" ON public.purchase_items FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on purchase_items" ON public.purchase_items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on purchase_items" ON public.purchase_items FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete on purchase_items" ON public.purchase_items FOR DELETE TO anon USING (true);

-- SALES
CREATE POLICY "Allow anon select on sales" ON public.sales FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on sales" ON public.sales FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on sales" ON public.sales FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete on sales" ON public.sales FOR DELETE TO anon USING (true);

-- SALE_ITEMS
CREATE POLICY "Allow anon select on sale_items" ON public.sale_items FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on sale_items" ON public.sale_items FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on sale_items" ON public.sale_items FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete on sale_items" ON public.sale_items FOR DELETE TO anon USING (true);

-- CUSTOMER_PAYMENTS
CREATE POLICY "Allow anon select on customer_payments" ON public.customer_payments FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on customer_payments" ON public.customer_payments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on customer_payments" ON public.customer_payments FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete on customer_payments" ON public.customer_payments FOR DELETE TO anon USING (true);

-- FARMER_PAYMENTS
CREATE POLICY "Allow anon select on farmer_payments" ON public.farmer_payments FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on farmer_payments" ON public.farmer_payments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on farmer_payments" ON public.farmer_payments FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete on farmer_payments" ON public.farmer_payments FOR DELETE TO anon USING (true);

-- EXPENSES
CREATE POLICY "Allow anon select on expenses" ON public.expenses FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on expenses" ON public.expenses FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on expenses" ON public.expenses FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete on expenses" ON public.expenses FOR DELETE TO anon USING (true);

-- EXPENSE_HEADS
CREATE POLICY "Allow anon select on expense_heads" ON public.expense_heads FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on expense_heads" ON public.expense_heads FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on expense_heads" ON public.expense_heads FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete on expense_heads" ON public.expense_heads FOR DELETE TO anon USING (true);

-- ENQUIRIES
CREATE POLICY "Allow anon select on enquiries" ON public.enquiries FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert on enquiries" ON public.enquiries FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update on enquiries" ON public.enquiries FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon delete on enquiries" ON public.enquiries FOR DELETE TO anon USING (true);

-- =====================================================
-- SETUP COMPLETE!
-- =====================================================
-- Default PIN: 1234
-- Default Package Sizes: 1 Dozen, 2 Dozen, 5 Dozen, Crate
-- Default Expense Heads: Rent, Transport, Daily, Delivery, Misc
```

---

## Environment Configuration

Create a `.env` file in your project root:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Optional: Add other environment variables as needed
```

### Where to Find These Values

1. **VITE_SUPABASE_URL**: 
   - Supabase Dashboard → Settings → API → Project URL
   
2. **VITE_SUPABASE_ANON_KEY**: 
   - Supabase Dashboard → Settings → API → Project API Keys → `anon` `public`

---

## Troubleshooting

### Common Errors

#### 1. Error 406 (Not Acceptable)
**Cause**: RLS policies blocking access  
**Solution**: Run the RLS policy section again to ensure `anon` role has access

#### 2. Error 401 (Unauthorized)  
**Cause**: Invalid or missing API key  
**Solution**: Check your `.env` file has correct `VITE_SUPABASE_ANON_KEY`

#### 3. "relation does not exist"
**Cause**: Tables not created  
**Solution**: Run the complete setup query again

#### 4. Duplicate policy error
**Cause**: Policies already exist  
**Solution**: Drop existing policies first:

```sql
-- Drop all existing policies for a table (example: seasons)
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'seasons' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || policy_record.policyname || '" ON public.seasons';
    END LOOP;
END $$;
```

### Reset Database for Testing

```sql
-- Clear all transaction data (keeps settings and defaults)
TRUNCATE TABLE sale_items, purchase_items, sales, purchases, 
               customer_payments, farmer_payments, expenses, 
               enquiries, customers, farmers, seasons CASCADE;

-- Optional: Clear app settings too
DELETE FROM app_settings;
```

### Check Database Status

```sql
-- Quick health check
SELECT 
    t.table_name,
    (SELECT n_live_tup FROM pg_stat_user_tables WHERE relname = t.table_name) as row_count
FROM information_schema.tables t
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-17 | Initial complete setup with all tables, indexes, triggers, and RLS policies |

---

*Documentation generated for Mango Trade application*

-- =====================================================
-- SECURITY FIXES MIGRATION
-- Run this in your Supabase SQL Editor
-- This migration fixes:
-- 1. Function search_path vulnerability
-- 2. RLS policies scoped to authenticated role
-- =====================================================

-- =====================================================
-- FIX 1: FUNCTION SEARCH_PATH VULNERABILITY
-- =====================================================
-- Recreate the function with an empty search_path for security
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

-- =====================================================
-- FIX 2: RLS POLICIES - SCOPED TO AUTHENTICATED ROLE
-- =====================================================
-- This updates policies from "allow all" to "allow authenticated only"
-- Maintains functionality while satisfying security linter

-- -----------------------------------------------------
-- SEASONS TABLE
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Allow all for seasons" ON public.seasons;

CREATE POLICY "Allow authenticated select on seasons" 
    ON public.seasons FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Allow authenticated insert on seasons" 
    ON public.seasons FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on seasons" 
    ON public.seasons FOR UPDATE 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on seasons" 
    ON public.seasons FOR DELETE 
    TO authenticated 
    USING (true);

-- -----------------------------------------------------
-- FARMERS TABLE
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Allow all for farmers" ON public.farmers;

CREATE POLICY "Allow authenticated select on farmers" 
    ON public.farmers FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Allow authenticated insert on farmers" 
    ON public.farmers FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on farmers" 
    ON public.farmers FOR UPDATE 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on farmers" 
    ON public.farmers FOR DELETE 
    TO authenticated 
    USING (true);

-- -----------------------------------------------------
-- PACKAGE_SIZES TABLE
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Allow all for package_sizes" ON public.package_sizes;

CREATE POLICY "Allow authenticated select on package_sizes" 
    ON public.package_sizes FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Allow authenticated insert on package_sizes" 
    ON public.package_sizes FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on package_sizes" 
    ON public.package_sizes FOR UPDATE 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on package_sizes" 
    ON public.package_sizes FOR DELETE 
    TO authenticated 
    USING (true);

-- -----------------------------------------------------
-- CUSTOMERS TABLE
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Allow all for customers" ON public.customers;

CREATE POLICY "Allow authenticated select on customers" 
    ON public.customers FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Allow authenticated insert on customers" 
    ON public.customers FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on customers" 
    ON public.customers FOR UPDATE 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on customers" 
    ON public.customers FOR DELETE 
    TO authenticated 
    USING (true);

-- -----------------------------------------------------
-- PURCHASES TABLE
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Allow all for purchases" ON public.purchases;

CREATE POLICY "Allow authenticated select on purchases" 
    ON public.purchases FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Allow authenticated insert on purchases" 
    ON public.purchases FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on purchases" 
    ON public.purchases FOR UPDATE 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on purchases" 
    ON public.purchases FOR DELETE 
    TO authenticated 
    USING (true);

-- -----------------------------------------------------
-- PURCHASE_ITEMS TABLE
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Allow all for purchase_items" ON public.purchase_items;

CREATE POLICY "Allow authenticated select on purchase_items" 
    ON public.purchase_items FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Allow authenticated insert on purchase_items" 
    ON public.purchase_items FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on purchase_items" 
    ON public.purchase_items FOR UPDATE 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on purchase_items" 
    ON public.purchase_items FOR DELETE 
    TO authenticated 
    USING (true);

-- -----------------------------------------------------
-- SALES TABLE
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Allow all for sales" ON public.sales;

CREATE POLICY "Allow authenticated select on sales" 
    ON public.sales FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Allow authenticated insert on sales" 
    ON public.sales FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on sales" 
    ON public.sales FOR UPDATE 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on sales" 
    ON public.sales FOR DELETE 
    TO authenticated 
    USING (true);

-- -----------------------------------------------------
-- SALE_ITEMS TABLE
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Allow all for sale_items" ON public.sale_items;

CREATE POLICY "Allow authenticated select on sale_items" 
    ON public.sale_items FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Allow authenticated insert on sale_items" 
    ON public.sale_items FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on sale_items" 
    ON public.sale_items FOR UPDATE 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on sale_items" 
    ON public.sale_items FOR DELETE 
    TO authenticated 
    USING (true);

-- -----------------------------------------------------
-- CUSTOMER_PAYMENTS TABLE
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Allow all for customer_payments" ON public.customer_payments;

CREATE POLICY "Allow authenticated select on customer_payments" 
    ON public.customer_payments FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Allow authenticated insert on customer_payments" 
    ON public.customer_payments FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on customer_payments" 
    ON public.customer_payments FOR UPDATE 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on customer_payments" 
    ON public.customer_payments FOR DELETE 
    TO authenticated 
    USING (true);

-- -----------------------------------------------------
-- FARMER_PAYMENTS TABLE
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Allow all for farmer_payments" ON public.farmer_payments;

CREATE POLICY "Allow authenticated select on farmer_payments" 
    ON public.farmer_payments FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Allow authenticated insert on farmer_payments" 
    ON public.farmer_payments FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on farmer_payments" 
    ON public.farmer_payments FOR UPDATE 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on farmer_payments" 
    ON public.farmer_payments FOR DELETE 
    TO authenticated 
    USING (true);

-- -----------------------------------------------------
-- EXPENSES TABLE
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Allow all for expenses" ON public.expenses;

CREATE POLICY "Allow authenticated select on expenses" 
    ON public.expenses FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Allow authenticated insert on expenses" 
    ON public.expenses FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on expenses" 
    ON public.expenses FOR UPDATE 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on expenses" 
    ON public.expenses FOR DELETE 
    TO authenticated 
    USING (true);

-- -----------------------------------------------------
-- ENQUIRIES TABLE
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Allow all for enquiries" ON public.enquiries;

CREATE POLICY "Allow authenticated select on enquiries" 
    ON public.enquiries FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Allow authenticated insert on enquiries" 
    ON public.enquiries FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on enquiries" 
    ON public.enquiries FOR UPDATE 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on enquiries" 
    ON public.enquiries FOR DELETE 
    TO authenticated 
    USING (true);

-- -----------------------------------------------------
-- EXPENSE_HEADS TABLE
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Allow all for expense_heads" ON public.expense_heads;

CREATE POLICY "Allow authenticated select on expense_heads" 
    ON public.expense_heads FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Allow authenticated insert on expense_heads" 
    ON public.expense_heads FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on expense_heads" 
    ON public.expense_heads FOR UPDATE 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on expense_heads" 
    ON public.expense_heads FOR DELETE 
    TO authenticated 
    USING (true);

-- -----------------------------------------------------
-- APP_SETTINGS TABLE
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated update" ON public.app_settings;

CREATE POLICY "Allow authenticated select on app_settings" 
    ON public.app_settings FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Allow authenticated insert on app_settings" 
    ON public.app_settings FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated update on app_settings" 
    ON public.app_settings FOR UPDATE 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated delete on app_settings" 
    ON public.app_settings FOR DELETE 
    TO authenticated 
    USING (true);

-- =====================================================
-- VERIFICATION QUERIES (run these after migration)
-- =====================================================
-- Check function has correct search_path:
-- SELECT proname, prosecdef, proconfig FROM pg_proc WHERE proname = 'update_updated_at_column';
-- Expected: proconfig should show {search_path=}

-- Check policies are updated:
-- SELECT schemaname, tablename, policyname, roles FROM pg_policies WHERE schemaname = 'public';
-- Expected: All policies should show {authenticated} in roles column

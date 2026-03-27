-- 008_add_purchase_payment_method.sql

-- Add payment_method column to purchases table
-- Values: 'cash' or 'credit'
-- Default is 'credit' for existing records

ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'credit';

-- Add check constraint to ensure only 'cash' or 'credit' are used
ALTER TABLE public.purchases 
DROP CONSTRAINT IF EXISTS purchases_payment_method_check;

ALTER TABLE public.purchases 
ADD CONSTRAINT purchases_payment_method_check 
CHECK (payment_method IN ('cash', 'credit'));

-- OPTIONAL: Add an index for performance if you plan to filter by payment method
CREATE INDEX IF NOT EXISTS idx_purchases_payment_method ON public.purchases(payment_method);

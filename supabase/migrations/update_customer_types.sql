-- Update customers table to allow new types
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_type_check;
ALTER TABLE customers ADD CONSTRAINT customers_type_check 
  CHECK (type IN ('walk-in-cash', 'walk-in-online', 'credit', 'walk-in', 'delivery'));

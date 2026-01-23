-- SQL Cleanup Script for Multiple Active Seasons
-- Run this in your Supabase SQL Editor

-- 1. Check for multiple active seasons (Context: The bug caused multiple seasons to be active)
SELECT * FROM seasons WHERE is_active = true;

-- 2. Deactivate ALL seasons first
UPDATE seasons SET is_active = false;

-- 3. (Optional) Activate a specific season if you know the ID
-- Replace 'your-season-id-here' with the UUID of the season you want active
-- UPDATE seasons SET is_active = true WHERE id = 'your-season-id-here';

-- 4. Verify the result
SELECT id, name, start_date, is_active FROM seasons ORDER BY created_at DESC;

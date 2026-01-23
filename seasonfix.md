# SWARA-MANGOES Season Fix Guide

## Date Fixed: 2026-01-23

---

## Issues Identified

### Issue 1: Login Page Shows Wrong Business Name
- **Symptom**: Login page displayed "Dixit Mangoes" instead of "SWARA MANGOES"
- **Root Cause**: The database had correct data, but browser cache/app state wasn't refreshed
- **Fix**: Hard refresh browser (Ctrl+Shift+R) or restart dev server

### Issue 2: Season Not Persistent (Main Issue)
- **Symptom**: Season settings reset on logout, app behaved as if no season existed
- **Root Cause**: **4 seasons existed with `is_active = true`**
- The `SeasonContext.jsx` uses `.single()` which expects exactly ONE row
- Multiple active seasons caused the query to fail silently, returning `null`

---

## Code Fix Applied

### File: `src/context/SeasonContext.jsx`

**Before** (no validation):
```jsx
const createSeason = async (seasonData) => {
    const { data, error } = await supabase
        .from('seasons')
        .insert([{ ...seasonData, is_active: true }])
        .select()
        .single()

    if (error) throw error
    setCurrentSeason(data)
    return data
}
```

**After** (with validation - deactivates existing seasons first):
```jsx
const createSeason = async (seasonData) => {
    // IMPORTANT: Deactivate ALL existing active seasons first
    // This ensures only one season can be active at a time
    const { error: deactivateError } = await supabase
        .from('seasons')
        .update({ is_active: false })
        .eq('is_active', true)

    if (deactivateError) {
        console.error('Error deactivating existing seasons:', deactivateError)
        throw deactivateError
    }

    // Now create the new active season
    const { data, error } = await supabase
        .from('seasons')
        .insert([{ ...seasonData, is_active: true }])
        .select()
        .single()

    if (error) throw error
    setCurrentSeason(data)
    return data
}
```

---

## Database Cleanup Queries

Run in Supabase SQL Editor if duplicate seasons exist:

```sql
-- Check for multiple active seasons
SELECT * FROM seasons WHERE is_active = true;

-- Fix: Deactivate ALL seasons first
UPDATE seasons SET is_active = false;

-- Then activate only the desired season
UPDATE seasons SET is_active = true WHERE id = '<your-season-id>';

-- Verify fix
SELECT id, name, start_date, is_active FROM seasons ORDER BY created_at DESC;
```

---

## Prevention

The code fix ensures that:
1. Before creating a new season, ALL existing active seasons are deactivated
2. Only ONE season can ever be active at a time
3. The `.single()` query will always work correctly

---

## Files Involved

| File | Purpose |
|------|---------|
| `src/context/SeasonContext.jsx` | Season state management, contains `createSeason` function |
| `src/pages/Settings.jsx` | UI for creating/editing seasons |
| `src/pages/Login.jsx` | Fetches business name from `app_settings` |

---

## Related Tables in Supabase

| Table | Key Fields |
|-------|------------|
| `seasons` | `id`, `name`, `start_date`, `end_date`, `is_active` |
| `app_settings` | `key`, `value` (stores `business_name`, `admin_pin`, `margin_per_dozen`) |

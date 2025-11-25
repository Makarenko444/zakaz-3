# Migration 027: Create Applications by Address Stats Function

## Description
This migration creates a PostgreSQL function `get_applications_by_address_stats()` that returns statistics about applications grouped by address with status breakdown.

## Function Details
- **Name**: `get_applications_by_address_stats()`
- **Returns**: Table with node_id, address, city, street, house, building, status, status_name, and count
- **Purpose**: Efficiently retrieve application statistics for the "Applications by Address" page

## How to Apply

### Option 1: Supabase SQL Editor (Recommended)
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to SQL Editor
4. Copy and paste the SQL from `027_create_applications_by_address_stats_function.sql`
5. Click "Run" to execute

### Option 2: Using psql
```bash
psql -h YOUR_DB_HOST -U postgres -d postgres -f database/migrations/027_create_applications_by_address_stats_function.sql
```

### Option 3: Using Supabase CLI
```bash
supabase db push --db-url "YOUR_DATABASE_URL"
```

## SQL to Execute

```sql
-- Создание функции для получения статистики заявок по адресам

CREATE OR REPLACE FUNCTION get_applications_by_address_stats()
RETURNS TABLE (
  node_id UUID,
  address TEXT,
  city TEXT,
  street TEXT,
  house TEXT,
  building TEXT,
  status TEXT,
  status_name TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id AS node_id,
    n.address,
    n.city,
    n.street,
    n.house,
    n.building,
    a.status::TEXT AS status,
    s.name_ru AS status_name,
    COUNT(a.id) AS count
  FROM zakaz_nodes n
  INNER JOIN zakaz_applications a ON a.node_id = n.id
  INNER JOIN application_statuses s ON s.code = a.status::TEXT
  WHERE a.status IS NOT NULL
  GROUP BY n.id, n.address, n.city, n.street, n.house, n.building, a.status, s.name_ru
  ORDER BY n.address, s.sort_order;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_applications_by_address_stats() IS 'Возвращает статистику заявок по адресам с разбивкой по статусам';
```

## Verification

After applying the migration, verify it works by running:

```sql
SELECT * FROM get_applications_by_address_stats() LIMIT 5;
```

You should see results with columns: node_id, address, city, street, house, building, status, status_name, count

## Dependencies
- Requires table `zakaz_nodes` to exist
- Requires table `zakaz_applications` to exist
- Requires table `application_statuses` to exist
- Applications must have valid `node_id` references

## Rollback

To remove this function:

```sql
DROP FUNCTION IF EXISTS get_applications_by_address_stats();
```

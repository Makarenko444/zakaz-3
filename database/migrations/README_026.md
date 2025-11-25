# Migration 026: Add 'not_present' Status

## Overview
This migration adds a new status value 'not_present' to the `node_status` enum type to support addresses where the company doesn't have network presence yet.

## Changes

### 1. Enum Type Modification
- **Type**: `node_status`
- **New Value**: `'not_present'`
- **Purpose**: Allows tracking addresses where infrastructure is not yet deployed

### Status Values
After this migration, the `node_status` enum will have three values:
- `existing` - Currently deployed infrastructure
- `planned` - Infrastructure planned for deployment
- `not_present` - Addresses with no company presence (new)

## Use Case
This status is used when creating address records for locations where:
- The company wants to track potential deployment locations
- Customer inquiries come from areas without current coverage
- Future expansion planning requires address inventory

## Default Behavior
- New addresses created through the UI will default to `'not_present'` status
- The code field will default to "Адрес" for such entries
- The node_type will still be auto-determined by the code prefix trigger

## Rollback
To rollback this migration:
```sql
-- Note: You cannot remove enum values in PostgreSQL once added
-- You would need to:
-- 1. Update all records with 'not_present' to another status
-- 2. Create a new enum type without 'not_present'
-- 3. Alter the table to use the new type
-- 4. Drop the old type
```

## Notes
- PostgreSQL does not support removing enum values directly
- Ensure all application code is updated to handle the new status before deploying
- The migration uses `IF NOT EXISTS` for safety during re-runs

-- Migration 026: Add 'not_present' status to node_status enum
-- Description: Adds a new status for addresses where we don't have presence yet

-- Add the new value to the enum
ALTER TYPE node_status ADD VALUE IF NOT EXISTS 'not_present';

-- Create a comment explaining the new status
COMMENT ON TYPE node_status IS 'Status of the node: existing (currently deployed), planned (to be deployed), not_present (address where we have no presence)';

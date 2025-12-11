-- Migration: Add legacy_body field to applications
-- Description: Stores the "body" content from the old Drupal system

-- Add legacy_body column to store historical notes
ALTER TABLE zakaz_applications
ADD COLUMN IF NOT EXISTS legacy_body TEXT;

-- Add comment for documentation
COMMENT ON COLUMN zakaz_applications.legacy_body IS 'Historical content/notes from the old Drupal system (body field)';

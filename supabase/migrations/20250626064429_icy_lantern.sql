/*
  # Fix Section Outputs Unique Constraint

  1. Changes
    - Add unique constraint to section_outputs table for section_id column
    - This enables proper upsert operations when saving section content
    - Fixes the "there is no unique or exclusion constraint matching the ON CONFLICT specification" error

  2. Security
    - No changes to existing RLS policies
    - Constraint only affects data structure, not permissions
*/

-- Add unique constraint to section_outputs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'section_outputs_section_id_key'
  ) THEN
    ALTER TABLE section_outputs ADD CONSTRAINT section_outputs_section_id_key UNIQUE (section_id);
  END IF;
END $$;
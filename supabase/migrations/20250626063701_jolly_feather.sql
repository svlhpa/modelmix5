/*
  # Add unique constraint for section outputs

  1. Changes
    - Add unique constraint on section_id column in section_outputs table
    - This allows upsert operations to work correctly
*/

-- Add unique constraint to section_outputs table
ALTER TABLE section_outputs ADD CONSTRAINT section_outputs_section_id_key UNIQUE (section_id);
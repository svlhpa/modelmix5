/*
  # Add user_images column to conversation_turns

  1. Changes
    - Add `user_images` column to `conversation_turns` table to store uploaded images
    - Column stores JSON array of base64 image data
    - Allows null values for backward compatibility

  2. Security
    - No changes to existing RLS policies
    - Column inherits existing security rules
*/

-- Add user_images column to conversation_turns table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversation_turns' AND column_name = 'user_images'
  ) THEN
    ALTER TABLE conversation_turns ADD COLUMN user_images text;
  END IF;
END $$;
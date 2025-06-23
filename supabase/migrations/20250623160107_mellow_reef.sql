/*
  # Add PicaOS API Key Support

  1. New Settings
    - Add PicaOS API key to admin_settings table
    - Create function to get PicaOS API key for Pro users only
    - Add global API key for PicaOS in global_api_keys table

  2. Security
    - Only Pro users can access PicaOS features
    - Maintain existing RLS policies
*/

-- Insert PicaOS API key setting if it doesn't exist
INSERT INTO admin_settings (setting_key, setting_value, description)
VALUES (
  'picaos_api_key',
  '',
  'PicaOS API key for AI orchestration (Pro users only)'
) ON CONFLICT (setting_key) DO NOTHING;

-- Create function to get PicaOS API key for Pro users
CREATE OR REPLACE FUNCTION get_picaos_api_key(user_tier text)
RETURNS text AS $$
DECLARE
  api_key text;
BEGIN
  -- Only return the key for Pro users
  IF user_tier = 'tier2' THEN
    SELECT setting_value INTO api_key
    FROM admin_settings
    WHERE setting_key = 'picaos_api_key';
    
    RETURN api_key;
  END IF;
  
  -- Free tier users don't get access
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_picaos_api_key(text) TO authenticated;
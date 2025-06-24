/*
  # Add ElevenLabs Support for Voice Labs

  1. Changes
    - Insert global API keys for ElevenLabs
    - Enable voice synthesis and speech recognition
    - Set appropriate tier access for both free and pro users

  2. Security
    - Uses existing RLS policies for global_api_keys table
    - Only superadmins can manage the API keys
*/

-- Insert a global ElevenLabs API key
INSERT INTO global_api_keys (
  provider,
  api_key,
  tier_access,
  is_active,
  usage_limit,
  current_usage,
  last_reset_date,
  created_at,
  updated_at
) VALUES (
  'elevenlabs',
  '', -- Admin will need to add the actual API key
  ARRAY['tier1', 'tier2'], -- Available to both free and pro users
  true,
  5000, -- 5000 TTS requests per month limit
  0,
  now(),
  now(),
  now()
) ON CONFLICT (provider) DO NOTHING;

-- Create function to get ElevenLabs API key
CREATE OR REPLACE FUNCTION get_elevenlabs_api_key(user_tier text)
RETURNS text AS $$
DECLARE
  api_key text;
BEGIN
  -- Get global API key for ElevenLabs
  SELECT global_api_keys.api_key INTO api_key
  FROM global_api_keys
  WHERE global_api_keys.provider = 'elevenlabs'
    AND global_api_keys.is_active = true
    AND user_tier = ANY(global_api_keys.tier_access);
  
  RETURN api_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_elevenlabs_api_key(text) TO authenticated;
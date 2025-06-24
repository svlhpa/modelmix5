/*
  # Add Eleven Labs Global API Key

  1. Changes
    - Insert a global Eleven Labs API key for text-to-speech functionality
    - Configure tier access for both free and pro users
    - Set usage limits and tracking

  2. Security
    - Uses existing RLS policies for global_api_keys table
    - Only superadmins can manage global API keys
*/

-- Insert a global Eleven Labs API key
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
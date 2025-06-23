/*
  # Add PicaOS Global API Key

  1. Changes
    - Insert a global PicaOS API key for Pro users
    - Enable AI orchestration for document generation
    - Set appropriate tier access (Pro users only)

  2. Security
    - Only Pro users (tier2) can access PicaOS features
    - API key is stored securely in global_api_keys table
*/

-- Insert a global PicaOS API key for Pro users
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
  'picaos',
  'pk_live_picaos_key_here', -- Replace with actual key in production
  ARRAY['tier2'], -- Pro users only
  true,
  1000, -- 1000 uses per month limit
  0,
  now(),
  now(),
  now()
) ON CONFLICT (provider) DO NOTHING;
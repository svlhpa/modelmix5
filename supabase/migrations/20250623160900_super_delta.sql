/*
  # Add PicaOS Global API Key

  1. Changes
    - Insert a global PicaOS API key for Pro users
    - Configure tier access to Pro users only
    - Set usage limits and tracking

  2. Security
    - Only Pro users can access PicaOS
    - Maintain existing RLS policies
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
  '', -- Replace with actual key in production
  ARRAY['tier2'], -- Pro users only
  true,
  1000, -- 1000 uses per month limit
  0,
  now(),
  now(),
  now()
) ON CONFLICT (provider) DO NOTHING;
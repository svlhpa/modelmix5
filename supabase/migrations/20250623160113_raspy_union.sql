/*
  # Add PicaOS Global API Key

  1. Changes
    - Insert a global PicaOS API key for Pro users
    - This enables PicaOS orchestration for Pro users
    - Admin can manage this key through the admin dashboard

  2. Security
    - Only Pro users can access PicaOS features
    - Uses existing RLS policies for global_api_keys table
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
  'pk_live_picaos_demo_key', -- This is a mock key for demonstration
  ARRAY['tier2'], -- Pro users only
  true,
  1000, -- 1000 uses per month limit
  0,
  now(),
  now(),
  now()
) ON CONFLICT (provider) DO NOTHING;
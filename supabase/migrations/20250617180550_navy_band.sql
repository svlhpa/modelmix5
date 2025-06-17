/*
  # Add Serper Global API Key for Internet Search

  1. Changes
    - Insert a global Serper API key that's available to all tiers
    - This enables internet search functionality for all users
    - Admin can manage this key through the admin dashboard

  2. Security
    - Uses existing RLS policies for global_api_keys table
    - Only superadmins can manage global API keys
*/

-- Insert a placeholder global Serper API key
-- Admin will need to update this with a real key through the admin dashboard
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
  'serper',
  'PLACEHOLDER_SERPER_KEY_UPDATE_IN_ADMIN',
  ARRAY['tier1', 'tier2'],
  false, -- Disabled by default until admin adds real key
  1000, -- 1000 searches per month limit
  0,
  now(),
  now(),
  now()
) ON CONFLICT (provider) DO NOTHING;
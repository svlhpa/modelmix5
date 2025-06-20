/*
  # Add Imagerouter Global API Key Support

  1. Database Functions
    - Update get_global_api_key function to handle imagerouter
    - Update increment_global_usage function to handle imagerouter
    - Update check_global_usage_limit function to handle imagerouter

  2. Security
    - Ensure proper RLS policies are in place
    - Maintain existing security model
*/

-- Update the get_global_api_key function to handle imagerouter
CREATE OR REPLACE FUNCTION get_global_api_key(provider_name text, user_tier text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  api_key text;
BEGIN
  SELECT gak.api_key INTO api_key
  FROM global_api_keys gak
  WHERE gak.provider = provider_name
    AND gak.is_active = true
    AND user_tier = ANY(gak.tier_access)
    AND (gak.usage_limit IS NULL OR gak.current_usage < gak.usage_limit);
  
  RETURN api_key;
END;
$$;

-- Update the increment_global_usage function to handle imagerouter
CREATE OR REPLACE FUNCTION increment_global_usage(provider_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE global_api_keys
  SET current_usage = current_usage + 1,
      updated_at = now()
  WHERE provider = provider_name
    AND is_active = true;
END;
$$;

-- Update the check_global_usage_limit function to handle imagerouter
CREATE OR REPLACE FUNCTION check_global_usage_limit(provider_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  can_use boolean := false;
BEGIN
  SELECT (usage_limit IS NULL OR current_usage < usage_limit) INTO can_use
  FROM global_api_keys
  WHERE provider = provider_name
    AND is_active = true
  LIMIT 1;
  
  RETURN COALESCE(can_use, false);
END;
$$;

-- Ensure the is_superadmin function exists for RLS policies
CREATE OR REPLACE FUNCTION is_superadmin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_admin boolean := false;
BEGIN
  SELECT (role = 'superadmin') INTO is_admin
  FROM user_profiles
  WHERE id = user_id;
  
  RETURN COALESCE(is_admin, false);
END;
$$;
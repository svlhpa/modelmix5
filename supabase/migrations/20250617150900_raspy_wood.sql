/*
  # Enable Free Trial with Global API Keys

  1. Database Functions
    - Update global API key functions to support free trial access
    - Add functions to check if user can use global keys
    - Ensure tier 1 users can access global keys for free trial

  2. Security
    - Maintain existing RLS policies
    - Ensure proper tier-based access control
    - Add usage tracking for free trial users
*/

-- Function to check if user can use global API keys for free trial
CREATE OR REPLACE FUNCTION can_use_global_keys(user_id uuid, provider_name text)
RETURNS boolean AS $$
DECLARE
  user_tier text;
  has_personal_key boolean;
  global_key_available boolean;
BEGIN
  -- Get user's current tier
  user_tier := get_user_tier(user_id);
  
  -- Check if user has personal API key for this provider
  SELECT EXISTS(
    SELECT 1 FROM user_api_settings 
    WHERE user_api_settings.user_id = can_use_global_keys.user_id 
    AND provider = provider_name 
    AND api_key IS NOT NULL 
    AND api_key != ''
  ) INTO has_personal_key;
  
  -- If user has personal key, they should use it
  IF has_personal_key THEN
    RETURN false;
  END IF;
  
  -- Check if global key is available for user's tier
  SELECT EXISTS(
    SELECT 1 FROM global_api_keys
    WHERE global_api_keys.provider = provider_name
      AND global_api_keys.is_active = true
      AND user_tier = ANY(global_api_keys.tier_access)
  ) INTO global_key_available;
  
  RETURN global_key_available;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_global_api_key function to be more permissive for free trial
CREATE OR REPLACE FUNCTION get_global_api_key(provider_name text, user_tier text)
RETURNS text AS $$
DECLARE
  api_key text;
  usage_ok boolean;
BEGIN
  -- Check if global key usage is within limits
  usage_ok := check_global_usage_limit(provider_name);
  
  -- If usage limit exceeded, return null
  IF NOT usage_ok THEN
    RETURN NULL;
  END IF;
  
  -- Get active global API key that supports the user's tier
  SELECT global_api_keys.api_key INTO api_key
  FROM global_api_keys
  WHERE global_api_keys.provider = provider_name
    AND global_api_keys.is_active = true
    AND user_tier = ANY(global_api_keys.tier_access);
  
  RETURN api_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track global key usage by user
CREATE OR REPLACE FUNCTION track_global_key_usage(user_id uuid, provider_name text)
RETURNS void AS $$
BEGIN
  -- Increment global usage counter
  PERFORM increment_global_usage(provider_name);
  
  -- You could also track individual user usage of global keys here
  -- This could be useful for analytics and abuse prevention
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
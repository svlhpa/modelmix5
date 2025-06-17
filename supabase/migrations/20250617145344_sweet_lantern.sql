/*
  # Global API Key Management

  1. New Tables
    - `global_api_keys`
      - `id` (uuid, primary key)
      - `provider` (text) - openai, openrouter, gemini, deepseek
      - `api_key` (text, encrypted)
      - `tier_access` (text[]) - which tiers can use this key
      - `is_active` (boolean) - whether the key is currently active
      - `usage_limit` (integer) - optional usage limit per month
      - `current_usage` (integer) - current month usage
      - `last_reset_date` (timestamp) - when usage was last reset
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on global_api_keys table
    - Add policies for superadmin-only access
    - Add function to get active global keys for user tier
*/

-- Create global_api_keys table
CREATE TABLE IF NOT EXISTS global_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  api_key text NOT NULL,
  tier_access text[] NOT NULL DEFAULT '{}',
  is_active boolean DEFAULT true,
  usage_limit integer,
  current_usage integer DEFAULT 0,
  last_reset_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(provider)
);

-- Enable RLS on global_api_keys
ALTER TABLE global_api_keys ENABLE ROW LEVEL SECURITY;

-- Create policies for global_api_keys (superadmin only)
CREATE POLICY "Superadmins can manage global API keys"
  ON global_api_keys
  FOR ALL
  TO authenticated
  USING (is_superadmin(auth.uid()))
  WITH CHECK (is_superadmin(auth.uid()));

-- Function to get global API key for user's tier
CREATE OR REPLACE FUNCTION get_global_api_key(provider_name text, user_tier text)
RETURNS text AS $$
DECLARE
  api_key text;
BEGIN
  -- Get active global API key that supports the user's tier
  SELECT global_api_keys.api_key INTO api_key
  FROM global_api_keys
  WHERE global_api_keys.provider = provider_name
    AND global_api_keys.is_active = true
    AND user_tier = ANY(global_api_keys.tier_access);
  
  RETURN api_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment global API key usage
CREATE OR REPLACE FUNCTION increment_global_usage(provider_name text)
RETURNS void AS $$
BEGIN
  -- Reset usage if it's a new month
  UPDATE global_api_keys 
  SET current_usage = 0, 
      last_reset_date = now()
  WHERE provider = provider_name 
    AND date_trunc('month', last_reset_date) < date_trunc('month', now());
  
  -- Increment usage
  UPDATE global_api_keys 
  SET current_usage = current_usage + 1,
      updated_at = now()
  WHERE provider = provider_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if global API key is within usage limits
CREATE OR REPLACE FUNCTION check_global_usage_limit(provider_name text)
RETURNS boolean AS $$
DECLARE
  usage_limit integer;
  current_usage integer;
BEGIN
  -- Get usage data
  SELECT global_api_keys.usage_limit, global_api_keys.current_usage 
  INTO usage_limit, current_usage
  FROM global_api_keys
  WHERE provider = provider_name
    AND is_active = true;
  
  -- If no usage limit set, allow unlimited usage
  IF usage_limit IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check if within limits
  RETURN current_usage < usage_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
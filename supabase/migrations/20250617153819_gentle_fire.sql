/*
  # Update Tier System for Unlimited Pro Plan

  1. Changes
    - Update tier limits to support unlimited values (-1)
    - Modify check functions to handle unlimited tiers
    - Update usage tracking for Pro users

  2. Functions Updated
    - check_tier_limits: Handle unlimited Pro tier
    - increment_usage: Skip increment for Pro users
    - get_user_tier: Ensure proper tier detection
*/

-- Update check_tier_limits function to handle unlimited Pro tier
CREATE OR REPLACE FUNCTION check_tier_limits(user_id uuid, action_type text)
RETURNS boolean AS $$
DECLARE
  user_tier text;
  monthly_count integer;
  tier1_limit integer := 50; -- Tier 1: 50 conversations per month
  tier2_limit integer := -1; -- Tier 2: Unlimited conversations (-1)
BEGIN
  -- Get user's current tier
  user_tier := get_user_tier(user_id);
  
  -- Pro users have unlimited access
  IF user_tier = 'tier2' THEN
    RETURN true;
  END IF;
  
  -- Get current monthly usage for free tier users
  SELECT monthly_conversations INTO monthly_count
  FROM user_profiles 
  WHERE id = user_id;
  
  -- Reset monthly count if it's a new month
  UPDATE user_profiles 
  SET monthly_conversations = 0, last_reset_date = now()
  WHERE id = user_id 
  AND date_trunc('month', last_reset_date) < date_trunc('month', now());
  
  -- Refresh monthly count after potential reset
  SELECT monthly_conversations INTO monthly_count
  FROM user_profiles 
  WHERE id = user_id;
  
  -- Check limits based on tier
  IF user_tier = 'tier1' THEN
    RETURN monthly_count < tier1_limit;
  END IF;
  
  -- Default to tier1 limits
  RETURN monthly_count < tier1_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update increment_usage function to skip Pro users
CREATE OR REPLACE FUNCTION increment_usage(user_id uuid)
RETURNS void AS $$
DECLARE
  user_tier text;
BEGIN
  -- Get user's current tier
  user_tier := get_user_tier(user_id);
  
  -- Don't increment usage for Pro users (unlimited)
  IF user_tier = 'tier2' THEN
    RETURN;
  END IF;
  
  -- Increment usage for free tier users
  UPDATE user_profiles 
  SET monthly_conversations = monthly_conversations + 1,
      updated_at = now()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check model limits per comparison
CREATE OR REPLACE FUNCTION check_model_limits(user_id uuid, model_count integer)
RETURNS boolean AS $$
DECLARE
  user_tier text;
  tier1_model_limit integer := 3; -- Tier 1: 3 models per comparison
  tier2_model_limit integer := -1; -- Tier 2: Unlimited models (-1)
BEGIN
  -- Get user's current tier
  user_tier := get_user_tier(user_id);
  
  -- Pro users have unlimited models
  IF user_tier = 'tier2' THEN
    RETURN true;
  END IF;
  
  -- Check limits for free tier
  IF user_tier = 'tier1' THEN
    RETURN model_count <= tier1_model_limit;
  END IF;
  
  -- Default to tier1 limits
  RETURN model_count <= tier1_model_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get tier display limits
CREATE OR REPLACE FUNCTION get_tier_display_limits(tier_name text)
RETURNS jsonb AS $$
BEGIN
  CASE tier_name
    WHEN 'tier1' THEN
      RETURN jsonb_build_object(
        'monthly_conversations', 50,
        'max_models_per_comparison', 3,
        'name', 'Free'
      );
    WHEN 'tier2' THEN
      RETURN jsonb_build_object(
        'monthly_conversations', -1,
        'max_models_per_comparison', -1,
        'name', 'Pro'
      );
    ELSE
      RETURN jsonb_build_object(
        'monthly_conversations', 50,
        'max_models_per_comparison', 3,
        'name', 'Free'
      );
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
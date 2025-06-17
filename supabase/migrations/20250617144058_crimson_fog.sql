/*
  # Add User Tiers System

  1. New Tables
    - `user_subscriptions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `tier` (text) - 'tier1' or 'tier2'
      - `status` (text) - 'active', 'cancelled', 'expired'
      - `started_at` (timestamp)
      - `expires_at` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Updates
    - Add tier-related columns to user_profiles for quick access
    - Add usage tracking for tier limits

  3. Security
    - Enable RLS on user_subscriptions
    - Add policies for users to manage their own subscriptions
    - Add superadmin access to all subscription data
*/

-- Create user_subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  tier text NOT NULL CHECK (tier IN ('tier1', 'tier2')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  started_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Add tier and usage tracking columns to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'current_tier'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN current_tier text DEFAULT 'tier1' CHECK (current_tier IN ('tier1', 'tier2'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'monthly_conversations'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN monthly_conversations integer DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'last_reset_date'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN last_reset_date timestamptz DEFAULT now();
  END IF;
END $$;

-- Enable RLS on user_subscriptions
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies for user_subscriptions
CREATE POLICY "Users can read own subscription"
  ON user_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_superadmin(auth.uid()));

CREATE POLICY "Users can update own subscription"
  ON user_subscriptions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR is_superadmin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_superadmin(auth.uid()));

CREATE POLICY "Superadmins can manage all subscriptions"
  ON user_subscriptions
  FOR ALL
  TO authenticated
  USING (is_superadmin(auth.uid()))
  WITH CHECK (is_superadmin(auth.uid()));

-- Function to get user tier with fallback
CREATE OR REPLACE FUNCTION get_user_tier(user_id uuid)
RETURNS text AS $$
DECLARE
  user_tier text;
  subscription_status text;
BEGIN
  -- Check if user has an active subscription
  SELECT tier, status INTO user_tier, subscription_status
  FROM user_subscriptions 
  WHERE user_subscriptions.user_id = get_user_tier.user_id
  AND (status = 'active' OR (status = 'cancelled' AND expires_at > now()));
  
  -- If no active subscription found, return tier1 (free)
  IF user_tier IS NULL THEN
    RETURN 'tier1';
  END IF;
  
  -- If subscription expired, return tier1
  IF subscription_status = 'expired' THEN
    RETURN 'tier1';
  END IF;
  
  RETURN user_tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check tier limits
CREATE OR REPLACE FUNCTION check_tier_limits(user_id uuid, action_type text)
RETURNS boolean AS $$
DECLARE
  user_tier text;
  monthly_count integer;
  tier1_limit integer := 50; -- Tier 1: 50 conversations per month
  tier2_limit integer := 1000; -- Tier 2: 1000 conversations per month (practically unlimited)
BEGIN
  -- Get user's current tier
  user_tier := get_user_tier(user_id);
  
  -- Get current monthly usage
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
  ELSIF user_tier = 'tier2' THEN
    RETURN monthly_count < tier2_limit;
  END IF;
  
  -- Default to tier1 limits
  RETURN monthly_count < tier1_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage counter
CREATE OR REPLACE FUNCTION increment_usage(user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE user_profiles 
  SET monthly_conversations = monthly_conversations + 1,
      updated_at = now()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create default tier1 subscription for new users
CREATE OR REPLACE FUNCTION create_default_subscription()
RETURNS trigger AS $$
BEGIN
  -- Create a tier1 subscription for new users
  INSERT INTO user_subscriptions (user_id, tier, status, started_at)
  VALUES (NEW.id, 'tier1', 'active', now());
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user subscription creation
DROP TRIGGER IF EXISTS on_user_profile_created ON user_profiles;
CREATE TRIGGER on_user_profile_created
  AFTER INSERT ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION create_default_subscription();

-- Update handle_new_user function to set default tier
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, current_tier, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'tier1',
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
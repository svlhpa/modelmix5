/*
  # Fix user signup database error

  1. Database Issues Fixed
    - Update trigger function to handle user profile creation properly
    - Ensure proper RLS policies for user creation
    - Fix any missing constraints or default values

  2. Changes Made
    - Create or replace the handle_new_user trigger function
    - Update RLS policies to allow proper user creation
    - Ensure create_default_subscription function works correctly

  3. Security
    - Maintain proper RLS policies
    - Ensure triggers run with appropriate permissions
*/

-- First, let's create or replace the handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace the create_default_subscription function
CREATE OR REPLACE FUNCTION public.create_default_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, tier, status, started_at)
  VALUES (
    NEW.id,
    'tier1',
    'active',
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_user_profile_created ON public.user_profiles;

-- Create the trigger on auth.users to create user profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create the trigger on user_profiles to create default subscription
CREATE TRIGGER on_user_profile_created
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_default_subscription();

-- Update RLS policies to ensure proper permissions during signup
DROP POLICY IF EXISTS "Enable insert for authenticated users during signup" ON public.user_profiles;

CREATE POLICY "Enable insert for authenticated users during signup"
  ON public.user_profiles
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Ensure the user_profiles table has proper constraints
DO $$
BEGIN
  -- Make sure full_name can be null or empty
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' 
    AND column_name = 'full_name' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.user_profiles ALTER COLUMN full_name DROP NOT NULL;
  END IF;
END $$;

-- Grant necessary permissions to the functions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_default_subscription() TO anon, authenticated;
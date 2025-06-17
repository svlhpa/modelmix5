/*
  # Fix User Signup Database Error

  1. Security Updates
    - Update RLS policies to allow proper user creation
    - Fix trigger function for new user profile creation
    - Ensure auth.users can insert into user_profiles

  2. Changes Made
    - Updated user_profiles RLS policies to work with auth triggers
    - Fixed the handle_new_user trigger function
    - Added proper permissions for the auth system
*/

-- Drop existing policies that might be blocking user creation
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- Create new policies that work with auth triggers
CREATE POLICY "Enable insert for authenticated users during signup"
  ON user_profiles
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Recreate the trigger function to handle new user creation properly
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.user_profiles TO anon, authenticated;
GRANT ALL ON public.user_api_settings TO authenticated;
GRANT ALL ON public.chat_sessions TO authenticated;
GRANT ALL ON public.conversation_turns TO authenticated;
GRANT ALL ON public.provider_analytics TO authenticated;
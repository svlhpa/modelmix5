/*
  # Add Superadmin System

  1. New Changes
    - Add `role` column to `user_profiles` table
    - Set default role as 'user'
    - Only two roles: 'user' and 'superadmin'
    - Add RLS policies for superadmin access
    - Create admin activity logging table

  2. Security
    - Superadmins can access all data across the platform
    - Regular users can only access their own data
    - All admin actions are logged for audit purposes
*/

-- Add role column to user_profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN role text DEFAULT 'user';
  END IF;
END $$;

-- Create admin_activity_logs table for audit trail
CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  action text NOT NULL,
  target_user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on admin_activity_logs
ALTER TABLE admin_activity_logs ENABLE ROW LEVEL SECURITY;

-- Create function to check if user is superadmin
CREATE OR REPLACE FUNCTION is_superadmin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE id = user_id AND role = 'superadmin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing RLS policies to include superadmin access

-- Update user_profiles policies
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
CREATE POLICY "Users can read own profile or superadmin can read all"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR is_superadmin(auth.uid()));

-- Update user_api_settings policies  
DROP POLICY IF EXISTS "Users can manage own API settings" ON user_api_settings;
CREATE POLICY "Users can manage own API settings or superadmin can manage all"
  ON user_api_settings
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR is_superadmin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_superadmin(auth.uid()));

-- Update chat_sessions policies
DROP POLICY IF EXISTS "Users can manage own chat sessions" ON chat_sessions;
CREATE POLICY "Users can manage own chat sessions or superadmin can manage all"
  ON chat_sessions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR is_superadmin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_superadmin(auth.uid()));

-- Update conversation_turns policies
DROP POLICY IF EXISTS "Users can manage own conversation turns" ON conversation_turns;
CREATE POLICY "Users can manage own conversation turns or superadmin can manage all"
  ON conversation_turns
  FOR ALL
  TO authenticated
  USING (
    session_id IN (
      SELECT id FROM chat_sessions WHERE user_id = auth.uid()
    ) OR is_superadmin(auth.uid())
  )
  WITH CHECK (
    session_id IN (
      SELECT id FROM chat_sessions WHERE user_id = auth.uid()
    ) OR is_superadmin(auth.uid())
  );

-- Update provider_analytics policies
DROP POLICY IF EXISTS "Users can manage own analytics" ON provider_analytics;
CREATE POLICY "Users can manage own analytics or superadmin can manage all"
  ON provider_analytics
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR is_superadmin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_superadmin(auth.uid()));

-- Admin activity logs policies
CREATE POLICY "Superadmins can manage admin activity logs"
  ON admin_activity_logs
  FOR ALL
  TO authenticated
  USING (is_superadmin(auth.uid()))
  WITH CHECK (is_superadmin(auth.uid()));

-- Function to log admin activities
CREATE OR REPLACE FUNCTION log_admin_activity(
  action_type text,
  target_user_id uuid DEFAULT NULL,
  activity_details jsonb DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  IF is_superadmin(auth.uid()) THEN
    INSERT INTO admin_activity_logs (admin_user_id, action, target_user_id, details)
    VALUES (auth.uid(), action_type, target_user_id, activity_details);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
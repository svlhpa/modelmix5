/*
  # Get Started Video System

  1. New Tables
    - `admin_settings`
      - `id` (uuid, primary key)
      - `setting_key` (text, unique)
      - `setting_value` (text)
      - `description` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `user_video_views`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `video_url` (text)
      - `viewed_at` (timestamp)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for users to track their own video views
    - Add superadmin access to admin settings
    - Insert default get started video URL

  3. Functions
    - Function to check if user has seen current get started video
    - Function to mark video as viewed
*/

-- Create admin_settings table
CREATE TABLE IF NOT EXISTS admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_video_views table
CREATE TABLE IF NOT EXISTS user_video_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  video_url text NOT NULL,
  viewed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, video_url)
);

-- Enable RLS on both tables
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_video_views ENABLE ROW LEVEL SECURITY;

-- Create policies for admin_settings (superadmin only)
CREATE POLICY "Superadmins can manage admin settings"
  ON admin_settings
  FOR ALL
  TO authenticated
  USING (is_superadmin(auth.uid()))
  WITH CHECK (is_superadmin(auth.uid()));

CREATE POLICY "Anyone can read admin settings"
  ON admin_settings
  FOR SELECT
  TO authenticated, anon
  USING (true);

-- Create policies for user_video_views
CREATE POLICY "Users can manage own video views or superadmin can manage all"
  ON user_video_views
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid() OR is_superadmin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_superadmin(auth.uid()));

-- Insert default get started video URL
INSERT INTO admin_settings (setting_key, setting_value, description)
VALUES (
  'get_started_video_url',
  'https://youtu.be/lCAa4-Wu0og',
  'YouTube URL for the get started video shown to new users'
) ON CONFLICT (setting_key) DO NOTHING;

-- Function to check if user has seen current get started video
CREATE OR REPLACE FUNCTION has_seen_get_started_video(user_id uuid)
RETURNS boolean AS $$
DECLARE
  current_video_url text;
  has_viewed boolean := false;
BEGIN
  -- Get current get started video URL
  SELECT setting_value INTO current_video_url
  FROM admin_settings
  WHERE setting_key = 'get_started_video_url';
  
  -- Check if user has viewed this specific video
  SELECT EXISTS(
    SELECT 1 FROM user_video_views
    WHERE user_video_views.user_id = has_seen_get_started_video.user_id
    AND video_url = current_video_url
  ) INTO has_viewed;
  
  RETURN has_viewed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark get started video as viewed
CREATE OR REPLACE FUNCTION mark_get_started_video_viewed(user_id uuid)
RETURNS void AS $$
DECLARE
  current_video_url text;
BEGIN
  -- Get current get started video URL
  SELECT setting_value INTO current_video_url
  FROM admin_settings
  WHERE setting_key = 'get_started_video_url';
  
  -- Insert video view record
  INSERT INTO user_video_views (user_id, video_url)
  VALUES (user_id, current_video_url)
  ON CONFLICT (user_id, video_url) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_settings_key ON admin_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_user_video_views_user_id ON user_video_views(user_id);
CREATE INDEX IF NOT EXISTS idx_user_video_views_video_url ON user_video_views(video_url);
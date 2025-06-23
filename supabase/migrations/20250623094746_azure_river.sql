/*
  # Fix Get Started Video Database Functions

  1. Database Functions Fixed
    - Fix mark_get_started_video_viewed function parameter handling
    - Ensure proper RLS permissions for the function
    - Add better error handling

  2. Security
    - Maintain proper RLS policies
    - Ensure functions run with appropriate permissions
*/

-- Drop and recreate the function with proper parameter handling
DROP FUNCTION IF EXISTS mark_get_started_video_viewed(uuid);

-- Function to mark get started video as viewed
CREATE OR REPLACE FUNCTION mark_get_started_video_viewed(target_user_id uuid)
RETURNS void AS $$
DECLARE
  current_video_url text;
BEGIN
  -- Get current get started video URL
  SELECT setting_value INTO current_video_url
  FROM admin_settings
  WHERE setting_key = 'get_started_video_url';
  
  -- If no video URL is set, exit gracefully
  IF current_video_url IS NULL THEN
    RETURN;
  END IF;
  
  -- Insert video view record
  INSERT INTO user_video_views (user_id, video_url, viewed_at, created_at)
  VALUES (target_user_id, current_video_url, now(), now())
  ON CONFLICT (user_id, video_url) DO UPDATE SET
    viewed_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate the has_seen function with proper parameter handling
DROP FUNCTION IF EXISTS has_seen_get_started_video(uuid);

-- Function to check if user has seen current get started video
CREATE OR REPLACE FUNCTION has_seen_get_started_video(target_user_id uuid)
RETURNS boolean AS $$
DECLARE
  current_video_url text;
  has_viewed boolean := false;
BEGIN
  -- Get current get started video URL
  SELECT setting_value INTO current_video_url
  FROM admin_settings
  WHERE setting_key = 'get_started_video_url';
  
  -- If no video URL is set, return true (don't show video)
  IF current_video_url IS NULL THEN
    RETURN true;
  END IF;
  
  -- Check if user has viewed this specific video
  SELECT EXISTS(
    SELECT 1 FROM user_video_views
    WHERE user_video_views.user_id = target_user_id
    AND video_url = current_video_url
  ) INTO has_viewed;
  
  RETURN has_viewed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION mark_get_started_video_viewed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION has_seen_get_started_video(uuid) TO authenticated;
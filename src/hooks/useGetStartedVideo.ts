import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export const useGetStartedVideo = () => {
  const { user } = useAuth();
  const [shouldShowVideo, setShouldShowVideo] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      checkIfShouldShowVideo();
    } else {
      setLoading(false);
    }
  }, [user]);

  const checkIfShouldShowVideo = async () => {
    try {
      setLoading(true);

      // Get current video URL from admin settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('admin_settings')
        .select('setting_value')
        .eq('setting_key', 'get_started_video_url')
        .single();

      if (settingsError) {
        console.error('Failed to get video URL:', settingsError);
        setLoading(false);
        return;
      }

      const currentVideoUrl = settingsData.setting_value;
      setVideoUrl(currentVideoUrl);

      // Check if user has seen this video
      const { data: hasSeenData, error: hasSeenError } = await supabase.rpc(
        'has_seen_get_started_video',
        { user_id: user!.id }
      );

      if (hasSeenError) {
        console.error('Failed to check video status:', hasSeenError);
        setLoading(false);
        return;
      }

      // Show video if user hasn't seen it
      setShouldShowVideo(!hasSeenData);
    } catch (error) {
      console.error('Error checking get started video status:', error);
    } finally {
      setLoading(false);
    }
  };

  const markVideoAsWatched = async () => {
    if (!user) return;

    try {
      const { error } = await supabase.rpc('mark_get_started_video_viewed', {
        user_id: user.id
      });

      if (error) throw error;

      setShouldShowVideo(false);
    } catch (error) {
      console.error('Failed to mark video as watched:', error);
    }
  };

  return {
    shouldShowVideo,
    videoUrl,
    loading,
    hideVideo: () => setShouldShowVideo(false),
    markVideoAsWatched
  };
};
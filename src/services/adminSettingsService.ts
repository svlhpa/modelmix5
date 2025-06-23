import { supabase } from '../lib/supabase';

interface AdminSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

class AdminSettingsService {
  async getAllSettings(): Promise<AdminSetting[]> {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('*')
      .order('setting_key');

    if (error) throw error;
    return data || [];
  }

  async getSetting(key: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('setting_value')
      .eq('setting_key', key)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Setting not found
        return null;
      }
      throw error;
    }

    return data.setting_value;
  }

  async updateSetting(key: string, value: string, description?: string): Promise<void> {
    const { error } = await supabase
      .from('admin_settings')
      .upsert({
        setting_key: key,
        setting_value: value,
        description: description || null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'setting_key'
      });

    if (error) throw error;
  }

  async deleteSetting(key: string): Promise<void> {
    const { error } = await supabase
      .from('admin_settings')
      .delete()
      .eq('setting_key', key);

    if (error) throw error;
  }

  // Specific methods for common settings
  async getGetStartedVideoUrl(): Promise<string> {
    const url = await this.getSetting('get_started_video_url');
    return url || 'https://youtu.be/lCAa4-Wu0og'; // Default fallback
  }

  async updateGetStartedVideoUrl(url: string): Promise<void> {
    await this.updateSetting(
      'get_started_video_url',
      url,
      'YouTube URL for the get started video shown to new users'
    );
  }

  // Get all users who haven't seen the current video
  async getUsersWhoHaventSeenCurrentVideo(): Promise<number> {
    const currentVideoUrl = await this.getGetStartedVideoUrl();
    
    const { count, error } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .not('id', 'in', 
        supabase
          .from('user_video_views')
          .select('user_id')
          .eq('video_url', currentVideoUrl)
      );

    if (error) throw error;
    return count || 0;
  }

  // Get video view statistics
  async getVideoViewStats(): Promise<{
    totalUsers: number;
    usersWhoWatchedCurrent: number;
    usersWhoHaventWatched: number;
    currentVideoUrl: string;
  }> {
    const currentVideoUrl = await this.getGetStartedVideoUrl();
    
    const [totalUsersResult, watchedUsersResult] = await Promise.all([
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
      supabase
        .from('user_video_views')
        .select('user_id', { count: 'exact', head: true })
        .eq('video_url', currentVideoUrl)
    ]);

    const totalUsers = totalUsersResult.count || 0;
    const usersWhoWatchedCurrent = watchedUsersResult.count || 0;
    const usersWhoHaventWatched = totalUsers - usersWhoWatchedCurrent;

    return {
      totalUsers,
      usersWhoWatchedCurrent,
      usersWhoHaventWatched,
      currentVideoUrl
    };
  }
}

export const adminSettingsService = new AdminSettingsService();
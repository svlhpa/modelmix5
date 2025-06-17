import { supabase } from '../lib/supabase';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'user' | 'superadmin';
  created_at: string;
  updated_at: string;
}

interface AdminActivityLog {
  id: string;
  admin_user_id: string;
  action: string;
  target_user_id: string | null;
  details: any;
  created_at: string;
}

interface UserStats {
  totalUsers: number;
  totalSessions: number;
  totalConversations: number;
  activeUsersLast30Days: number;
}

class AdminService {
  // User Management
  async getAllUsers(): Promise<UserProfile[]> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async updateUserRole(userId: string, role: 'user' | 'superadmin'): Promise<void> {
    const { error } = await supabase
      .from('user_profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw error;

    // Log admin activity
    await this.logActivity('update_user_role', userId, { new_role: role });
  }

  async deleteUser(userId: string): Promise<void> {
    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', userId);

    if (error) throw error;

    // Log admin activity
    await this.logActivity('delete_user', userId);
  }

  // System Statistics
  async getSystemStats(): Promise<UserStats> {
    const [usersResult, sessionsResult, conversationsResult, activeUsersResult] = await Promise.all([
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('chat_sessions').select('id', { count: 'exact', head: true }),
      supabase.from('conversation_turns').select('id', { count: 'exact', head: true }),
      supabase
        .from('chat_sessions')
        .select('user_id', { count: 'exact', head: true })
        .gte('updated_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    ]);

    return {
      totalUsers: usersResult.count || 0,
      totalSessions: sessionsResult.count || 0,
      totalConversations: conversationsResult.count || 0,
      activeUsersLast30Days: activeUsersResult.count || 0,
    };
  }

  // Activity Logging
  async logActivity(action: string, targetUserId?: string, details?: any): Promise<void> {
    const { error } = await supabase.rpc('log_admin_activity', {
      action_type: action,
      target_user_id: targetUserId || null,
      activity_details: details || null,
    });

    if (error) throw error;
  }

  async getActivityLogs(limit: number = 50): Promise<AdminActivityLog[]> {
    const { data, error } = await supabase
      .from('admin_activity_logs')
      .select(`
        *,
        admin_user:user_profiles!admin_user_id(email, full_name),
        target_user:user_profiles!target_user_id(email, full_name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  // Provider Analytics (Global View)
  async getGlobalProviderStats() {
    const { data, error } = await supabase
      .from('provider_analytics')
      .select('*')
      .order('total_responses', { ascending: false });

    if (error) throw error;

    // Aggregate stats across all users
    const aggregated = data.reduce((acc, stat) => {
      const existing = acc.find(item => item.provider === stat.provider);
      if (existing) {
        existing.total_responses += stat.total_responses;
        existing.total_selections += stat.total_selections;
        existing.error_count += stat.error_count;
      } else {
        acc.push({
          provider: stat.provider,
          total_responses: stat.total_responses,
          total_selections: stat.total_selections,
          error_count: stat.error_count,
        });
      }
      return acc;
    }, [] as any[]);

    // Calculate selection rates
    return aggregated.map(stat => ({
      ...stat,
      selection_rate: stat.total_responses > 0 ? (stat.total_selections / stat.total_responses) * 100 : 0,
      error_rate: stat.total_responses > 0 ? (stat.error_count / stat.total_responses) * 100 : 0,
    }));
  }
}

export const adminService = new AdminService();
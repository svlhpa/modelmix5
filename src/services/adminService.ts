import { supabase } from '../lib/supabase';
import { UserTier, UserSubscription } from '../types';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'user' | 'superadmin';
  current_tier: UserTier;
  monthly_conversations: number;
  last_reset_date: string;
  created_at: string;
  updated_at: string;
}

interface UserWithSubscription extends UserProfile {
  subscription?: UserSubscription;
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
  tier1Users: number;
  tier2Users: number;
}

interface GlobalProviderStats {
  provider: string;
  total_responses: number;
  total_selections: number;
  selection_rate: number;
  error_rate: number;
  unique_users: number;
  avg_response_time?: number;
  last_used: string;
}

interface ModelUsageTrend {
  date: string;
  provider: string;
  responses: number;
  selections: number;
}

class AdminService {
  // User Management
  async getAllUsers(): Promise<UserWithSubscription[]> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select(`
        *,
        subscription:user_subscriptions(*)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return data.map(user => ({
      ...user,
      subscription: user.subscription?.[0] || null
    }));
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

  async updateUserTier(userId: string, tier: UserTier): Promise<void> {
    // Update user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({ 
        current_tier: tier,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (profileError) throw profileError;

    // Update or create subscription
    const { error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        tier,
        status: 'active',
        started_at: new Date().toISOString(),
        expires_at: null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (subscriptionError) throw subscriptionError;

    // Log admin activity
    await this.logActivity('update_user_tier', userId, { new_tier: tier });
  }

  async resetUserUsage(userId: string): Promise<void> {
    const { error } = await supabase
      .from('user_profiles')
      .update({ 
        monthly_conversations: 0,
        last_reset_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) throw error;

    // Log admin activity
    await this.logActivity('reset_user_usage', userId);
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

    // Get tier distribution
    const { data: tierData } = await supabase
      .from('user_profiles')
      .select('current_tier');

    const tier1Users = tierData?.filter(u => u.current_tier === 'tier1').length || 0;
    const tier2Users = tierData?.filter(u => u.current_tier === 'tier2').length || 0;

    return {
      totalUsers: usersResult.count || 0,
      totalSessions: sessionsResult.count || 0,
      totalConversations: conversationsResult.count || 0,
      activeUsersLast30Days: activeUsersResult.count || 0,
      tier1Users,
      tier2Users,
    };
  }

  // Global Provider Analytics
  async getGlobalProviderStats(): Promise<GlobalProviderStats[]> {
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
        existing.unique_users += 1;
        // Update last_used to the most recent
        if (new Date(stat.last_used) > new Date(existing.last_used)) {
          existing.last_used = stat.last_used;
        }
      } else {
        acc.push({
          provider: stat.provider,
          total_responses: stat.total_responses,
          total_selections: stat.total_selections,
          error_count: stat.error_count,
          unique_users: 1,
          last_used: stat.last_used,
        });
      }
      return acc;
    }, [] as any[]);

    // Calculate rates and sort by total responses
    return aggregated
      .map(stat => ({
        provider: stat.provider,
        total_responses: stat.total_responses,
        total_selections: stat.total_selections,
        selection_rate: stat.total_responses > 0 ? (stat.total_selections / stat.total_responses) * 100 : 0,
        error_rate: stat.total_responses > 0 ? (stat.error_count / stat.total_responses) * 100 : 0,
        unique_users: stat.unique_users,
        last_used: stat.last_used,
      }))
      .sort((a, b) => b.total_responses - a.total_responses);
  }

  async getModelUsageTrends(days: number = 30): Promise<ModelUsageTrend[]> {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('provider_analytics')
      .select('provider, total_responses, total_selections, updated_at')
      .gte('updated_at', startDate)
      .order('updated_at', { ascending: true });

    if (error) throw error;

    // Group by date and provider
    const trends = data.reduce((acc, stat) => {
      const date = new Date(stat.updated_at).toISOString().split('T')[0];
      const key = `${date}-${stat.provider}`;
      
      if (!acc[key]) {
        acc[key] = {
          date,
          provider: stat.provider,
          responses: 0,
          selections: 0,
        };
      }
      
      acc[key].responses += stat.total_responses;
      acc[key].selections += stat.total_selections;
      
      return acc;
    }, {} as Record<string, ModelUsageTrend>);

    return Object.values(trends);
  }

  async getTopPerformingModels(limit: number = 10): Promise<GlobalProviderStats[]> {
    const stats = await this.getGlobalProviderStats();
    return stats
      .filter(stat => stat.total_responses >= 10) // Only include models with significant usage
      .sort((a, b) => b.selection_rate - a.selection_rate)
      .slice(0, limit);
  }

  async getModelComparisonData() {
    const stats = await this.getGlobalProviderStats();
    
    return {
      totalModels: stats.length,
      totalResponses: stats.reduce((sum, stat) => sum + stat.total_responses, 0),
      totalSelections: stats.reduce((sum, stat) => sum + stat.total_selections, 0),
      averageSelectionRate: stats.length > 0 
        ? stats.reduce((sum, stat) => sum + stat.selection_rate, 0) / stats.length 
        : 0,
      mostPopularModel: stats.length > 0 ? stats[0] : null,
      bestPerformingModel: stats.length > 0 
        ? stats.reduce((best, current) => 
            current.selection_rate > best.selection_rate ? current : best
          ) 
        : null,
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
}

export const adminService = new AdminService();
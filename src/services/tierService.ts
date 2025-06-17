import { supabase } from '../lib/supabase';
import { UserTier, TierLimits, UserSubscription } from '../types';

class TierService {
  // Tier definitions
  private tierLimits: Record<UserTier, TierLimits> = {
    tier1: {
      tier: 'tier1',
      name: 'Free',
      monthlyConversations: 50,
      maxModelsPerComparison: 3,
      features: [
        'Up to 50 conversations per month',
        'Compare up to 3 AI models',
        'Basic analytics',
        'Standard support'
      ],
      price: 0
    },
    tier2: {
      tier: 'tier2',
      name: 'Pro',
      monthlyConversations: 1000,
      maxModelsPerComparison: 10,
      features: [
        'Up to 1,000 conversations per month',
        'Compare up to 10 AI models',
        'Advanced analytics',
        'Priority support',
        'Export conversations',
        'Custom model configurations'
      ],
      price: 999 // $9.99 in cents
    }
  };

  getTierLimits(tier: UserTier): TierLimits {
    return this.tierLimits[tier];
  }

  getAllTiers(): TierLimits[] {
    return Object.values(this.tierLimits);
  }

  async getUserSubscription(): Promise<UserSubscription | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to get user subscription:', error);
      return null;
    }

    return data;
  }

  async getCurrentTier(): Promise<UserTier> {
    const subscription = await this.getUserSubscription();
    
    if (!subscription) return 'tier1';
    
    // Check if subscription is active
    if (subscription.status === 'active') {
      // Check if it hasn't expired (for cancelled subscriptions)
      if (subscription.status === 'cancelled' && subscription.expires_at) {
        const expiresAt = new Date(subscription.expires_at);
        if (expiresAt < new Date()) {
          return 'tier1';
        }
      }
      return subscription.tier;
    }
    
    return 'tier1';
  }

  async checkUsageLimit(): Promise<{ canUse: boolean; usage: number; limit: number }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { canUse: false, usage: 0, limit: 0 };

    // Get user profile with usage data
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('monthly_conversations, current_tier, last_reset_date')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Failed to get user profile:', error);
      return { canUse: false, usage: 0, limit: 0 };
    }

    const currentTier = await this.getCurrentTier();
    const limits = this.getTierLimits(currentTier);
    
    // Check if we need to reset monthly counter
    const lastReset = new Date(profile.last_reset_date);
    const now = new Date();
    const isNewMonth = lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear();
    
    let currentUsage = profile.monthly_conversations;
    
    if (isNewMonth) {
      // Reset the counter
      const { error: resetError } = await supabase
        .from('user_profiles')
        .update({ 
          monthly_conversations: 0, 
          last_reset_date: now.toISOString() 
        })
        .eq('id', user.id);
      
      if (!resetError) {
        currentUsage = 0;
      }
    }

    return {
      canUse: currentUsage < limits.monthlyConversations,
      usage: currentUsage,
      limit: limits.monthlyConversations
    };
  }

  async incrementUsage(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.rpc('increment_usage', {
      user_id: user.id
    });

    if (error) {
      console.error('Failed to increment usage:', error);
    }
  }

  async upgradeTier(tier: UserTier): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Update subscription
    const { error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: user.id,
        tier,
        status: 'active',
        started_at: new Date().toISOString(),
        expires_at: null, // No expiration for active subscriptions
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (subscriptionError) throw subscriptionError;

    // Update user profile
    const { error: profileError } = await supabase
      .from('user_profiles')
      .update({ 
        current_tier: tier,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (profileError) throw profileError;
  }

  async cancelSubscription(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Set subscription to cancelled but keep it active until end of billing period
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 1); // Expires at end of current billing period

    const { error } = await supabase
      .from('user_subscriptions')
      .update({
        status: 'cancelled',
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id);

    if (error) throw error;
  }

  formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  getUsagePercentage(usage: number, limit: number): number {
    return Math.min((usage / limit) * 100, 100);
  }

  getUsageColor(percentage: number): string {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-orange-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-green-600';
  }

  getUsageBarColor(percentage: number): string {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-orange-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  }
}

export const tierService = new TierService();
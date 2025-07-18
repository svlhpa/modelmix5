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
        'Free trial access to select models',
        'Standard support'
      ],
      price: 0
    },
    tier2: {
      tier: 'tier2',
      name: 'Pro',
      monthlyConversations: -1, // -1 indicates unlimited
      maxModelsPerComparison: -1, // -1 indicates unlimited
      features: [
        'Unlimited conversations per month',
        'Compare unlimited AI models',
        'Advanced analytics',
        'Priority support',
        'Export conversations',
        'Custom model configurations',
        'Access to all premium models',
        'Faster response times'
      ],
      price: 1799 // $17.99 in cents
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
    
    // Pro users have unlimited conversations
    if (currentTier === 'tier2') {
      return {
        canUse: true,
        usage: profile.monthly_conversations,
        limit: -1 // Unlimited
      };
    }
    
    // Check if we need to reset monthly counter for free tier
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

    // Check if user is Pro - if so, don't increment (unlimited)
    const currentTier = await this.getCurrentTier();
    if (currentTier === 'tier2') {
      return; // Pro users have unlimited usage
    }

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

    console.log('Starting tier upgrade for user:', user.id, 'to tier:', tier);

    try {
      // Use the new database function for better RLS handling
      const { error } = await supabase.rpc('upgrade_user_tier', {
        target_user_id: user.id,
        new_tier: tier
      });

      if (error) {
        console.error('Tier upgrade RPC error:', error);
        throw new Error(`Failed to upgrade tier: ${error.message}`);
      }

      console.log('Tier upgrade completed successfully using RPC');

      // Verify the update was successful
      const { data: updatedProfile, error: verifyError } = await supabase
        .from('user_profiles')
        .select('current_tier')
        .eq('id', user.id)
        .single();

      if (verifyError) {
        console.error('Verification error:', verifyError);
        throw new Error(`Failed to verify upgrade: ${verifyError.message}`);
      }

      if (updatedProfile.current_tier !== tier) {
        throw new Error(`Upgrade verification failed. Expected ${tier}, got ${updatedProfile.current_tier}`);
      }

      console.log('Tier upgrade completed and verified successfully');
    } catch (error) {
      console.error('Tier upgrade failed:', error);
      throw error;
    }
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
    if (limit === -1) return 0; // Unlimited usage shows 0%
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

  // Helper method to check if a tier has unlimited feature
  isUnlimited(tier: UserTier, feature: 'conversations' | 'models'): boolean {
    const limits = this.getTierLimits(tier);
    if (feature === 'conversations') {
      return limits.monthlyConversations === -1;
    }
    if (feature === 'models') {
      return limits.maxModelsPerComparison === -1;
    }
    return false;
  }

  // Get display text for limits
  getDisplayLimit(tier: UserTier, feature: 'conversations' | 'models'): string {
    const limits = this.getTierLimits(tier);
    if (feature === 'conversations') {
      return limits.monthlyConversations === -1 ? 'Unlimited' : limits.monthlyConversations.toString();
    }
    if (feature === 'models') {
      return limits.maxModelsPerComparison === -1 ? 'Unlimited' : limits.maxModelsPerComparison.toString();
    }
    return '0';
  }
}

export const tierService = new TierService();
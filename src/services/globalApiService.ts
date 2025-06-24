import { supabase } from '../lib/supabase';
import { UserTier } from '../types';

interface GlobalApiKey {
  id: string;
  provider: string;
  api_key: string;
  tier_access: string[];
  is_active: boolean;
  usage_limit: number | null;
  current_usage: number;
  last_reset_date: string;
  created_at: string;
  updated_at: string;
}

interface GlobalApiKeyInput {
  provider: string;
  api_key: string;
  tier_access: string[];
  is_active: boolean;
  usage_limit?: number | null;
}

class GlobalApiService {
  // Admin functions for managing global API keys
  async getAllGlobalApiKeys(): Promise<GlobalApiKey[]> {
    const { data, error } = await supabase
      .from('global_api_keys')
      .select('*')
      .order('provider');

    if (error) throw error;
    return data || [];
  }

  async createGlobalApiKey(keyData: GlobalApiKeyInput): Promise<void> {
    const { error } = await supabase
      .from('global_api_keys')
      .insert({
        ...keyData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
  }

  async updateGlobalApiKey(id: string, keyData: Partial<GlobalApiKeyInput>): Promise<void> {
    const { error } = await supabase
      .from('global_api_keys')
      .update({
        ...keyData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  }

  async deleteGlobalApiKey(id: string): Promise<void> {
    const { error } = await supabase
      .from('global_api_keys')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async toggleGlobalApiKey(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('global_api_keys')
      .update({ 
        is_active: isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  }

  async resetGlobalUsage(id: string): Promise<void> {
    const { error } = await supabase
      .from('global_api_keys')
      .update({ 
        current_usage: 0,
        last_reset_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
  }

  // User functions for accessing global API keys
  async getGlobalApiKey(provider: string, userTier: UserTier): Promise<string | null> {
    const { data, error } = await supabase.rpc('get_global_api_key', {
      provider_name: provider,
      user_tier: userTier
    });

    if (error) {
      console.error('Failed to get global API key:', error);
      return null;
    }

    return data;
  }

  async incrementGlobalUsage(provider: string): Promise<void> {
    const { error } = await supabase.rpc('increment_global_usage', {
      provider_name: provider
    });

    if (error) {
      console.error('Failed to increment global usage:', error);
    }
  }

  async checkGlobalUsageLimit(provider: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('check_global_usage_limit', {
      provider_name: provider
    });

    if (error) {
      console.error('Failed to check global usage limit:', error);
      return false;
    }

    return data;
  }

  // Helper functions
  getProviderDisplayName(provider: string): string {
    const names: Record<string, string> = {
      openai: 'OpenAI',
      openrouter: 'OpenRouter',
      gemini: 'Google Gemini',
      deepseek: 'DeepSeek',
      serper: 'Serper (Internet Search)',
      imagerouter: 'Imagerouter (Image Generation)',
      tavus: 'Tavus (AI Video Calls)',
      picaos: 'PicaOS (AI Orchestration)',
      elevenlabs: 'Eleven Labs (Text-to-Speech)'
    };
    return names[provider] || provider;
  }

  getProviderIcon(provider: string): string {
    const icons: Record<string, string> = {
      openai: '🤖',
      openrouter: '🔀',
      gemini: '💎',
      deepseek: '🔍',
      serper: '🌐',
      imagerouter: '🎨',
      tavus: '📹',
      picaos: '🤖',
      elevenlabs: '🔊'
    };
    return icons[provider] || '🔧';
  }

  getTierDisplayName(tier: string): string {
    const names: Record<string, string> = {
      tier1: 'Free',
      tier2: 'Pro'
    };
    return names[tier] || tier;
  }

  getUsagePercentage(current: number, limit: number | null): number {
    if (!limit) return 0;
    return Math.min((current / limit) * 100, 100);
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

export const globalApiService = new GlobalApiService();
import { supabase } from '../lib/supabase';
import { APISettings, ChatSession, ConversationTurn, ProviderStats, Message, ModelSettings } from '../types';

class DatabaseService {
  // API Settings
  async saveApiSettings(settings: APISettings) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const promises = Object.entries(settings).map(async ([provider, apiKey]) => {
      if (!apiKey) return;

      const { error } = await supabase
        .from('user_api_settings')
        .upsert({
          user_id: user.id,
          provider,
          api_key: apiKey,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,provider'
        });

      if (error) throw error;
    });

    await Promise.all(promises);
  }

  async saveModelSettings(settings: ModelSettings) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Store model settings as JSON in a single row
    const { error } = await supabase
      .from('user_api_settings')
      .upsert({
        user_id: user.id,
        provider: 'model_settings',
        api_key: JSON.stringify(settings),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,provider'
      });

    if (error) throw error;
  }

  async loadApiSettings(): Promise<APISettings> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { 
      openai: '', 
      openrouter: '', 
      gemini: '', 
      deepseek: ''
    };

    const { data, error } = await supabase
      .from('user_api_settings')
      .select('provider, api_key')
      .eq('user_id', user.id)
      .neq('provider', 'model_settings'); // Exclude model settings

    if (error) throw error;

    const settings: APISettings = {
      openai: '',
      openrouter: '',
      gemini: '',
      deepseek: ''
    };

    data?.forEach((setting) => {
      if (setting.provider in settings) {
        (settings as any)[setting.provider] = setting.api_key;
      }
    });

    return settings;
  }

  async loadModelSettings(): Promise<ModelSettings> {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Default settings for free tier users - don't preselect traditional models
    const defaultSettings: ModelSettings = {
      openai: false,
      gemini: false,
      deepseek: false,
      openrouter_models: {}
    };

    if (!user) return defaultSettings;

    const { data, error } = await supabase
      .from('user_api_settings')
      .select('api_key')
      .eq('user_id', user.id)
      .eq('provider', 'model_settings')
      .maybeSingle();

    if (error || !data) {
      // Return default settings if not found
      return defaultSettings;
    }

    try {
      const parsedSettings = JSON.parse(data.api_key);
      
      // Ensure all required properties exist and have proper defaults
      return {
        openai: parsedSettings.openai ?? false,
        gemini: parsedSettings.gemini ?? false,
        deepseek: parsedSettings.deepseek ?? false,
        openrouter_models: parsedSettings.openrouter_models ?? {}
      };
    } catch {
      // Return default settings if JSON parsing fails
      return defaultSettings;
    }
  }

  // Chat Sessions
  async createChatSession(title: string): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: user.id,
        title,
      })
      .select('id')
      .single();

    if (error) throw error;
    return data.id;
  }

  async loadChatSessions(): Promise<ChatSession[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // Return sessions without messages initially - they'll be loaded when selected
    return data.map(session => ({
      id: session.id,
      title: session.title,
      messages: [],
      createdAt: new Date(session.created_at),
      updatedAt: new Date(session.updated_at),
    }));
  }

  async loadSessionMessages(sessionId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('conversation_turns')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    const messages: Message[] = [];
    
    data.forEach((turn) => {
      // Add user message first
      messages.push({
        id: `user-${turn.id}`,
        content: turn.user_message,
        role: 'user',
        timestamp: new Date(turn.created_at),
        images: turn.user_images ? JSON.parse(turn.user_images) : undefined,
      });

      // Add selected AI response if available
      if (turn.selected_response && turn.selected_provider) {
        messages.push({
          id: `ai-${turn.id}`,
          content: turn.selected_response,
          role: 'assistant',
          timestamp: new Date(turn.created_at),
          provider: turn.selected_provider,
        });
      }
    });

    return messages;
  }

  async deleteChatSession(sessionId: string) {
    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) throw error;
  }

  async updateChatSession(sessionId: string, title: string) {
    const { error } = await supabase
      .from('chat_sessions')
      .update({
        title,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) throw error;
  }

  // Conversation Turns
  async saveConversationTurn(sessionId: string, turn: ConversationTurn) {
    const { error } = await supabase
      .from('conversation_turns')
      .insert({
        session_id: sessionId,
        user_message: turn.userMessage,
        selected_provider: turn.selectedResponse?.provider || null,
        selected_response: turn.selectedResponse?.content || null,
        user_images: turn.images ? JSON.stringify(turn.images) : null,
      });

    if (error) throw error;

    // Update session timestamp
    await supabase
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    // Update analytics
    if (turn.selectedResponse) {
      await this.updateProviderAnalytics(turn);
    }
  }

  // Analytics
  async updateProviderAnalytics(turn: ConversationTurn) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Update analytics for all providers that responded
    const promises = turn.responses.map(async (response) => {
      const { data: existing } = await supabase
        .from('provider_analytics')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', response.provider)
        .maybeSingle();

      const isSelected = response.provider === turn.selectedResponse?.provider;
      const hasError = !!response.error;

      if (existing) {
        const newTotalResponses = existing.total_responses + 1;
        const newTotalSelections = existing.total_selections + (isSelected ? 1 : 0);
        const newErrorCount = existing.error_count + (hasError ? 1 : 0);
        const newSelectionRate = (newTotalSelections / newTotalResponses) * 100;

        await supabase
          .from('provider_analytics')
          .update({
            total_responses: newTotalResponses,
            total_selections: newTotalSelections,
            error_count: newErrorCount,
            selection_rate: newSelectionRate,
            last_used: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('provider_analytics')
          .insert({
            user_id: user.id,
            provider: response.provider,
            total_responses: 1,
            total_selections: isSelected ? 1 : 0,
            error_count: hasError ? 1 : 0,
            selection_rate: isSelected ? 100 : 0,
            last_used: new Date().toISOString(),
          });
      }
    });

    await Promise.all(promises);
  }

  async loadProviderAnalytics(): Promise<ProviderStats[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('provider_analytics')
      .select('*')
      .eq('user_id', user.id)
      .order('selection_rate', { ascending: false });

    if (error) throw error;

    return data.map(analytics => ({
      provider: analytics.provider,
      totalSelections: analytics.total_selections,
      totalResponses: analytics.total_responses,
      selectionRate: analytics.selection_rate,
      avgResponseTime: 0, // Not tracked yet
      errorRate: analytics.total_responses > 0 ? analytics.error_count / analytics.total_responses : 0,
      lastUsed: new Date(analytics.last_used),
    }));
  }

  async clearAnalytics() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('provider_analytics')
      .delete()
      .eq('user_id', user.id);

    if (error) throw error;
  }
}

export const databaseService = new DatabaseService();
import { globalApiService } from './globalApiService';
import { UserTier } from '../types';

interface TavusConversationRequest {
  replica_id: string;
  conversation_name?: string;
  conversation_context?: string;
}

interface TavusConversationResponse {
  conversation_id: string;
  conversation_url: string;
  status: string;
}

class TavusService {
  private readonly REPLICA_ID = 'r79e1c033f';
  private readonly API_BASE_URL = 'https://tavusapi.com/v2';

  async createConversation(
    conversationName: string,
    conversationContext: string,
    userTier: UserTier = 'tier1'
  ): Promise<TavusConversationResponse> {
    // Get API key (personal or global)
    const apiKey = await this.getApiKey(userTier);
    
    if (!apiKey) {
      throw new Error('Tavus API key not available. Please configure it in settings or contact support for global key access.');
    }

    const requestBody: TavusConversationRequest = {
      replica_id: this.REPLICA_ID,
      conversation_name: conversationName,
      conversation_context: conversationContext
    };

    try {
      const response = await fetch(`${this.API_BASE_URL}/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Tavus API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Increment global usage if using global key
      const isGlobalKey = await this.isUsingGlobalKey(userTier);
      if (isGlobalKey) {
        await globalApiService.incrementGlobalUsage('tavus');
      }

      return data;
    } catch (error) {
      console.error('Tavus API error:', error);
      throw error;
    }
  }

  async getConversationStatus(conversationId: string, userTier: UserTier = 'tier1'): Promise<any> {
    const apiKey = await this.getApiKey(userTier);
    
    if (!apiKey) {
      throw new Error('Tavus API key not available.');
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/conversations/${conversationId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Tavus API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Tavus status check error:', error);
      throw error;
    }
  }

  private async getApiKey(userTier: UserTier): Promise<string | null> {
    // For now, we'll primarily use global keys since personal Tavus keys are less common
    // In a real implementation, you'd check for personal keys first
    
    try {
      const globalKey = await globalApiService.getGlobalApiKey('tavus', userTier);
      return globalKey;
    } catch (error) {
      console.error('Error accessing Tavus API key:', error);
      return null;
    }
  }

  private async isUsingGlobalKey(userTier: UserTier): Promise<boolean> {
    // For now, assume we're always using global keys for Tavus
    // In a real implementation, you'd check if user has personal key first
    return true;
  }

  // Helper method to validate conversation inputs
  validateConversationInputs(name: string, context: string): { isValid: boolean; error?: string } {
    if (!name || name.trim().length === 0) {
      return { isValid: false, error: 'Conversation name is required' };
    }

    if (!context || context.trim().length === 0) {
      return { isValid: false, error: 'Conversation context is required' };
    }

    if (name.length > 100) {
      return { isValid: false, error: 'Conversation name must be 100 characters or less' };
    }

    if (context.length > 1000) {
      return { isValid: false, error: 'Conversation context must be 1000 characters or less' };
    }

    return { isValid: true };
  }

  // Get replica information
  getReplicaInfo() {
    return {
      id: this.REPLICA_ID,
      name: 'ModelMix AI Assistant',
      description: 'AI video conversation assistant for ModelMix platform'
    };
  }
}

export const tavusService = new TavusService();
import { globalApiService } from './globalApiService';

interface TavusConversationResponse {
  conversation_id: string;
  conversation_url: string;
  status: string;
}

class TavusService {
  private readonly REPLICA_ID = 'r79e1c033f';

  async createConversation(conversationName: string, conversationContext: string): Promise<TavusConversationResponse> {
    // Get Tavus API key from global keys
    const apiKey = await globalApiService.getGlobalApiKey('tavus', 'tier2');
    
    if (!apiKey) {
      throw new Error('Tavus API key not available. Please contact support.');
    }

    try {
      const response = await fetch('https://tavusapi.com/v2/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({
          replica_id: this.REPLICA_ID,
          conversation_name: conversationName,
          conversation_context: conversationContext
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Tavus API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Increment global usage
      await globalApiService.incrementGlobalUsage('tavus');
      
      return data;
    } catch (error) {
      console.error('Tavus API error:', error);
      throw error;
    }
  }

  async getConversationStatus(conversationId: string): Promise<any> {
    const apiKey = await globalApiService.getGlobalApiKey('tavus', 'tier2');
    
    if (!apiKey) {
      throw new Error('Tavus API key not available');
    }

    try {
      const response = await fetch(`https://tavusapi.com/v2/conversations/${conversationId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get conversation status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get conversation status:', error);
      throw error;
    }
  }
}

export const tavusService = new TavusService();
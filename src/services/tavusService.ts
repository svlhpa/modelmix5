interface TavusConversation {
  conversation_id: string;
  conversation_url: string;
  status: string;
  created_at: string;
}

interface TavusConversationRequest {
  replica_id: string;
  conversation_name?: string;
  conversational_context?: string;
  callback_url?: string;
}

class TavusService {
  private apiKey: string = '';
  private readonly baseUrl = 'https://tavusapi.com/v2';
  private readonly defaultReplicaId = 'r79e1c033f'; // Your provided replica ID

  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createConversation(
    conversationName: string,
    conversationalContext: string,
    replicaId?: string
  ): Promise<TavusConversation> {
    if (!this.apiKey) {
      throw new Error('Tavus API key not configured. Please contact admin.');
    }

    const requestBody: TavusConversationRequest = {
      replica_id: replicaId || this.defaultReplicaId,
      conversation_name: conversationName,
      conversational_context: conversationalContext
    };

    try {
      const response = await fetch(`${this.baseUrl}/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || 
          `Tavus API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Tavus conversation creation failed:', error);
      throw error;
    }
  }

  async getConversation(conversationId: string): Promise<TavusConversation> {
    if (!this.apiKey) {
      throw new Error('Tavus API key not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/conversations/${conversationId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get conversation: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get Tavus conversation:', error);
      throw error;
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    if (!this.apiKey) {
      throw new Error('Tavus API key not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete conversation: ${response.status}`);
      }
    } catch (error) {
      console.error('Failed to delete Tavus conversation:', error);
      throw error;
    }
  }

  // Check if Tavus is properly configured
  isConfigured(): boolean {
    return this.apiKey.trim() !== '';
  }

  // Get available replica IDs (you can expand this list)
  getAvailableReplicas(): Array<{ id: string; name: string; description: string }> {
    return [
      {
        id: 'r79e1c033f',
        name: 'Default Avatar',
        description: 'Professional AI assistant avatar'
      },
      {
        id: 'rb17cf590e15',
        name: 'Alternative Avatar',
        description: 'Friendly conversational avatar'
      }
    ];
  }
}

export const tavusService = new TavusService();
export type { TavusConversation, TavusConversationRequest };
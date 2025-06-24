import { elevenLabsService } from './elevenLabsService';
import { UserTier } from '../types';

interface VoiceAgent {
  id: string;
  name: string;
  description: string;
  voiceId: string;
  avatar: string;
  personality: string;
}

interface VoiceSettings {
  stability: number;
  clarity: number;
  style: number;
}

class VoiceChatService {
  private readonly SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
  private readonly EDGE_FUNCTION_URL = `${this.SUPABASE_URL}/functions/v1/voice-chat`;
  private readonly AGENTS: VoiceAgent[] = [
    {
      id: 'support-agent',
      name: 'Alexis',
      description: 'A dedicated support agent who is always ready to resolve any issues.',
      voiceId: 'pNInz6obpgDQGcFmaJgB',
      avatar: 'https://images.pexels.com/photos/5876695/pexels-photo-5876695.jpeg?auto=compress&cs=tinysrgb&w=150',
      personality: 'Helpful, patient, and knowledgeable'
    },
    {
      id: 'mindfulness-coach',
      name: 'Joe',
      description: 'A mindfulness coach who helps you find calm and clarity.',
      voiceId: 'ErXwobaYiN019PkySvjV',
      avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150',
      personality: 'Calm, insightful, and encouraging'
    },
    {
      id: 'sales-agent',
      name: 'Harper',
      description: 'A sales agent who showcases how ElevenLabs can transform your business.',
      voiceId: 'jBpfuIE2acCO8z3wKNLl',
      avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150',
      personality: 'Enthusiastic, knowledgeable, and persuasive'
    },
    {
      id: 'wizard',
      name: 'Calum',
      description: 'A mysterious wizard who offers ancient wisdom to aid you on your journey.',
      voiceId: 'XrExE9yKIg1WjnnlVkGX',
      avatar: 'https://images.pexels.com/photos/2379005/pexels-photo-2379005.jpeg?auto=compress&cs=tinysrgb&w=150',
      personality: 'Wise, mysterious, and philosophical'
    }
  ];

  getAvailableAgents(): VoiceAgent[] {
    return this.AGENTS;
  }

  async textToSpeech(
    text: string,
    voiceId: string,
    userTier: UserTier = 'tier1',
    voiceSettings?: VoiceSettings
  ): Promise<Blob> {
    try {
      // Call the Eleven Labs service
      return await elevenLabsService.textToSpeech(
        text,
        voiceId,
        userTier,
        voiceSettings
      );
    } catch (error) {
      console.error('Failed to convert text to speech:', error);
      throw error;
    }
  }

  async streamTextToSpeech(
    text: string,
    voiceId: string,
    userTier: UserTier = 'tier1',
    voiceSettings?: VoiceSettings,
    onChunk?: (audioChunk: Uint8Array) => void,
    onFinish?: () => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    try {
      // Call the Eleven Labs service with streaming
      await elevenLabsService.streamTextToSpeech(
        text,
        voiceId,
        userTier,
        voiceSettings,
        onChunk,
        onFinish,
        onError
      );
    } catch (error) {
      console.error('Failed to stream text to speech:', error);
      throw error;
    }
  }

  async speechToText(audioBlob: Blob, userTier: UserTier = 'tier1'): Promise<string> {
    try {
      // Call the Eleven Labs service
      return await elevenLabsService.speechToText(audioBlob, userTier);
    } catch (error) {
      console.error('Failed to convert speech to text:', error);
      throw error;
    }
  }

  async generateAIResponse(
    userMessage: string,
    agentId: string,
    agentName: string,
    userTier: UserTier = 'tier1'
  ): Promise<string> {
    try {
      // In a real implementation, this would call the edge function
      // For now, we'll generate a simple response based on the agent
      const responses: Record<string, string[]> = {
        'support-agent': [
          `I understand your concern about "${userMessage}". Let me help you resolve this issue.`,
          `That's a great question about "${userMessage}". Here's what you need to know...`,
          `I'm here to help you with "${userMessage}". Let's work through this together.`
        ],
        'mindfulness-coach': [
          `Take a deep breath. Let's approach "${userMessage}" mindfully.`,
          `I hear what you're saying about "${userMessage}". Let's explore how to bring more clarity to this situation.`,
          `"${userMessage}" is a common challenge. Here's a mindfulness technique that might help...`
        ],
        'sales-agent': [
          `That's a great point about "${userMessage}"! Our voice technology can definitely help with that.`,
          `Many of our customers have had similar questions about "${userMessage}". Here's how our solution addresses that need...`,
          `I'd be happy to explain how our platform can transform "${userMessage}" for you.`
        ],
        'wizard': [
          `Ah, "${userMessage}" is an interesting quest indeed. The ancient scrolls speak of such matters...`,
          `The path of "${userMessage}" requires wisdom. Let me share what the stars have revealed...`,
          `Many have walked the road of "${userMessage}" before you. Here's what the mystical realms suggest...`
        ]
      };
      
      const agentResponses = responses[agentId] || responses['support-agent'];
      return agentResponses[Math.floor(Math.random() * agentResponses.length)];
    } catch (error) {
      console.error('Failed to generate AI response:', error);
      throw error;
    }
  }

  // Create a function to handle real-time voice chat
  async setupRealTimeVoiceChat(
    agentId: string,
    voiceId: string,
    userTier: UserTier = 'tier1',
    voiceSettings?: VoiceSettings,
    onMessage?: (message: string) => void,
    onAudioChunk?: (audioChunk: Uint8Array) => void,
    onError?: (error: Error) => void
  ): Promise<{
    sendMessage: (text: string) => Promise<void>;
    sendAudio: (audioBlob: Blob) => Promise<void>;
    disconnect: () => void;
  }> {
    try {
      // In a real implementation, this would set up a WebSocket connection
      // For now, we'll return a simple interface that simulates real-time chat
      
      return {
        sendMessage: async (text: string) => {
          try {
            // Generate AI response
            const response = await this.generateAIResponse(text, agentId, this.AGENTS.find(a => a.id === agentId)?.name || 'AI', userTier);
            
            if (onMessage) {
              onMessage(response);
            }
            
            // Generate speech
            await this.streamTextToSpeech(
              response,
              voiceId,
              userTier,
              voiceSettings,
              onAudioChunk,
              undefined,
              onError
            );
          } catch (error) {
            console.error('Error sending message:', error);
            if (onError) {
              onError(error instanceof Error ? error : new Error('Unknown error'));
            }
          }
        },
        
        sendAudio: async (audioBlob: Blob) => {
          try {
            // Convert speech to text
            const text = await this.speechToText(audioBlob, userTier);
            
            if (onMessage) {
              onMessage(text);
            }
            
            // Generate AI response
            const response = await this.generateAIResponse(text, agentId, this.AGENTS.find(a => a.id === agentId)?.name || 'AI', userTier);
            
            if (onMessage) {
              onMessage(response);
            }
            
            // Generate speech
            await this.streamTextToSpeech(
              response,
              voiceId,
              userTier,
              voiceSettings,
              onAudioChunk,
              undefined,
              onError
            );
          } catch (error) {
            console.error('Error sending audio:', error);
            if (onError) {
              onError(error instanceof Error ? error : new Error('Unknown error'));
            }
          }
        },
        
        disconnect: () => {
          // In a real implementation, this would close the WebSocket connection
          console.log('Disconnected from voice chat');
        }
      };
    } catch (error) {
      console.error('Failed to set up real-time voice chat:', error);
      throw error;
    }
  }
}

export const voiceChatService = new VoiceChatService();
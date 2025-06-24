import { globalApiService } from './globalApiService';
import { UserTier } from '../types';

interface VoiceSettings {
  elevenLabsApiKey: string;
  voiceId: string;
  model: string;
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
}

class VoiceLabsService {
  private readonly API_BASE_URL = 'https://api.elevenlabs.io/v1';
  private readonly WEBSOCKET_URL = 'wss://api.elevenlabs.io/v1/speech-to-speech/stream';

  // Get API key (personal or global)
  async getApiKey(userTier: UserTier, personalKey?: string): Promise<string | null> {
    // First try personal key if provided
    if (personalKey && personalKey.trim() !== '') {
      return personalKey;
    }
    
    // Fall back to global key
    try {
      const globalKey = await globalApiService.getGlobalApiKey('elevenlabs', userTier);
      return globalKey;
    } catch (error) {
      console.error('Error accessing ElevenLabs API key:', error);
      return null;
    }
  }

  // Validate API key
  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/user`, {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Failed to validate ElevenLabs API key:', error);
      return false;
    }
  }

  // Get available voices
  async getVoices(apiKey: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/voices`, {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get voices: ${response.status}`);
      }

      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      console.error('Failed to get ElevenLabs voices:', error);
      return [];
    }
  }

  // Get available models
  async getModels(apiKey: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/models`, {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get models: ${response.status}`);
      }

      const data = await response.json();
      return data || [];
    } catch (error) {
      console.error('Failed to get ElevenLabs models:', error);
      return [];
    }
  }

  // Create WebSocket connection for real-time speech-to-speech
  createSpeechToSpeechConnection(
    apiKey: string, 
    settings: VoiceSettings,
    onTranscript: (text: string, isFinal: boolean) => void,
    onAiResponse: (text: string) => void,
    onAudioChunk: (audioData: ArrayBuffer) => void,
    onError: (error: string) => void
  ): WebSocket {
    // In a real implementation, this would connect to your backend WebSocket server
    // which would handle the ElevenLabs API calls
    
    // For now, we'll create a simulated WebSocket
    const ws = new WebSocket('wss://echo.websocket.org/');
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      
      // Send initial configuration
      ws.send(JSON.stringify({
        type: 'config',
        apiKey,
        voiceId: settings.voiceId,
        modelId: settings.model,
        stability: settings.stability,
        similarityBoost: settings.similarityBoost,
        style: settings.style,
        useSpeakerBoost: settings.useSpeakerBoost
      }));
    };
    
    ws.onmessage = (event) => {
      // In a real implementation, this would handle messages from your backend
      // For now, we'll simulate responses
      
      try {
        // Echo back the message for simulation
        const message = JSON.parse(event.data);
        
        if (message.type === 'audio_data') {
          // Simulate transcript generation
          setTimeout(() => {
            const simulatedTranscript = "This is a simulated transcript of what you said.";
            onTranscript(simulatedTranscript, true);
            
            // Simulate AI response
            setTimeout(() => {
              const simulatedResponse = "This is a simulated AI response to your message.";
              onAiResponse(simulatedResponse);
              
              // Simulate audio chunks
              // In a real implementation, these would be actual audio data from ElevenLabs
              const simulatedAudioChunk = new ArrayBuffer(1024);
              onAudioChunk(simulatedAudioChunk);
            }, 1000);
          }, 500);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      onError('WebSocket connection error');
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };
    
    return ws;
  }

  // Get user subscription info
  async getUserSubscription(apiKey: string): Promise<any> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/user/subscription`, {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get subscription: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get ElevenLabs subscription:', error);
      return null;
    }
  }

  // Get remaining character count
  async getRemainingCharacters(apiKey: string): Promise<number> {
    try {
      const subscription = await this.getUserSubscription(apiKey);
      return subscription?.character_count || 0;
    } catch (error) {
      console.error('Failed to get remaining characters:', error);
      return 0;
    }
  }

  // Increment global usage
  async incrementGlobalUsage(): Promise<void> {
    try {
      await globalApiService.incrementGlobalUsage('elevenlabs');
    } catch (error) {
      console.error('Failed to increment global usage:', error);
    }
  }
}

export const voiceLabsService = new VoiceLabsService();
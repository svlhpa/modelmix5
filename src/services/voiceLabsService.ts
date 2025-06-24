import { globalApiService } from './globalApiService';
import { UserTier } from '../types';

class VoiceLabsService {
  private readonly API_BASE_URL = 'wss://api.modelmix.app/voice-labs';
  private readonly FALLBACK_URL = 'wss://echo.websocket.org'; // Fallback for testing

  // Get WebSocket URL for voice connection
  getWebSocketUrl(): string {
    // In a production environment, this would be a real WebSocket endpoint
    // For now, we'll use a placeholder that will be replaced by the real endpoint
    return this.API_BASE_URL;
  }

  // Get available voices from ElevenLabs
  async getAvailableVoices(userTier: UserTier = 'tier1'): Promise<any[]> {
    try {
      const apiKey = await this.getElevenLabsApiKey(userTier);
      
      if (!apiKey) {
        throw new Error('ElevenLabs API key not available');
      }

      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
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

  // Get ElevenLabs API key (from global keys)
  async getElevenLabsApiKey(userTier: UserTier): Promise<string | null> {
    try {
      const apiKey = await globalApiService.getGlobalApiKey('elevenlabs', userTier);
      return apiKey;
    } catch (error) {
      console.error('Failed to get ElevenLabs API key:', error);
      return null;
    }
  }

  // Get OpenAI Whisper API key (from global keys)
  async getWhisperApiKey(userTier: UserTier): Promise<string | null> {
    try {
      const apiKey = await globalApiService.getGlobalApiKey('openai_whisper', userTier);
      return apiKey;
    } catch (error) {
      console.error('Failed to get Whisper API key:', error);
      return null;
    }
  }

  // Test connection to voice services
  async testConnection(userTier: UserTier = 'tier1'): Promise<{
    elevenlabs: boolean;
    whisper: boolean;
    websocket: boolean;
  }> {
    const [elevenLabsKey, whisperKey] = await Promise.all([
      this.getElevenLabsApiKey(userTier),
      this.getWhisperApiKey(userTier)
    ]);

    // Test WebSocket connection
    let websocketOk = false;
    try {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(this.FALLBACK_URL);
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('WebSocket connection timeout'));
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          ws.close();
          resolve();
        };

        ws.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };
      });
      websocketOk = true;
    } catch (error) {
      console.error('WebSocket test failed:', error);
    }

    return {
      elevenlabs: !!elevenLabsKey,
      whisper: !!whisperKey,
      websocket: websocketOk
    };
  }

  // Get voice settings presets
  getVoicePresets() {
    return {
      natural: {
        stability: 0.5,
        similarityBoost: 0.75,
        style: 0.0,
        useSpeakerBoost: true
      },
      expressive: {
        stability: 0.3,
        similarityBoost: 0.8,
        style: 0.7,
        useSpeakerBoost: true
      },
      consistent: {
        stability: 0.8,
        similarityBoost: 0.5,
        style: 0.0,
        useSpeakerBoost: false
      }
    };
  }

  // Get default voice for a given character
  getDefaultVoice(character: string): string {
    const voiceMap: Record<string, string> = {
      'alexis': 'rachel',
      'joe': 'dave',
      'harper': 'domi',
      'calum': 'clyde'
    };
    
    return voiceMap[character.toLowerCase()] || 'rachel';
  }
}

export const voiceLabsService = new VoiceLabsService();
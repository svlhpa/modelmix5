import { globalApiService } from './globalApiService';
import { UserTier } from '../types';

class VoiceLabsService {
  private readonly API_BASE_URL = 'https://api.elevenlabs.io/v1';

  // Get WebSocket URL for voice connection
  getWebSocketUrl(): string {
    // Use the Supabase Edge Function URL
    return `${import.meta.env.VITE_SUPABASE_URL.replace('https://', 'wss://')}/functions/v1/voice-labs`;
  }

  // Get available voices from ElevenLabs
  async getAvailableVoices(apiKey: string): Promise<any[]> {
    try {
      if (!apiKey) {
        throw new Error('ElevenLabs API key not available');
      }

      const response = await fetch(`${this.API_BASE_URL}/voices`, {
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
      // First try dedicated whisper key
      let apiKey = await globalApiService.getGlobalApiKey('openai_whisper', userTier);
      
      // If not available, fall back to regular OpenAI key
      if (!apiKey) {
        apiKey = await globalApiService.getGlobalApiKey('openai', userTier);
      }
      
      return apiKey;
    } catch (error) {
      console.error('Failed to get Whisper API key:', error);
      return null;
    }
  }

  // Check if ElevenLabs is available
  async isElevenLabsAvailable(userTier: UserTier = 'tier1'): Promise<boolean> {
    const apiKey = await this.getElevenLabsApiKey(userTier);
    return !!apiKey;
  }

  // Text to speech using ElevenLabs API
  async textToSpeech(text: string, voiceId: string, apiKey: string, voiceSettings: any): Promise<ArrayBuffer> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: voiceSettings.stability,
            similarity_boost: voiceSettings.similarityBoost,
            style: voiceSettings.style,
            use_speaker_boost: voiceSettings.useSpeakerBoost
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate speech: ${response.status}`);
      }

      return await response.arrayBuffer();
    } catch (error) {
      console.error('Failed to generate speech:', error);
      throw error;
    }
  }

  // Speech to text using ElevenLabs API
  async speechToText(audioBlob: Blob, apiKey: string): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob);
      formData.append('model_id', 'whisper-1');

      const response = await fetch(`${this.API_BASE_URL}/speech-to-text`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Failed to transcribe speech: ${response.status}`);
      }

      const data = await response.json();
      return data.text || '';
    } catch (error) {
      console.error('Failed to transcribe speech:', error);
      throw error;
    }
  }

  // Get voice ID from voice name
  getVoiceId(voiceName: string): string {
    const voiceIds: Record<string, string> = {
      'rachel': '21m00Tcm4TlvDq8ikWAM',
      'drew': 'jsCqWAovK2LkecY7zXl4',
      'clyde': '2EiwWnXFnvU5JabPnv8n',
      'paul': 'onwK4e9ZLuTAKqWW03F9',
      'domi': 'AZnzlk1XvdvUeBnXmlld',
      'dave': 'CYw3kZ02Hs0563khs1Fj'
    };
    
    return voiceIds[voiceName.toLowerCase()] || '21m00Tcm4TlvDq8ikWAM'; // Default to Rachel
  }
}

export const voiceLabsService = new VoiceLabsService();
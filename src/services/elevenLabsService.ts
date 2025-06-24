import { globalApiService } from './globalApiService';
import { UserTier } from '../types';

interface TextToSpeechRequest {
  text: string;
  voice_id: string;
  model_id?: string;
  voice_settings?: {
    stability: number;
    similarity_boost: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
}

interface SpeechToTextRequest {
  audio: Blob;
}

class ElevenLabsService {
  private readonly API_BASE_URL = 'https://api.elevenlabs.io/v1';
  private readonly DEFAULT_MODEL = 'eleven_turbo_v2';

  async getApiKey(userTier: UserTier = 'tier1'): Promise<string | null> {
    try {
      // Try to get global API key
      const globalKey = await globalApiService.getGlobalApiKey('elevenlabs', userTier);
      return globalKey;
    } catch (error) {
      console.error('Error accessing Eleven Labs API key:', error);
      return null;
    }
  }

  async getAvailableVoices(userTier: UserTier = 'tier1'): Promise<any[]> {
    const apiKey = await this.getApiKey(userTier);
    
    if (!apiKey) {
      throw new Error('Eleven Labs API key not available. Please configure it in settings or contact support for global key access.');
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/voices`, {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get voices: ${response.status}`);
      }

      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      console.error('Failed to get Eleven Labs voices:', error);
      throw error;
    }
  }

  async textToSpeech(
    text: string,
    voiceId: string,
    userTier: UserTier = 'tier1',
    voiceSettings?: {
      stability: number;
      clarity: number;
      style: number;
    }
  ): Promise<string> {
    const apiKey = await this.getApiKey(userTier);
    
    if (!apiKey) {
      throw new Error('Eleven Labs API key not available. Please configure it in settings or contact support for global key access.');
    }

    try {
      const request: TextToSpeechRequest = {
        text,
        voice_id: voiceId,
        model_id: this.DEFAULT_MODEL,
        voice_settings: {
          stability: voiceSettings?.stability || 0.5,
          similarity_boost: voiceSettings?.clarity || 0.75,
          style: voiceSettings?.style || 0.5,
          use_speaker_boost: true
        }
      };

      const response = await fetch(`${this.API_BASE_URL}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`Failed to convert text to speech: ${response.status}`);
      }

      // In a real implementation, we would process the audio blob
      // For now, we'll return a placeholder URL
      return 'https://example.com/audio.mp3';
    } catch (error) {
      console.error('Failed to convert text to speech:', error);
      throw error;
    }
  }

  async speechToText(audioBlob: Blob, userTier: UserTier = 'tier1'): Promise<string> {
    // For speech-to-text, we'll use OpenAI Whisper through our global API key
    const apiKey = await globalApiService.getGlobalApiKey('openai_whisper', userTier);
    
    if (!apiKey) {
      throw new Error('Speech-to-text API key not available. Please contact support.');
    }

    try {
      // In a real implementation, we would call the OpenAI Whisper API
      // For now, we'll return a placeholder text
      return "This is a simulated transcription of the audio.";
    } catch (error) {
      console.error('Failed to convert speech to text:', error);
      throw error;
    }
  }

  // Get usage information
  async getUsage(userTier: UserTier = 'tier1'): Promise<any> {
    const apiKey = await this.getApiKey(userTier);
    
    if (!apiKey) {
      throw new Error('Eleven Labs API key not available.');
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/user/subscription`, {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get usage: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get Eleven Labs usage:', error);
      throw error;
    }
  }

  // Test if API key is valid
  async testApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/voices`, {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Eleven Labs API key test failed:', error);
      return false;
    }
  }
}

export const elevenLabsService = new ElevenLabsService();
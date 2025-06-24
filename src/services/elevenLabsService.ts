import { globalApiService } from './globalApiService';
import { UserTier } from '../types';

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  preview_url?: string;
  labels?: Record<string, string>;
}

interface ElevenLabsModel {
  model_id: string;
  name: string;
  can_be_finetuned: boolean;
  can_do_text_to_speech: boolean;
  can_do_voice_conversion: boolean;
  can_use_speaker_boost: boolean;
  serves_pro_voices: boolean;
  token_cost_factor: number;
  description?: string;
  requires_alpha_access?: boolean;
  max_characters_request_free_user: number;
  max_characters_request_subscribed_user: number;
}

interface TTSRequest {
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

class ElevenLabsService {
  private readonly API_BASE_URL = 'https://api.elevenlabs.io/v1';

  // Get API key (personal or global)
  private async getApiKey(userTier: UserTier = 'tier1'): Promise<{ key: string | null; isGlobal: boolean }> {
    try {
      // Try to get personal API key first
      const personalKey = await globalApiService.getGlobalApiKey('elevenlabs', userTier);
      if (personalKey && personalKey.trim() !== '') {
        console.log('Using personal Eleven Labs API key');
        return { key: personalKey, isGlobal: false };
      }

      // Try to get global key
      const globalKey = await globalApiService.getGlobalApiKey('elevenlabs', userTier);
      if (globalKey && globalKey.trim() !== '') {
        console.log('Using global Eleven Labs API key');
        return { key: globalKey, isGlobal: true };
      }
    } catch (error) {
      console.error('Error accessing Eleven Labs API key:', error);
    }

    console.log('No Eleven Labs API key available');
    return { key: null, isGlobal: false };
  }

  // Get available voices
  async getVoices(userTier: UserTier = 'tier1'): Promise<ElevenLabsVoice[]> {
    const { key: apiKey, isGlobal } = await this.getApiKey(userTier);
    
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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail?.message || `Eleven Labs API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Increment global usage if using global key
      if (isGlobal) {
        await globalApiService.incrementGlobalUsage('elevenlabs');
      }

      return data.voices || [];
    } catch (error) {
      console.error('Failed to fetch Eleven Labs voices:', error);
      throw error;
    }
  }

  // Get available models
  async getModels(userTier: UserTier = 'tier1'): Promise<ElevenLabsModel[]> {
    const { key: apiKey, isGlobal } = await this.getApiKey(userTier);
    
    if (!apiKey) {
      throw new Error('Eleven Labs API key not available. Please configure it in settings or contact support for global key access.');
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/models`, {
        method: 'GET',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail?.message || `Eleven Labs API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Increment global usage if using global key
      if (isGlobal) {
        await globalApiService.incrementGlobalUsage('elevenlabs');
      }

      return data || [];
    } catch (error) {
      console.error('Failed to fetch Eleven Labs models:', error);
      throw error;
    }
  }

  // Convert text to speech
  async textToSpeech(
    request: TTSRequest,
    userTier: UserTier = 'tier1',
    signal?: AbortSignal
  ): Promise<Blob> {
    const { key: apiKey, isGlobal } = await this.getApiKey(userTier);
    
    if (!apiKey) {
      throw new Error('Eleven Labs API key not available. Please configure it in settings or contact support for global key access.');
    }

    // Default voice settings if not provided
    const voiceSettings = request.voice_settings || {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0,
      use_speaker_boost: true
    };

    // Default model if not provided
    const modelId = request.model_id || 'eleven_monolingual_v1';

    try {
      const response = await fetch(`${this.API_BASE_URL}/text-to-speech/${request.voice_id}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: request.text,
          model_id: modelId,
          voice_settings: voiceSettings
        }),
        signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail?.message || `Eleven Labs API error: ${response.status}`);
      }

      // Increment global usage if using global key
      if (isGlobal) {
        await globalApiService.incrementGlobalUsage('elevenlabs');
      }

      return await response.blob();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      console.error('Failed to generate speech:', error);
      throw error;
    }
  }

  // Get default voices for quick setup
  getDefaultVoices(): Array<{ id: string; name: string; description: string }> {
    return [
      {
        id: 'pNInz6obpgDQGcFmaJgB', // Adam
        name: 'Adam',
        description: 'Deep, authoritative male voice'
      },
      {
        id: 'EXAVITQu4vr4xnSDxMaL', // Bella
        name: 'Bella',
        description: 'Warm, friendly female voice'
      },
      {
        id: 'VR6AewLTigWG4xSOukaG', // Arnold
        name: 'Arnold',
        description: 'Strong, confident male voice'
      },
      {
        id: 'MF3mGyEYCl7XYWbV9V6O', // Elli
        name: 'Elli',
        description: 'Young, energetic female voice'
      },
      {
        id: 'TxGEqnHWrfWFTfGW9XjX', // Josh
        name: 'Josh',
        description: 'Casual, conversational male voice'
      }
    ];
  }

  // Create audio URL from blob
  createAudioUrl(audioBlob: Blob): string {
    return URL.createObjectURL(audioBlob);
  }

  // Clean up audio URL
  revokeAudioUrl(url: string): void {
    URL.revokeObjectURL(url);
  }

  // Check if TTS is available
  async isAvailable(userTier: UserTier = 'tier1'): Promise<boolean> {
    try {
      const { key } = await this.getApiKey(userTier);
      return !!key;
    } catch (error) {
      return false;
    }
  }

  // Get character limits based on subscription
  getCharacterLimits(): { free: number; subscribed: number } {
    return {
      free: 10000, // 10k characters per month for free users
      subscribed: 500000 // 500k characters per month for subscribed users
    };
  }

  // Validate text length
  validateTextLength(text: string, isSubscribed: boolean = false): { isValid: boolean; error?: string } {
    const limits = this.getCharacterLimits();
    const maxLength = isSubscribed ? limits.subscribed : limits.free;
    
    if (text.length === 0) {
      return { isValid: false, error: 'Text cannot be empty' };
    }
    
    if (text.length > 5000) { // Per-request limit
      return { isValid: false, error: 'Text is too long. Maximum 5000 characters per request.' };
    }
    
    return { isValid: true };
  }
}

export const elevenLabsService = new ElevenLabsService();
export type { ElevenLabsVoice, ElevenLabsModel, TTSRequest };
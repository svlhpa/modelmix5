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
  stream?: boolean;
}

interface SpeechToTextRequest {
  audio: Blob;
}

class ElevenLabsService {
  private readonly API_BASE_URL = 'https://api.elevenlabs.io/v1';
  private readonly DEFAULT_MODEL = 'eleven_turbo_v2';
  private readonly STREAMING_MODEL = 'eleven_monolingual_v1';

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
  ): Promise<Blob> {
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

      // Increment global usage if using global key
      const isGlobalKey = !(await this.isUsingPersonalKey(userTier));
      if (isGlobalKey) {
        await globalApiService.incrementGlobalUsage('elevenlabs');
      }

      return await response.blob();
    } catch (error) {
      console.error('Failed to convert text to speech:', error);
      throw error;
    }
  }

  async streamTextToSpeech(
    text: string,
    voiceId: string,
    userTier: UserTier = 'tier1',
    voiceSettings?: {
      stability: number;
      clarity: number;
      style: number;
    },
    onChunk?: (audioChunk: Uint8Array) => void,
    onFinish?: () => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    const apiKey = await this.getApiKey(userTier);
    
    if (!apiKey) {
      throw new Error('Eleven Labs API key not available. Please configure it in settings or contact support for global key access.');
    }

    try {
      const request: TextToSpeechRequest = {
        text,
        voice_id: voiceId,
        model_id: this.STREAMING_MODEL, // Use streaming-optimized model
        voice_settings: {
          stability: voiceSettings?.stability || 0.5,
          similarity_boost: voiceSettings?.clarity || 0.75,
          style: voiceSettings?.style || 0.5,
          use_speaker_boost: true
        },
        stream: true
      };

      const response = await fetch(`${this.API_BASE_URL}/text-to-speech/${voiceId}/stream`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw new Error(`Failed to stream text to speech: ${response.status}`);
      }

      // Increment global usage if using global key
      const isGlobalKey = !(await this.isUsingPersonalKey(userTier));
      if (isGlobalKey) {
        await globalApiService.incrementGlobalUsage('elevenlabs');
      }

      // Process the streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      // Read chunks
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Process chunk
        if (value && onChunk) {
          onChunk(value);
        }
      }

      // Finished
      if (onFinish) {
        onFinish();
      }
    } catch (error) {
      console.error('Failed to stream text to speech:', error);
      if (onError) {
        onError(error instanceof Error ? error : new Error('Unknown error'));
      }
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
      // Create form data
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'whisper-1');
      
      // Call OpenAI Whisper API
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Failed to transcribe audio: ${response.status}`);
      }

      const data = await response.json();
      
      // Increment global usage
      await globalApiService.incrementGlobalUsage('openai_whisper');
      
      return data.text || '';
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

  // Check if using personal key
  private async isUsingPersonalKey(userTier: UserTier): Promise<boolean> {
    // This would check if the user has a personal key configured
    // For now, we'll assume all keys are global
    return false;
  }
}

export const elevenLabsService = new ElevenLabsService();
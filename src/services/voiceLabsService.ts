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

  // Text-to-speech API call
  async textToSpeech(
    text: string,
    apiKey: string,
    voiceId: string,
    model: string,
    stability: number,
    similarityBoost: number,
    style: number,
    useSpeakerBoost: boolean
  ): Promise<ArrayBuffer | null> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          model_id: model,
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            style,
            use_speaker_boost: useSpeakerBoost
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate speech: ${response.status}`);
      }

      return await response.arrayBuffer();
    } catch (error) {
      console.error('Failed to generate speech:', error);
      return null;
    }
  }

  // Speech-to-text API call (using OpenAI Whisper via ElevenLabs)
  async speechToText(audioBlob: Blob, apiKey: string): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.wav');
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
      return data.text || null;
    } catch (error) {
      console.error('Failed to transcribe speech:', error);
      return null;
    }
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

  // Convert audio buffer to WAV format
  convertToWav(buffer: Float32Array, sampleRate: number): Blob {
    // Function to convert audio buffer to WAV format
    // This is a simplified implementation
    const numChannels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = buffer.length * bytesPerSample;
    const bufferSize = 44 + dataSize;
    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');

    // FMT sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // Data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write the PCM samples
    const offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      const sample = Math.max(-1, Math.min(1, buffer[i]));
      view.setInt16(offset + i * bytesPerSample, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    }

    return new Blob([view], { type: 'audio/wav' });

    function writeString(view: DataView, offset: number, string: string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }
  }
}

export const voiceLabsService = new VoiceLabsService();
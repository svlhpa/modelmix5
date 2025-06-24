import { globalApiService } from './globalApiService';
import { UserTier } from '../types';

class WhisperService {
  private readonly API_URL = 'https://api.openai.com/v1/audio/transcriptions';

  // Get API key (personal or global)
  private async getApiKey(userTier: UserTier = 'tier1'): Promise<{ key: string | null; isGlobal: boolean }> {
    try {
      // Try to get personal API key first (using OpenAI key)
      const personalKey = await globalApiService.getGlobalApiKey('openai', userTier);
      if (personalKey && personalKey.trim() !== '') {
        console.log('Using personal OpenAI API key for Whisper');
        return { key: personalKey, isGlobal: false };
      }

      // Try to get dedicated Whisper key
      const whisperKey = await globalApiService.getGlobalApiKey('openai_whisper', userTier);
      if (whisperKey && whisperKey.trim() !== '') {
        console.log('Using global Whisper API key');
        return { key: whisperKey, isGlobal: true };
      }
    } catch (error) {
      console.error('Error accessing Whisper API key:', error);
    }

    console.log('No Whisper API key available');
    return { key: null, isGlobal: false };
  }

  // Transcribe audio to text
  async transcribeAudio(
    audioBlob: Blob,
    language: string = 'en',
    userTier: UserTier = 'tier1'
  ): Promise<string> {
    const { key: apiKey, isGlobal } = await this.getApiKey(userTier);
    
    if (!apiKey) {
      throw new Error('Whisper API key not available. Please configure an OpenAI API key in settings or contact support for global key access.');
    }

    // Create form data
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', language);
    formData.append('response_format', 'json');

    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Whisper API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Increment global usage if using global key
      if (isGlobal) {
        await globalApiService.incrementGlobalUsage('openai_whisper');
      }

      return data.text || '';
    } catch (error) {
      console.error('Failed to transcribe audio:', error);
      throw error;
    }
  }

  // Check if speech-to-text is available
  async isAvailable(userTier: UserTier = 'tier1'): Promise<boolean> {
    try {
      const { key } = await this.getApiKey(userTier);
      return !!key;
    } catch (error) {
      return false;
    }
  }

  // Get supported languages
  getSupportedLanguages(): Array<{ code: string; name: string }> {
    return [
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'nl', name: 'Dutch' },
      { code: 'ja', name: 'Japanese' },
      { code: 'zh', name: 'Chinese' },
      { code: 'ru', name: 'Russian' },
      { code: 'ar', name: 'Arabic' },
      { code: 'hi', name: 'Hindi' },
      { code: 'ko', name: 'Korean' }
    ];
  }
}

export const whisperService = new WhisperService();
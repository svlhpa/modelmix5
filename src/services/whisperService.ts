import { globalApiService } from './globalApiService';
import { UserTier } from '../types';

class WhisperService {
  private readonly API_URL = 'https://api.openai.com/v1/audio/transcriptions';

  // Get API key (personal or global)
  private async getApiKey(userTier: UserTier = 'tier1'): Promise<{ key: string | null; isGlobal: boolean }> {
    try {
      // Try personal key first
      const personalKey = await this.getPersonalApiKey();
      if (personalKey) {
        console.log('Using personal OpenAI Whisper API key');
        return { key: personalKey, isGlobal: false };
      }

      // Try global key as fallback
      const globalKey = await globalApiService.getGlobalApiKey('openai_whisper', userTier);
      if (globalKey && globalKey.trim() !== '') {
        console.log('Using global OpenAI Whisper API key');
        return { key: globalKey, isGlobal: true };
      }

      // If no personal key and no global key, try using the regular OpenAI key
      const openaiKey = await globalApiService.getGlobalApiKey('openai', userTier);
      if (openaiKey && openaiKey.trim() !== '') {
        console.log('Using OpenAI API key for Whisper');
        return { key: openaiKey, isGlobal: true };
      }
    } catch (error) {
      console.error('Error accessing Whisper API key:', error);
    }

    console.log('No Whisper API key available');
    return { key: null, isGlobal: false };
  }

  // Get personal API key from settings
  private async getPersonalApiKey(): Promise<string | null> {
    try {
      // This would typically come from user settings
      // For now, we'll just return null to use the global key
      return null;
    } catch (error) {
      console.error('Error getting personal Whisper API key:', error);
      return null;
    }
  }

  // Transcribe audio to text
  async transcribeAudio(
    audioBlob: Blob,
    options: {
      language?: string;
      prompt?: string;
      temperature?: number;
    } = {},
    userTier: UserTier = 'tier1',
    signal?: AbortSignal
  ): Promise<string> {
    const { key: apiKey, isGlobal } = await this.getApiKey(userTier);
    
    if (!apiKey) {
      throw new Error('OpenAI Whisper API key not available. Please configure it in settings or contact support for global key access.');
    }

    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('model', 'whisper-1');
    
    if (options.language) {
      formData.append('language', options.language);
    }
    
    if (options.prompt) {
      formData.append('prompt', options.prompt);
    }
    
    if (options.temperature !== undefined) {
      formData.append('temperature', options.temperature.toString());
    }

    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData,
        signal
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
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      console.error('Failed to transcribe audio:', error);
      throw error;
    }
  }

  // Check if service is available
  async isAvailable(userTier: UserTier = 'tier1'): Promise<boolean> {
    try {
      const { key } = await this.getApiKey(userTier);
      return !!key;
    } catch (error) {
      return false;
    }
  }
}

export const whisperService = new WhisperService();
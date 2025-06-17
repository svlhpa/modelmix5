import { APIResponse, APISettings, ModelSettings } from '../types';
import { databaseService } from './databaseService';
import { globalApiService } from './globalApiService';
import { openRouterService, OpenRouterModel } from './openRouterService';

class AIService {
  private settings: APISettings = {
    openai: '',
    openrouter: '',
    gemini: '',
    deepseek: ''
  };

  private modelSettings: ModelSettings = {
    openai: false,
    gemini: false,
    deepseek: false,
    openrouter_models: {}
  };

  private openRouterModels: OpenRouterModel[] = [];

  async updateSettings(settings: APISettings) {
    this.settings = { ...settings };
    await databaseService.saveApiSettings(settings);
  }

  async updateModelSettings(modelSettings: ModelSettings) {
    this.modelSettings = { ...modelSettings };
    await databaseService.saveModelSettings(modelSettings);
  }

  async loadSettings(): Promise<APISettings> {
    try {
      this.settings = await databaseService.loadApiSettings();
      return this.settings;
    } catch (error) {
      console.error('Failed to load settings from database:', error);
      return this.settings;
    }
  }

  async loadModelSettings(): Promise<ModelSettings> {
    try {
      this.modelSettings = await databaseService.loadModelSettings();
      return this.modelSettings;
    } catch (error) {
      console.error('Failed to load model settings from database:', error);
      return this.modelSettings;
    }
  }

  async loadOpenRouterModels(): Promise<OpenRouterModel[]> {
    if (this.openRouterModels.length === 0) {
      this.openRouterModels = await openRouterService.getAvailableModels();
    }
    return this.openRouterModels;
  }

  // Get API key with fallback to global keys for free trial
  private async getApiKey(provider: string, userTier: string): Promise<{ key: string | null; isGlobal: boolean }> {
    // First try user's personal API key
    const userKey = this.settings[provider as keyof APISettings];
    if (userKey && userKey.trim() !== '') {
      return { key: userKey, isGlobal: false };
    }

    // Fallback to global API key for free trial
    const globalKey = await globalApiService.getGlobalApiKey(provider, userTier as any);
    if (globalKey) {
      // Check if global key is within usage limits
      const canUse = await globalApiService.checkGlobalUsageLimit(provider);
      if (canUse) {
        return { key: globalKey, isGlobal: true };
      }
    }

    return { key: null, isGlobal: false };
  }

  private async callOpenAI(messages: Array<{role: 'user' | 'assistant', content: string}>, images: string[] = [], signal?: AbortSignal, userTier?: string): Promise<string> {
    const { key: apiKey, isGlobal } = await this.getApiKey('openai', userTier || 'tier1');
    if (!apiKey) {
      throw new Error('OpenAI API key not available. Please configure your API key in settings or upgrade to Pro for guaranteed access.');
    }

    // Format messages for vision if images are present
    const formattedMessages = messages.map((msg, index) => {
      if (msg.role === 'user' && index === messages.length - 1 && images.length > 0) {
        return {
          role: msg.role,
          content: [
            { type: 'text', text: msg.content },
            ...images.map(image => ({
              type: 'image_url',
              image_url: { url: image }
            }))
          ]
        };
      }
      return { role: msg.role, content: msg.content };
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: formattedMessages,
        max_tokens: 1000,
        temperature: 0.7
      }),
      signal
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Increment global usage if using global key
    if (isGlobal) {
      await globalApiService.incrementGlobalUsage('openai');
    }
    
    return data.choices[0]?.message?.content || 'No response generated';
  }

  private async callGemini(messages: Array<{role: 'user' | 'assistant', content: string}>, images: string[] = [], signal?: AbortSignal, userTier?: string): Promise<string> {
    const { key: apiKey, isGlobal } = await this.getApiKey('gemini', userTier || 'tier1');
    if (!apiKey) {
      throw new Error('Gemini API key not available. Please configure your API key in settings or upgrade to Pro for guaranteed access.');
    }

    // Convert messages to Gemini format
    const contents = messages.map((msg, index) => {
      const parts: any[] = [{ text: msg.content }];
      
      // Add images to the last user message
      if (msg.role === 'user' && index === messages.length - 1 && images.length > 0) {
        images.forEach(image => {
          // Extract base64 data from data URL
          const base64Data = image.split(',')[1];
          const mimeType = image.split(';')[0].split(':')[1];
          parts.push({
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          });
        });
      }

      return {
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts
      };
    });

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000
        }
      }),
      signal
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Increment global usage if using global key
    if (isGlobal) {
      await globalApiService.incrementGlobalUsage('gemini');
    }
    
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';
  }

  private async callDeepSeek(messages: Array<{role: 'user' | 'assistant', content: string}>, images: string[] = [], signal?: AbortSignal, userTier?: string): Promise<string> {
    const { key: apiKey, isGlobal } = await this.getApiKey('deepseek', userTier || 'tier1');
    if (!apiKey) {
      throw new Error('DeepSeek API key not available. Please configure your API key in settings or upgrade to Pro for guaranteed access.');
    }

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7
      }),
      signal
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Increment global usage if using global key
    if (isGlobal) {
      await globalApiService.incrementGlobalUsage('deepseek');
    }
    
    return data.choices[0]?.message?.content || 'No response generated';
  }

  // CRITICAL: Completely rebuilt response generation system
  async getResponses(
    currentMessage: string, 
    conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = [], 
    images: string[] = [],
    onResponseUpdate?: (responses: APIResponse[]) => void,
    signal?: AbortSignal,
    userTier?: string
  ): Promise<APIResponse[]> {
    const providers: Array<{ name: string, call: () => Promise<string> }> = [];

    // Add traditional providers
    if (this.modelSettings.openai) {
      providers.push({
        name: 'OpenAI GPT-4o',
        call: () => this.callOpenAI(conversationHistory, images, signal, userTier)
      });
    }

    if (this.modelSettings.gemini) {
      providers.push({
        name: 'Google Gemini 1.5 Pro',
        call: () => this.callGemini(conversationHistory, images, signal, userTier)
      });
    }

    if (this.modelSettings.deepseek) {
      providers.push({
        name: 'DeepSeek Chat',
        call: () => this.callDeepSeek(conversationHistory, images, signal, userTier)
      });
    }

    // Add selected OpenRouter models
    const { key: openRouterKey, isGlobal: isOpenRouterGlobal } = await this.getApiKey('openrouter', userTier || 'tier1');
    if (openRouterKey) {
      const enabledOpenRouterModels = Object.entries(this.modelSettings.openrouter_models)
        .filter(([_, enabled]) => enabled)
        .map(([modelId]) => modelId);

      for (const modelId of enabledOpenRouterModels) {
        const model = this.openRouterModels.find(m => m.id === modelId);
        if (model) {
          providers.push({
            name: model.name,
            call: async () => {
              const result = await openRouterService.callModel(modelId, conversationHistory, openRouterKey, images, signal);
              
              // Increment global usage if using global key
              if (isOpenRouterGlobal) {
                await globalApiService.incrementGlobalUsage('openrouter');
              }
              
              return result;
            }
          });
        }
      }
    }

    if (providers.length === 0) {
      return [];
    }

    // Initialize responses with loading state
    const responses: APIResponse[] = providers.map(provider => ({
      provider: provider.name,
      content: '',
      loading: true,
      error: undefined
    }));

    // Call the update callback immediately with loading states
    if (onResponseUpdate) {
      onResponseUpdate([...responses]);
    }

    // Make all API calls concurrently and update responses as they complete
    const promises = providers.map(async (provider, index) => {
      try {
        const content = await provider.call();
        
        // Check if aborted before updating
        if (signal?.aborted) {
          return;
        }
        
        responses[index] = {
          ...responses[index],
          content,
          loading: false
        };
        
        // Call update callback each time a response completes
        if (onResponseUpdate && !signal?.aborted) {
          onResponseUpdate([...responses]);
        }
      } catch (error) {
        // Don't update if aborted
        if (signal?.aborted) {
          return;
        }
        
        responses[index] = {
          ...responses[index],
          content: '',
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
        
        // Call update callback for errors too
        if (onResponseUpdate && !signal?.aborted) {
          onResponseUpdate([...responses]);
        }
      }
    });

    await Promise.all(promises);
    return responses;
  }
}

export const aiService = new AIService();
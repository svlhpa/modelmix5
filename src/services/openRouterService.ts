interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  top_provider: {
    max_completion_tokens?: number;
  };
  architecture?: {
    modality?: string;
    tokenizer?: string;
    instruct_type?: string;
  };
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

class OpenRouterService {
  private models: OpenRouterModel[] = [];
  private lastFetch: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  async getAvailableModels(): Promise<OpenRouterModel[]> {
    const now = Date.now();
    
    // Return cached models if they're still fresh
    if (this.models.length > 0 && (now - this.lastFetch) < this.CACHE_DURATION) {
      return this.models;
    }

    try {
      const response = await fetch("https://openrouter.ai/api/v1/models", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data: OpenRouterModelsResponse = await response.json();
      
      // Filter and sort models for better UX
      this.models = data.data
        .filter(model => {
          // Filter out models that are likely not suitable for chat
          const isChat = !model.id.includes('embedding') && 
                        !model.id.includes('whisper') && 
                        !model.id.includes('tts') &&
                        !model.id.includes('dall-e') &&
                        !model.id.includes('stable-diffusion');
          
          // Only include models with reasonable context length
          const hasGoodContext = model.context_length >= 4000;
          
          return isChat && hasGoodContext;
        })
        .sort((a, b) => {
          // Sort by popularity/provider, then by name
          const aIsFree = a.pricing.prompt === "0";
          const bIsFree = b.pricing.prompt === "0";
          
          if (aIsFree && !bIsFree) return -1;
          if (!aIsFree && bIsFree) return 1;
          
          return a.name.localeCompare(b.name);
        });

      this.lastFetch = now;
      return this.models;
    } catch (error) {
      console.error('Failed to fetch OpenRouter models:', error);
      
      // Return fallback models if API fails
      return this.getFallbackModels();
    }
  }

  private getFallbackModels(): OpenRouterModel[] {
    return [
      {
        id: 'anthropic/claude-3-haiku',
        name: 'Claude 3 Haiku',
        description: 'Fast and efficient model from Anthropic',
        context_length: 200000,
        pricing: { prompt: '0.00025', completion: '0.00125' },
        top_provider: { max_completion_tokens: 4096 }
      },
      {
        id: 'anthropic/claude-3-5-sonnet',
        name: 'Claude 3.5 Sonnet',
        description: 'Balanced performance and speed',
        context_length: 200000,
        pricing: { prompt: '0.003', completion: '0.015' },
        top_provider: { max_completion_tokens: 8192 }
      },
      {
        id: 'deepseek/deepseek-r1:free',
        name: 'DeepSeek R1 (Free)',
        description: 'Free reasoning model',
        context_length: 32000,
        pricing: { prompt: '0', completion: '0' },
        top_provider: { max_completion_tokens: 4096 }
      },
      {
        id: 'google/gemma-2-27b-it:free',
        name: 'Gemma 2 27B (Free)',
        description: 'Free Google model',
        context_length: 8192,
        pricing: { prompt: '0', completion: '0' },
        top_provider: { max_completion_tokens: 4096 }
      },
      {
        id: 'meta-llama/llama-3.1-8b-instruct:free',
        name: 'Llama 3.1 8B (Free)',
        description: 'Free Meta model',
        context_length: 131072,
        pricing: { prompt: '0', completion: '0' },
        top_provider: { max_completion_tokens: 4096 }
      }
    ];
  }

  getModelCategories(models: OpenRouterModel[]): Record<string, OpenRouterModel[]> {
    const categories: Record<string, OpenRouterModel[]> = {
      'Free Models': [],
      'Claude Models': [],
      'GPT Models': [],
      'Gemini Models': [],
      'Llama Models': [],
      'Other Models': []
    };

    models.forEach(model => {
      const isFree = model.pricing.prompt === "0";
      const modelName = model.name.toLowerCase();
      const modelId = model.id.toLowerCase();

      if (isFree) {
        categories['Free Models'].push(model);
      } else if (modelId.includes('claude') || modelId.includes('anthropic')) {
        categories['Claude Models'].push(model);
      } else if (modelId.includes('gpt') || modelId.includes('openai')) {
        categories['GPT Models'].push(model);
      } else if (modelId.includes('gemini') || modelId.includes('google')) {
        categories['Gemini Models'].push(model);
      } else if (modelId.includes('llama') || modelId.includes('meta')) {
        categories['Llama Models'].push(model);
      } else {
        categories['Other Models'].push(model);
      }
    });

    // Remove empty categories
    Object.keys(categories).forEach(key => {
      if (categories[key].length === 0) {
        delete categories[key];
      }
    });

    return categories;
  }

  async callModel(
    modelId: string, 
    messages: Array<{role: 'user' | 'assistant', content: string}>, 
    apiKey: string,
    images: string[] = [],
    signal?: AbortSignal
  ): Promise<string> {
    if (!apiKey) {
      throw new Error('OpenRouter API key not configured');
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

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'ModelMix - AI Comparison Platform'
      },
      body: JSON.stringify({
        model: modelId,
        messages: formattedMessages,
        max_tokens: 1000,
        temperature: 0.7
      }),
      signal
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No response generated';
  }
}

export const openRouterService = new OpenRouterService();
export type { OpenRouterModel };
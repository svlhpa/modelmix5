import { APIResponse, APISettings, ModelSettings } from '../types';
import { databaseService } from './databaseService';
import { globalApiService } from './globalApiService';
import { openRouterService, OpenRouterModel } from './openRouterService';
import { imageRouterService, ImageModel } from './imageRouterService';
import { elevenLabsService } from './elevenLabsService';

class AIService {
  private settings: APISettings = {
    openai: '',
    openrouter: '',
    gemini: '',
    deepseek: '',
    serper: '',
    imagerouter: '',
    elevenlabs: '',
    openai_whisper: ''
  };

  private modelSettings: ModelSettings = {
    openai: false,
    gemini: false,
    deepseek: false,
    openrouter_models: {},
    image_models: {}
  };

  private openRouterModels: OpenRouterModel[] = [];
  private imageModels: ImageModel[] = [];

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

  async loadImageModels(): Promise<ImageModel[]> {
    if (this.imageModels.length === 0) {
      this.imageModels = await imageRouterService.getAvailableModels();
    }
    return this.imageModels;
  }

  // CRITICAL: Updated API key access to prioritize Pro users for global keys
  private async getApiKey(provider: string, userTier: string): Promise<{ key: string | null; isGlobal: boolean }> {
    console.log(`Getting API key for provider: ${provider}, userTier: ${userTier}`);
    
    // First try user's personal API key
    const userKey = this.settings[provider as keyof APISettings];
    if (userKey && userKey.trim() !== '') {
      console.log(`Using personal API key for ${provider}`);
      return { key: userKey, isGlobal: false };
    }

    // CRITICAL: For Pro users (tier2), always try global keys as fallback
    // For Free users (tier1), also try global keys for free trial
    console.log(`No personal key for ${provider}, checking global keys for tier: ${userTier}`);
    
    try {
      const globalKey = await globalApiService.getGlobalApiKey(provider, userTier as any);
      console.log(`Global key check result for ${provider}:`, { hasKey: !!globalKey, key: globalKey ? 'present' : 'null' });
      
      if (globalKey && globalKey !== 'PLACEHOLDER_SERPER_KEY_UPDATE_IN_ADMIN') {
        // Check if global key is within usage limits
        const canUse = await globalApiService.checkGlobalUsageLimit(provider);
        console.log(`Global usage limit check for ${provider}:`, canUse);
        
        if (canUse) {
          console.log(`Using global API key for ${provider} (tier: ${userTier})`);
          return { key: globalKey, isGlobal: true };
        } else {
          console.log(`Global API key for ${provider} is over usage limit`);
        }
      } else {
        console.log(`No global API key available for ${provider}`);
      }
    } catch (error) {
      console.error(`Error accessing global API key for ${provider}:`, error);
    }

    console.log(`No API key available for ${provider}`);
    return { key: null, isGlobal: false };
  }

  private async callSerper(query: string, signal?: AbortSignal): Promise<string> {
    // Try to get global Serper API key first
    const globalKey = await globalApiService.getGlobalApiKey('serper', 'tier1');
    let apiKey = globalKey;
    let isGlobal = true;

    // If no global key, try user's personal key
    if (!apiKey) {
      apiKey = this.settings.serper;
      isGlobal = false;
    }

    if (!apiKey || apiKey.trim() === '' || apiKey === 'PLACEHOLDER_SERPER_KEY_UPDATE_IN_ADMIN') {
      throw new Error('Internet search is not available. Please contact support or configure your own Serper API key.');
    }

    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: query,
          num: 5, // Limit to 5 results for better performance
        }),
        signal
      });

      if (!response.ok) {
        throw new Error(`Internet search failed: ${response.status}`);
      }

      const data = await response.json();
      
      // Increment global usage if using global key
      if (isGlobal && globalKey) {
        await globalApiService.incrementGlobalUsage('serper');
      }
      
      // Format search results in a clear, structured way
      let searchResults = '=== CURRENT INTERNET SEARCH RESULTS ===\n\n';
      
      if (data.answerBox) {
        searchResults += `QUICK ANSWER: ${data.answerBox.answer || data.answerBox.snippet}\n\n`;
      }

      if (data.knowledgeGraph) {
        searchResults += `KNOWLEDGE GRAPH: ${data.knowledgeGraph.description}\n\n`;
      }

      if (data.organic && data.organic.length > 0) {
        searchResults += 'TOP SEARCH RESULTS:\n';
        data.organic.forEach((result: any, index: number) => {
          searchResults += `\n${index + 1}. ${result.title}\n`;
          if (result.snippet) {
            searchResults += `   Summary: ${result.snippet}\n`;
          }
          if (result.link) {
            searchResults += `   Source: ${result.link}\n`;
          }
        });
      }

      searchResults += '\n=== END OF SEARCH RESULTS ===\n\n';
      searchResults += 'IMPORTANT: Use the above current information from the internet to provide an accurate, up-to-date response. Reference specific details from these search results in your answer.';

      return searchResults.trim();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      throw new Error(`Failed to search the internet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async callOpenAI(messages: Array<{role: 'user' | 'assistant' | 'system', content: string}>, images: string[] = [], signal?: AbortSignal, userTier?: string): Promise<string> {
    // CRITICAL: Always try tier2 first for Pro users, then fallback to tier1
    const tier = userTier || 'tier2';
    let { key: apiKey, isGlobal } = await this.getApiKey('openai', tier);
    
    // If no key found for tier2, try tier1 as fallback
    if (!apiKey && tier === 'tier2') {
      console.log('No tier2 key for OpenAI, trying tier1 fallback');
      const fallback = await this.getApiKey('openai', 'tier1');
      apiKey = fallback.key;
      isGlobal = fallback.isGlobal;
    }
    
    if (!apiKey) {
      throw new Error('OpenAI API key not available. Please configure your API key in settings or contact support for global key access.');
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

  private async callGemini(messages: Array<{role: 'user' | 'assistant' | 'system', content: string}>, images: string[] = [], signal?: AbortSignal, userTier?: string): Promise<string> {
    // CRITICAL: Always try tier2 first for Pro users, then fallback to tier1
    const tier = userTier || 'tier2';
    let { key: apiKey, isGlobal } = await this.getApiKey('gemini', tier);
    
    // If no key found for tier2, try tier1 as fallback
    if (!apiKey && tier === 'tier2') {
      console.log('No tier2 key for Gemini, trying tier1 fallback');
      const fallback = await this.getApiKey('gemini', 'tier1');
      apiKey = fallback.key;
      isGlobal = fallback.isGlobal;
    }
    
    if (!apiKey) {
      throw new Error('Gemini API key not available. Please configure your API key in settings or contact support for global key access.');
    }

    // Convert messages to Gemini format, handling system messages
    const contents = messages
      .filter(msg => msg.role !== 'system') // Gemini doesn't support system messages directly
      .map((msg, index) => {
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

    // If there was a system message, prepend it to the first user message
    const systemMessage = messages.find(msg => msg.role === 'system');
    if (systemMessage && contents.length > 0 && contents[0].role === 'user') {
      contents[0].parts[0].text = `${systemMessage.content}\n\n${contents[0].parts[0].text}`;
    }

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

  private async callDeepSeek(messages: Array<{role: 'user' | 'assistant' | 'system', content: string}>, images: string[] = [], signal?: AbortSignal, userTier?: string): Promise<string> {
    // CRITICAL: Always try tier2 first for Pro users, then fallback to tier1
    const tier = userTier || 'tier2';
    let { key: apiKey, isGlobal } = await this.getApiKey('deepseek', tier);
    
    // If no key found for tier2, try tier1 as fallback
    if (!apiKey && tier === 'tier2') {
      console.log('No tier2 key for DeepSeek, trying tier1 fallback');
      const fallback = await this.getApiKey('deepseek', 'tier1');
      apiKey = fallback.key;
      isGlobal = fallback.isGlobal;
    }
    
    if (!apiKey) {
      throw new Error('DeepSeek API key not available. Please configure your API key in settings or contact support for global key access.');
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

  // CRITICAL: Completely rebuilt debate response generation for proper engagement
  async generateDebateResponse(
    topic: string,
    position: string,
    previousMessages: any[],
    model: string,
    responseType: 'opening' | 'rebuttal' | 'closing' | 'response_to_user'
  ): Promise<string> {
    console.log(`Generating debate response for ${model}...`);
    
    // CRITICAL: Load current settings first to ensure we have the latest API keys
    await this.loadSettings();
    
    // CRITICAL: Build proper debate context with opponent's arguments
    const opponentMessages = previousMessages.filter(msg => 
      (msg.speaker === 'ai1' || msg.speaker === 'ai2') && msg.speaker !== this.getCurrentSpeaker(model, previousMessages)
    );
    
    const myPreviousMessages = previousMessages.filter(msg => 
      msg.speaker === this.getCurrentSpeaker(model, previousMessages)
    );

    const systemPrompt = this.getEnhancedDebateSystemPrompt(
      topic, 
      position, 
      responseType, 
      model, 
      opponentMessages, 
      myPreviousMessages,
      previousMessages.length
    );
    
    // Build conversation context with FULL debate history
    const messages: Array<{role: 'user' | 'assistant' | 'system', content: string}> = [
      { role: 'system', content: systemPrompt }
    ];
    
    // Add the FULL debate context so AI can reference previous arguments
    if (previousMessages.length > 0) {
      const debateContext = this.buildDebateContext(previousMessages, model);
      messages.push({ role: 'user', content: debateContext });
    }

    try {
      console.log(`Calling ${model} API with enhanced context...`);
      
      // CRITICAL: Call with tier2 access for Pro users, tier1 for free users
      switch (model) {
        case 'openai':
          return await this.callOpenAI(messages, [], undefined, 'tier2');
        case 'gemini':
          return await this.callGemini(messages, [], undefined, 'tier2');
        case 'deepseek':
          return await this.callDeepSeek(messages, [], undefined, 'tier2');
        default:
          throw new Error(`Unsupported model for debate: ${model}`);
      }
    } catch (error) {
      console.error(`Error generating debate response for ${model}:`, error);
      
      // Return a more helpful fallback response
      const modelName = model === 'openai' ? 'GPT-4o' : 
                       model === 'gemini' ? 'Gemini Pro' : 
                       model === 'deepseek' ? 'DeepSeek' : model;
      
      return `I apologize, but I'm having trouble generating a response right now. ${error instanceof Error ? error.message : 'Please try again.'}\n\n💡 **Tip:** Make sure you have configured your API keys in Settings, or the debate will use free trial access if available.`;
    }
  }

  // CRITICAL: Helper to determine current speaker
  private getCurrentSpeaker(model: string, previousMessages: any[]): 'ai1' | 'ai2' {
    // Find which AI this model represents by looking at previous messages
    const ai1Messages = previousMessages.filter(msg => msg.speaker === 'ai1');
    const ai2Messages = previousMessages.filter(msg => msg.speaker === 'ai2');
    
    // Check if this model has spoken as ai1 or ai2 before
    if (ai1Messages.length > 0 && ai1Messages[0].model?.toLowerCase().includes(model)) {
      return 'ai1';
    }
    if (ai2Messages.length > 0 && ai2Messages[0].model?.toLowerCase().includes(model)) {
      return 'ai2';
    }
    
    // Default logic based on turn count
    const aiMessageCount = previousMessages.filter(msg => msg.speaker === 'ai1' || msg.speaker === 'ai2').length;
    return aiMessageCount % 2 === 0 ? 'ai1' : 'ai2';
  }

  // CRITICAL: Build comprehensive debate context
  private buildDebateContext(previousMessages: any[], currentModel: string): string {
    const currentSpeaker = this.getCurrentSpeaker(currentModel, previousMessages);
    const opponentSpeaker = currentSpeaker === 'ai1' ? 'ai2' : 'ai1';
    
    let context = "=== CURRENT DEBATE CONTEXT ===\n\n";
    
    // Add recent debate exchanges (last 4 messages)
    const recentMessages = previousMessages
      .filter(msg => msg.speaker === 'ai1' || msg.speaker === 'ai2')
      .slice(-4);
    
    if (recentMessages.length > 0) {
      context += "**Recent Debate Exchanges:**\n\n";
      recentMessages.forEach((msg, index) => {
        const speakerLabel = msg.speaker === currentSpeaker ? "YOU" : "YOUR OPPONENT";
        context += `${speakerLabel} (${msg.model}): ${msg.content}\n\n`;
      });
    }
    
    // Add opponent's key arguments to address
    const opponentMessages = previousMessages.filter(msg => msg.speaker === opponentSpeaker);
    if (opponentMessages.length > 0) {
      context += "**Your Opponent's Key Arguments to Address:**\n";
      opponentMessages.forEach((msg, index) => {
        context += `${index + 1}. ${msg.content.substring(0, 200)}...\n`;
      });
      context += "\n";
    }
    
    context += "=== YOUR TASK ===\n";
    context += "You must DIRECTLY RESPOND to your opponent's arguments above. Reference specific points they made and counter them with your own evidence and logic. This is a competitive debate - be assertive and persuasive!\n\n";
    context += "Now provide your response:";
    
    return context;
  }

  // CRITICAL: Enhanced system prompt for competitive debate
  private getEnhancedDebateSystemPrompt(
    topic: string, 
    position: string, 
    responseType: string, 
    model: string,
    opponentMessages: any[],
    myPreviousMessages: any[],
    totalTurns: number
  ): string {
    const modelName = model === 'openai' ? 'GPT-4o' : 
                     model === 'gemini' ? 'Gemini Pro' : 
                     model === 'deepseek' ? 'DeepSeek' : model;
    
    const opponentName = model === 'openai' ? 'Gemini Pro' : 
                        model === 'gemini' ? 'GPT-4o' : 
                        'GPT-4o'; // Default opponent

    const basePrompt = `You are ${modelName} in a COMPETITIVE Parliamentary debate about: "${topic}"

Your position: ${position}
Your opponent: ${opponentName}

CRITICAL DEBATE RULES:
🏛️ **Parliamentary Style**: Use formal language ("The Honorable Member", "My learned colleague")
🎯 **Be COMPETITIVE**: This is a contest - you want to WIN this debate
🔥 **Address Opponent Directly**: Reference their specific arguments and counter them
💪 **Be Assertive**: Don't just state your position - ATTACK their weak points
📊 **Use Evidence**: Cite facts, studies, examples to support your arguments
🎭 **Show Personality**: Be passionate about your position while remaining respectful

DEBATE ENGAGEMENT REQUIREMENTS:
- NEVER just give a generic opening statement
- ALWAYS reference what your opponent has said (if they've spoken)
- Point out flaws in their logic
- Use phrases like "My opponent claims... but they're wrong because..."
- Build on the debate flow - this is a CONVERSATION, not separate speeches
- Be competitive but respectful
- Keep responses 2-3 paragraphs maximum
- End with a strong challenge or question for your opponent`;

    // Add specific instructions based on response type and debate progress
    let specificInstructions = "";
    
    if (responseType === 'opening' && totalTurns <= 1) {
      specificInstructions = `
This is your OPENING STATEMENT. Set the tone and present your strongest arguments. Be bold and confident in your position.`;
    } else if (opponentMessages.length > 0) {
      const lastOpponentMessage = opponentMessages[opponentMessages.length - 1];
      specificInstructions = `
This is a REBUTTAL. Your opponent just said: "${lastOpponentMessage.content.substring(0, 300)}..."

You MUST:
1. Directly address their specific points
2. Point out flaws in their argument
3. Counter with your own evidence
4. Challenge them on weak spots
5. Strengthen your own position

Be competitive and assertive - you're trying to WIN this debate!`;
    } else if (responseType === 'closing') {
      specificInstructions = `
This is your CLOSING ARGUMENT. Summarize why you've won this debate, address their strongest points one final time, and make a compelling final case.`;
    } else {
      specificInstructions = `
Continue the debate by addressing your opponent's arguments and strengthening your position. Be competitive and engaging.`;
    }

    return basePrompt + specificInstructions;
  }

  // CRITICAL: New method to handle both text and image generation
  async getResponses(
    currentMessage: string, 
    conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = [], 
    images: string[] = [],
    onResponseUpdate?: (responses: APIResponse[]) => void,
    signal?: AbortSignal,
    userTier?: string,
    useInternetSearch: boolean = false
  ): Promise<APIResponse[]> {
    // CRITICAL: Detect if this is an image generation request
    const isImageRequest = imageRouterService.isImageGenerationRequest(currentMessage);
    
    if (isImageRequest) {
      return this.getImageResponses(currentMessage, onResponseUpdate, signal, userTier);
    } else {
      return this.getTextResponses(currentMessage, conversationHistory, images, onResponseUpdate, signal, userTier, useInternetSearch);
    }
  }

  // CRITICAL: Image generation responses with enhanced debugging
  private async getImageResponses(
    prompt: string,
    onResponseUpdate?: (responses: APIResponse[]) => void,
    signal?: AbortSignal,
    userTier?: string
  ): Promise<APIResponse[]> {
    console.log('=== IMAGE GENERATION DEBUG ===');
    console.log('Starting image generation for prompt:', prompt);
    console.log('User tier:', userTier);
    
    // CRITICAL: Check for API key availability first with detailed logging
    const { key: apiKey, isGlobal } = await this.getApiKey('imagerouter', userTier || 'tier1');
    console.log('Imagerouter API key check:', { 
      hasKey: !!apiKey, 
      isGlobal, 
      userTier,
      keyLength: apiKey ? apiKey.length : 0,
      keyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'none'
    });
    
    if (!apiKey) {
      console.log('❌ No Imagerouter API key available');
      return [{
        provider: 'Image Generation',
        content: 'Image generation requires an Imagerouter API key. Please configure it in settings or contact support for global key access.',
        loading: false,
        error: 'API key not configured',
        isImageGeneration: true
      }];
    }

    console.log('✅ API key found, proceeding with image generation');

    // CRITICAL: Filter enabled image models based on user tier and API key availability
    const hasPersonalImageKey = this.settings.imagerouter && this.settings.imagerouter.trim() !== '';
    const isProUser = userTier === 'tier2';
    
    console.log('Access check:', { hasPersonalImageKey, isProUser, isGlobal });
    
    let enabledImageModels: string[] = [];
    
    if (hasPersonalImageKey || isProUser) {
      // User has personal key or is Pro - can access all enabled models
      enabledImageModels = Object.entries(this.modelSettings.image_models)
        .filter(([_, enabled]) => enabled)
        .map(([modelId]) => modelId);
      console.log('✅ Pro/Personal key access - enabled models:', enabledImageModels);
    } else if (isGlobal && !isProUser) {
      // Free tier user with global key access - only the 3 hardcoded free models
      const freeModelIds = [
        'stabilityai/sdxl-turbo:free',
        'black-forest-labs/FLUX-1-schnell:free', 
        'test/test'
      ];
      enabledImageModels = Object.entries(this.modelSettings.image_models)
        .filter(([modelId, enabled]) => enabled && freeModelIds.includes(modelId))
        .map(([modelId]) => modelId);
      console.log('✅ Free tier global access - enabled models:', enabledImageModels);
      console.log('Available free models:', freeModelIds);
      console.log('User enabled models:', Object.entries(this.modelSettings.image_models).filter(([_, enabled]) => enabled).map(([modelId]) => modelId));
    }

    if (enabledImageModels.length === 0) {
      console.log('❌ No enabled image models found');
      console.log('Model settings:', this.modelSettings.image_models);
      return [{
        provider: 'Image Generation',
        content: 'No image models selected. Please enable image models in settings.',
        loading: false,
        error: 'No models enabled',
        isImageGeneration: true
      }];
    }

    // Initialize responses with loading state
    const responses: APIResponse[] = enabledImageModels.map(modelId => {
      const model = this.imageModels.find(m => m.id === modelId);
      return {
        provider: model?.name || modelId,
        content: '',
        loading: true,
        isImageGeneration: true,
        generatedImages: []
      };
    });

    console.log('Initialized responses for models:', responses.map(r => r.provider));

    // Call the update callback immediately with loading states
    if (onResponseUpdate) {
      onResponseUpdate([...responses]);
    }

    // Generate images concurrently
    const promises = enabledImageModels.map(async (modelId, index) => {
      try {
        console.log(`🎨 Generating image with model ${modelId}...`);
        const imageUrls = await imageRouterService.generateImage(prompt, modelId, apiKey, signal);
        
        // Check if aborted before updating
        if (signal?.aborted) {
          return;
        }
        
        console.log(`✅ Image generated successfully for ${modelId}:`, imageUrls);
        
        responses[index] = {
          ...responses[index],
          content: `Generated image for: "${prompt}"`,
          loading: false,
          generatedImages: imageUrls
        };
        
        // Increment global usage if using global key
        if (isGlobal) {
          console.log('📊 Incrementing global usage for imagerouter');
          await globalApiService.incrementGlobalUsage('imagerouter');
        }
        
        // Call update callback each time an image completes
        if (onResponseUpdate && !signal?.aborted) {
          onResponseUpdate([...responses]);
        }
      } catch (error) {
        // Don't update if aborted
        if (signal?.aborted) {
          return;
        }
        
        console.error(`❌ Error generating image with ${modelId}:`, error);
        
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
    console.log('🏁 All image generation promises completed');
    console.log('=== END IMAGE GENERATION DEBUG ===');
    return responses;
  }

  // CRITICAL: Text generation responses (existing logic)
  private async getTextResponses(
    currentMessage: string, 
    conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = [], 
    images: string[] = [],
    onResponseUpdate?: (responses: APIResponse[]) => void,
    signal?: AbortSignal,
    userTier?: string,
    useInternetSearch: boolean = false
  ): Promise<APIResponse[]> {
    let enhancedHistory = [...conversationHistory];
    let searchResults = '';

    // Perform internet search if requested
    if (useInternetSearch) {
      try {
        searchResults = await this.callSerper(currentMessage, signal);
        
        // Create a new enhanced message that includes search results
        const lastUserMessageIndex = enhancedHistory.length - 1;
        if (lastUserMessageIndex >= 0 && enhancedHistory[lastUserMessageIndex].role === 'user') {
          // Update the last user message to include search results
          enhancedHistory[lastUserMessageIndex] = {
            ...enhancedHistory[lastUserMessageIndex],
            content: `${enhancedHistory[lastUserMessageIndex].content}\n\n${searchResults}`
          };
        } else {
          // Add a new message with search results
          enhancedHistory.push({ 
            role: 'user', 
            content: `${currentMessage}\n\n${searchResults}` 
          });
        }
      } catch (error) {
        console.error('Internet search failed:', error);
        // Add a note about search failure but continue
        const lastUserMessageIndex = enhancedHistory.length - 1;
        if (lastUserMessageIndex >= 0 && enhancedHistory[lastUserMessageIndex].role === 'user') {
          enhancedHistory[lastUserMessageIndex] = {
            ...enhancedHistory[lastUserMessageIndex],
            content: `${enhancedHistory[lastUserMessageIndex].content}\n\n[Note: Internet search was requested but failed. Please provide the best response based on your training data.]`
          };
        }
      }
    }

    const providers: Array<{ name: string, call: () => Promise<string> }> = [];

    // Add traditional providers
    if (this.modelSettings.openai) {
      providers.push({
        name: 'OpenAI GPT-4o',
        call: () => this.callOpenAI(enhancedHistory as any, images, signal, userTier)
      });
    }

    if (this.modelSettings.gemini) {
      providers.push({
        name: 'Google Gemini 1.5 Pro',
        call: () => this.callGemini(enhancedHistory as any, images, signal, userTier)
      });
    }

    if (this.modelSettings.deepseek) {
      providers.push({
        name: 'DeepSeek Chat',
        call: () => this.callDeepSeek(enhancedHistory as any, images, signal, userTier)
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
              const result = await openRouterService.callModel(modelId, enhancedHistory as any, openRouterKey, images, signal);
              
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
      error: undefined,
      isImageGeneration: false
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

  // Generate text-to-speech audio for a message
  async generateTextToSpeech(
    text: string,
    voiceId: string,
    voiceSettings: {
      stability: number;
      similarity_boost: number;
      style?: number;
      use_speaker_boost?: boolean;
    },
    userTier?: string
  ): Promise<string | null> {
    try {
      // Load current settings to ensure we have the latest API keys
      await this.loadSettings();
      
      // Check if Eleven Labs is available
      const { key: apiKey } = await this.getApiKey('elevenlabs', userTier || 'tier2');
      if (!apiKey) {
        throw new Error('Eleven Labs API key not available');
      }
      
      // Generate audio using Eleven Labs
      const audioBlob = await elevenLabsService.textToSpeech({
        text,
        voice_id: voiceId,
        voice_settings: voiceSettings
      }, userTier as any);
      
      // Create URL for the audio blob
      const audioUrl = elevenLabsService.createAudioUrl(audioBlob);
      return audioUrl;
    } catch (error) {
      console.error('Failed to generate text-to-speech:', error);
      return null;
    }
  }
}

export const aiService = new AIService();
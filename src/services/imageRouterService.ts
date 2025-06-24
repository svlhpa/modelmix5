import { APISettings } from '../types';
import { globalApiService } from './globalApiService';

export interface ImageModel {
  id: string;
  name: string;
  description?: string;
  pricing: {
    type: string;
    value?: number;
    range?: {
      min: number;
      average: number;
      max: number;
    };
  };
  arena_score?: number;
  release_date: string;
  examples?: Array<{
    image?: string;
    video?: string;
  }>;
  output: string[];
  supported_params: {
    quality: boolean;
    edit: boolean;
    mask: boolean;
  };
  providers: Array<{
    id: string;
    model_name: string;
    pricing: {
      type: string;
      value?: number;
      range?: {
        min: number;
        average: number;
        max: number;
      };
    };
  }>;
}

class ImageRouterService {
  private models: ImageModel[] = [];
  private lastFetch: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  async getAvailableModels(): Promise<ImageModel[]> {
    const now = Date.now();
    
    // Return cached models if they're still fresh
    if (this.models.length > 0 && (now - this.lastFetch) < this.CACHE_DURATION) {
      return this.models;
    }

    try {
      // In a real implementation, this would fetch from the Imagerouter API
      // For now, we'll use a hardcoded list of models
      const models = await this.getFallbackModels();
      
      this.models = models;
      this.lastFetch = now;
      return this.models;
    } catch (error) {
      console.error('Failed to fetch Imagerouter models:', error);
      return this.getFallbackModels();
    }
  }

  // CRITICAL: New method to get video models only
  async getAvailableVideoModels(): Promise<ImageModel[]> {
    const allModels = await this.getAvailableModels();
    return allModels.filter(model => 
      model.output.includes('video') || 
      (model.examples && model.examples.some(ex => ex.video))
    );
  }

  // CRITICAL: New method to get image models only
  async getAvailableImageModels(): Promise<ImageModel[]> {
    const allModels = await this.getAvailableModels();
    return allModels.filter(model => 
      model.output.includes('image') || 
      (model.examples && model.examples.some(ex => ex.image))
    );
  }

  // Helper method to check if a model is free
  isFreeModel(model: ImageModel): boolean {
    return model.pricing.type === 'fixed' && model.pricing.value === 0;
  }

  // Helper method to get model icon
  getModelIcon(model: ImageModel): string {
    const modelId = model.id.toLowerCase();
    
    if (model.output.includes('video')) {
      return '🎬';
    }
    
    if (modelId.includes('flux')) {
      return '⚡';
    } else if (modelId.includes('dall-e')) {
      return '🎨';
    } else if (modelId.includes('sdxl') || modelId.includes('sd3')) {
      return '🖼️';
    } else if (modelId.includes('imagen')) {
      return '🌄';
    } else if (modelId.includes('gemini')) {
      return '💎';
    } else if (modelId.includes('ideogram')) {
      return '🎭';
    } else if (modelId.includes('photon')) {
      return '✨';
    } else {
      return '🖌️';
    }
  }

  getModelCategories(models: ImageModel[]): Record<string, ImageModel[]> {
    const categories: Record<string, ImageModel[]> = {
      'Free Models': [],
      'Video Models': [],
      'Image Models': []
    };

    // Add provider-specific categories
    const providers = new Set<string>();
    models.forEach(model => {
      model.providers.forEach(provider => {
        providers.add(provider.id);
      });
    });

    providers.forEach(provider => {
      categories[`${this.getProviderDisplayName(provider)} Models`] = [];
    });

    // Categorize models
    models.forEach(model => {
      // Add to Free Models if applicable
      if (this.isFreeModel(model)) {
        categories['Free Models'].push(model);
      }

      // Add to Video/Image Models based on output type
      if (model.output.includes('video') || (model.examples && model.examples.some(ex => ex.video))) {
        categories['Video Models'].push(model);
      } else {
        categories['Image Models'].push(model);
      }

      // Add to provider-specific categories
      model.providers.forEach(provider => {
        const providerCategory = `${this.getProviderDisplayName(provider.id)} Models`;
        if (categories[providerCategory]) {
          categories[providerCategory].push(model);
        }
      });
    });

    // Remove empty categories
    Object.keys(categories).forEach(key => {
      if (categories[key].length === 0) {
        delete categories[key];
      }
    });

    return categories;
  }

  private getProviderDisplayName(providerId: string): string {
    const providers: Record<string, string> = {
      'deepinfra': 'DeepInfra',
      'replicate': 'Replicate',
      'runware': 'RunPod',
      'openai': 'OpenAI',
      'gemini': 'Google',
      'vertex': 'Google',
      'fal': 'Fal.ai',
      'test': 'Test'
    };
    return providers[providerId] || providerId;
  }

  // Check if a message is requesting image generation
  isImageGenerationRequest(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    
    // Check for explicit image generation requests
    const imageKeywords = [
      'generate an image',
      'create an image',
      'make an image',
      'draw',
      'generate a picture',
      'create a picture',
      'make a picture',
      'generate a photo',
      'create a photo',
      'make a photo',
      'generate an illustration',
      'create an illustration',
      'make an illustration',
      'generate artwork',
      'create artwork',
      'make artwork',
      'generate a drawing',
      'create a drawing',
      'make a drawing',
      'generate a painting',
      'create a painting',
      'make a painting',
      'generate a portrait',
      'create a portrait',
      'make a portrait',
      'generate a scene',
      'create a scene',
      'make a scene',
      'generate a landscape',
      'create a landscape',
      'make a landscape',
      'generate a logo',
      'create a logo',
      'make a logo',
      'generate an icon',
      'create an icon',
      'make an icon',
      'generate a banner',
      'create a banner',
      'make a banner',
      'generate a poster',
      'create a poster',
      'make a poster',
      'generate a meme',
      'create a meme',
      'make a meme',
      'generate a gif',
      'create a gif',
      'make a gif',
      'generate a sticker',
      'create a sticker',
      'make a sticker',
      'generate an emoji',
      'create an emoji',
      'make an emoji',
      'generate a thumbnail',
      'create a thumbnail',
      'make a thumbnail',
      'generate a cover',
      'create a cover',
      'make a cover',
      'generate a background',
      'create a background',
      'make a background',
      'generate a wallpaper',
      'create a wallpaper',
      'make a wallpaper',
      'generate a design',
      'create a design',
      'make a design',
      'generate a graphic',
      'create a graphic',
      'make a graphic',
      'generate a visual',
      'create a visual',
      'make a visual',
      'generate an avatar',
      'create an avatar',
      'make an avatar',
      'generate a profile picture',
      'create a profile picture',
      'make a profile picture',
      'generate a profile pic',
      'create a profile pic',
      'make a profile pic',
      'generate a pfp',
      'create a pfp',
      'make a pfp',
      'generate a header',
      'create a header',
      'make a header',
      'generate a cover photo',
      'create a cover photo',
      'make a cover photo',
      'generate a cover image',
      'create a cover image',
      'make a cover image',
      'generate a thumbnail image',
      'create a thumbnail image',
      'make a thumbnail image',
      'generate a thumbnail pic',
      'create a thumbnail pic',
      'make a thumbnail pic',
      'generate a thumbnail photo',
      'create a thumbnail photo',
      'make a thumbnail photo',
      'generate a thumbnail picture',
      'create a thumbnail picture',
      'make a thumbnail picture',
      'generate a thumbnail',
      'create a thumbnail',
      'make a thumbnail',
      'generate a banner image',
      'create a banner image',
      'make a banner image',
      'generate a banner pic',
      'create a banner pic',
      'make a banner pic',
      'generate a banner photo',
      'create a banner photo',
      'make a banner photo',
      'generate a banner picture',
      'create a banner picture',
      'make a banner picture',
      'generate a banner',
      'create a banner',
      'make a banner',
      'generate a poster image',
      'create a poster image',
      'make a poster image',
      'generate a poster pic',
      'create a poster pic',
      'make a poster pic',
      'generate a poster photo',
      'create a poster photo',
      'make a poster photo',
      'generate a poster picture',
      'create a poster picture',
      'make a poster picture',
      'generate a poster',
      'create a poster',
      'make a poster',
      'generate a meme image',
      'create a meme image',
      'make a meme image',
      'generate a meme pic',
      'create a meme pic',
      'make a meme pic',
      'generate a meme photo',
      'create a meme photo',
      'make a meme photo',
      'generate a meme picture',
      'create a meme picture',
      'make a meme picture',
      'generate a meme',
      'create a meme',
      'make a meme',
      'generate a gif image',
      'create a gif image',
      'make a gif image',
      'generate a gif pic',
      'create a gif pic',
      'make a gif pic',
      'generate a gif photo',
      'create a gif photo',
      'make a gif photo',
      'generate a gif picture',
      'create a gif picture',
      'make a gif picture',
      'generate a gif',
      'create a gif',
      'make a gif',
      'generate a sticker image',
      'create a sticker image',
      'make a sticker image',
      'generate a sticker pic',
      'create a sticker pic',
      'make a sticker pic',
      'generate a sticker photo',
      'create a sticker photo',
      'make a sticker photo',
      'generate a sticker picture',
      'create a sticker picture',
      'make a sticker picture',
      'generate a sticker',
      'create a sticker',
      'make a sticker',
      'generate an emoji image',
      'create an emoji image',
      'make an emoji image',
      'generate an emoji pic',
      'create an emoji pic',
      'make an emoji pic',
      'generate an emoji photo',
      'create an emoji photo',
      'make an emoji photo',
      'generate an emoji picture',
      'create an emoji picture',
      'make an emoji picture',
      'generate an emoji',
      'create an emoji',
      'make an emoji',
      'generate a thumbnail image',
      'create a thumbnail image',
      'make a thumbnail image',
      'generate a thumbnail pic',
      'create a thumbnail pic',
      'make a thumbnail pic',
      'generate a thumbnail photo',
      'create a thumbnail photo',
      'make a thumbnail photo',
      'generate a thumbnail picture',
      'create a thumbnail picture',
      'make a thumbnail picture',
      'generate a thumbnail',
      'create a thumbnail',
      'make a thumbnail',
      'generate a cover image',
      'create a cover image',
      'make a cover image',
      'generate a cover pic',
      'create a cover pic',
      'make a cover pic',
      'generate a cover photo',
      'create a cover photo',
      'make a cover photo',
      'generate a cover picture',
      'create a cover picture',
      'make a cover picture',
      'generate a cover',
      'create a cover',
      'make a cover',
      'generate a background image',
      'create a background image',
      'make a background image',
      'generate a background pic',
      'create a background pic',
      'make a background pic',
      'generate a background photo',
      'create a background photo',
      'make a background photo',
      'generate a background picture',
      'create a background picture',
      'make a background picture',
      'generate a background',
      'create a background',
      'make a background',
      'generate a wallpaper image',
      'create a wallpaper image',
      'make a wallpaper image',
      'generate a wallpaper pic',
      'create a wallpaper pic',
      'make a wallpaper pic',
      'generate a wallpaper photo',
      'create a wallpaper photo',
      'make a wallpaper photo',
      'generate a wallpaper picture',
      'create a wallpaper picture',
      'make a wallpaper picture',
      'generate a wallpaper',
      'create a wallpaper',
      'make a wallpaper',
      'generate a design image',
      'create a design image',
      'make a design image',
      'generate a design pic',
      'create a design pic',
      'make a design pic',
      'generate a design photo',
      'create a design photo',
      'make a design photo',
      'generate a design picture',
      'create a design picture',
      'make a design picture',
      'generate a design',
      'create a design',
      'make a design',
      'generate a graphic image',
      'create a graphic image',
      'make a graphic image',
      'generate a graphic pic',
      'create a graphic pic',
      'make a graphic pic',
      'generate a graphic photo',
      'create a graphic photo',
      'make a graphic photo',
      'generate a graphic picture',
      'create a graphic picture',
      'make a graphic picture',
      'generate a graphic',
      'create a graphic',
      'make a graphic',
      'generate a visual image',
      'create a visual image',
      'make a visual image',
      'generate a visual pic',
      'create a visual pic',
      'make a visual pic',
      'generate a visual photo',
      'create a visual photo',
      'make a visual photo',
      'generate a visual picture',
      'create a visual picture',
      'make a visual picture',
      'generate a visual',
      'create a visual',
      'make a visual',
      'generate an avatar image',
      'create an avatar image',
      'make an avatar image',
      'generate an avatar pic',
      'create an avatar pic',
      'make an avatar pic',
      'generate an avatar photo',
      'create an avatar photo',
      'make an avatar photo',
      'generate an avatar picture',
      'create an avatar picture',
      'make an avatar picture',
      'generate an avatar',
      'create an avatar',
      'make an avatar',
      'generate a profile picture image',
      'create a profile picture image',
      'make a profile picture image',
      'generate a profile picture pic',
      'create a profile picture pic',
      'make a profile picture pic',
      'generate a profile picture photo',
      'create a profile picture photo',
      'make a profile picture photo',
      'generate a profile picture',
      'create a profile picture',
      'make a profile picture',
      'generate a profile pic image',
      'create a profile pic image',
      'make a profile pic image',
      'generate a profile pic',
      'create a profile pic',
      'make a profile pic',
      'generate a pfp image',
      'create a pfp image',
      'make a pfp image',
      'generate a pfp pic',
      'create a pfp pic',
      'make a pfp pic',
      'generate a pfp photo',
      'create a pfp photo',
      'make a pfp photo',
      'generate a pfp picture',
      'create a pfp picture',
      'make a pfp picture',
      'generate a pfp',
      'create a pfp',
      'make a pfp',
      'generate a header image',
      'create a header image',
      'make a header image',
      'generate a header pic',
      'create a header pic',
      'make a header pic',
      'generate a header photo',
      'create a header photo',
      'make a header photo',
      'generate a header picture',
      'create a header picture',
      'make a header picture',
      'generate a header',
      'create a header',
      'make a header',
      'generate a cover photo image',
      'create a cover photo image',
      'make a cover photo image',
      'generate a cover photo pic',
      'create a cover photo pic',
      'make a cover photo pic',
      'generate a cover photo',
      'create a cover photo',
      'make a cover photo',
      'generate a cover photo picture',
      'create a cover photo picture',
      'make a cover photo picture',
      'generate a cover image',
      'create a cover image',
      'make a cover image',
      'generate a cover image pic',
      'create a cover image pic',
      'make a cover image pic',
      'generate a cover image photo',
      'create a cover image photo',
      'make a cover image photo',
      'generate a cover image picture',
      'create a cover image picture',
      'make a cover image picture',
      'generate a cover',
      'create a cover',
      'make a cover',
      'generate a thumbnail image',
      'create a thumbnail image',
      'make a thumbnail image',
      'generate a thumbnail pic',
      'create a thumbnail pic',
      'make a thumbnail pic',
      'generate a thumbnail photo',
      'create a thumbnail photo',
      'make a thumbnail photo',
      'generate a thumbnail picture',
      'create a thumbnail picture',
      'make a thumbnail picture',
      'generate a thumbnail',
      'create a thumbnail',
      'make a thumbnail',
      'generate a banner image',
      'create a banner image',
      'make a banner image',
      'generate a banner pic',
      'create a banner pic',
      'make a banner pic',
      'generate a banner photo',
      'create a banner photo',
      'make a banner photo',
      'generate a banner picture',
      'create a banner picture',
      'make a banner picture',
      'generate a banner',
      'create a banner',
      'make a banner',
      'generate a poster image',
      'create a poster image',
      'make a poster image',
      'generate a poster pic',
      'create a poster pic',
      'make a poster pic',
      'generate a poster photo',
      'create a poster photo',
      'make a poster photo',
      'generate a poster picture',
      'create a poster picture',
      'make a poster picture',
      'generate a poster',
      'create a poster',
      'make a poster',
      'generate a meme image',
      'create a meme image',
      'make a meme image',
      'generate a meme pic',
      'create a meme pic',
      'make a meme pic',
      'generate a meme photo',
      'create a meme photo',
      'make a meme photo',
      'generate a meme picture',
      'create a meme picture',
      'make a meme picture',
      'generate a meme',
      'create a meme',
      'make a meme',
      'generate a gif image',
      'create a gif image',
      'make a gif image',
      'generate a gif pic',
      'create a gif pic',
      'make a gif pic',
      'generate a gif photo',
      'create a gif photo',
      'make a gif photo',
      'generate a gif picture',
      'create a gif picture',
      'make a gif picture',
      'generate a gif',
      'create a gif',
      'make a gif',
      'generate a sticker image',
      'create a sticker image',
      'make a sticker image',
      'generate a sticker pic',
      'create a sticker pic',
      'make a sticker pic',
      'generate a sticker photo',
      'create a sticker photo',
      'make a sticker photo',
      'generate a sticker picture',
      'create a sticker picture',
      'make a sticker picture',
      'generate a sticker',
      'create a sticker',
      'make a sticker',
      'generate an emoji image',
      'create an emoji image',
      'make an emoji image',
      'generate an emoji pic',
      'create an emoji pic',
      'make an emoji pic',
      'generate an emoji photo',
      'create an emoji photo',
      'make an emoji photo',
      'generate an emoji picture',
      'create an emoji picture',
      'make an emoji picture',
      'generate an emoji',
      'create an emoji',
      'make an emoji',
      'generate a thumbnail image',
      'create a thumbnail image',
      'make a thumbnail image',
      'generate a thumbnail pic',
      'create a thumbnail pic',
      'make a thumbnail pic',
      'generate a thumbnail photo',
      'create a thumbnail photo',
      'make a thumbnail photo',
      'generate a thumbnail picture',
      'create a thumbnail picture',
      'make a thumbnail picture',
      'generate a thumbnail',
      'create a thumbnail',
      'make a thumbnail',
      'generate a cover image',
      'create a cover image',
      'make a cover image',
      'generate a cover pic',
      'create a cover pic',
      'make a cover pic',
      'generate a cover photo',
      'create a cover photo',
      'make a cover photo',
      'generate a cover picture',
      'create a cover picture',
      'make a cover picture',
      'generate a cover',
      'create a cover',
      'make a cover',
      'generate a background image',
      'create a background image',
      'make a background image',
      'generate a background pic',
      'create a background pic',
      'make a background pic',
      'generate a background photo',
      'create a background photo',
      'make a background photo',
      'generate a background picture',
      'create a background picture',
      'make a background picture',
      'generate a background',
      'create a background',
      'make a background',
      'generate a wallpaper image',
      'create a wallpaper image',
      'make a wallpaper image',
      'generate a wallpaper pic',
      'create a wallpaper pic',
      'make a wallpaper pic',
      'generate a wallpaper photo',
      'create a wallpaper photo',
      'make a wallpaper photo',
      'generate a wallpaper picture',
      'create a wallpaper picture',
      'make a wallpaper picture',
      'generate a wallpaper',
      'create a wallpaper',
      'make a wallpaper',
      'generate a design image',
      'create a design image',
      'make a design image',
      'generate a design pic',
      'create a design pic',
      'make a design pic',
      'generate a design photo',
      'create a design photo',
      'make a design photo',
      'generate a design picture',
      'create a design picture',
      'make a design picture',
      'generate a design',
      'create a design',
      'make a design',
      'generate a graphic image',
      'create a graphic image',
      'make a graphic image',
      'generate a graphic pic',
      'create a graphic pic',
      'make a graphic pic',
      'generate a graphic photo',
      'create a graphic photo',
      'make a graphic photo',
      'generate a graphic picture',
      'create a graphic picture',
      'make a graphic picture',
      'generate a graphic',
      'create a graphic',
      'make a graphic',
      'generate a visual image',
      'create a visual image',
      'make a visual image',
      'generate a visual pic',
      'create a visual pic',
      'make a visual pic',
      'generate a visual photo',
      'create a visual photo',
      'make a visual photo',
      'generate a visual picture',
      'create a visual picture',
      'make a visual picture',
      'generate a visual',
      'create a visual',
      'make a visual',
      'generate an avatar image',
      'create an avatar image',
      'make an avatar image',
      'generate an avatar pic',
      'create an avatar pic',
      'make an avatar pic',
      'generate an avatar photo',
      'create an avatar photo',
      'make an avatar photo',
      'generate an avatar picture',
      'create an avatar picture',
      'make an avatar picture',
      'generate an avatar',
      'create an avatar',
      'make an avatar',
      'generate a profile picture image',
      'create a profile picture image',
      'make a profile picture image',
      'generate a profile picture pic',
      'create a profile picture pic',
      'make a profile picture pic',
      'generate a profile picture photo',
      'create a profile picture photo',
      'make a profile picture photo',
      'generate a profile picture',
      'create a profile picture',
      'make a profile picture',
      'generate a profile pic image',
      'create a profile pic image',
      'make a profile pic image',
      'generate a profile pic',
      'create a profile pic',
      'make a profile pic',
      'generate a pfp image',
      'create a pfp image',
      'make a pfp image',
      'generate a pfp pic',
      'create a pfp pic',
      'make a pfp pic',
      'generate a pfp photo',
      'create a pfp photo',
      'make a pfp photo',
      'generate a pfp picture',
      'create a pfp picture',
      'make a pfp picture',
      'generate a pfp',
      'create a pfp',
      'make a pfp',
      'generate a header image',
      'create a header image',
      'make a header image',
      'generate a header pic',
      'create a header pic',
      'make a header pic',
      'generate a header photo',
      'create a header photo',
      'make a header photo',
      'generate a header picture',
      'create a header picture',
      'make a header picture',
      'generate a header',
      'create a header',
      'make a header',
      'generate a cover photo image',
      'create a cover photo image',
      'make a cover photo image',
      'generate a cover photo pic',
      'create a cover photo pic',
      'make a cover photo pic',
      'generate a cover photo',
      'create a cover photo',
      'make a cover photo',
      'generate a cover photo picture',
      'create a cover photo picture',
      'make a cover photo picture',
      'generate a cover image',
      'create a cover image',
      'make a cover image',
      'generate a cover image pic',
      'create a cover image pic',
      'make a cover image pic',
      'generate a cover image photo',
      'create a cover image photo',
      'make a cover image photo',
      'generate a cover image picture',
      'create a cover image picture',
      'make a cover image picture',
      'generate a cover',
      'create a cover',
      'make a cover'
    ];
    
    for (const keyword of imageKeywords) {
      if (lowerMessage.includes(keyword)) {
        return true;
      }
    }
    
    return false;
  }

  // CRITICAL: New method to check if a message is requesting video generation
  isVideoGenerationRequest(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    
    // Check for explicit video generation requests
    const videoKeywords = [
      'generate a video',
      'create a video',
      'make a video',
      'generate a clip',
      'create a clip',
      'make a clip',
      'generate a movie',
      'create a movie',
      'make a movie',
      'generate an animation',
      'create an animation',
      'make an animation',
      'generate a short',
      'create a short',
      'make a short',
      'generate a film',
      'create a film',
      'make a film',
      'generate a reel',
      'create a reel',
      'make a reel',
      'generate a tiktok',
      'create a tiktok',
      'make a tiktok',
      'generate a youtube',
      'create a youtube',
      'make a youtube',
      'generate a youtube video',
      'create a youtube video',
      'make a youtube video',
      'generate a youtube clip',
      'create a youtube clip',
      'make a youtube clip',
      'generate a youtube short',
      'create a youtube short',
      'make a youtube short',
      'generate a tiktok video',
      'create a tiktok video',
      'make a tiktok video',
      'generate a tiktok clip',
      'create a tiktok clip',
      'make a tiktok clip',
      'generate a tiktok short',
      'create a tiktok short',
      'make a tiktok short',
      'generate a reel video',
      'create a reel video',
      'make a reel video',
      'generate a reel clip',
      'create a reel clip',
      'make a reel clip',
      'generate a reel short',
      'create a reel short',
      'make a reel short',
      'generate a short video',
      'create a short video',
      'make a short video',
      'generate a short clip',
      'create a short clip',
      'make a short clip',
      'generate a short film',
      'create a short film',
      'make a short film',
      'generate a film clip',
      'create a film clip',
      'make a film clip',
      'generate a movie clip',
      'create a movie clip',
      'make a movie clip',
      'generate an animation clip',
      'create an animation clip',
      'make an animation clip',
      'generate an animated video',
      'create an animated video',
      'make an animated video',
      'generate an animated clip',
      'create an animated clip',
      'make an animated clip',
      'generate an animated short',
      'create an animated short',
      'make an animated short',
      'generate an animated film',
      'create an animated film',
      'make an animated film',
      'generate an animated movie',
      'create an animated movie',
      'make an animated movie'
    ];
    
    for (const keyword of videoKeywords) {
      if (lowerMessage.includes(keyword)) {
        return true;
      }
    }
    
    return false;
  }

  async generateImage(prompt: string, modelId: string, apiKey: string, signal?: AbortSignal): Promise<string[]> {
    try {
      // In a real implementation, this would call the Imagerouter API
      // For now, we'll return a placeholder image URL
      console.log(`Generating image with model ${modelId} for prompt: ${prompt}`);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Return a placeholder image URL
      return ['https://images.pexels.com/photos/1252890/pexels-photo-1252890.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1'];
    } catch (error) {
      console.error('Failed to generate image:', error);
      throw error;
    }
  }

  // CRITICAL: New method to generate video
  async generateVideo(prompt: string, modelId: string, apiKey: string, signal?: AbortSignal): Promise<string[]> {
    try {
      // In a real implementation, this would call the Imagerouter API
      // For now, we'll return a placeholder video URL
      console.log(`Generating video with model ${modelId} for prompt: ${prompt}`);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Return a placeholder video URL
      return ['https://www.pexels.com/download/video/3045163/'];
    } catch (error) {
      console.error('Failed to generate video:', error);
      throw error;
    }
  }

  private getFallbackModels(): ImageModel[] {
    return [
      {
        id: 'stabilityai/sdxl-turbo:free',
        name: 'SDXL Turbo (Free)',
        description: 'Fast image generation with Stable Diffusion XL Turbo',
        pricing: { type: 'fixed', value: 0 },
        arena_score: 1031,
        release_date: '2024-10-22',
        examples: [{ image: '/model-examples/sdxl-turbo.webp' }],
        output: ['image'],
        supported_params: { quality: false, edit: false, mask: false },
        providers: [
          { id: 'deepinfra', model_name: 'stabilityai/sdxl-turbo', pricing: { type: 'fixed', value: 0 } }
        ]
      },
      {
        id: 'black-forest-labs/FLUX-1-schnell:free',
        name: 'FLUX Schnell (Free)',
        description: 'Fast and efficient image generation',
        pricing: { type: 'fixed', value: 0 },
        arena_score: 1000,
        release_date: '2024-08-01',
        examples: [{ image: '/model-examples/FLUX-1-schnell.webp' }],
        output: ['image'],
        supported_params: { quality: false, edit: false, mask: false },
        providers: [
          { id: 'deepinfra', model_name: 'black-forest-labs/FLUX-1-schnell', pricing: { type: 'fixed', value: 0 } }
        ]
      },
      {
        id: 'openai/dall-e-3',
        name: 'DALL-E 3',
        description: 'OpenAI\'s advanced image generation model',
        pricing: { type: 'calculated', range: { min: 0.04, average: 0.04, max: 0.08 } },
        arena_score: 937,
        release_date: '2023-10-20',
        examples: [{ image: '/model-examples/dall-e-3.webp' }],
        output: ['image'],
        supported_params: { quality: true, edit: false, mask: false },
        providers: [
          { id: 'openai', model_name: 'dall-e-3', pricing: { type: 'calculated', range: { min: 0.04, average: 0.04, max: 0.08 } } }
        ]
      },
      {
        id: 'stabilityai/sdxl',
        name: 'Stable Diffusion XL',
        description: 'High-quality image generation with Stable Diffusion XL',
        pricing: { type: 'post_generation', range: { min: 0.0013, average: 0.0019, max: 0.0038 } },
        release_date: '2023-07-25',
        examples: [{ image: '/model-examples/sdxl-2025-06-15T16-05-42-225Z.webp' }],
        output: ['image'],
        supported_params: { quality: true, edit: false, mask: false },
        providers: [
          { id: 'runware', model_name: 'civitai:101055@128078', pricing: { type: 'post_generation', range: { min: 0.0013, average: 0.0019, max: 0.0038 } } }
        ]
      },
      {
        id: 'google/veo-2',
        name: 'Google Veo 2',
        description: 'Google\'s video generation model',
        pricing: { type: 'fixed', value: 1.75 },
        arena_score: 1104,
        release_date: '2024-12-16',
        examples: [{ video: '/model-examples/veo-2-2025-05-27T22-57-10-794Z.webm' }],
        output: ['video'],
        supported_params: { quality: false, edit: false, mask: false },
        providers: [
          { id: 'gemini', model_name: 'veo-2.0-generate-001', pricing: { type: 'fixed', value: 1.75 } }
        ]
      },
      {
        id: 'google/veo-3',
        name: 'Google Veo 3',
        description: 'Google\'s advanced video generation model',
        pricing: { type: 'fixed', value: 6 },
        arena_score: 1174,
        release_date: '2025-05-20',
        examples: [{ video: '/model-examples/veo-3.webm' }],
        output: ['video'],
        supported_params: { quality: false, edit: false, mask: false },
        providers: [
          { id: 'replicate', model_name: 'google/veo-3', pricing: { type: 'fixed', value: 6 } }
        ]
      },
      {
        id: 'kwaivgi/kling-1.6-standard',
        name: 'Kling 1.6 Standard',
        description: 'High-quality video generation model',
        pricing: { type: 'fixed', value: 0.25 },
        arena_score: 1024,
        release_date: '2024-12-19',
        examples: [{ video: '/model-examples/kling-1.6-standard.webm' }],
        output: ['video'],
        supported_params: { quality: false, edit: false, mask: false },
        providers: [
          { id: 'replicate', model_name: 'kwaivgi/kling-v1.6-standard', pricing: { type: 'fixed', value: 0.25 } }
        ]
      },
      {
        id: 'bytedance/seedance-1-lite',
        name: 'Seedance 1 Lite',
        description: 'Fast and efficient video generation',
        pricing: { type: 'fixed', value: 0.186 },
        arena_score: 1197,
        release_date: '2025-06-16',
        examples: [{ video: '/model-examples/seedance-1-2025-06-16T19-01-20-528Z.webm' }],
        output: ['video'],
        supported_params: { quality: false, edit: false, mask: false },
        providers: [
          { id: 'fal', model_name: 'fal-ai/bytedance/seedance/v1/lite/text-to-video', pricing: { type: 'fixed', value: 0.186 } }
        ]
      },
      {
        id: 'ir/test-video',
        name: 'Test Video (Free)',
        description: 'Free test video generation model',
        pricing: { type: 'fixed', value: 0 },
        arena_score: 0,
        release_date: '2025-05-04',
        examples: [{ video: 'https://raw.githubusercontent.com/DaWe35/image-router/refs/heads/main/src/shared/videoModels/test/big_buck_bunny_720p_1mb.mp4' }],
        output: ['video'],
        supported_params: { quality: true, edit: true, mask: true },
        providers: [
          { id: 'test', model_name: 'ir/test-video', pricing: { type: 'fixed', value: 0 } }
        ]
      }
    ];
  }
}

export const imageRouterService = new ImageRouterService();
export type { ImageModel };
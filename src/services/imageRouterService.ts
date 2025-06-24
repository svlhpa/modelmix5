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
    
    // CRITICAL: Fix to properly detect "generate image" and similar phrases
    if (lowerMessage.includes("generate image") || 
        lowerMessage.includes("generate an image") || 
        lowerMessage.includes("generate a image")) {
      return true;
    }
    
    // Check for explicit image generation requests
    const imageKeywords = [
      'generate image',
      'create image',
      'make image',
      'draw',
      'generate picture',
      'create picture',
      'make picture',
      'generate photo',
      'create photo',
      'make photo',
      'generate illustration',
      'create illustration',
      'make illustration',
      'generate artwork',
      'create artwork',
      'make artwork',
      'generate drawing',
      'create drawing',
      'make drawing',
      'generate painting',
      'create painting',
      'make painting',
      'generate portrait',
      'create portrait',
      'make portrait',
      'generate scene',
      'create scene',
      'make scene',
      'generate landscape',
      'create landscape',
      'make landscape',
      'generate logo',
      'create logo',
      'make logo',
      'generate icon',
      'create icon',
      'make icon',
      'generate banner',
      'create banner',
      'make banner',
      'generate poster',
      'create poster',
      'make poster',
      'generate meme',
      'create meme',
      'make meme',
      'generate gif',
      'create gif',
      'make gif',
      'generate sticker',
      'create sticker',
      'make sticker',
      'generate emoji',
      'create emoji',
      'make emoji',
      'generate thumbnail',
      'create thumbnail',
      'make thumbnail',
      'generate cover',
      'create cover',
      'make cover',
      'generate background',
      'create background',
      'make background',
      'generate wallpaper',
      'create wallpaper',
      'make wallpaper',
      'generate design',
      'create design',
      'make design',
      'generate graphic',
      'create graphic',
      'make graphic',
      'generate visual',
      'create visual',
      'make visual',
      'generate avatar',
      'create avatar',
      'make avatar',
      'generate profile picture',
      'create profile picture',
      'make profile picture',
      'generate profile pic',
      'create profile pic',
      'make profile pic',
      'generate pfp',
      'create pfp',
      'make pfp',
      'generate header',
      'create header',
      'make header',
      'generate cover photo',
      'create cover photo',
      'make cover photo',
      'generate cover image',
      'create cover image',
      'make cover image',
      'generate thumbnail image',
      'create thumbnail image',
      'make thumbnail image',
      'generate thumbnail pic',
      'create thumbnail pic',
      'make thumbnail pic',
      'generate thumbnail photo',
      'create thumbnail photo',
      'make thumbnail photo',
      'generate thumbnail picture',
      'create thumbnail picture',
      'make thumbnail picture',
      'generate thumbnail',
      'create thumbnail',
      'make thumbnail',
      'generate banner image',
      'create banner image',
      'make banner image',
      'generate banner pic',
      'create banner pic',
      'make banner pic',
      'generate banner photo',
      'create banner photo',
      'make banner photo',
      'generate banner picture',
      'create banner picture',
      'make banner picture',
      'generate banner',
      'create banner',
      'make banner',
      'generate poster image',
      'create poster image',
      'make poster image',
      'generate poster pic',
      'create poster pic',
      'make poster pic',
      'generate poster photo',
      'create poster photo',
      'make poster photo',
      'generate poster picture',
      'create poster picture',
      'make poster picture',
      'generate poster',
      'create poster',
      'make poster',
      'generate meme image',
      'create meme image',
      'make meme image',
      'generate meme pic',
      'create meme pic',
      'make meme pic',
      'generate meme photo',
      'create meme photo',
      'make meme photo',
      'generate meme picture',
      'create meme picture',
      'make meme picture',
      'generate meme',
      'create meme',
      'make meme',
      'generate gif image',
      'create gif image',
      'make gif image',
      'generate gif pic',
      'create gif pic',
      'make gif pic',
      'generate gif photo',
      'create gif photo',
      'make gif photo',
      'generate gif picture',
      'create gif picture',
      'make gif picture',
      'generate gif',
      'create gif',
      'make gif',
      'generate sticker image',
      'create sticker image',
      'make sticker image',
      'generate sticker pic',
      'create sticker pic',
      'make sticker pic',
      'generate sticker photo',
      'create sticker photo',
      'make sticker photo',
      'generate sticker picture',
      'create sticker picture',
      'make sticker picture',
      'generate sticker',
      'create sticker',
      'make sticker',
      'generate emoji image',
      'create emoji image',
      'make emoji image',
      'generate emoji pic',
      'create emoji pic',
      'make emoji pic',
      'generate emoji photo',
      'create emoji photo',
      'make emoji photo',
      'generate emoji picture',
      'create emoji picture',
      'make emoji picture',
      'generate emoji',
      'create emoji',
      'make emoji',
      'generate thumbnail image',
      'create thumbnail image',
      'make thumbnail image',
      'generate thumbnail pic',
      'create thumbnail pic',
      'make thumbnail pic',
      'generate thumbnail photo',
      'create thumbnail photo',
      'make thumbnail photo',
      'generate thumbnail picture',
      'create thumbnail picture',
      'make thumbnail picture',
      'generate thumbnail',
      'create thumbnail',
      'make thumbnail',
      'generate cover image',
      'create cover image',
      'make cover image',
      'generate cover pic',
      'create cover pic',
      'make cover pic',
      'generate cover photo',
      'create cover photo',
      'make cover photo',
      'generate cover picture',
      'create cover picture',
      'make cover picture',
      'generate cover',
      'create cover',
      'make cover',
      'generate background image',
      'create background image',
      'make background image',
      'generate background pic',
      'create background pic',
      'make background pic',
      'generate background photo',
      'create background photo',
      'make background photo',
      'generate background picture',
      'create background picture',
      'make background picture',
      'generate background',
      'create background',
      'make background',
      'generate wallpaper image',
      'create wallpaper image',
      'make wallpaper image',
      'generate wallpaper pic',
      'create wallpaper pic',
      'make wallpaper pic',
      'generate wallpaper photo',
      'create wallpaper photo',
      'make wallpaper photo',
      'generate wallpaper picture',
      'create wallpaper picture',
      'make wallpaper picture',
      'generate wallpaper',
      'create wallpaper',
      'make wallpaper',
      'generate design image',
      'create design image',
      'make design image',
      'generate design pic',
      'create design pic',
      'make design pic',
      'generate design photo',
      'create design photo',
      'make design photo',
      'generate design picture',
      'create design picture',
      'make design picture',
      'generate design',
      'create design',
      'make design',
      'generate graphic image',
      'create graphic image',
      'make graphic image',
      'generate graphic pic',
      'create graphic pic',
      'make graphic pic',
      'generate graphic photo',
      'create graphic photo',
      'make graphic photo',
      'generate graphic picture',
      'create graphic picture',
      'make graphic picture',
      'generate graphic',
      'create graphic',
      'make graphic',
      'generate visual image',
      'create visual image',
      'make visual image',
      'generate visual pic',
      'create visual pic',
      'make visual pic',
      'generate visual photo',
      'create visual photo',
      'make visual photo',
      'generate visual picture',
      'create visual picture',
      'make visual picture',
      'generate visual',
      'create visual',
      'make visual',
      'generate avatar image',
      'create avatar image',
      'make avatar image',
      'generate avatar pic',
      'create avatar pic',
      'make avatar pic',
      'generate avatar photo',
      'create avatar photo',
      'make avatar photo',
      'generate avatar picture',
      'create avatar picture',
      'make avatar picture',
      'generate avatar',
      'create avatar',
      'make avatar',
      'generate profile picture image',
      'create profile picture image',
      'make profile picture image',
      'generate profile picture pic',
      'create profile picture pic',
      'make profile picture pic',
      'generate profile picture photo',
      'create profile picture photo',
      'make profile picture photo',
      'generate profile picture',
      'create profile picture',
      'make profile picture',
      'generate profile pic image',
      'create profile pic image',
      'make profile pic image',
      'generate profile pic',
      'create profile pic',
      'make profile pic',
      'generate pfp image',
      'create pfp image',
      'make pfp image',
      'generate pfp pic',
      'create pfp pic',
      'make pfp pic',
      'generate pfp photo',
      'create pfp photo',
      'make pfp photo',
      'generate pfp picture',
      'create pfp picture',
      'make pfp picture',
      'generate pfp',
      'create pfp',
      'make pfp',
      'generate header image',
      'create header image',
      'make header image',
      'generate header pic',
      'create header pic',
      'make header pic',
      'generate header photo',
      'create header photo',
      'make header photo',
      'generate header picture',
      'create header picture',
      'make header picture',
      'generate header',
      'create header',
      'make header',
      'generate cover photo image',
      'create cover photo image',
      'make cover photo image',
      'generate cover photo pic',
      'create cover photo pic',
      'make cover photo pic',
      'generate cover photo',
      'create cover photo',
      'make cover photo',
      'generate cover photo picture',
      'create cover photo picture',
      'make cover photo picture',
      'generate cover image',
      'create cover image',
      'make cover image',
      'generate cover image pic',
      'create cover image pic',
      'make cover image pic',
      'generate cover image photo',
      'create cover image photo',
      'make cover image photo',
      'generate cover image picture',
      'create cover image picture',
      'make cover image picture',
      'generate cover',
      'create cover',
      'make cover'
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
    
    // CRITICAL: Fix to properly detect "generate video" and similar phrases
    if (lowerMessage.includes("generate video") || 
        lowerMessage.includes("generate a video") || 
        lowerMessage.includes("generate an video")) {
      return true;
    }
    
    // Check for explicit video generation requests
    const videoKeywords = [
      'generate video',
      'create video',
      'make video',
      'generate clip',
      'create clip',
      'make clip',
      'generate movie',
      'create movie',
      'make movie',
      'generate animation',
      'create animation',
      'make animation',
      'generate short',
      'create short',
      'make short',
      'generate film',
      'create film',
      'make film',
      'generate reel',
      'create reel',
      'make reel',
      'generate tiktok',
      'create tiktok',
      'make tiktok',
      'generate youtube',
      'create youtube',
      'make youtube',
      'generate youtube video',
      'create youtube video',
      'make youtube video',
      'generate youtube clip',
      'create youtube clip',
      'make youtube clip',
      'generate youtube short',
      'create youtube short',
      'make youtube short',
      'generate tiktok video',
      'create tiktok video',
      'make tiktok video',
      'generate tiktok clip',
      'create tiktok clip',
      'make tiktok clip',
      'generate tiktok short',
      'create tiktok short',
      'make tiktok short',
      'generate reel video',
      'create reel video',
      'make reel video',
      'generate reel clip',
      'create reel clip',
      'make reel clip',
      'generate reel short',
      'create reel short',
      'make reel short',
      'generate short video',
      'create short video',
      'make short video',
      'generate short clip',
      'create short clip',
      'make short clip',
      'generate short film',
      'create short film',
      'make short film',
      'generate film clip',
      'create film clip',
      'make film clip',
      'generate movie clip',
      'create movie clip',
      'make movie clip',
      'generate animation clip',
      'create animation clip',
      'make animation clip',
      'generate animated video',
      'create animated video',
      'make animated video',
      'generate animated clip',
      'create animated clip',
      'make animated clip',
      'generate animated short',
      'create animated short',
      'make animated short',
      'generate animated film',
      'create animated film',
      'make animated film',
      'generate animated movie',
      'create animated movie',
      'make animated movie'
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
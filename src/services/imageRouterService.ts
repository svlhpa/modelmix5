import { ImageModel, APISettings } from '../types';

interface ImageGenerationResponse {
  data: Array<{
    url: string;
  }>;
}

class ImageRouterService {
  private models: ImageModel[] = [];
  private lastFetch: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Image models data from the provided JSON
  private imageModelsData = {
    "black-forest-labs/FLUX-1.1-pro": {
      "providers": [{"id": "deepinfra", "model_name": "black-forest-labs/FLUX-1.1-pro", "pricing": {"type": "fixed", "value": 0.04}}],
      "arena_score": 1085,
      "release_date": "2024-11-02",
      "examples": [{"image": "/model-examples/FLUX-1.1-pro.webp"}],
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "black-forest-labs/FLUX-1-schnell:free": {
      "providers": [{"id": "deepinfra", "model_name": "black-forest-labs/FLUX-1-schnell", "pricing": {"type": "fixed", "value": 0}}],
      "arena_score": 1000,
      "release_date": "2024-08-01",
      "examples": [{"image": "/model-examples/FLUX-1-schnell.webp"}],
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "black-forest-labs/FLUX-1-dev": {
      "providers": [{"id": "runware", "model_name": "runware:101@1", "pricing": {"type": "post_generation", "range": {"min": 0.0026, "average": 0.0038, "max": 0.0045}}}],
      "arena_score": 1046,
      "release_date": "2024-08-01",
      "examples": [{"image": "/model-examples/FLUX-1-dev.webp"}],
      "output": ["image"],
      "supported_params": {"quality": true, "edit": false, "mask": false}
    },
    "black-forest-labs/FLUX-pro": {
      "providers": [{"id": "deepinfra", "model_name": "black-forest-labs/FLUX-pro", "pricing": {"type": "fixed", "value": 0.05}}],
      "arena_score": 1069,
      "release_date": "2024-08-01",
      "examples": [{"image": "/model-examples/FLUX-pro-2025-04-03T14-14-55-833Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "stabilityai/sdxl-turbo:free": {
      "providers": [{"id": "deepinfra", "model_name": "stabilityai/sdxl-turbo", "pricing": {"type": "fixed", "value": 0}}],
      "arena_score": 1031,
      "release_date": "2024-10-22",
      "examples": [{"image": "/model-examples/sdxl-turbo.webp"}],
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "openai/dall-e-3": {
      "providers": [{"id": "openai", "model_name": "dall-e-3", "pricing": {"type": "calculated", "range": {"min": 0.04, "average": 0.04, "max": 0.08}}}],
      "arena_score": 937,
      "release_date": "2023-10-20",
      "examples": [{"image": "/model-examples/dall-e-3.webp"}],
      "output": ["image"],
      "supported_params": {"quality": true, "edit": false, "mask": false}
    },
    "recraft-ai/recraft-v3": {
      "providers": [{"id": "replicate", "model_name": "recraft-ai/recraft-v3", "pricing": {"type": "fixed", "value": 0.04}}],
      "arena_score": 1110,
      "release_date": "2024-10-30",
      "examples": [{"image": "/model-examples/recraft-v3-2025-04-03T15-09-40-800Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "ideogram-ai/ideogram-v3": {
      "providers": [{"id": "replicate", "model_name": "ideogram-ai/ideogram-v3", "pricing": {"type": "calculated", "range": {"min": 0.04, "average": 0.07, "max": 0.1}}}],
      "arena_score": 1088,
      "release_date": "2025-03-26",
      "examples": [{"image": "/model-examples/ideogram-v3-2025-05-06T13-16-26-069Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": true, "edit": false, "mask": false}
    },
    "google/imagen-4": {
      "providers": [{"id": "vertex", "model_name": "imagen-4.0-generate-preview-06-06", "pricing": {"type": "fixed", "value": 0.04}}],
      "release_date": "2025-06-06",
      "arena_score": 1106,
      "examples": [{"image": "/model-examples/imagen-4.webp"}],
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "luma/photon": {
      "providers": [{"id": "replicate", "model_name": "luma/photon", "pricing": {"type": "fixed", "value": 0.03}}],
      "arena_score": 1035,
      "release_date": "2024-12-03",
      "examples": [{"image": "/model-examples/photon-2025-04-03T15-07-51-501Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "minimax/image-01": {
      "providers": [{"id": "replicate", "model_name": "minimax/image-01", "pricing": {"type": "fixed", "value": 0.01}}],
      "arena_score": 1049,
      "release_date": "2025-03-05",
      "examples": [{"image": "/model-examples/image-01.webp"}],
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "test/test": {
      "providers": [{"id": "test", "model_name": "test/test", "pricing": {"type": "fixed", "value": 0}}],
      "arena_score": 0,
      "release_date": "2025-05-04",
      "examples": [{"image": "/model-examples/test.webp"}],
      "output": ["image"],
      "supported_params": {"quality": true, "edit": true, "mask": true}
    }
  };

  async getAvailableModels(): Promise<ImageModel[]> {
    const now = Date.now();
    
    // Return cached models if they're still fresh
    if (this.models.length > 0 && (now - this.lastFetch) < this.CACHE_DURATION) {
      return this.models;
    }

    // Convert the static data to ImageModel format
    this.models = Object.entries(this.imageModelsData).map(([id, data]) => ({
      id,
      name: this.getDisplayName(id),
      description: this.getDescription(id),
      pricing: data.providers[0]?.pricing || { type: 'fixed', value: 0 },
      arena_score: data.arena_score,
      release_date: data.release_date,
      examples: data.examples,
      output: data.output,
      supported_params: data.supported_params,
      providers: data.providers
    }));

    // Sort by arena score (highest first), then by free models
    this.models.sort((a, b) => {
      const aIsFree = this.isFreeModel(a);
      const bIsFree = this.isFreeModel(b);
      
      if (aIsFree && !bIsFree) return -1;
      if (!aIsFree && bIsFree) return 1;
      
      return (b.arena_score || 0) - (a.arena_score || 0);
    });

    this.lastFetch = now;
    return this.models;
  }

  private getDisplayName(id: string): string {
    const nameMap: Record<string, string> = {
      'black-forest-labs/FLUX-1.1-pro': 'FLUX 1.1 Pro',
      'black-forest-labs/FLUX-1-schnell:free': 'FLUX Schnell (Free)',
      'black-forest-labs/FLUX-1-dev': 'FLUX Dev',
      'black-forest-labs/FLUX-pro': 'FLUX Pro',
      'stabilityai/sdxl-turbo:free': 'SDXL Turbo (Free)',
      'openai/dall-e-3': 'DALL-E 3',
      'recraft-ai/recraft-v3': 'Recraft V3',
      'ideogram-ai/ideogram-v3': 'Ideogram V3',
      'google/imagen-4': 'Imagen 4',
      'luma/photon': 'Luma Photon',
      'minimax/image-01': 'MiniMax Image-01',
      'test/test': 'Test Model'
    };
    return nameMap[id] || id;
  }

  private getDescription(id: string): string {
    const descMap: Record<string, string> = {
      'black-forest-labs/FLUX-1.1-pro': 'High-quality image generation with excellent prompt following',
      'black-forest-labs/FLUX-1-schnell:free': 'Fast, free image generation with good quality',
      'black-forest-labs/FLUX-1-dev': 'Development version with advanced features',
      'black-forest-labs/FLUX-pro': 'Professional-grade image generation',
      'stabilityai/sdxl-turbo:free': 'Fast, free Stable Diffusion model',
      'openai/dall-e-3': 'OpenAI\'s advanced image generation model',
      'recraft-ai/recraft-v3': 'High-quality artistic image generation',
      'ideogram-ai/ideogram-v3': 'Excellent text rendering in images',
      'google/imagen-4': 'Google\'s latest image generation model',
      'luma/photon': 'Photorealistic image generation',
      'minimax/image-01': 'Efficient image generation model',
      'test/test': 'Test model for development'
    };
    return descMap[id] || 'AI image generation model';
  }

  isFreeModel(model: ImageModel): boolean {
    return model.pricing.value === 0 || model.id.includes(':free');
  }

  getModelCategories(models: ImageModel[]): Record<string, ImageModel[]> {
    const categories: Record<string, ImageModel[]> = {
      'Free Models': [],
      'FLUX Models': [],
      'Stability AI': [],
      'OpenAI': [],
      'Google': [],
      'Other Models': []
    };

    models.forEach(model => {
      const isFree = this.isFreeModel(model);
      const modelId = model.id.toLowerCase();

      if (isFree) {
        categories['Free Models'].push(model);
      } else if (modelId.includes('flux')) {
        categories['FLUX Models'].push(model);
      } else if (modelId.includes('stability') || modelId.includes('sdxl')) {
        categories['Stability AI'].push(model);
      } else if (modelId.includes('openai') || modelId.includes('dall-e')) {
        categories['OpenAI'].push(model);
      } else if (modelId.includes('google') || modelId.includes('imagen')) {
        categories['Google'].push(model);
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

  async generateImage(
    prompt: string,
    modelId: string,
    apiKey: string,
    signal?: AbortSignal
  ): Promise<string[]> {
    if (!apiKey) {
      throw new Error('Imagerouter API key not configured');
    }

    const response = await fetch('https://api.imagerouter.io/v1/openai/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt,
        model: modelId
      }),
      signal
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `Imagerouter API error: ${response.status}`);
    }

    const data: ImageGenerationResponse = await response.json();
    return data.data.map(item => item.url);
  }

  // Detect if a user message is requesting image generation
  isImageGenerationRequest(message: string): boolean {
    const imageKeywords = [
      'generate image', 'create image', 'make image', 'draw', 'paint', 'sketch',
      'generate picture', 'create picture', 'make picture', 'illustration',
      'generate art', 'create art', 'make art', 'artwork', 'visual',
      'show me', 'picture of', 'image of', 'photo of', 'drawing of',
      'generate a', 'create a', 'make a', 'design', 'visualize'
    ];

    const messageLower = message.toLowerCase();
    return imageKeywords.some(keyword => messageLower.includes(keyword));
  }

  getModelIcon(model: ImageModel): string {
    const modelId = model.id.toLowerCase();
    
    if (modelId.includes('flux')) return '⚡';
    if (modelId.includes('dall-e') || modelId.includes('openai')) return '🎨';
    if (modelId.includes('stability') || modelId.includes('sdxl')) return '🎭';
    if (modelId.includes('imagen') || modelId.includes('google')) return '🖼️';
    if (modelId.includes('recraft')) return '🎪';
    if (modelId.includes('ideogram')) return '📝';
    if (modelId.includes('luma')) return '📸';
    if (modelId.includes('minimax')) return '🔥';
    if (modelId.includes('test')) return '🧪';
    
    return '🎨';
  }
}

export const imageRouterService = new ImageRouterService();
export type { ImageModel };
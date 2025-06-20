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

  // Complete image models data from the provided JSON - all 59 models
  private imageModelsData = {
    "black-forest-labs/FLUX-1.1-pro": {
      "providers": [{"id": "deepinfra", "model_name": "black-forest-labs/FLUX-1.1-pro", "pricing": {"type": "fixed", "value": 0.04}}],
      "arena_score": 1085,
      "release_date": "2024-11-02",
      "examples": [{"image": "/model-examples/FLUX-1.1-pro.webp"}],
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "black-forest-labs/FLUX-1-schnell": {
      "providers": [{"id": "runware", "model_name": "runware:100@1", "pricing": {"type": "post_generation", "range": {"min": 0.0006, "average": 0.0013, "max": 0.0019}}}],
      "arena_score": 1000,
      "release_date": "2024-08-01",
      "examples": [{"image": "/model-examples/flux-schnell-4-steps.webp"}],
      "output": ["image"],
      "supported_params": {"quality": true, "edit": false, "mask": false}
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
    "black-forest-labs/flux-1.1-pro-ultra": {
      "providers": [{"id": "replicate", "model_name": "black-forest-labs/flux-1.1-pro-ultra", "pricing": {"type": "fixed", "value": 0.06}}],
      "arena_score": 1094,
      "release_date": "2024-11-06",
      "examples": [{"image": "/model-examples/flux-1.1-pro-ultra-2025-04-03T15-49-06-132Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "black-forest-labs/flux-kontext-pro": {
      "providers": [{"id": "replicate", "model_name": "black-forest-labs/flux-kontext-pro", "pricing": {"type": "fixed", "value": 0.04}}],
      "arena_score": 1076,
      "release_date": "2025-05-29",
      "examples": [{"image": "/model-examples/flux-1-kontext-pro-2025-05-30T19-06-27-208Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": false, "edit": true, "mask": false}
    },
    "black-forest-labs/flux-kontext-max": {
      "providers": [{"id": "replicate", "model_name": "black-forest-labs/flux-kontext-max", "pricing": {"type": "fixed", "value": 0.08}}],
      "arena_score": 1103,
      "release_date": "2025-05-29",
      "examples": [{"image": "/model-examples/flux-1-kontext-max.webp"}],
      "output": ["image"],
      "supported_params": {"quality": false, "edit": true, "mask": false}
    },
    "stabilityai/sd1.5-dpo": {
      "providers": [{"id": "runware", "model_name": "civitai:240850@271743", "pricing": {"type": "post_generation", "range": {"min": 0.0013, "average": 0.0019, "max": 0.0038}}}],
      "release_date": "2022-10-20",
      "examples": [{"image": "/model-examples/sd1.5-dpo-2025-06-15T16-14-50-412Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": true, "edit": false, "mask": false}
    },
    "stabilityai/sd3.5-medium": {
      "providers": [{"id": "deepinfra", "model_name": "stabilityai/sd3.5-medium", "pricing": {"type": "fixed", "value": 0.03}}],
      "arena_score": 928,
      "release_date": "2024-10-22",
      "examples": [{"image": "/model-examples/sd3.5-medium.webp"}],
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "stabilityai/sd3.5": {
      "providers": [{"id": "deepinfra", "model_name": "stabilityai/sd3.5", "pricing": {"type": "fixed", "value": 0.06}}],
      "arena_score": 1028,
      "release_date": "2024-10-22",
      "examples": [{"image": "/model-examples/sd3.5.webp"}],
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "stabilityai/sdxl": {
      "providers": [{"id": "runware", "model_name": "civitai:101055@128078", "pricing": {"type": "post_generation", "range": {"min": 0.0013, "average": 0.0019, "max": 0.0038}}}],
      "release_date": "2023-07-25",
      "examples": [{"image": "/model-examples/sdxl-2025-06-15T16-05-42-225Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": true, "edit": false, "mask": false}
    },
    "stabilityai/sdxl-turbo": {
      "providers": [{"id": "deepinfra", "model_name": "stabilityai/sdxl-turbo", "pricing": {"type": "fixed", "value": 0.0002}}],
      "arena_score": 1031,
      "release_date": "2024-10-22",
      "examples": [{"image": "/model-examples/sdxl-turbo.webp"}],
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
    "stabilityai/sd3": {
      "providers": [{"id": "runware", "model_name": "runware:5@1", "pricing": {"type": "post_generation", "range": {"min": 0.0006, "average": 0.0019, "max": 0.0064}}}],
      "arena_score": 1015,
      "release_date": "2025-06-01",
      "examples": [{"image": "/model-examples/sd3-2025-06-15T13-09-47-800Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": true, "edit": true, "mask": true}
    },
    "run-diffusion/Juggernaut-Flux": {
      "providers": [{"id": "runware", "model_name": "rundiffusion:120@100", "pricing": {"type": "post_generation", "range": {"min": 0.0025, "average": 0.005, "max": 0.0095}}}, {"id": "deepinfra", "model_name": "run-diffusion/Juggernaut-Flux", "pricing": {"type": "fixed", "value": 0.009}}],
      "release_date": "2025-03-05",
      "examples": [{"image": "/model-examples/Juggernaut-Flux-2025-04-03T14-15-04-136Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": true, "edit": false, "mask": false}
    },
    "run-diffusion/Juggernaut-Lightning-Flux": {
      "providers": [{"id": "runware", "model_name": "rundiffusion:110@101", "pricing": {"type": "post_generation", "range": {"min": 0.0008, "average": 0.0017, "max": 0.0034}}}, {"id": "deepinfra", "model_name": "run-diffusion/Juggernaut-Lightning-Flux", "pricing": {"type": "fixed", "value": 0.009}}],
      "release_date": "2025-03-05",
      "examples": [{"image": "/model-examples/Juggernaut-Lightning-Flux-2025-04-03T14-15-05-487Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": true, "edit": false, "mask": false}
    },
    "run-diffusion/Juggernaut-Pro-Flux": {
      "providers": [{"id": "runware", "model_name": "rundiffusion:130@100", "pricing": {"type": "post_generation", "range": {"min": 0.0025, "average": 0.005, "max": 0.0095}}}],
      "release_date": "2025-03-05",
      "examples": [{"image": "/model-examples/Juggernaut-Pro-Flux-2025-06-15T17-12-19-100Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": true, "edit": false, "mask": false}
    },
    "run-diffusion/Juggernaut-XL": {
      "providers": [{"id": "runware", "model_name": "civitai:133005@782002", "pricing": {"type": "post_generation", "range": {"min": 0.0025, "average": 0.005, "max": 0.0095}}}],
      "release_date": "2024-08-29",
      "output": ["image"],
      "supported_params": {"quality": true, "edit": false, "mask": false}
    },
    "run-diffusion/RunDiffusion-Photo-Flux": {
      "providers": [{"id": "runware", "model_name": "rundiffusion:500@100", "pricing": {"type": "post_generation", "range": {"min": 0.0025, "average": 0.005, "max": 0.0095}}}],
      "release_date": "2025-03-05",
      "output": ["image"],
      "supported_params": {"quality": true, "edit": false, "mask": false}
    },
    "openai/dall-e-2": {
      "providers": [{"id": "openai", "model_name": "dall-e-2", "pricing": {"type": "fixed", "value": 0.02}}],
      "arena_score": 695,
      "release_date": "2022-04-6",
      "examples": [{"image": "/model-examples/dall-e-2.webp"}],
      "output": ["image"],
      "supported_params": {"quality": true, "edit": false, "mask": false}
    },
    "openai/dall-e-3": {
      "providers": [{"id": "openai", "model_name": "dall-e-3", "pricing": {"type": "calculated", "range": {"min": 0.04, "average": 0.04, "max": 0.08}}}],
      "arena_score": 937,
      "release_date": "2023-10-20",
      "examples": [{"image": "/model-examples/dall-e-3.webp"}],
      "output": ["image"],
      "supported_params": {"quality": true, "edit": false, "mask": false}
    },
    "openai/gpt-image-1": {
      "providers": [{"id": "openai", "model_name": "gpt-image-1", "pricing": {"type": "post_generation", "range": {"min": 0.011, "average": 0.167, "max": 0.5}}}],
      "arena_score": 1151,
      "release_date": "2025-04-23",
      "examples": [{"image": "/model-examples/gpt-image-1-2025-06-15T21-37-41-776Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": true, "edit": true, "mask": true}
    },
    "recraft-ai/recraft-v3": {
      "providers": [{"id": "replicate", "model_name": "recraft-ai/recraft-v3", "pricing": {"type": "fixed", "value": 0.04}}],
      "arena_score": 1110,
      "release_date": "2024-10-30",
      "examples": [{"image": "/model-examples/recraft-v3-2025-04-03T15-09-40-800Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "recraft-ai/recraft-v3-svg": {
      "providers": [{"id": "replicate", "model_name": "recraft-ai/recraft-v3-svg", "pricing": {"type": "fixed", "value": 0.08}}],
      "release_date": "2024-10-30",
      "examples": [{"image": "/model-examples/recraft-v3-svg-2025-04-03T15-34-40-865Z.svg"}],
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "ideogram-ai/ideogram-v2a": {
      "providers": [{"id": "replicate", "model_name": "ideogram-ai/ideogram-v2a", "pricing": {"type": "calculated", "range": {"min": 0.025, "average": 0.04, "max": 0.04}}}],
      "arena_score": 1004,
      "release_date": "2025-02-27",
      "examples": [{"image": "/model-examples/ideogram-v2a-2025-04-03T15-10-14-620Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": true, "edit": false, "mask": false}
    },
    "ideogram-ai/ideogram-v2a-turbo": {
      "providers": [{"id": "replicate", "model_name": "ideogram-ai/ideogram-v2a-turbo", "pricing": {"type": "fixed", "value": 0.025}}],
      "release_date": "2025-02-27",
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "ideogram-ai/ideogram-v3-balanced": {
      "providers": [{"id": "replicate", "model_name": "ideogram-ai/ideogram-v3-balanced", "pricing": {"type": "fixed", "value": 0.07}}],
      "release_date": "2025-03-26",
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "ideogram-ai/ideogram-v3-turbo": {
      "providers": [{"id": "replicate", "model_name": "ideogram-ai/ideogram-v3-turbo", "pricing": {"type": "fixed", "value": 0.04}}],
      "release_date": "2025-03-26",
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "ideogram-ai/ideogram-v3-quality": {
      "providers": [{"id": "replicate", "model_name": "ideogram-ai/ideogram-v3-quality", "pricing": {"type": "fixed", "value": 0.1}}],
      "release_date": "2025-03-26",
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
    "google/imagen-3": {
      "providers": [{"id": "vertex", "model_name": "imagen-3.0-generate-002", "pricing": {"type": "fixed", "value": 0.04}}],
      "arena_score": 1092,
      "release_date": "2024-12-16",
      "examples": [{"image": "/model-examples/imagen-3-2025-04-03T15-11-15-706Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "google/imagen-3-fast": {
      "providers": [{"id": "vertex", "model_name": "imagen-3.0-fast-generate-001", "pricing": {"type": "fixed", "value": 0.02}}],
      "release_date": "2024-12-16",
      "examples": [{"image": "/model-examples/imagen-3-fast-2025-04-03T15-11-16-597Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "google/imagen-4-05-20": {
      "providers": [{"id": "vertex", "model_name": "imagen-4.0-generate-preview-05-20", "pricing": {"type": "fixed", "value": 0.04}}],
      "release_date": "2025-05-20",
      "examples": [{"image": "/model-examples/imagen-4-2025-05-24T20-46-43-888Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "google/imagen-4-ultra-05-20": {
      "providers": [{"id": "vertex", "model_name": "imagen-4.0-ultra-generate-exp-05-20", "pricing": {"type": "fixed", "value": 0.08}}],
      "release_date": "2025-05-20",
      "examples": [{"image": "/model-examples/imagen-4-ultra-2025-05-24T20-51-35-162Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "google/imagen-4-06-06": {
      "providers": [{"id": "vertex", "model_name": "imagen-4.0-generate-preview-06-06", "pricing": {"type": "fixed", "value": 0.04}}],
      "release_date": "2025-06-06",
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "google/imagen-4-fast-06-06": {
      "providers": [{"id": "vertex", "model_name": "imagen-4.0-fast-generate-preview-06-06", "pricing": {"type": "fixed", "value": 0.02}}],
      "release_date": "2025-06-06",
      "examples": [{"image": "/model-examples/imagen-4-fast-06-06-2025-06-14T20-58-35-827Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "google/imagen-4-ultra-06-06": {
      "providers": [{"id": "vertex", "model_name": "imagen-4.0-ultra-generate-preview-06-06", "pricing": {"type": "fixed", "value": 0.06}}],
      "release_date": "2025-06-06",
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "google/imagen-4": {
      "providers": [{"id": "vertex", "model_name": "imagen-4.0-generate-preview-06-06", "pricing": {"type": "fixed", "value": 0.04}}],
      "release_date": "2025-06-06",
      "arena_score": 1106,
      "examples": [{"image": "/model-examples/imagen-4.webp"}],
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "google/imagen-4-ultra": {
      "providers": [{"id": "vertex", "model_name": "imagen-4.0-ultra-generate-preview-06-06", "pricing": {"type": "fixed", "value": 0.06}}],
      "release_date": "2025-06-06",
      "arena_score": 1106,
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "google/imagen-4-fast": {
      "providers": [{"id": "vertex", "model_name": "imagen-4.0-fast-generate-preview-06-06", "pricing": {"type": "fixed", "value": 0.02}}],
      "release_date": "2025-06-06",
      "examples": [{"image": "/model-examples/imagen-4-fast-06-06-2025-06-14T20-58-35-827Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "google/gemini-2.0-flash-exp": {
      "providers": [{"id": "gemini", "model_name": "gemini-2.0-flash-exp-image-generation", "pricing": {"type": "post_generation", "range": {"min": 0.01, "average": 0.01, "max": 0.2}}}],
      "arena_score": 962,
      "release_date": "2025-03-12",
      "examples": [{"image": "/model-examples/gemini-2.0-flash-exp_free-2025-05-13T11-23-59-032Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": false, "edit": true, "mask": false}
    },
    "google/gemini-2.0-flash-exp:free": {
      "providers": [{"id": "gemini", "model_name": "gemini-2.0-flash-exp-image-generation", "pricing": {"type": "fixed", "value": 0}}],
      "arena_score": 962,
      "release_date": "2025-03-12",
      "examples": [{"image": "/model-examples/gemini-2.0-flash-exp_free-2025-05-13T11-23-59-032Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": false, "edit": true, "mask": false}
    },
    "luma/photon": {
      "providers": [{"id": "replicate", "model_name": "luma/photon", "pricing": {"type": "fixed", "value": 0.03}}],
      "arena_score": 1035,
      "release_date": "2024-12-03",
      "examples": [{"image": "/model-examples/photon-2025-04-03T15-07-51-501Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "luma/photon-flash": {
      "providers": [{"id": "replicate", "model_name": "luma/photon-flash", "pricing": {"type": "fixed", "value": 0.01}}],
      "arena_score": 964,
      "release_date": "2024-12-03",
      "examples": [{"image": "/model-examples/photon-flash-2025-04-03T14-22-54-572Z.webp"}],
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
    "Lykon/DreamShaper": {
      "providers": [{"id": "runware", "model_name": "civitai:4384@128713", "pricing": {"type": "post_generation", "range": {"min": 0.0013, "average": 0.0019, "max": 0.0038}}}],
      "release_date": "2023-07-29",
      "examples": [{"image": "/model-examples/DreamShaper-2025-06-15T21-45-26-399Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": true, "edit": false, "mask": false}
    },
    "asiryan/Realistic-Vision": {
      "providers": [{"id": "runware", "model_name": "civitai:4201@130072", "pricing": {"type": "post_generation", "range": {"min": 0.0013, "average": 0.0019, "max": 0.0038}}}],
      "release_date": "2024-02-26",
      "examples": [{"image": "/model-examples/Realistic-Vision-2025-06-15T21-45-24-483Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": true, "edit": false, "mask": false}
    },
    "SG161222/RealVisXL": {
      "providers": [{"id": "runware", "model_name": "civitai:139562@361593", "pricing": {"type": "post_generation", "range": {"min": 0.0013, "average": 0.0019, "max": 0.0038}}}],
      "release_date": "2025-04-18",
      "examples": [{"image": "/model-examples/RealVisXL-2025-06-15T21-45-25-442Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": true, "edit": false, "mask": false}
    },
    "HiDream-ai/HiDream-I1-Fast": {
      "providers": [{"id": "runware", "model_name": "runware:97@3", "pricing": {"type": "post_generation", "range": {"min": 0.0019, "average": 0.0026, "max": 0.0038}}}],
      "arena_score": 1050,
      "release_date": "2025-04-28",
      "examples": [{"image": "/model-examples/HiDream-I1-Fast-2025-06-15T21-29-53-614Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": true, "edit": false, "mask": false}
    },
    "HiDream-ai/HiDream-I1-Dev": {
      "providers": [{"id": "runware", "model_name": "runware:97@2", "pricing": {"type": "post_generation", "range": {"min": 0.0019, "average": 0.0045, "max": 0.008}}}],
      "arena_score": 1082,
      "release_date": "2025-03-05",
      "examples": [{"image": "/model-examples/HiDream-I1-Dev-2025-06-15T21-31-50-531Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": true, "edit": false, "mask": false}
    },
    "HiDream-ai/HiDream-I1-Full": {
      "providers": [{"id": "runware", "model_name": "runware:97@1", "pricing": {"type": "post_generation", "range": {"min": 0.0045, "average": 0.009, "max": 0.015}}}],
      "release_date": "2025-04-28",
      "examples": [{"image": "/model-examples/HiDream-I1-Full-2025-06-15T21-31-49-649Z.webp"}],
      "output": ["image"],
      "supported_params": {"quality": true, "edit": false, "mask": false}
    },
    "bytedance/seedream-3": {
      "providers": [{"id": "fal", "model_name": "fal-ai/bytedance/seedream/v3/text-to-image", "pricing": {"type": "fixed", "value": 0.03}}],
      "release_date": "2025-04-16",
      "arena_score": 1160,
      "examples": [{"image": "/model-examples/seedream-3-2025-06-16T17-59-52-679Z.webp"}],
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
    },
    // Video models (excluded from image generation settings)
    "google/veo-2": {
      "providers": [{"id": "gemini", "model_name": "veo-2.0-generate-001", "pricing": {"type": "fixed", "value": 1.75}}],
      "arena_score": 1104,
      "release_date": "2024-12-16",
      "examples": [{"video": "/model-examples/veo-2-2025-05-27T22-57-10-794Z.webm"}],
      "output": ["video"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "google/veo-3": {
      "providers": [{"id": "replicate", "model_name": "google/veo-3", "pricing": {"type": "fixed", "value": 6}}],
      "arena_score": 1174,
      "release_date": "2025-05-20",
      "examples": [{"video": "/model-examples/veo-3.webm"}],
      "output": ["video"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "kwaivgi/kling-1.6-standard": {
      "providers": [{"id": "replicate", "model_name": "kwaivgi/kling-v1.6-standard", "pricing": {"type": "fixed", "value": 0.25}}],
      "arena_score": 1024,
      "release_date": "2024-12-19",
      "examples": [{"video": "/model-examples/kling-1.6-standard.webm"}],
      "output": ["video"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "bytedance/seedance-1-lite": {
      "providers": [{"id": "fal", "model_name": "fal-ai/bytedance/seedance/v1/lite/text-to-video", "pricing": {"type": "fixed", "value": 0.186}}],
      "arena_score": 1197,
      "release_date": "2025-06-16",
      "examples": [{"video": "/model-examples/seedance-1-2025-06-16T19-01-20-528Z.webm"}],
      "output": ["video"],
      "supported_params": {"quality": false, "edit": false, "mask": false}
    },
    "ir/test-video": {
      "providers": [{"id": "test", "model_name": "ir/test-video", "pricing": {"type": "fixed", "value": 0}}],
      "arena_score": 0,
      "release_date": "2025-05-04",
      "examples": [{"video": "https://raw.githubusercontent.com/DaWe35/image-router/refs/heads/main/src/shared/videoModels/test/big_buck_bunny_720p_1mb.mp4"}],
      "output": ["video"],
      "supported_params": {"quality": true, "edit": true, "mask": true}
    }
  };

  // CRITICAL: Hardcoded free models for free tier users with global access
  private readonly FREE_TIER_MODELS = [
    'stabilityai/sdxl-turbo:free',
    'black-forest-labs/FLUX-1-schnell:free', 
    'test/test'
  ];

  async getAvailableModels(): Promise<ImageModel[]> {
    const now = Date.now();
    
    // Return cached models if they're still fresh
    if (this.models.length > 0 && (now - this.lastFetch) < this.CACHE_DURATION) {
      return this.models;
    }

    // Convert the static data to ImageModel format, filtering only image models
    this.models = Object.entries(this.imageModelsData)
      .filter(([id, data]) => data.output.includes('image')) // Only include image models, exclude video models
      .map(([id, data]) => ({
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

  // CRITICAL: New method to get models available for free tier users with global access
  async getFreeTierModels(): Promise<ImageModel[]> {
    const allModels = await this.getAvailableModels();
    return allModels.filter(model => this.FREE_TIER_MODELS.includes(model.id));
  }

  // CRITICAL: Method to check if user can access a specific model
  canAccessModel(modelId: string, hasPersonalKey: boolean, hasGlobalKey: boolean, isProUser: boolean): boolean {
    if (hasPersonalKey || isProUser) {
      // User has personal key or is Pro - can access all models
      return true;
    } else if (hasGlobalKey && !isProUser) {
      // Free tier user with global key access - only the 3 hardcoded free models
      return this.FREE_TIER_MODELS.includes(modelId);
    } else {
      // No access
      return false;
    }
  }

  private getDisplayName(id: string): string {
    const nameMap: Record<string, string> = {
      'black-forest-labs/FLUX-1.1-pro': 'FLUX 1.1 Pro',
      'black-forest-labs/FLUX-1-schnell': 'FLUX Schnell',
      'black-forest-labs/FLUX-1-schnell:free': 'FLUX Schnell (Free)',
      'black-forest-labs/FLUX-1-dev': 'FLUX Dev',
      'black-forest-labs/FLUX-pro': 'FLUX Pro',
      'black-forest-labs/flux-1.1-pro-ultra': 'FLUX 1.1 Pro Ultra',
      'black-forest-labs/flux-kontext-pro': 'FLUX Kontext Pro',
      'black-forest-labs/flux-kontext-max': 'FLUX Kontext Max',
      'stabilityai/sd1.5-dpo': 'Stable Diffusion 1.5 DPO',
      'stabilityai/sd3.5-medium': 'SD 3.5 Medium',
      'stabilityai/sd3.5': 'SD 3.5',
      'stabilityai/sdxl': 'SDXL',
      'stabilityai/sdxl-turbo': 'SDXL Turbo',
      'stabilityai/sdxl-turbo:free': 'SDXL Turbo (Free)',
      'stabilityai/sd3': 'Stable Diffusion 3',
      'run-diffusion/Juggernaut-Flux': 'Juggernaut FLUX',
      'run-diffusion/Juggernaut-Lightning-Flux': 'Juggernaut Lightning FLUX',
      'run-diffusion/Juggernaut-Pro-Flux': 'Juggernaut Pro FLUX',
      'run-diffusion/Juggernaut-XL': 'Juggernaut XL',
      'run-diffusion/RunDiffusion-Photo-Flux': 'RunDiffusion Photo FLUX',
      'openai/dall-e-2': 'DALL-E 2',
      'openai/dall-e-3': 'DALL-E 3',
      'openai/gpt-image-1': 'GPT Image 1',
      'recraft-ai/recraft-v3': 'Recraft V3',
      'recraft-ai/recraft-v3-svg': 'Recraft V3 SVG',
      'ideogram-ai/ideogram-v2a': 'Ideogram V2a',
      'ideogram-ai/ideogram-v2a-turbo': 'Ideogram V2a Turbo',
      'ideogram-ai/ideogram-v3-balanced': 'Ideogram V3 Balanced',
      'ideogram-ai/ideogram-v3-turbo': 'Ideogram V3 Turbo',
      'ideogram-ai/ideogram-v3-quality': 'Ideogram V3 Quality',
      'ideogram-ai/ideogram-v3': 'Ideogram V3',
      'google/imagen-3': 'Imagen 3',
      'google/imagen-3-fast': 'Imagen 3 Fast',
      'google/imagen-4-05-20': 'Imagen 4 (05-20)',
      'google/imagen-4-ultra-05-20': 'Imagen 4 Ultra (05-20)',
      'google/imagen-4-06-06': 'Imagen 4 (06-06)',
      'google/imagen-4-fast-06-06': 'Imagen 4 Fast (06-06)',
      'google/imagen-4-ultra-06-06': 'Imagen 4 Ultra (06-06)',
      'google/imagen-4': 'Imagen 4',
      'google/imagen-4-ultra': 'Imagen 4 Ultra',
      'google/imagen-4-fast': 'Imagen 4 Fast',
      'google/gemini-2.0-flash-exp': 'Gemini 2.0 Flash Exp',
      'google/gemini-2.0-flash-exp:free': 'Gemini 2.0 Flash Exp (Free)',
      'luma/photon': 'Luma Photon',
      'luma/photon-flash': 'Luma Photon Flash',
      'minimax/image-01': 'MiniMax Image-01',
      'Lykon/DreamShaper': 'DreamShaper',
      'asiryan/Realistic-Vision': 'Realistic Vision',
      'SG161222/RealVisXL': 'RealVisXL',
      'HiDream-ai/HiDream-I1-Fast': 'HiDream I1 Fast',
      'HiDream-ai/HiDream-I1-Dev': 'HiDream I1 Dev',
      'HiDream-ai/HiDream-I1-Full': 'HiDream I1 Full',
      'bytedance/seedream-3': 'SeeDream 3',
      'test/test': 'Test Model'
    };
    return nameMap[id] || id.split('/').pop() || id;
  }

  private getDescription(id: string): string {
    const descMap: Record<string, string> = {
      'black-forest-labs/FLUX-1.1-pro': 'High-quality image generation with excellent prompt following',
      'black-forest-labs/FLUX-1-schnell': 'Fast FLUX model with good quality',
      'black-forest-labs/FLUX-1-schnell:free': 'Fast, free image generation with good quality',
      'black-forest-labs/FLUX-1-dev': 'Development version with advanced features',
      'black-forest-labs/FLUX-pro': 'Professional-grade image generation',
      'black-forest-labs/flux-1.1-pro-ultra': 'Ultra high-quality FLUX model',
      'black-forest-labs/flux-kontext-pro': 'FLUX with context editing capabilities',
      'black-forest-labs/flux-kontext-max': 'Maximum quality FLUX with context editing',
      'stabilityai/sd1.5-dpo': 'Stable Diffusion 1.5 with DPO optimization',
      'stabilityai/sd3.5-medium': 'Medium quality Stable Diffusion 3.5',
      'stabilityai/sd3.5': 'High quality Stable Diffusion 3.5',
      'stabilityai/sdxl': 'Stable Diffusion XL base model',
      'stabilityai/sdxl-turbo': 'Fast Stable Diffusion XL model',
      'stabilityai/sdxl-turbo:free': 'Fast, free Stable Diffusion model',
      'stabilityai/sd3': 'Latest Stable Diffusion 3 model',
      'run-diffusion/Juggernaut-Flux': 'High-quality artistic FLUX variant',
      'run-diffusion/Juggernaut-Lightning-Flux': 'Fast artistic FLUX variant',
      'run-diffusion/Juggernaut-Pro-Flux': 'Professional artistic FLUX variant',
      'run-diffusion/Juggernaut-XL': 'High-quality artistic XL model',
      'run-diffusion/RunDiffusion-Photo-Flux': 'Photorealistic FLUX variant',
      'openai/dall-e-2': 'OpenAI\'s DALL-E 2 image generation',
      'openai/dall-e-3': 'OpenAI\'s advanced DALL-E 3 model',
      'openai/gpt-image-1': 'OpenAI\'s latest image generation model',
      'recraft-ai/recraft-v3': 'High-quality artistic image generation',
      'recraft-ai/recraft-v3-svg': 'SVG vector image generation',
      'ideogram-ai/ideogram-v2a': 'Excellent text rendering in images',
      'ideogram-ai/ideogram-v2a-turbo': 'Fast text rendering model',
      'ideogram-ai/ideogram-v3-balanced': 'Balanced quality and speed',
      'ideogram-ai/ideogram-v3-turbo': 'Fast Ideogram V3 model',
      'ideogram-ai/ideogram-v3-quality': 'Highest quality Ideogram model',
      'ideogram-ai/ideogram-v3': 'Latest Ideogram model with text rendering',
      'google/imagen-3': 'Google\'s Imagen 3 model',
      'google/imagen-3-fast': 'Fast Google Imagen 3 model',
      'google/imagen-4-05-20': 'Google Imagen 4 (May 2025)',
      'google/imagen-4-ultra-05-20': 'Ultra quality Imagen 4 (May 2025)',
      'google/imagen-4-06-06': 'Google Imagen 4 (June 2025)',
      'google/imagen-4-fast-06-06': 'Fast Imagen 4 (June 2025)',
      'google/imagen-4-ultra-06-06': 'Ultra quality Imagen 4 (June 2025)',
      'google/imagen-4': 'Google\'s latest Imagen 4 model',
      'google/imagen-4-ultra': 'Ultra quality Imagen 4',
      'google/imagen-4-fast': 'Fast Imagen 4 model',
      'google/gemini-2.0-flash-exp': 'Gemini 2.0 experimental image generation',
      'google/gemini-2.0-flash-exp:free': 'Free Gemini 2.0 image generation',
      'luma/photon': 'Photorealistic image generation',
      'luma/photon-flash': 'Fast photorealistic generation',
      'minimax/image-01': 'Efficient image generation model',
      'Lykon/DreamShaper': 'Artistic dream-like image generation',
      'asiryan/Realistic-Vision': 'Highly realistic image generation',
      'SG161222/RealVisXL': 'Realistic vision XL model',
      'HiDream-ai/HiDream-I1-Fast': 'Fast high-quality image generation',
      'HiDream-ai/HiDream-I1-Dev': 'Development version with advanced features',
      'HiDream-ai/HiDream-I1-Full': 'Full quality HiDream model',
      'bytedance/seedream-3': 'ByteDance\'s SeeDream 3 model',
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
      'Ideogram': [],
      'RunDiffusion': [],
      'Other Models': []
    };

    models.forEach(model => {
      const isFree = this.isFreeModel(model);
      const modelId = model.id.toLowerCase();

      if (isFree) {
        categories['Free Models'].push(model);
      } else if (modelId.includes('flux')) {
        categories['FLUX Models'].push(model);
      } else if (modelId.includes('stability') || modelId.includes('sd') || modelId.includes('sdxl')) {
        categories['Stability AI'].push(model);
      } else if (modelId.includes('openai') || modelId.includes('dall-e') || modelId.includes('gpt-image')) {
        categories['OpenAI'].push(model);
      } else if (modelId.includes('google') || modelId.includes('imagen') || modelId.includes('gemini')) {
        categories['Google'].push(model);
      } else if (modelId.includes('ideogram')) {
        categories['Ideogram'].push(model);
      } else if (modelId.includes('run-diffusion') || modelId.includes('juggernaut')) {
        categories['RunDiffusion'].push(model);
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
    if (modelId.includes('dall-e') || modelId.includes('openai') || modelId.includes('gpt-image')) return '🎨';
    if (modelId.includes('stability') || modelId.includes('sd')) return '🎭';
    if (modelId.includes('imagen') || modelId.includes('google') || modelId.includes('gemini')) return '🖼️';
    if (modelId.includes('recraft')) return '🎪';
    if (modelId.includes('ideogram')) return '📝';
    if (modelId.includes('luma') || modelId.includes('photon')) return '📸';
    if (modelId.includes('minimax')) return '🔥';
    if (modelId.includes('juggernaut') || modelId.includes('run-diffusion')) return '🎯';
    if (modelId.includes('hidream')) return '💫';
    if (modelId.includes('seedream') || modelId.includes('bytedance')) return '🌱';
    if (modelId.includes('dreamshaper') || modelId.includes('lykon')) return '✨';
    if (modelId.includes('realistic') || modelId.includes('realvis')) return '📷';
    if (modelId.includes('test')) return '🧪';
    
    return '🎨';
  }
}

export const imageRouterService = new ImageRouterService();
export type { ImageModel };
export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  provider?: string;
  images?: string[]; // Base64 encoded images
  generatedImages?: string[]; // URLs to generated images
  isImageGeneration?: boolean; // Flag to indicate this is an image generation response
  audioUrl?: string; // URL to generated audio for TTS
}

export interface APIResponse {
  provider: string;
  content: string;
  loading: boolean;
  error?: string;
  selected?: boolean;
  generatedImages?: string[]; // URLs to generated images
  isImageGeneration?: boolean; // Flag to indicate this is an image generation response
  audioUrl?: string; // URL to generated audio for TTS
}

export interface APISettings {
  openai: string;
  openrouter: string;
  gemini: string;
  deepseek: string;
  serper: string;
  imagerouter: string;
  elevenlabs: string; // Added Eleven Labs API key
  openai_whisper: string; // Added OpenAI Whisper API key for STT
}

export interface OpenRouterModelSettings {
  [modelId: string]: boolean;
}

export interface ImageModelSettings {
  [modelId: string]: boolean;
}

export interface ModelSettings {
  openai: boolean;
  gemini: boolean;
  deepseek: boolean;
  openrouter_models: OpenRouterModelSettings;
  image_models: ImageModelSettings;
}

export interface VoiceChatSettings {
  voiceId: string;
  voiceName: string;
  rolePlayPrompt: string;
  autoPlayTTS: boolean;
  sttLanguage: string;
  voiceStability: number;
  voiceSimilarity: number;
  voiceStyle: number;
  useSpeakerBoost: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationTurn {
  id: string;
  userMessage: string;
  responses: APIResponse[];
  selectedResponse?: APIResponse;
  timestamp: Date;
  images?: string[]; // Base64 encoded images
}

export interface ProviderStats {
  provider: string;
  totalSelections: number;
  totalResponses: number;
  selectionRate: number;
  avgResponseTime: number;
  errorRate: number;
  lastUsed: Date;
}

export type UserTier = 'tier1' | 'tier2';

export interface UserSubscription {
  id: string;
  user_id: string;
  tier: UserTier;
  status: 'active' | 'cancelled' | 'expired';
  started_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TierLimits {
  tier: UserTier;
  name: string;
  monthlyConversations: number;
  maxModelsPerComparison: number;
  features: string[];
  price: number; // in cents, 0 for free
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'user' | 'superadmin';
  current_tier: UserTier;
  monthly_conversations: number;
  last_reset_date: string;
  created_at: string;
  updated_at: string;
}

// Image generation model interface
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

// File upload interface
export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
  uploadedAt: Date;
  expiresAt: Date;
}
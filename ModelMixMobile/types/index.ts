export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  provider?: string;
  images?: string[];
}

export interface APIResponse {
  provider: string;
  content: string;
  loading: boolean;
  error?: string;
  selected?: boolean;
}

export interface APISettings {
  openai: string;
  openrouter: string;
  gemini: string;
  deepseek: string;
  serper: string;
}

export interface ModelSettings {
  openai: boolean;
  gemini: boolean;
  deepseek: boolean;
  openrouter_models: { [modelId: string]: boolean };
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
  images?: string[];
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

export interface TierLimits {
  tier: UserTier;
  name: string;
  monthlyConversations: number;
  maxModelsPerComparison: number;
  features: string[];
  price: number;
}
export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  provider?: string;
  images?: string[]; // Base64 encoded images
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
}

export interface OpenRouterModelSettings {
  [modelId: string]: boolean;
}

export interface ModelSettings {
  openai: boolean;
  gemini: boolean;
  deepseek: boolean;
  openrouter_models: OpenRouterModelSettings;
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
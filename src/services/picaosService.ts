import { UserTier } from '../types';
import { adminSettingsService } from './adminSettingsService';

interface PicaOSWorkflow {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  progress: number;
  created_at: string;
  updated_at: string;
  result?: any;
  error?: string;
}

interface PicaOSTask {
  id: string;
  workflow_id: string;
  name: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  input: any;
  output?: any;
  error?: string;
  created_at: string;
  updated_at: string;
}

interface WriteupWorkflowInput {
  prompt: string;
  settings: {
    targetLength: string;
    customWordCount?: number;
    style: string;
    tone: string;
    format: string;
    includeReferences: boolean;
    enableReview: boolean;
    euModelsOnly: boolean;
  };
  userTier: UserTier;
}

interface WriteupSection {
  id: string;
  title: string;
  content: string;
  wordCount: number;
  model: string;
  status: 'pending' | 'writing' | 'completed' | 'error';
}

class PicaOSService {
  private readonly API_BASE_URL = 'https://api.pica-os.com/v1';
  private apiKey: string | null = null;

  constructor() {
    // API key will be loaded from admin settings
    this.loadApiKey();
  }

  private async loadApiKey(): Promise<void> {
    try {
      this.apiKey = await adminSettingsService.getPicaosApiKey();
      console.log('PicaOS API key loaded:', this.apiKey ? 'Present' : 'Not configured');
    } catch (error) {
      console.error('Failed to load PicaOS API key:', error);
      this.apiKey = null;
    }
  }

  // Create a comprehensive writeup workflow in PicaOS
  async createWriteupWorkflow(input: WriteupWorkflowInput): Promise<PicaOSWorkflow> {
    // Ensure API key is loaded
    if (!this.apiKey) {
      await this.loadApiKey();
    }
    
    if (!this.apiKey) {
      throw new Error('PicaOS API key not configured. Please contact an administrator.');
    }

    try {
      console.log('🚀 Creating PicaOS writeup workflow...');
      
      const workflowDefinition = {
        name: `Writeup: ${this.generateTitle(input.prompt)}`,
        description: `AI-orchestrated ${input.settings.format} generation`,
        workflow: {
          steps: [
            {
              id: 'planning',
              name: 'Document Planning',
              type: 'ai_planning',
              config: {
                model: 'claude-3.5-sonnet',
                prompt: this.generatePlanningPrompt(input),
                output_format: 'json'
              }
            },
            {
              id: 'outline_generation',
              name: 'Outline Generation',
              type: 'ai_generation',
              depends_on: ['planning'],
              config: {
                model: 'gpt-4o',
                prompt: 'Generate detailed outline based on planning results',
                max_tokens: 2000
              }
            },
            {
              id: 'section_writing',
              name: 'Section Writing',
              type: 'parallel_ai_generation',
              depends_on: ['outline_generation'],
              config: {
                models: this.selectOptimalModels(input.settings, input.userTier),
                section_strategy: 'distributed',
                quality_threshold: 0.8,
                retry_limit: 3
              }
            },
            {
              id: 'content_review',
              name: 'Content Review & Refinement',
              type: 'ai_review',
              depends_on: ['section_writing'],
              config: {
                model: 'claude-3.5-sonnet',
                review_criteria: [
                  'coherence',
                  'completeness',
                  'style_consistency',
                  'factual_accuracy'
                ],
                auto_fix: input.settings.enableReview
              }
            },
            {
              id: 'final_assembly',
              name: 'Document Assembly',
              type: 'document_assembly',
              depends_on: ['content_review'],
              config: {
                format: input.settings.format,
                include_references: input.settings.includeReferences,
                style: input.settings.style,
                tone: input.settings.tone
              }
            }
          ]
        },
        metadata: {
          user_tier: input.userTier,
          target_words: this.getTargetWordCount(input.settings),
          estimated_duration: this.estimateWorkflowDuration(input.settings)
        }
      };

      const response = await fetch(`${this.API_BASE_URL}/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Client': 'ModelMix-WriteupAgent'
        },
        body: JSON.stringify(workflowDefinition)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`PicaOS API error: ${response.status} - ${errorData.message || response.statusText}`);
      }

      const workflow = await response.json();
      console.log('✅ PicaOS workflow created:', workflow.id);
      
      return workflow;
    } catch (error) {
      console.error('❌ Failed to create PicaOS workflow:', error);
      throw new Error(`Failed to create writeup workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Start workflow execution
  async startWorkflow(workflowId: string): Promise<void> {
    if (!this.apiKey) {
      await this.loadApiKey();
      if (!this.apiKey) {
        throw new Error('PicaOS API key not configured');
      }
    }

    try {
      console.log(`▶️ Starting PicaOS workflow: ${workflowId}`);
      
      const response = await fetch(`${this.API_BASE_URL}/workflows/${workflowId}/start`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Client': 'ModelMix-WriteupAgent'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to start workflow: ${response.status} - ${errorData.message || response.statusText}`);
      }

      console.log('✅ Workflow started successfully');
    } catch (error) {
      console.error('❌ Failed to start workflow:', error);
      throw error;
    }
  }

  // Get workflow status and progress
  async getWorkflowStatus(workflowId: string): Promise<PicaOSWorkflow> {
    if (!this.apiKey) {
      await this.loadApiKey();
      if (!this.apiKey) {
        throw new Error('PicaOS API key not configured');
      }
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/workflows/${workflowId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Client': 'ModelMix-WriteupAgent'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to get workflow status: ${response.status} - ${errorData.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Failed to get workflow status:', error);
      throw error;
    }
  }

  // Get workflow tasks for detailed progress
  async getWorkflowTasks(workflowId: string): Promise<PicaOSTask[]> {
    if (!this.apiKey) {
      await this.loadApiKey();
      if (!this.apiKey) {
        throw new Error('PicaOS API key not configured');
      }
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/workflows/${workflowId}/tasks`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Client': 'ModelMix-WriteupAgent'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to get workflow tasks: ${response.status} - ${errorData.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Failed to get workflow tasks:', error);
      throw error;
    }
  }

  // Pause workflow execution
  async pauseWorkflow(workflowId: string): Promise<void> {
    if (!this.apiKey) {
      await this.loadApiKey();
      if (!this.apiKey) {
        throw new Error('PicaOS API key not configured');
      }
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/workflows/${workflowId}/pause`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Client': 'ModelMix-WriteupAgent'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to pause workflow: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Failed to pause workflow:', error);
      throw error;
    }
  }

  // Resume workflow execution
  async resumeWorkflow(workflowId: string): Promise<void> {
    if (!this.apiKey) {
      await this.loadApiKey();
      if (!this.apiKey) {
        throw new Error('PicaOS API key not configured');
      }
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/workflows/${workflowId}/resume`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Client': 'ModelMix-WriteupAgent'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to resume workflow: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Failed to resume workflow:', error);
      throw error;
    }
  }

  // Get final workflow result
  async getWorkflowResult(workflowId: string): Promise<{
    title: string;
    sections: WriteupSection[];
    wordCount: number;
    metadata: any;
  }> {
    if (!this.apiKey) {
      await this.loadApiKey();
      if (!this.apiKey) {
        throw new Error('PicaOS API key not configured');
      }
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/workflows/${workflowId}/result`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Client': 'ModelMix-WriteupAgent'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to get workflow result: ${response.status} - ${errorData.message || response.statusText}`);
      }

      const result = await response.json();
      
      // Transform PicaOS result to our format
      return {
        title: result.document?.title || 'Generated Document',
        sections: result.document?.sections?.map((section: any, index: number) => ({
          id: `section-${index + 1}`,
          title: section.title,
          content: section.content,
          wordCount: this.countWords(section.content),
          model: section.model || 'PicaOS Orchestrated',
          status: 'completed' as const
        })) || [],
        wordCount: result.document?.total_words || 0,
        metadata: result.metadata || {}
      };
    } catch (error) {
      console.error('❌ Failed to get workflow result:', error);
      throw error;
    }
  }

  // Test PicaOS connection
  async testConnection(): Promise<boolean> {
    if (!this.apiKey) {
      await this.loadApiKey();
      if (!this.apiKey) {
        return false;
      }
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/health`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Client': 'ModelMix-WriteupAgent'
        }
      });

      return response.ok;
    } catch (error) {
      console.error('❌ PicaOS connection test failed:', error);
      return false;
    }
  }

  // Helper methods
  private generatePlanningPrompt(input: WriteupWorkflowInput): string {
    const targetWords = this.getTargetWordCount(input.settings);
    
    return `You are an expert content strategist planning a comprehensive ${input.settings.format}.

Topic: "${input.prompt}"

Requirements:
- Target length: ${targetWords} words
- Style: ${input.settings.style}
- Tone: ${input.settings.tone}
- Format: ${input.settings.format}
- Include references: ${input.settings.includeReferences}

Create a detailed content strategy including:
1. Document structure and section breakdown
2. Key themes and arguments to cover
3. Research areas and reference requirements
4. Writing approach for each section
5. Quality criteria and success metrics

Output your plan as structured JSON with clear sections and requirements.`;
  }

  private selectOptimalModels(settings: any, userTier: UserTier): string[] {
    // Select best models based on document type and user tier
    const models = [];
    
    if (userTier === 'tier2') {
      // Pro users get premium models
      models.push('claude-3.5-sonnet', 'gpt-4o', 'gemini-1.5-pro');
      
      if (settings.style === 'academic') {
        models.push('claude-3-opus'); // Best for academic writing
      }
      
      if (settings.style === 'creative') {
        models.push('claude-3.5-sonnet', 'gpt-4o-creative'); // Best for creative writing
      }
    } else {
      // Free tier gets good but limited models
      models.push('gpt-4o-mini', 'claude-3-haiku', 'gemini-1.5-flash');
    }
    
    return models;
  }

  private getTargetWordCount(settings: any): number {
    switch (settings.targetLength) {
      case 'short': return 25000;
      case 'medium': return 50000;
      case 'long': return 100000;
      case 'custom': return settings.customWordCount || 50000;
      default: return 50000;
    }
  }

  private estimateWorkflowDuration(settings: any): number {
    const wordCount = this.getTargetWordCount(settings);
    const baseMinutes = Math.ceil(wordCount / 1000) * 2; // 2 minutes per 1000 words
    
    // Add time for review if enabled
    if (settings.enableReview) {
      return baseMinutes * 1.5;
    }
    
    return baseMinutes;
  }

  private generateTitle(prompt: string): string {
    return prompt.split(' ').slice(0, 8).join(' ').replace(/[^\w\s]/g, '').trim();
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  // Get available PicaOS models
  async getAvailableModels(): Promise<string[]> {
    if (!this.apiKey) {
      await this.loadApiKey();
      if (!this.apiKey) {
        return ['claude-3.5-sonnet', 'gpt-4o', 'gemini-1.5-pro']; // Fallback
      }
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Client': 'ModelMix-WriteupAgent'
        }
      });

      if (!response.ok) {
        return ['claude-3.5-sonnet', 'gpt-4o', 'gemini-1.5-pro']; // Fallback
      }

      const data = await response.json();
      return data.models || [];
    } catch (error) {
      console.error('Failed to get available models:', error);
      return ['claude-3.5-sonnet', 'gpt-4o', 'gemini-1.5-pro']; // Fallback
    }
  }

  // Get workflow analytics
  async getWorkflowAnalytics(workflowId: string): Promise<any> {
    if (!this.apiKey) {
      await this.loadApiKey();
      if (!this.apiKey) {
        return null;
      }
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/workflows/${workflowId}/analytics`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Client': 'ModelMix-WriteupAgent'
        }
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get workflow analytics:', error);
      return null;
    }
  }
}

export const picaosService = new PicaOSService();
export type { PicaOSWorkflow, PicaOSTask, WriteupWorkflowInput };
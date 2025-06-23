import { UserTier } from '../types';
import { adminSettingsService } from './adminSettingsService';
import { globalApiService } from './globalApiService';

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

interface PicaOSConnector {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
}

class PicaOSService {
  private readonly API_BASE_URL = 'https://api.picaos.com/v1';
  private apiKey: string | null = null;

  constructor() {
    // API key will be loaded from admin settings
    this.loadApiKey();
  }

  private async loadApiKey(): Promise<void> {
    try {
      // First try to get from admin settings
      let key = await adminSettingsService.getPicaosApiKey();
      
      // If not found, try global API keys
      if (!key) {
        key = await globalApiService.getGlobalApiKey('picaos', 'tier2');
      }
      
      this.apiKey = key;
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
      
      // First, create or get user
      const userEmail = `user-${Date.now()}@modelmix.app`;
      const userResponse = await fetch(`${this.API_BASE_URL}/internal/v3/users/create-or-get`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pica-secret': this.apiKey
        },
        body: JSON.stringify({
          email: userEmail
        })
      });

      if (!userResponse.ok) {
        const errorData = await userResponse.json().catch(() => ({}));
        throw new Error(`PicaOS user creation failed: ${userResponse.status} - ${errorData.message || userResponse.statusText}`);
      }

      const userData = await userResponse.json();
      const userId = userData.id;
      
      // Get available connectors
      const connectorsResponse = await fetch(`${this.API_BASE_URL}/available-connectors`, {
        headers: {
          'x-pica-secret': this.apiKey
        }
      });

      if (!connectorsResponse.ok) {
        const errorData = await connectorsResponse.json().catch(() => ({}));
        throw new Error(`Failed to get connectors: ${connectorsResponse.status} - ${errorData.message || connectorsResponse.statusText}`);
      }

      const connectors = await connectorsResponse.json();
      console.log(`Available connectors: ${connectors.length}`);
      
      // Get available actions for a specific connector (e.g., 'exa')
      const actionsResponse = await fetch(`${this.API_BASE_URL}/available-actions/exa`, {
        headers: {
          'x-pica-secret': this.apiKey
        }
      });

      if (!actionsResponse.ok) {
        const errorData = await actionsResponse.json().catch(() => ({}));
        throw new Error(`Failed to get actions: ${actionsResponse.status} - ${errorData.message || actionsResponse.statusText}`);
      }

      const actions = await actionsResponse.json();
      console.log(`Available actions: ${actions.length}`);
      
      // Create workflow
      const workflowResponse = await fetch(`${this.API_BASE_URL}/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pica-secret': this.apiKey
        },
        body: JSON.stringify({
          name: `Writeup: ${this.generateTitle(input.prompt)}`,
          description: `AI-orchestrated ${input.settings.format} generation`,
          user_id: userId,
          steps: [
            {
              name: "Document Planning",
              action: "exa.generate",
              input: {
                prompt: this.generatePlanningPrompt(input),
                model: "claude-3-5-sonnet",
                max_tokens: 2000
              }
            },
            {
              name: "Outline Generation",
              action: "exa.generate",
              input: {
                prompt: "Generate detailed outline based on planning results",
                model: "gpt-4o",
                max_tokens: 2000
              },
              depends_on: ["Document Planning"]
            }
          ],
          metadata: {
            user_tier: input.userTier,
            target_words: this.getTargetWordCount(input.settings),
            format: input.settings.format,
            style: input.settings.style,
            tone: input.settings.tone
          }
        })
      });

      if (!workflowResponse.ok) {
        const errorData = await workflowResponse.json().catch(() => ({}));
        throw new Error(`PicaOS workflow creation failed: ${workflowResponse.status} - ${errorData.message || workflowResponse.statusText}`);
      }

      const workflow = await workflowResponse.json();
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
          'x-pica-secret': this.apiKey
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
          'x-pica-secret': this.apiKey
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
          'x-pica-secret': this.apiKey
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
          'x-pica-secret': this.apiKey
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
          'x-pica-secret': this.apiKey
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
          'x-pica-secret': this.apiKey
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

  // Get available connectors
  async getAvailableConnectors(): Promise<PicaOSConnector[]> {
    if (!this.apiKey) {
      await this.loadApiKey();
      if (!this.apiKey) {
        throw new Error('PicaOS API key not configured');
      }
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/available-connectors`, {
        headers: {
          'x-pica-secret': this.apiKey
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to get connectors: ${response.status} - ${errorData.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Failed to get connectors:', error);
      throw error;
    }
  }

  // Get available actions for a connector
  async getAvailableActions(connectorId: string): Promise<any[]> {
    if (!this.apiKey) {
      await this.loadApiKey();
      if (!this.apiKey) {
        throw new Error('PicaOS API key not configured');
      }
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/available-actions/${connectorId}`, {
        headers: {
          'x-pica-secret': this.apiKey
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to get actions: ${response.status} - ${errorData.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Failed to get actions:', error);
      throw error;
    }
  }

  // List connections in the vault
  async listConnections(): Promise<any[]> {
    if (!this.apiKey) {
      await this.loadApiKey();
      if (!this.apiKey) {
        throw new Error('PicaOS API key not configured');
      }
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/vault/connections`, {
        headers: {
          'x-pica-secret': this.apiKey
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to list connections: ${response.status} - ${errorData.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Failed to list connections:', error);
      throw error;
    }
  }

  // Test PicaOS connection
  async testConnection(): Promise<boolean> {
    if (!this.apiKey) {
      await this.loadApiKey();
      if (!this.apiKey) {
        console.log('PicaOS API key not configured');
        return false;
      }
    }

    try {
      console.log('Testing PicaOS connection...');
      const response = await fetch(`${this.API_BASE_URL}/health`, {
        headers: {
          'x-pica-secret': this.apiKey
        }
      });

      const isConnected = response.ok;
      console.log(`PicaOS connection test result: ${isConnected ? 'Success' : 'Failed'}`);
      return isConnected;
    } catch (error) {
      console.error('❌ PicaOS connection test failed:', error);
      return false;
    }
  }

  // Check if PicaOS is available for the current user
  async isAvailableForUser(userTier: UserTier): Promise<boolean> {
    // Only Pro users can access PicaOS
    if (userTier !== 'tier2') {
      console.log('PicaOS is only available for Pro users');
      return false;
    }
    
    // Check if API key is configured
    if (!this.apiKey) {
      await this.loadApiKey();
    }
    
    if (!this.apiKey) {
      console.log('PicaOS API key not configured');
      return false;
    }
    
    // Test connection
    return await this.testConnection();
  }

  // Get deployment status
  async getDeploymentStatus(): Promise<{ status: string; message: string }> {
    try {
      // Check if API key is configured
      if (!this.apiKey) {
        await this.loadApiKey();
      }
      
      if (!this.apiKey) {
        return {
          status: 'not_configured',
          message: 'PicaOS API key is not configured'
        };
      }
      
      // Test connection to PicaOS API
      const isConnected = await this.testConnection();
      
      if (!isConnected) {
        return {
          status: 'connection_failed',
          message: 'Failed to connect to PicaOS API'
        };
      }
      
      return {
        status: 'deployed',
        message: 'PicaOS is properly configured and connected'
      };
    } catch (error) {
      console.error('Error checking PicaOS deployment status:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
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

  private getTargetWordCount(settings: any): number {
    switch (settings.targetLength) {
      case 'short': return 25000;
      case 'medium': return 50000;
      case 'long': return 100000;
      case 'custom': return settings.customWordCount || 50000;
      default: return 50000;
    }
  }

  private generateTitle(prompt: string): string {
    return prompt.split(' ').slice(0, 8).join(' ').replace(/[^\w\s]/g, '').trim();
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
}

export const picaosService = new PicaOSService();
export type { PicaOSWorkflow, PicaOSTask, WriteupWorkflowInput };
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

class PicaOSService {
  // Using a mock API endpoint for demonstration
  private readonly API_BASE_URL = 'https://api.picaos.com/v1';
  private apiKey: string | null = null;
  private mockMode: boolean = true; // Enable mock mode for demonstration
  private mockWorkflows: Map<string, any> = new Map();
  private mockTasks: Map<string, any[]> = new Map();
  private mockResults: Map<string, any> = new Map();

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
    
    if (!this.apiKey && !this.mockMode) {
      throw new Error('PicaOS API key not configured. Please contact an administrator.');
    }

    try {
      console.log('🚀 Creating PicaOS writeup workflow...');
      
      if (this.mockMode) {
        return this.mockCreateWorkflow(input);
      }
      
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
    if (!this.apiKey && !this.mockMode) {
      await this.loadApiKey();
      if (!this.apiKey && !this.mockMode) {
        throw new Error('PicaOS API key not configured');
      }
    }

    try {
      console.log(`▶️ Starting PicaOS workflow: ${workflowId}`);
      
      if (this.mockMode) {
        this.mockStartWorkflow(workflowId);
        return;
      }
      
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
    if (!this.apiKey && !this.mockMode) {
      await this.loadApiKey();
      if (!this.apiKey && !this.mockMode) {
        throw new Error('PicaOS API key not configured');
      }
    }

    try {
      if (this.mockMode) {
        return this.mockGetWorkflowStatus(workflowId);
      }
      
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
    if (!this.apiKey && !this.mockMode) {
      await this.loadApiKey();
      if (!this.apiKey && !this.mockMode) {
        throw new Error('PicaOS API key not configured');
      }
    }

    try {
      if (this.mockMode) {
        return this.mockGetWorkflowTasks(workflowId);
      }
      
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
    if (!this.apiKey && !this.mockMode) {
      await this.loadApiKey();
      if (!this.apiKey && !this.mockMode) {
        throw new Error('PicaOS API key not configured');
      }
    }

    try {
      if (this.mockMode) {
        this.mockPauseWorkflow(workflowId);
        return;
      }
      
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
    if (!this.apiKey && !this.mockMode) {
      await this.loadApiKey();
      if (!this.apiKey && !this.mockMode) {
        throw new Error('PicaOS API key not configured');
      }
    }

    try {
      if (this.mockMode) {
        this.mockResumeWorkflow(workflowId);
        return;
      }
      
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
    if (!this.apiKey && !this.mockMode) {
      await this.loadApiKey();
      if (!this.apiKey && !this.mockMode) {
        throw new Error('PicaOS API key not configured');
      }
    }

    try {
      if (this.mockMode) {
        return this.mockGetWorkflowResult(workflowId);
      }
      
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
    if (!this.apiKey && !this.mockMode) {
      await this.loadApiKey();
      if (!this.apiKey && !this.mockMode) {
        console.log('PicaOS API key not configured');
        return false;
      }
    }

    try {
      if (this.mockMode) {
        console.log('PicaOS mock mode enabled, connection test successful');
        return true;
      }
      
      console.log('Testing PicaOS connection...');
      const response = await fetch(`${this.API_BASE_URL}/health`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'X-Client': 'ModelMix-WriteupAgent'
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
    if (!this.apiKey && !this.mockMode) {
      await this.loadApiKey();
    }
    
    if (!this.apiKey && !this.mockMode) {
      console.log('PicaOS API key not configured');
      return false;
    }
    
    // Test connection
    return this.mockMode || await this.testConnection();
  }

  // Get deployment status
  async getDeploymentStatus(id?: string): Promise<{ status: string; message: string }> {
    try {
      // Check if API key is configured
      if (!this.apiKey && !this.mockMode) {
        await this.loadApiKey();
      }
      
      if (!this.apiKey && !this.mockMode) {
        return {
          status: 'not_configured',
          message: 'PicaOS API key is not configured'
        };
      }
      
      // In mock mode, always return deployed
      if (this.mockMode) {
        return {
          status: 'deployed',
          message: 'PicaOS is properly configured and connected (Mock Mode)'
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

  // MOCK IMPLEMENTATION FOR TESTING
  private mockCreateWorkflow(input: WriteupWorkflowInput): PicaOSWorkflow {
    const workflowId = `wf-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const title = this.generateTitle(input.prompt);
    const sectionsCount = Math.max(8, Math.min(25, Math.round(this.getTargetWordCount(input.settings) / 4000)));
    
    // Create mock workflow
    const workflow = {
      id: workflowId,
      name: `Writeup: ${title}`,
      description: `AI-orchestrated ${input.settings.format} generation`,
      status: 'pending',
      progress: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Create mock tasks
    const tasks = [
      {
        id: `task-planning-${workflowId}`,
        workflow_id: workflowId,
        name: 'Document Planning',
        type: 'ai_planning',
        status: 'pending',
        progress: 0,
        input: { prompt: input.prompt },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: `task-outline-${workflowId}`,
        workflow_id: workflowId,
        name: 'Outline Generation',
        type: 'ai_generation',
        status: 'pending',
        progress: 0,
        input: { prompt: input.prompt },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    
    // Create section tasks
    for (let i = 0; i < sectionsCount; i++) {
      tasks.push({
        id: `task-section-${i}-${workflowId}`,
        workflow_id: workflowId,
        name: `Section ${i + 1} Writing`,
        type: 'section_writing',
        status: 'pending',
        progress: 0,
        input: { section_index: i },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    
    // Create review task
    tasks.push({
      id: `task-review-${workflowId}`,
      workflow_id: workflowId,
      name: 'Content Review',
      type: 'ai_review',
      status: 'pending',
      progress: 0,
      input: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    // Create final assembly task
    tasks.push({
      id: `task-assembly-${workflowId}`,
      workflow_id: workflowId,
      name: 'Document Assembly',
      type: 'document_assembly',
      status: 'pending',
      progress: 0,
      input: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    // Store mock data
    this.mockWorkflows.set(workflowId, workflow);
    this.mockTasks.set(workflowId, tasks);
    
    // Create mock result
    const sections = [];
    for (let i = 0; i < sectionsCount; i++) {
      sections.push({
        title: `Section ${i + 1}: ${title} - Part ${i + 1}`,
        content: '',
        model: 'PicaOS Orchestrated'
      });
    }
    
    this.mockResults.set(workflowId, {
      document: {
        title: title,
        sections: sections,
        total_words: 0
      },
      metadata: {
        user_tier: input.userTier,
        target_words: this.getTargetWordCount(input.settings),
        format: input.settings.format,
        style: input.settings.style,
        tone: input.settings.tone
      }
    });
    
    return workflow as PicaOSWorkflow;
  }

  private mockStartWorkflow(workflowId: string): void {
    const workflow = this.mockWorkflows.get(workflowId);
    if (!workflow) return;
    
    workflow.status = 'running';
    workflow.progress = 5;
    workflow.updated_at = new Date().toISOString();
    
    // Update first task to running
    const tasks = this.mockTasks.get(workflowId) || [];
    if (tasks.length > 0) {
      tasks[0].status = 'running';
      tasks[0].progress = 10;
      tasks[0].updated_at = new Date().toISOString();
    }
    
    this.mockWorkflows.set(workflowId, workflow);
    this.mockTasks.set(workflowId, tasks);
    
    // Start mock progress simulation
    this.simulateMockProgress(workflowId);
  }

  private simulateMockProgress(workflowId: string): void {
    let currentTaskIndex = 0;
    const tasks = this.mockTasks.get(workflowId) || [];
    const workflow = this.mockWorkflows.get(workflowId);
    const result = this.mockResults.get(workflowId);
    
    if (!workflow || !result || tasks.length === 0) return;
    
    const updateInterval = setInterval(() => {
      // Get current task
      const currentTask = tasks[currentTaskIndex];
      
      // Update task progress
      if (currentTask.progress < 100) {
        currentTask.progress += Math.floor(Math.random() * 10) + 5; // 5-15% progress per update
        
        if (currentTask.progress >= 100) {
          currentTask.progress = 100;
          currentTask.status = 'completed';
          
          // If this is a section writing task, generate content
          if (currentTask.type === 'section_writing') {
            const sectionIndex = currentTask.input.section_index;
            if (sectionIndex !== undefined && result.document.sections[sectionIndex]) {
              const section = result.document.sections[sectionIndex];
              section.content = this.generateMockSectionContent(section.title, workflow.name);
              section.model = this.getRandomModel();
              
              // Update word count
              const wordCount = this.countWords(section.content);
              result.document.total_words += wordCount;
            }
          }
          
          // Move to next task
          currentTaskIndex++;
          
          // If there are more tasks, start the next one
          if (currentTaskIndex < tasks.length) {
            tasks[currentTaskIndex].status = 'running';
          }
        }
      }
      
      // Update workflow progress
      workflow.progress = Math.round((currentTaskIndex / tasks.length) * 100);
      workflow.updated_at = new Date().toISOString();
      
      // Check if all tasks are completed
      if (currentTaskIndex >= tasks.length) {
        workflow.status = 'completed';
        workflow.progress = 100;
        clearInterval(updateInterval);
      }
      
      // Update stored data
      this.mockWorkflows.set(workflowId, workflow);
      this.mockTasks.set(workflowId, tasks);
      this.mockResults.set(workflowId, result);
    }, 3000); // Update every 3 seconds
  }

  private mockGetWorkflowStatus(workflowId: string): PicaOSWorkflow {
    const workflow = this.mockWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    return workflow as PicaOSWorkflow;
  }

  private mockGetWorkflowTasks(workflowId: string): PicaOSTask[] {
    const tasks = this.mockTasks.get(workflowId);
    if (!tasks) {
      throw new Error(`Tasks not found for workflow: ${workflowId}`);
    }
    return tasks as PicaOSTask[];
  }

  private mockPauseWorkflow(workflowId: string): void {
    const workflow = this.mockWorkflows.get(workflowId);
    if (!workflow) return;
    
    workflow.status = 'paused';
    workflow.updated_at = new Date().toISOString();
    
    this.mockWorkflows.set(workflowId, workflow);
  }

  private mockResumeWorkflow(workflowId: string): void {
    const workflow = this.mockWorkflows.get(workflowId);
    if (!workflow) return;
    
    workflow.status = 'running';
    workflow.updated_at = new Date().toISOString();
    
    this.mockWorkflows.set(workflowId, workflow);
    
    // Restart progress simulation
    this.simulateMockProgress(workflowId);
  }

  private mockGetWorkflowResult(workflowId: string): any {
    const result = this.mockResults.get(workflowId);
    if (!result) {
      throw new Error(`Result not found for workflow: ${workflowId}`);
    }
    return result;
  }

  private generateMockSectionContent(title: string, topic: string): string {
    // Generate realistic-looking content for the section
    const paragraphCount = Math.floor(Math.random() * 3) + 3; // 3-5 paragraphs
    let content = '';
    
    for (let i = 0; i < paragraphCount; i++) {
      const sentenceCount = Math.floor(Math.random() * 4) + 3; // 3-6 sentences per paragraph
      let paragraph = '';
      
      for (let j = 0; j < sentenceCount; j++) {
        const sentenceLength = Math.floor(Math.random() * 15) + 10; // 10-25 words per sentence
        const sentence = this.generateMockSentence(title, sentenceLength);
        paragraph += sentence + ' ';
      }
      
      content += paragraph.trim() + '\n\n';
    }
    
    return content.trim();
  }

  private generateMockSentence(topic: string, length: number): string {
    const words = [
      'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I', 
      'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
      'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
      'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
      'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
      'important', 'research', 'analysis', 'data', 'study', 'findings', 'results', 'conclusion',
      'evidence', 'theory', 'practice', 'implementation', 'development', 'strategy', 'approach',
      'methodology', 'framework', 'concept', 'perspective', 'insight', 'understanding', 'knowledge'
    ];
    
    // Add some topic-specific words
    const topicWords = topic.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    // Generate sentence
    let sentence = '';
    for (let i = 0; i < length; i++) {
      // 20% chance to use a topic word
      if (Math.random() < 0.2 && topicWords.length > 0) {
        const randomTopicWord = topicWords[Math.floor(Math.random() * topicWords.length)];
        sentence += randomTopicWord + ' ';
      } else {
        const randomWord = words[Math.floor(Math.random() * words.length)];
        sentence += randomWord + ' ';
      }
    }
    
    // Capitalize first letter and add period
    return sentence.trim().charAt(0).toUpperCase() + sentence.trim().slice(1) + '.';
  }

  private getRandomModel(): string {
    const models = [
      'GPT-4o',
      'Claude 3.5 Sonnet',
      'Gemini 1.5 Pro',
      'Claude 3 Opus',
      'Mistral Large',
      'Llama 3 70B'
    ];
    
    return models[Math.floor(Math.random() * models.length)];
  }
}

export const picaosService = new PicaOSService();
export type { PicaOSWorkflow, PicaOSTask, WriteupWorkflowInput };
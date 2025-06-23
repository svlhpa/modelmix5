import { globalApiService } from './globalApiService';
import { UserTier } from '../types';

interface PicaosProject {
  id: string;
  title: string;
  prompt: string;
  status: 'planning' | 'writing' | 'reviewing' | 'completed' | 'error';
  progress: number;
  sections: PicaosSection[];
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
  settings: PicaosSettings;
}

interface PicaosSection {
  id: string;
  title: string;
  content: string;
  status: 'pending' | 'writing' | 'completed' | 'error';
  wordCount: number;
  assignedModel: string;
  qualityScore?: number;
}

interface PicaosSettings {
  targetLength: 'short' | 'medium' | 'long' | 'custom';
  customWordCount?: number;
  style: 'academic' | 'business' | 'creative' | 'technical' | 'journalistic';
  tone: 'formal' | 'casual' | 'persuasive' | 'informative' | 'engaging';
  format: 'research-paper' | 'report' | 'novel' | 'article' | 'manual' | 'proposal';
  includeReferences: boolean;
  enableQualityReview: boolean;
  maxIterations: number;
}

interface PicaosOrchestrationPlan {
  outline: {
    title: string;
    sections: Array<{
      id: string;
      title: string;
      description: string;
      targetWords: number;
      dependencies: string[];
      assignedModel: string;
      priority: number;
    }>;
  };
  modelAssignments: {
    planner: string;
    writers: string[];
    reviewer: string;
    coordinator: string;
  };
  executionPlan: {
    phases: Array<{
      name: string;
      sections: string[];
      parallelizable: boolean;
      estimatedTime: number;
    }>;
  };
}

class PicaosService {
  private readonly API_BASE_URL = 'https://api.picaos.com/v1';
  private projects: Map<string, PicaosProject> = new Map();

  async createProject(params: {
    prompt: string;
    settings: PicaosSettings;
    userTier: UserTier;
  }): Promise<PicaosProject> {
    const apiKey = await this.getApiKey(params.userTier);
    if (!apiKey) {
      throw new Error('PicaOS API key not available. Please contact support for access.');
    }

    const projectId = `picaos-${Date.now()}`;
    
    // Step 1: Create orchestration plan using PicaOS
    const orchestrationPlan = await this.createOrchestrationPlan(
      params.prompt,
      params.settings,
      apiKey
    );

    // Step 2: Initialize project with the plan
    const project: PicaosProject = {
      id: projectId,
      title: orchestrationPlan.outline.title,
      prompt: params.prompt,
      status: 'planning',
      progress: 0,
      sections: orchestrationPlan.outline.sections.map(section => ({
        id: section.id,
        title: section.title,
        content: '',
        status: 'pending' as const,
        wordCount: 0,
        assignedModel: section.assignedModel
      })),
      wordCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: params.settings
    };

    this.projects.set(projectId, project);
    return project;
  }

  async startOrchestration(
    projectId: string,
    onProgress: (project: PicaosProject) => void
  ): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) throw new Error('Project not found');

    const apiKey = await this.getApiKey('tier2');
    if (!apiKey) throw new Error('PicaOS API key not available');

    project.status = 'writing';
    project.progress = 5;
    this.updateProject(project, onProgress);

    try {
      // Start PicaOS orchestration workflow
      const orchestrationId = await this.startPicaosWorkflow(project, apiKey);
      
      // Monitor progress and update sections in real-time
      await this.monitorOrchestration(orchestrationId, project, onProgress, apiKey);
      
    } catch (error) {
      console.error('PicaOS orchestration failed:', error);
      project.status = 'error';
      this.updateProject(project, onProgress);
      throw error;
    }
  }

  private async createOrchestrationPlan(
    prompt: string,
    settings: PicaosSettings,
    apiKey: string
  ): Promise<PicaosOrchestrationPlan> {
    const targetWordCount = this.getTargetWordCount(settings);
    
    try {
      const response = await fetch(`${this.API_BASE_URL}/orchestration/plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-Client': 'ModelMix'
        },
        body: JSON.stringify({
          task: 'long_form_writing',
          prompt: prompt,
          requirements: {
            target_words: targetWordCount,
            style: settings.style,
            tone: settings.tone,
            format: settings.format,
            include_references: settings.includeReferences,
            quality_review: settings.enableQualityReview
          },
          constraints: {
            max_sections: Math.min(25, Math.max(8, Math.round(targetWordCount / 3000))),
            min_section_words: 1000,
            max_iterations: settings.maxIterations || 3
          }
        })
      });

      if (!response.ok) {
        throw new Error(`PicaOS planning failed: ${response.status}`);
      }

      const plan = await response.json();
      
      // Increment global usage
      await globalApiService.incrementGlobalUsage('picaos');
      
      return plan;
      
    } catch (error) {
      console.error('PicaOS planning error:', error);
      
      // Fallback to local planning if PicaOS is unavailable
      return this.createFallbackPlan(prompt, settings, targetWordCount);
    }
  }

  private async startPicaosWorkflow(
    project: PicaosProject,
    apiKey: string
  ): Promise<string> {
    const response = await fetch(`${this.API_BASE_URL}/orchestration/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-Client': 'ModelMix'
      },
      body: JSON.stringify({
        project_id: project.id,
        title: project.title,
        prompt: project.prompt,
        sections: project.sections.map(section => ({
          id: section.id,
          title: section.title,
          assigned_model: section.assignedModel,
          target_words: Math.round(this.getTargetWordCount(project.settings) / project.sections.length)
        })),
        settings: project.settings,
        workflow_type: 'parallel_with_coordination'
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to start PicaOS workflow: ${response.status}`);
    }

    const result = await response.json();
    return result.orchestration_id;
  }

  private async monitorOrchestration(
    orchestrationId: string,
    project: PicaosProject,
    onProgress: (project: PicaosProject) => void,
    apiKey: string
  ): Promise<void> {
    const maxPollingTime = 30 * 60 * 1000; // 30 minutes max
    const pollingInterval = 5000; // 5 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxPollingTime) {
      try {
        const response = await fetch(`${this.API_BASE_URL}/orchestration/${orchestrationId}/status`, {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'X-Client': 'ModelMix'
          }
        });

        if (!response.ok) {
          throw new Error(`Status check failed: ${response.status}`);
        }

        const status = await response.json();
        
        // Update project with latest status
        this.updateProjectFromStatus(project, status);
        this.updateProject(project, onProgress);

        // Check if completed
        if (status.status === 'completed') {
          project.status = 'completed';
          project.progress = 100;
          this.updateProject(project, onProgress);
          break;
        }

        // Check if failed
        if (status.status === 'failed') {
          project.status = 'error';
          this.updateProject(project, onProgress);
          throw new Error(`Orchestration failed: ${status.error || 'Unknown error'}`);
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollingInterval));
        
      } catch (error) {
        console.error('Monitoring error:', error);
        
        // Continue monitoring unless it's a critical error
        if (error instanceof Error && error.message.includes('failed')) {
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, pollingInterval));
      }
    }

    // Timeout handling
    if (project.status !== 'completed') {
      console.warn('PicaOS orchestration timed out');
      project.status = 'error';
      this.updateProject(project, onProgress);
      throw new Error('Orchestration timed out after 30 minutes');
    }
  }

  private updateProjectFromStatus(project: PicaosProject, status: any): void {
    // Update overall progress
    project.progress = Math.round(status.progress || 0);
    project.updatedAt = new Date();

    // Update sections with completed content
    if (status.sections) {
      status.sections.forEach((sectionStatus: any) => {
        const section = project.sections.find(s => s.id === sectionStatus.id);
        if (section) {
          section.status = sectionStatus.status;
          section.content = sectionStatus.content || section.content;
          section.wordCount = sectionStatus.word_count || this.countWords(section.content);
          section.qualityScore = sectionStatus.quality_score;
        }
      });
    }

    // Update total word count
    project.wordCount = project.sections.reduce((total, section) => total + section.wordCount, 0);

    // Update status based on section completion
    const completedSections = project.sections.filter(s => s.status === 'completed').length;
    const totalSections = project.sections.length;
    
    if (completedSections === totalSections) {
      project.status = 'completed';
      project.progress = 100;
    } else if (completedSections > 0) {
      project.status = 'writing';
      project.progress = Math.max(project.progress, Math.round((completedSections / totalSections) * 90) + 5);
    }
  }

  private createFallbackPlan(
    prompt: string,
    settings: PicaosSettings,
    targetWordCount: number
  ): PicaosOrchestrationPlan {
    const sectionsCount = Math.min(20, Math.max(8, Math.round(targetWordCount / 3000)));
    const sectionTitles = this.generateSectionTitles(prompt, settings, sectionsCount);
    
    // Mock model assignments for fallback
    const availableModels = [
      'claude-3.5-sonnet',
      'gpt-4o',
      'gemini-1.5-pro',
      'deepseek-r1'
    ];

    return {
      outline: {
        title: this.generateTitle(prompt),
        sections: sectionTitles.map((title, index) => ({
          id: `section-${index + 1}`,
          title,
          description: `Content for ${title}`,
          targetWords: Math.round(targetWordCount / sectionsCount),
          dependencies: index > 0 ? [`section-${index}`] : [],
          assignedModel: availableModels[index % availableModels.length],
          priority: index < 3 ? 1 : 2 // High priority for first 3 sections
        }))
      },
      modelAssignments: {
        planner: 'claude-3.5-sonnet',
        writers: availableModels,
        reviewer: 'gpt-4o',
        coordinator: 'claude-3.5-sonnet'
      },
      executionPlan: {
        phases: [
          {
            name: 'Introduction Phase',
            sections: ['section-1', 'section-2'],
            parallelizable: false,
            estimatedTime: 300 // 5 minutes
          },
          {
            name: 'Main Content Phase',
            sections: sectionTitles.slice(2, -2).map((_, i) => `section-${i + 3}`),
            parallelizable: true,
            estimatedTime: 900 // 15 minutes
          },
          {
            name: 'Conclusion Phase',
            sections: [`section-${sectionsCount - 1}`, `section-${sectionsCount}`],
            parallelizable: false,
            estimatedTime: 300 // 5 minutes
          }
        ]
      }
    };
  }

  private generateSectionTitles(prompt: string, settings: PicaosSettings, count: number): string[] {
    // Generate section titles based on format
    switch (settings.format) {
      case 'research-paper':
        return [
          'Abstract',
          'Introduction',
          'Literature Review',
          'Methodology',
          'Results and Analysis',
          'Discussion',
          'Conclusion',
          'References',
          ...Array.from({length: Math.max(0, count - 8)}, (_, i) => `Additional Analysis ${i + 1}`)
        ].slice(0, count);
      
      case 'report':
        return [
          'Executive Summary',
          'Introduction',
          'Background',
          'Analysis',
          'Findings',
          'Recommendations',
          'Implementation Plan',
          'Conclusion',
          ...Array.from({length: Math.max(0, count - 8)}, (_, i) => `Section ${i + 9}`)
        ].slice(0, count);
      
      case 'novel':
        return Array.from({length: count}, (_, i) => `Chapter ${i + 1}`);
      
      default:
        return Array.from({length: count}, (_, i) => `Section ${i + 1}: ${this.generateTitle(prompt)} - Part ${i + 1}`);
    }
  }

  private generateTitle(prompt: string): string {
    const words = prompt.split(' ').slice(0, 8);
    return words.join(' ').replace(/[^\w\s]/g, '').trim();
  }

  private getTargetWordCount(settings: PicaosSettings): number {
    switch (settings.targetLength) {
      case 'short': return 25000;
      case 'medium': return 50000;
      case 'long': return 100000;
      case 'custom': return settings.customWordCount || 50000;
      default: return 50000;
    }
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private updateProject(project: PicaosProject, onProgress: (project: PicaosProject) => void): void {
    this.projects.set(project.id, { ...project });
    if (onProgress) {
      onProgress({ ...project });
    }
  }

  private async getApiKey(userTier: UserTier): Promise<string | null> {
    try {
      return await globalApiService.getGlobalApiKey('picaos', userTier);
    } catch (error) {
      console.error('Error accessing PicaOS API key:', error);
      return null;
    }
  }

  // Public methods for project management
  async getProject(projectId: string): Promise<PicaosProject | null> {
    return this.projects.get(projectId) || null;
  }

  async getUserProjects(): Promise<PicaosProject[]> {
    return Array.from(this.projects.values());
  }

  async pauseProject(projectId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (project) {
      // In a real implementation, you'd call PicaOS API to pause
      project.status = 'planning'; // Paused state
      project.updatedAt = new Date();
      this.projects.set(projectId, project);
    }
  }

  async exportProject(projectId: string, format: 'pdf' | 'docx' | 'txt'): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) throw new Error('Project not found');

    // Convert PicaOS project to WriteupProject format for export
    const writeupProject = {
      id: project.id,
      title: project.title,
      prompt: project.prompt,
      sections: project.sections.map(section => ({
        id: section.id,
        title: section.title,
        content: section.content,
        wordCount: section.wordCount,
        model: section.assignedModel,
        modelProvider: 'picaos'
      })),
      wordCount: project.wordCount,
      createdAt: project.createdAt,
      settings: {
        targetLength: project.settings.targetLength,
        style: project.settings.style,
        tone: project.settings.tone,
        format: project.settings.format,
        includeReferences: project.settings.includeReferences
      }
    };

    // Use the existing export service
    const { exportService } = await import('./exportService');
    
    switch (format) {
      case 'pdf':
        await exportService.exportToPDF(writeupProject as any);
        break;
      case 'docx':
        await exportService.exportToWord(writeupProject as any);
        break;
      case 'txt':
        exportService.exportToText(writeupProject as any);
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Test PicaOS API connection
  async testConnection(userTier: UserTier): Promise<boolean> {
    const apiKey = await this.getApiKey(userTier);
    if (!apiKey) return false;

    try {
      const response = await fetch(`${this.API_BASE_URL}/health`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'X-Client': 'ModelMix'
        }
      });
      return response.ok;
    } catch (error) {
      console.error('PicaOS connection test failed:', error);
      return false;
    }
  }
}

export const picaosService = new PicaosService();
export type { PicaosProject, PicaosSection, PicaosSettings };
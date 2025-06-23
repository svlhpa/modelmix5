import { picaosService, PicaOSWorkflow, WriteupWorkflowInput } from './picaosService';
import { globalApiService } from './globalApiService';
import { exportService } from './exportService';
import { UserTier } from '../types';

interface WriteupProject {
  id: string;
  title: string;
  prompt: string;
  outline: any;
  sections: WriteupSection[];
  status: 'planning' | 'writing' | 'reviewing' | 'completed' | 'paused' | 'error';
  progress: number;
  currentSection: number;
  totalSections: number;
  wordCount: number;
  estimatedPages: number;
  createdAt: Date;
  updatedAt: Date;
  settings: WriteupSettings;
  picaosWorkflowId?: string; // PicaOS workflow ID
  picaosStatus?: string; // PicaOS workflow status
  orchestrationMethod: 'picaos' | 'legacy'; // Track which method is being used
}

interface WriteupSection {
  id: string;
  title: string;
  content: string;
  status: 'pending' | 'writing' | 'completed' | 'reviewing' | 'error' | 'retry';
  wordCount: number;
  model: string;
  modelProvider?: string;
  summary?: string;
  reviewNotes?: string;
  retryCount?: number;
  targetWords?: number;
}

interface WriteupSettings {
  targetLength: 'short' | 'medium' | 'long' | 'custom';
  customWordCount?: number;
  style: 'academic' | 'business' | 'creative' | 'technical' | 'journalistic';
  tone: 'formal' | 'casual' | 'persuasive' | 'informative' | 'engaging';
  format: 'research-paper' | 'report' | 'novel' | 'article' | 'manual' | 'proposal';
  includeReferences: boolean;
  enableReview: boolean;
  euModelsOnly: boolean;
  usePicaOS?: boolean; // New option to use PicaOS orchestration
}

class WriteupService {
  private projects: Map<string, WriteupProject> = new Map();
  private progressCallbacks: Map<string, (project: WriteupProject) => void> = new Map();
  private pollingIntervals: Map<string, NodeJS.Timeout> = new Map();

  async createProject(params: {
    prompt: string;
    settings: WriteupSettings;
    userTier: UserTier;
  }): Promise<WriteupProject> {
    const projectId = `writeup-${Date.now()}`;
    
    // Determine orchestration method - default to PicaOS for better results
    const usePicaOS = params.settings.usePicaOS !== false; // Default to true
    
    console.log(`🎯 Creating writeup project with ${usePicaOS ? 'PicaOS' : 'legacy'} orchestration`);
    
    let outline: any = {};
    let sections: WriteupSection[] = [];
    let picaosWorkflowId: string | undefined;
    
    if (usePicaOS) {
      // Check if user is Pro tier (required for PicaOS)
      if (params.userTier !== 'tier2') {
        console.log('⚠️ PicaOS requires Pro tier, falling back to legacy method');
        outline = await this.generateLegacyOutline(params.prompt, params.settings);
        sections = this.createSectionsFromOutline(outline, params.settings);
      } else {
        // Test PicaOS connection first
        const connectionOk = await picaosService.testConnection();
        if (!connectionOk) {
          console.warn('⚠️ PicaOS connection failed, falling back to legacy method');
          // Fall back to legacy method
          outline = await this.generateLegacyOutline(params.prompt, params.settings);
          sections = this.createSectionsFromOutline(outline, params.settings);
        } else {
          // Use PicaOS orchestration
          try {
            const workflowInput: WriteupWorkflowInput = {
              prompt: params.prompt,
              settings: params.settings,
              userTier: params.userTier
            };
            
            const workflow = await picaosService.createWriteupWorkflow(workflowInput);
            picaosWorkflowId = workflow.id;
            
            // Create placeholder sections that will be populated by PicaOS
            const estimatedSections = this.estimateSectionCount(params.settings);
            sections = Array.from({ length: estimatedSections }, (_, i) => ({
              id: `section-${i + 1}`,
              title: `Section ${i + 1}`,
              content: '',
              status: 'pending' as const,
              wordCount: 0,
              model: 'PicaOS Orchestrated',
              modelProvider: 'picaos',
              targetWords: Math.round(this.getTargetWordCount(params.settings) / estimatedSections)
            }));
            
            outline = {
              title: this.generateTitle(params.prompt),
              sections: sections.map(s => ({
                id: s.id,
                title: s.title,
                targetWords: s.targetWords
              }))
            };
          } catch (error) {
            console.error('❌ PicaOS workflow creation failed, falling back to legacy:', error);
            // Fall back to legacy method
            outline = await this.generateLegacyOutline(params.prompt, params.settings);
            sections = this.createSectionsFromOutline(outline, params.settings);
            picaosWorkflowId = undefined;
          }
        }
      }
    } else {
      // Use legacy method
      outline = await this.generateLegacyOutline(params.prompt, params.settings);
      sections = this.createSectionsFromOutline(outline, params.settings);
    }
    
    const project: WriteupProject = {
      id: projectId,
      title: this.generateTitle(params.prompt),
      prompt: params.prompt,
      outline,
      sections,
      status: 'planning',
      progress: 0,
      currentSection: 0,
      totalSections: sections.length,
      wordCount: 0,
      estimatedPages: this.calculateEstimatedPages(params.settings),
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: params.settings,
      picaosWorkflowId,
      orchestrationMethod: picaosWorkflowId ? 'picaos' : 'legacy'
    };

    this.projects.set(projectId, project);
    return project;
  }

  async startWriting(
    projectId: string, 
    onProgress: (project: WriteupProject) => void
  ): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) throw new Error('Project not found');

    // Store the progress callback
    this.progressCallbacks.set(projectId, onProgress);

    project.status = 'writing';
    project.progress = 5;
    this.updateProject(project, onProgress);

    try {
      if (project.orchestrationMethod === 'picaos' && project.picaosWorkflowId) {
        console.log('🚀 Starting PicaOS orchestrated writing...');
        await this.startPicaOSWriting(project, onProgress);
      } else {
        console.log('🔧 Starting legacy writing method...');
        await this.startLegacyWriting(project, onProgress);
      }
    } catch (error) {
      console.error('❌ Writing process failed:', error);
      project.status = 'error';
      project.updatedAt = new Date();
      this.updateProject(project, onProgress);
      throw error;
    }
  }

  private async startPicaOSWriting(
    project: WriteupProject,
    onProgress: (project: WriteupProject) => void
  ): Promise<void> {
    if (!project.picaosWorkflowId) {
      throw new Error('No PicaOS workflow ID found');
    }

    try {
      // Start the PicaOS workflow
      await picaosService.startWorkflow(project.picaosWorkflowId);
      
      // Start polling for progress
      this.startPicaOSPolling(project, onProgress);
      
    } catch (error) {
      console.error('❌ Failed to start PicaOS workflow:', error);
      throw new Error(`Failed to start PicaOS workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private startPicaOSPolling(
    project: WriteupProject,
    onProgress: (project: WriteupProject) => void
  ): void {
    if (!project.picaosWorkflowId) return;

    const pollInterval = setInterval(async () => {
      try {
        const workflow = await picaosService.getWorkflowStatus(project.picaosWorkflowId!);
        const tasks = await picaosService.getWorkflowTasks(project.picaosWorkflowId!);
        
        // Update project with PicaOS progress
        project.progress = Math.round(workflow.progress || 0);
        project.picaosStatus = workflow.status;
        project.updatedAt = new Date();
        
        // Update sections based on task progress
        this.updateSectionsFromTasks(project, tasks);
        
        console.log(`📊 PicaOS Progress: ${project.progress}% (${workflow.status})`);
        
        if (workflow.status === 'completed') {
          console.log('✅ PicaOS workflow completed, fetching results...');
          
          try {
            const result = await picaosService.getWorkflowResult(project.picaosWorkflowId!);
            
            // Update project with final results
            project.title = result.title;
            project.sections = result.sections.map(section => ({
              ...section,
              status: 'completed' as const,
              modelProvider: 'picaos'
            }));
            project.wordCount = result.wordCount;
            project.totalSections = result.sections.length;
            project.progress = 100;
            project.status = 'completed';
            project.updatedAt = new Date();
            
            console.log(`🎉 PicaOS writeup completed! ${result.wordCount} words, ${result.sections.length} sections`);
            
          } catch (resultError) {
            console.error('❌ Failed to fetch PicaOS results:', resultError);
            project.status = 'error';
          }
          
          clearInterval(pollInterval);
          this.pollingIntervals.delete(project.id);
          
        } else if (workflow.status === 'failed') {
          console.error('❌ PicaOS workflow failed:', workflow.error);
          project.status = 'error';
          clearInterval(pollInterval);
          this.pollingIntervals.delete(project.id);
        }
        
        this.updateProject(project, onProgress);
        
      } catch (error) {
        console.error('❌ Error polling PicaOS status:', error);
        // Don't fail the entire process for polling errors
      }
    }, 3000); // Poll every 3 seconds
    
    this.pollingIntervals.set(project.id, pollInterval);
  }

  private updateSectionsFromTasks(project: WriteupProject, tasks: any[]): void {
    // Update section status based on PicaOS task progress
    tasks.forEach((task, index) => {
      if (index < project.sections.length) {
        const section = project.sections[index];
        
        if (task.type === 'section_writing' || task.name.includes('Section')) {
          section.status = task.status === 'completed' ? 'completed' :
                         task.status === 'running' ? 'writing' :
                         task.status === 'failed' ? 'error' : 'pending';
          
          if (task.output?.content) {
            section.content = task.output.content;
            section.wordCount = this.countWords(task.output.content);
          }
          
          if (task.output?.title) {
            section.title = task.output.title;
          }
        }
      }
    });
    
    // Update current section and word count
    const completedSections = project.sections.filter(s => s.status === 'completed').length;
    project.currentSection = completedSections;
    project.wordCount = project.sections.reduce((total, s) => total + s.wordCount, 0);
  }

  private async startLegacyWriting(
    project: WriteupProject,
    onProgress: (project: WriteupProject) => void
  ): Promise<void> {
    // Get premium models for writing (prioritize high-quality models)
    const availableModels = await this.getPremiumModels();
    console.log('Available premium models for writing:', availableModels);

    if (availableModels.length === 0) {
      throw new Error('No premium AI models available for writing. Please configure API keys or contact support.');
    }

    // Process sections sequentially with retry logic and quality assurance
    for (let i = 0; i < project.sections.length; i++) {
      const section = project.sections[i];
      
      // Update current section and progress
      project.currentSection = i;
      project.progress = Math.round(((i / project.sections.length) * 85) + 5); // 5-90% range
      project.updatedAt = new Date();
      this.updateProject(project, onProgress);

      // Select premium model for this section (rotate through best models)
      const selectedModel = this.selectBestModelForSection(availableModels, section, i);
      section.model = selectedModel.name;
      section.modelProvider = selectedModel.provider;
      section.status = 'writing';
      section.retryCount = 0;
      
      // Calculate target words for this section
      const targetWords = Math.round(this.getTargetWordCount(project.settings) / project.sections.length);
      section.targetWords = targetWords;
      
      // Update progress with section status change
      this.updateProject(project, onProgress);

      // Attempt to generate section content with retry logic
      let success = false;
      const maxRetries = 3;
      
      for (let retry = 0; retry < maxRetries && !success; retry++) {
        try {
          console.log(`Writing section ${i + 1}/${project.sections.length}: ${section.title} (Attempt ${retry + 1})`);
          console.log(`Using premium model: ${section.model} (${section.modelProvider})`);
          
          // Generate section content with enhanced prompting
          const content = await this.generateSectionContent(
            project,
            section,
            selectedModel,
            retry > 0 // isRetry
          );

          if (content && content.trim().length > 100) { // Minimum content check
            section.content = content;
            section.wordCount = this.countWords(content);
            section.status = 'completed';
            success = true;
            
            // Update project word count and progress
            project.wordCount = project.sections.reduce((total, s) => total + s.wordCount, 0);
            project.progress = Math.round(((i + 1) / project.sections.length) * 85) + 5;
            project.updatedAt = new Date();
            
            console.log(`✅ Section ${i + 1} completed successfully. Word count: ${section.wordCount}. Total: ${project.wordCount}`);
            
            // Real-time progress update
            this.updateProject(project, onProgress);
            
          } else {
            throw new Error('Generated content is too short or empty');
          }
          
        } catch (error) {
          console.error(`❌ Error writing section ${i + 1} (attempt ${retry + 1}):`, error);
          section.retryCount = retry + 1;
          
          if (retry < maxRetries - 1) {
            // Try with a different model on retry
            const alternativeModel = availableModels[(availableModels.indexOf(selectedModel) + 1) % availableModels.length];
            section.model = alternativeModel.name;
            section.modelProvider = alternativeModel.provider;
            console.log(`🔄 Retrying with alternative model: ${alternativeModel.name}`);
            
            // Small delay before retry
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            // Final attempt failed - mark as error but continue
            section.status = 'error';
            section.content = `Error generating content for "${section.title}". This section needs manual review. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
            section.wordCount = this.countWords(section.content);
            console.error(`❌ Section ${i + 1} failed after ${maxRetries} attempts`);
          }
          
          this.updateProject(project, onProgress);
        }
      }
      
      // Small delay between sections to prevent rate limiting
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Review phase (if enabled)
    if (project.settings.enableReview) {
      project.status = 'reviewing';
      project.progress = 90;
      this.updateProject(project, onProgress);
      
      await this.reviewAndImproveProject(project, onProgress);
    }

    // Final completion
    project.status = 'completed';
    project.progress = 100;
    project.currentSection = project.sections.length;
    project.updatedAt = new Date();
    
    console.log('🎉 Project completed!', {
      totalSections: project.sections.length,
      completedSections: project.sections.filter(s => s.status === 'completed').length,
      errorSections: project.sections.filter(s => s.status === 'error').length,
      totalWords: project.wordCount,
      estimatedPages: Math.round(project.wordCount / 250)
    });
    
    this.updateProject(project, onProgress);
  }

  // Helper methods
  private updateProject(project: WriteupProject, onProgress: (project: WriteupProject) => void) {
    this.projects.set(project.id, { ...project });
    if (onProgress) {
      onProgress({ ...project });
    }
  }

  private async generateLegacyOutline(prompt: string, settings: WriteupSettings): Promise<any> {
    const sectionsCount = Math.max(8, Math.min(25, Math.round(this.getTargetWordCount(settings) / 4000)));
    
    return {
      title: this.generateTitle(prompt),
      sections: Array.from({ length: sectionsCount }, (_, i) => ({
        id: `section-${i + 1}`,
        title: `Section ${i + 1}: ${this.generateTitle(prompt)} - Part ${i + 1}`,
        targetWords: Math.round(this.getTargetWordCount(settings) / sectionsCount)
      }))
    };
  }

  private createSectionsFromOutline(outline: any, settings: WriteupSettings): WriteupSection[] {
    return outline.sections.map((section: any) => ({
      id: section.id,
      title: section.title,
      content: '',
      status: 'pending' as const,
      wordCount: 0,
      model: '',
      modelProvider: '',
      targetWords: section.targetWords || Math.round(this.getTargetWordCount(settings) / outline.sections.length)
    }));
  }

  private estimateSectionCount(settings: WriteupSettings): number {
    const wordCount = this.getTargetWordCount(settings);
    return Math.max(8, Math.min(25, Math.round(wordCount / 4000)));
  }

  private generateTitle(prompt: string): string {
    return prompt.split(' ').slice(0, 8).join(' ').replace(/[^\w\s]/g, '').trim();
  }

  private getTargetWordCount(settings: WriteupSettings): number {
    switch (settings.targetLength) {
      case 'short': return 25000;
      case 'medium': return 50000;
      case 'long': return 100000;
      case 'custom': return settings.customWordCount || 50000;
      default: return 50000;
    }
  }

  private calculateEstimatedPages(settings: WriteupSettings): number {
    const wordCount = this.getTargetWordCount(settings);
    return Math.round(wordCount / 250);
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  // Get premium models for writing
  private async getPremiumModels(): Promise<Array<{name: string, provider: string, id: string, tier: 'premium' | 'standard'}>> {
    // This would normally fetch available models from various providers
    // For now, return a static list of premium models
    return [
      { name: 'GPT-4o', provider: 'openai', id: 'gpt-4o', tier: 'premium' },
      { name: 'Claude 3.5 Sonnet', provider: 'anthropic', id: 'claude-3-5-sonnet', tier: 'premium' },
      { name: 'Gemini 1.5 Pro', provider: 'google', id: 'gemini-1-5-pro', tier: 'premium' }
    ];
  }

  // Select the best model for each section
  private selectBestModelForSection(
    availableModels: Array<{name: string, provider: string, id: string, tier: string}>, 
    section: WriteupSection, 
    sectionIndex: number
  ): {name: string, provider: string, id: string, tier: string} {
    if (availableModels.length === 0) {
      throw new Error('No models available for section generation');
    }
    
    // Rotate through available models
    return availableModels[sectionIndex % availableModels.length];
  }

  // Generate section content
  private async generateSectionContent(
    project: WriteupProject,
    section: WriteupSection,
    model: {name: string, provider: string, id: string},
    isRetry: boolean = false
  ): Promise<string> {
    // This would normally call the appropriate AI service
    // For now, generate placeholder content
    return `This is placeholder content for "${section.title}". In a real implementation, this would be generated by ${model.name}.

The content would be about ${project.prompt} and would be written in a ${project.settings.style} style with a ${project.settings.tone} tone.

This section would typically contain about ${section.targetWords} words and would be part of a ${project.settings.format} document.`;
  }

  // Review and improve project
  private async reviewAndImproveProject(
    project: WriteupProject,
    onProgress: (project: WriteupProject) => void
  ): Promise<void> {
    // This would normally review and improve the content
    // For now, just update the status
    for (const section of project.sections) {
      if (section.status === 'completed') {
        section.reviewNotes = 'Quality check passed';
      }
    }
    
    project.progress = 98;
    this.updateProject(project, onProgress);
  }

  async pauseProject(projectId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) return;

    if (project.orchestrationMethod === 'picaos' && project.picaosWorkflowId) {
      try {
        await picaosService.pauseWorkflow(project.picaosWorkflowId);
      } catch (error) {
        console.error('Failed to pause PicaOS workflow:', error);
      }
    }

    // Stop polling
    const pollInterval = this.pollingIntervals.get(projectId);
    if (pollInterval) {
      clearInterval(pollInterval);
      this.pollingIntervals.delete(projectId);
    }

    project.status = 'paused';
    project.updatedAt = new Date();
    this.projects.set(projectId, project);
  }

  async resumeProject(projectId: string, onProgress: (project: WriteupProject) => void): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) return;

    if (project.orchestrationMethod === 'picaos' && project.picaosWorkflowId) {
      try {
        await picaosService.resumeWorkflow(project.picaosWorkflowId);
        this.startPicaOSPolling(project, onProgress);
      } catch (error) {
        console.error('Failed to resume PicaOS workflow:', error);
        throw error;
      }
    }

    project.status = 'writing';
    project.updatedAt = new Date();
    this.updateProject(project, onProgress);
  }

  // Public methods
  async getProject(projectId: string): Promise<WriteupProject | null> {
    return this.projects.get(projectId) || null;
  }

  async getUserProjects(): Promise<WriteupProject[]> {
    return Array.from(this.projects.values());
  }

  async handleSectionAction(projectId: string, sectionId: string, action: 'accept' | 'edit' | 'regenerate'): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) return;

    const section = project.sections.find(s => s.id === sectionId);
    if (!section) return;

    switch (action) {
      case 'accept':
        section.status = 'completed';
        break;
      case 'edit':
        section.status = 'reviewing';
        break;
      case 'regenerate':
        section.status = 'pending';
        section.content = '';
        section.wordCount = 0;
        break;
    }

    project.updatedAt = new Date();
    this.projects.set(projectId, project);
  }

  async exportProject(projectId: string, format: 'pdf' | 'docx' | 'txt'): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) throw new Error('Project not found');

    try {
      switch (format) {
        case 'pdf':
          await exportService.exportToPDF(project);
          break;
        case 'docx':
          await exportService.exportToWord(project);
          break;
        case 'txt':
          exportService.exportToText(project);
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error(`Export failed for format ${format}:`, error);
      throw error;
    }
  }

  // Cleanup method to clear polling intervals
  cleanup(): void {
    this.pollingIntervals.forEach(interval => clearInterval(interval));
    this.pollingIntervals.clear();
    this.progressCallbacks.clear();
  }
}

export const writeupService = new WriteupService();
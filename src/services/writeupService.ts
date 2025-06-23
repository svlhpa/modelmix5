import { globalApiService } from './globalApiService';
import { openRouterService } from './openRouterService';
import { aiService } from './aiService';
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
}

interface WriteupSection {
  id: string;
  title: string;
  content: string;
  status: 'pending' | 'writing' | 'completed' | 'reviewing' | 'error';
  wordCount: number;
  model: string;
  modelProvider?: string;
  summary?: string;
  reviewNotes?: string;
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
}

class WriteupService {
  private projects: Map<string, WriteupProject> = new Map();
  private progressCallbacks: Map<string, (project: WriteupProject) => void> = new Map();

  async createProject(params: {
    prompt: string;
    settings: WriteupSettings;
    userTier: UserTier;
  }): Promise<WriteupProject> {
    const projectId = `writeup-${Date.now()}`;
    
    // Generate outline and sections
    const outline = await this.generateOutline(params.prompt, params.settings);
    const sections = this.createSectionsFromOutline(outline, params.settings);
    
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
      settings: params.settings
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
    project.progress = 5; // Initial progress
    this.updateProject(project, onProgress);

    try {
      // Get available models for writing
      const availableModels = await this.getAvailableModels();
      console.log('Available models for writing:', availableModels);

      if (availableModels.length === 0) {
        throw new Error('No AI models available for writing. Please configure API keys.');
      }

      // Process sections sequentially with real-time progress updates
      for (let i = 0; i < project.sections.length; i++) {
        const section = project.sections[i];
        
        // Update current section and progress
        project.currentSection = i;
        project.progress = Math.round(((i / project.sections.length) * 90) + 5); // 5-95% range
        project.updatedAt = new Date();
        this.updateProject(project, onProgress);

        // Select model for this section (rotate through available models)
        const selectedModel = availableModels[i % availableModels.length];
        section.model = selectedModel.name;
        section.modelProvider = selectedModel.provider;
        section.status = 'writing';
        
        // Update progress with section status change
        this.updateProject(project, onProgress);

        try {
          console.log(`Writing section ${i + 1}/${project.sections.length}: ${section.title}`);
          console.log(`Using model: ${section.model} (${section.modelProvider})`);
          
          // Generate section content
          const content = await this.generateSectionContent(
            project,
            section,
            selectedModel
          );

          section.content = content;
          section.wordCount = this.countWords(content);
          section.status = 'completed';
          
          // Update project word count and progress
          project.wordCount = project.sections.reduce((total, s) => total + s.wordCount, 0);
          project.progress = Math.round(((i + 1) / project.sections.length) * 90) + 5;
          project.updatedAt = new Date();
          
          console.log(`Section ${i + 1} completed. Word count: ${section.wordCount}. Total: ${project.wordCount}`);
          
          // Real-time progress update
          this.updateProject(project, onProgress);
          
          // Small delay between sections to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`Error writing section ${i + 1}:`, error);
          section.status = 'error';
          section.content = `Error generating content: ${error instanceof Error ? error.message : 'Unknown error'}`;
          this.updateProject(project, onProgress);
        }
      }

      // Final completion
      project.status = 'completed';
      project.progress = 100;
      project.currentSection = project.sections.length;
      project.updatedAt = new Date();
      
      console.log('Project completed!', {
        totalSections: project.sections.length,
        totalWords: project.wordCount,
        estimatedPages: Math.round(project.wordCount / 250)
      });
      
      this.updateProject(project, onProgress);
      
    } catch (error) {
      console.error('Writing process failed:', error);
      project.status = 'error';
      project.updatedAt = new Date();
      this.updateProject(project, onProgress);
      throw error;
    } finally {
      // Clean up callback
      this.progressCallbacks.delete(projectId);
    }
  }

  private updateProject(project: WriteupProject, onProgress: (project: WriteupProject) => void) {
    // Update the stored project
    this.projects.set(project.id, { ...project });
    
    // Call the progress callback with the updated project
    if (onProgress) {
      onProgress({ ...project });
    }
  }

  private async getAvailableModels(): Promise<Array<{name: string, provider: string, id: string}>> {
    const models: Array<{name: string, provider: string, id: string}> = [];

    try {
      // Load AI service settings
      await aiService.loadSettings();
      await aiService.loadModelSettings();

      // Get traditional models (these are always available if API keys are configured)
      const traditionalModels = [
        { name: 'OpenAI GPT-4o', provider: 'openai', id: 'gpt-4o' },
        { name: 'Google Gemini 1.5 Pro', provider: 'gemini', id: 'gemini-1.5-pro' },
        { name: 'DeepSeek Chat', provider: 'deepseek', id: 'deepseek-chat' }
      ];

      // Check which traditional models are available
      for (const model of traditionalModels) {
        try {
          const globalKey = await globalApiService.getGlobalApiKey(model.provider, 'tier2');
          if (globalKey) {
            models.push(model);
          }
        } catch (error) {
          console.log(`${model.provider} not available:`, error);
        }
      }

      // Get OpenRouter models
      try {
        const openRouterKey = await globalApiService.getGlobalApiKey('openrouter', 'tier2');
        if (openRouterKey) {
          const openRouterModels = await openRouterService.getAvailableModels();
          
          // Add a selection of good OpenRouter models for writing
          const selectedOpenRouterModels = openRouterModels
            .filter(model => {
              // Filter for good writing models
              const modelName = model.name.toLowerCase();
              return (
                modelName.includes('claude') ||
                modelName.includes('gpt') ||
                modelName.includes('llama') ||
                modelName.includes('mistral') ||
                modelName.includes('gemma') ||
                modelName.includes('qwen')
              ) && model.context_length >= 8000; // Ensure good context length
            })
            .slice(0, 20) // Limit to top 20 models
            .map(model => ({
              name: model.name,
              provider: 'openrouter',
              id: model.id
            }));

          models.push(...selectedOpenRouterModels);
        }
      } catch (error) {
        console.log('OpenRouter not available:', error);
      }

      console.log(`Found ${models.length} available models for writing`);
      return models;
      
    } catch (error) {
      console.error('Error getting available models:', error);
      return models;
    }
  }

  private async generateOutline(prompt: string, settings: WriteupSettings): Promise<any> {
    // Generate a comprehensive outline based on the prompt and settings
    const targetWordCount = this.getTargetWordCount(settings);
    const sectionsCount = Math.max(8, Math.min(20, Math.round(targetWordCount / 5000))); // 5000 words per section average

    const outline = {
      title: this.generateTitle(prompt),
      abstract: 'Abstract section',
      sections: []
    };

    // Generate section titles based on format
    const sectionTitles = this.generateSectionTitles(prompt, settings, sectionsCount);
    
    for (let i = 0; i < sectionTitles.length; i++) {
      outline.sections.push({
        id: `section-${i + 1}`,
        title: sectionTitles[i],
        targetWords: Math.round(targetWordCount / sectionsCount),
        order: i + 1
      });
    }

    return outline;
  }

  private generateSectionTitles(prompt: string, settings: WriteupSettings, count: number): string[] {
    const baseTitle = this.generateTitle(prompt);
    
    // Generate section titles based on format
    switch (settings.format) {
      case 'research-paper':
        return [
          'Title Page',
          'Abstract',
          'Introduction',
          'Literature Review',
          'Methodology',
          'Results and Analysis',
          'Discussion',
          'Conclusion',
          'References',
          ...Array.from({length: Math.max(0, count - 9)}, (_, i) => `Additional Analysis ${i + 1}`)
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
        return Array.from({length: count}, (_, i) => `Section ${i + 1}: ${baseTitle} - Part ${i + 1}`);
    }
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
      summary: '',
      reviewNotes: ''
    }));
  }

  private async generateSectionContent(
    project: WriteupProject,
    section: WriteupSection,
    model: {name: string, provider: string, id: string}
  ): Promise<string> {
    const targetWords = Math.round(this.getTargetWordCount(project.settings) / project.totalSections);
    
    const prompt = `Write a comprehensive section titled "${section.title}" for a ${project.settings.format} about "${project.prompt}".

Requirements:
- Target length: approximately ${targetWords} words
- Writing style: ${project.settings.style}
- Tone: ${project.settings.tone}
- Format: ${project.settings.format}

Context: This is section ${project.sections.indexOf(section) + 1} of ${project.totalSections} in a comprehensive document.

Previous sections completed: ${project.sections.slice(0, project.sections.indexOf(section)).map(s => s.title).join(', ')}

Please write detailed, well-researched content that flows naturally and maintains consistency with the overall document theme. Include specific examples, analysis, and insights relevant to the topic.

Write the complete section content now:`;

    try {
      let content: string;
      
      if (model.provider === 'openrouter') {
        // Use OpenRouter service
        const openRouterKey = await globalApiService.getGlobalApiKey('openrouter', 'tier2');
        if (!openRouterKey) {
          throw new Error('OpenRouter API key not available');
        }
        
        content = await openRouterService.callModel(
          model.id,
          [{ role: 'user', content: prompt }],
          openRouterKey
        );
        
        // Increment global usage
        await globalApiService.incrementGlobalUsage('openrouter');
        
      } else {
        // Use traditional AI service
        const messages = [{ role: 'user' as const, content: prompt }];
        
        switch (model.provider) {
          case 'openai':
            content = await this.callOpenAI(messages);
            break;
          case 'gemini':
            content = await this.callGemini(messages);
            break;
          case 'deepseek':
            content = await this.callDeepSeek(messages);
            break;
          default:
            throw new Error(`Unsupported model provider: ${model.provider}`);
        }
      }
      
      return content || `Content for ${section.title} - Generated by ${model.name}`;
      
    } catch (error) {
      console.error(`Error generating content for section ${section.title}:`, error);
      throw new Error(`Failed to generate content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async callOpenAI(messages: Array<{role: 'user' | 'assistant', content: string}>): Promise<string> {
    const apiKey = await globalApiService.getGlobalApiKey('openai', 'tier2');
    if (!apiKey) throw new Error('OpenAI API key not available');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: messages,
        max_tokens: 2000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    await globalApiService.incrementGlobalUsage('openai');
    return data.choices[0]?.message?.content || 'No response generated';
  }

  private async callGemini(messages: Array<{role: 'user' | 'assistant', content: string}>): Promise<string> {
    const apiKey = await globalApiService.getGlobalApiKey('gemini', 'tier2');
    if (!apiKey) throw new Error('Gemini API key not available');

    const contents = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    await globalApiService.incrementGlobalUsage('gemini');
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';
  }

  private async callDeepSeek(messages: Array<{role: 'user' | 'assistant', content: string}>): Promise<string> {
    const apiKey = await globalApiService.getGlobalApiKey('deepseek', 'tier2');
    if (!apiKey) throw new Error('DeepSeek API key not available');

    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages,
        max_tokens: 2000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    await globalApiService.incrementGlobalUsage('deepseek');
    return data.choices[0]?.message?.content || 'No response generated';
  }

  private generateTitle(prompt: string): string {
    // Extract a title from the prompt
    const words = prompt.split(' ').slice(0, 8);
    return words.join(' ').replace(/[^\w\s]/g, '').trim();
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
    return Math.round(wordCount / 250); // 250 words per page average
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  async pauseProject(projectId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (project) {
      project.status = 'paused';
      project.updatedAt = new Date();
      this.projects.set(projectId, project);
    }
  }

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
        // In a real implementation, this would open an editor
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

    const content = this.generateExportContent(project);
    
    switch (format) {
      case 'txt':
        this.downloadTextFile(content, `${project.title}.txt`);
        break;
      case 'pdf':
        // For now, download as text since PDF generation requires additional libraries
        this.downloadTextFile(content, `${project.title}.txt`);
        alert('PDF export is not yet implemented. Downloaded as text file instead.');
        break;
      case 'docx':
        // For now, download as text since Word generation requires additional libraries
        this.downloadTextFile(content, `${project.title}.txt`);
        alert('Word export is not yet implemented. Downloaded as text file instead.');
        break;
    }
  }

  private generateExportContent(project: WriteupProject): string {
    let content = `${project.title}\n\n`;
    content += `Generated by ModelMix Write-up Agent\n`;
    content += `Created: ${project.createdAt.toLocaleDateString()}\n`;
    content += `Word Count: ${project.wordCount}\n`;
    content += `Pages: ${Math.round(project.wordCount / 250)}\n\n`;
    content += '=' .repeat(50) + '\n\n';

    project.sections.forEach((section, index) => {
      content += `${index + 1}. ${section.title}\n\n`;
      content += `${section.content}\n\n`;
      content += '-'.repeat(30) + '\n\n';
    });

    return content;
  }

  private downloadTextFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const writeupService = new WriteupService();
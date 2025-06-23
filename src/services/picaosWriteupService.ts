import { globalApiService } from './globalApiService';
import { UserTier } from '../types';

interface WriteupProject {
  id: string;
  title: string;
  prompt: string;
  sections: WriteupSection[];
  status: 'planning' | 'writing' | 'reviewing' | 'completed' | 'error';
  progress: number;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
  settings: WriteupSettings;
}

interface WriteupSection {
  id: string;
  title: string;
  content: string;
  status: 'pending' | 'writing' | 'completed' | 'error';
  wordCount: number;
  model: string;
}

interface WriteupSettings {
  targetLength: 'short' | 'medium' | 'long' | 'custom';
  customWordCount?: number;
  style: 'academic' | 'business' | 'creative' | 'technical' | 'journalistic';
  tone: 'formal' | 'casual' | 'persuasive' | 'informative' | 'engaging';
  format: 'research-paper' | 'report' | 'novel' | 'article' | 'manual' | 'proposal';
  includeReferences: boolean;
  enableQualityReview: boolean;
}

class PicaosWriteupService {
  private readonly API_BASE_URL = 'https://api.picaos.com/v1/passthrough/completions';
  private projects: Map<string, WriteupProject> = new Map();
  private progressCallbacks: Map<string, (project: WriteupProject) => void> = new Map();

  async createProject(params: {
    prompt: string;
    settings: WriteupSettings;
    userTier: UserTier;
  }): Promise<WriteupProject> {
    // Get API key (personal or global)
    const apiKey = await this.getApiKey(params.userTier);
    
    if (!apiKey) {
      throw new Error('PicaOS API key not available. Please configure it in settings or contact support for global key access.');
    }

    const projectId = `writeup-${Date.now()}`;
    
    // Generate outline using PicaOS API
    const outline = await this.generateOutline(params.prompt, params.settings, apiKey);
    
    // Create sections from outline
    const sections = this.createSectionsFromOutline(outline);
    
    // Create project
    const project: WriteupProject = {
      id: projectId,
      title: this.generateTitle(params.prompt),
      prompt: params.prompt,
      sections,
      status: 'planning',
      progress: 0,
      wordCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: params.settings
    };
    
    this.projects.set(projectId, project);
    return project;
  }

  async generateContent(
    projectId: string,
    onProgress: (project: WriteupProject) => void
  ): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) throw new Error('Project not found');

    // Store the progress callback
    this.progressCallbacks.set(projectId, onProgress);

    project.status = 'writing';
    project.progress = 5; // Initial progress
    this.updateProject(project);

    try {
      // Get API key
      const apiKey = await this.getApiKey('tier2');
      if (!apiKey) {
        throw new Error('PicaOS API key not available');
      }

      // Process sections sequentially
      for (let i = 0; i < project.sections.length; i++) {
        const section = project.sections[i];
        
        // Update progress
        project.progress = Math.round(((i / project.sections.length) * 85) + 5); // 5-90% range
        section.status = 'writing';
        this.updateProject(project);

        try {
          // Generate content for this section
          const content = await this.generateSectionContent(
            project.prompt,
            section.title,
            project.settings,
            apiKey
          );

          // Update section with generated content
          section.content = content;
          section.wordCount = this.countWords(content);
          section.status = 'completed';
          
          // Update project word count
          project.wordCount = project.sections.reduce((total, s) => total + s.wordCount, 0);
          
          this.updateProject(project);
        } catch (error) {
          console.error(`Error generating content for section ${i}:`, error);
          section.status = 'error';
          this.updateProject(project);
        }
      }

      // Review phase (if enabled)
      if (project.settings.enableQualityReview) {
        project.status = 'reviewing';
        project.progress = 95;
        this.updateProject(project);
        
        // Simulate review process
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Complete project
      project.status = 'completed';
      project.progress = 100;
      this.updateProject(project);
      
    } catch (error) {
      console.error('Content generation failed:', error);
      project.status = 'error';
      this.updateProject(project);
      throw error;
    } finally {
      // Clean up callback
      this.progressCallbacks.delete(projectId);
    }
  }

  private async generateOutline(
    prompt: string,
    settings: WriteupSettings,
    apiKey: string
  ): Promise<any> {
    try {
      const response = await fetch(this.API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pica-secret': apiKey,
          'x-pica-connection-key': 'openai', // Using OpenAI connection
          'x-pica-action-id': 'conn_mod_def::GDzgIxPFYP0::2bW4lQ29TAuimPnr1tYXww'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          prompt: `Create a detailed outline for a ${settings.format} about: "${prompt}"
          
          Requirements:
          - Target length: ${this.getTargetWordCount(settings)} words
          - Writing style: ${settings.style}
          - Tone: ${settings.tone}
          - Format: ${settings.format}
          
          Create a detailed outline with:
          1. A compelling title
          2. 10-15 main sections with descriptive titles
          3. Brief description of what each section should cover
          
          Format your response as a JSON object with this structure:
          {
            "title": "Compelling title here",
            "sections": [
              {
                "title": "Section title",
                "description": "Brief description of what this section covers"
              }
            ]
          }`,
          max_tokens: 2000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`PicaOS API error: ${response.status}`);
      }

      const data = await response.json();
      const outlineText = data.choices[0].text;
      
      // Parse JSON from the response
      try {
        // Find JSON in the response
        const jsonMatch = outlineText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        throw new Error('No valid JSON found in response');
      } catch (parseError) {
        console.error('Failed to parse outline JSON:', parseError);
        // Fallback to manual outline generation
        return this.createFallbackOutline(prompt, settings);
      }
      
    } catch (error) {
      console.error('Failed to generate outline:', error);
      return this.createFallbackOutline(prompt, settings);
    }
  }

  private async generateSectionContent(
    projectPrompt: string,
    sectionTitle: string,
    settings: WriteupSettings,
    apiKey: string
  ): Promise<string> {
    try {
      const response = await fetch(this.API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pica-secret': apiKey,
          'x-pica-connection-key': 'openai', // Using OpenAI connection
          'x-pica-action-id': 'conn_mod_def::GDzgIxPFYP0::2bW4lQ29TAuimPnr1tYXww'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          prompt: `You are an expert ${settings.style} writer creating a comprehensive ${settings.format} about "${projectPrompt}".

          Write a detailed section titled "${sectionTitle}" with the following requirements:
          
          - Writing style: ${settings.style}
          - Tone: ${settings.tone}
          - Format: ${settings.format}
          - Target length: 1000-2000 words for this section
          
          ${settings.includeReferences ? 'Include relevant citations and references where appropriate.' : ''}
          
          Write the complete section content now. Make it comprehensive and detailed.`,
          max_tokens: 4000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`PicaOS API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].text;
      
    } catch (error) {
      console.error(`Failed to generate content for section "${sectionTitle}":`, error);
      throw error;
    }
  }

  private createFallbackOutline(prompt: string, settings: WriteupSettings): any {
    const title = this.generateTitle(prompt);
    
    // Generate section titles based on format
    let sections = [];
    
    switch (settings.format) {
      case 'research-paper':
        sections = [
          { title: 'Abstract', description: 'Summary of the research paper' },
          { title: 'Introduction', description: 'Background and purpose of the research' },
          { title: 'Literature Review', description: 'Analysis of existing research' },
          { title: 'Methodology', description: 'Research approach and methods' },
          { title: 'Results', description: 'Findings from the research' },
          { title: 'Discussion', description: 'Interpretation of results' },
          { title: 'Conclusion', description: 'Summary of findings and implications' },
          { title: 'References', description: 'Citations and bibliography' }
        ];
        break;
        
      case 'report':
        sections = [
          { title: 'Executive Summary', description: 'Brief overview of the report' },
          { title: 'Introduction', description: 'Purpose and scope of the report' },
          { title: 'Background', description: 'Context and relevant information' },
          { title: 'Methodology', description: 'How the information was gathered' },
          { title: 'Findings', description: 'Main results and data' },
          { title: 'Analysis', description: 'Interpretation of findings' },
          { title: 'Recommendations', description: 'Suggested actions' },
          { title: 'Conclusion', description: 'Summary and final thoughts' },
          { title: 'Appendices', description: 'Additional supporting information' }
        ];
        break;
        
      case 'novel':
        sections = [
          { title: 'Chapter 1', description: 'Introduction to the main characters and setting' },
          { title: 'Chapter 2', description: 'Development of the initial conflict' },
          { title: 'Chapter 3', description: 'Exploration of character motivations' },
          { title: 'Chapter 4', description: 'Introduction of complications' },
          { title: 'Chapter 5', description: 'Rising action and tension' },
          { title: 'Chapter 6', description: 'Major plot development' },
          { title: 'Chapter 7', description: 'Character growth and challenges' },
          { title: 'Chapter 8', description: 'Climactic events' },
          { title: 'Chapter 9', description: 'Resolution of conflicts' },
          { title: 'Chapter 10', description: 'Conclusion and epilogue' }
        ];
        break;
        
      default:
        // Generic sections
        sections = [
          { title: 'Introduction', description: 'Overview of the topic' },
          { title: 'Background', description: 'Context and history' },
          { title: 'Main Section 1', description: 'First major point or argument' },
          { title: 'Main Section 2', description: 'Second major point or argument' },
          { title: 'Main Section 3', description: 'Third major point or argument' },
          { title: 'Analysis', description: 'Interpretation and evaluation' },
          { title: 'Practical Applications', description: 'Real-world uses and implications' },
          { title: 'Conclusion', description: 'Summary and final thoughts' }
        ];
    }
    
    return {
      title,
      sections
    };
  }

  private createSectionsFromOutline(outline: any): WriteupSection[] {
    return outline.sections.map((section: any, index: number) => ({
      id: `section-${index + 1}`,
      title: section.title,
      content: '',
      status: 'pending',
      wordCount: 0,
      model: this.getModelForSection(index)
    }));
  }

  private getModelForSection(sectionIndex: number): string {
    // Rotate between different models for different sections
    const models = [
      'GPT-4o',
      'Claude 3.5 Sonnet',
      'Gemini 1.5 Pro',
      'DeepSeek Chat'
    ];
    
    return models[sectionIndex % models.length];
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

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private updateProject(project: WriteupProject): void {
    // Update the stored project
    this.projects.set(project.id, { ...project });
    
    // Call the progress callback if registered
    const callback = this.progressCallbacks.get(project.id);
    if (callback) {
      callback({ ...project });
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
  async getProject(projectId: string): Promise<WriteupProject | null> {
    return this.projects.get(projectId) || null;
  }

  async getUserProjects(): Promise<WriteupProject[]> {
    return Array.from(this.projects.values());
  }

  async pauseProject(projectId: string): Promise<void> {
    const project = this.projects.get(projectId);
    if (project) {
      project.status = 'planning'; // Paused state
      project.updatedAt = new Date();
      this.projects.set(projectId, project);
    }
  }

  async exportProject(projectId: string, format: 'pdf' | 'docx' | 'txt'): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) throw new Error('Project not found');

    // Use the existing export service
    const { exportService } = await import('./exportService');
    
    switch (format) {
      case 'pdf':
        await exportService.exportToPDF(project as any);
        break;
      case 'docx':
        await exportService.exportToWord(project as any);
        break;
      case 'txt':
        exportService.exportToText(project as any);
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Test API connection
  async testConnection(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch(this.API_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-pica-secret': apiKey,
          'x-pica-connection-key': 'openai',
          'x-pica-action-id': 'conn_mod_def::GDzgIxPFYP0::2bW4lQ29TAuimPnr1tYXww'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          prompt: 'Hello, this is a test.',
          max_tokens: 10
        })
      });
      
      return response.ok;
    } catch (error) {
      console.error('PicaOS API connection test failed:', error);
      return false;
    }
  }
}

export const picaosWriteupService = new PicaosWriteupService();
export type { WriteupProject, WriteupSection, WriteupSettings };
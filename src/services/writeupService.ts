import { globalApiService } from './globalApiService';
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

interface CreateProjectParams {
  prompt: string;
  settings: WriteupSettings;
  userTier: UserTier;
}

class WriteupService {
  private projects: Map<string, WriteupProject> = new Map();
  private activeWritingProcesses: Map<string, boolean> = new Map();

  // Model assignments based on quality, speed, and cost
  private modelAssignments = {
    planner: 'openai', // Best for structured planning
    writer: ['openai', 'gemini', 'deepseek'], // Rotate for variety
    reviewer: 'gemini', // Good for critical analysis
    stylist: 'openai', // Best for style consistency
    formatter: 'deepseek' // Efficient for formatting tasks
  };

  async createProject(params: CreateProjectParams): Promise<WriteupProject> {
    const projectId = `writeup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Generate title from prompt
    const title = this.generateTitle(params.prompt);
    
    // Create initial project structure
    const project: WriteupProject = {
      id: projectId,
      title,
      prompt: params.prompt,
      outline: null,
      sections: [],
      status: 'planning',
      progress: 0,
      currentSection: 0,
      totalSections: 0,
      wordCount: 0,
      estimatedPages: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: params.settings
    };

    // Step 1: Generate outline using Planner Agent
    try {
      console.log('🧠 Starting outline generation...');
      const outline = await this.generateOutline(params.prompt, params.settings, params.userTier);
      project.outline = outline;
      project.sections = this.createSectionsFromOutline(outline);
      project.totalSections = project.sections.length;
      project.status = 'writing';
      project.progress = 10; // Planning complete
      console.log(`✅ Outline generated with ${project.sections.length} sections`);
    } catch (error) {
      console.error('❌ Outline generation failed:', error);
      project.status = 'error';
      throw new Error(`Failed to create project outline: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    this.projects.set(projectId, project);
    return project;
  }

  async startWriting(projectId: string, onProgress?: (project: WriteupProject) => void): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) throw new Error('Project not found');

    if (this.activeWritingProcesses.get(projectId)) {
      throw new Error('Writing process already active for this project');
    }

    this.activeWritingProcesses.set(projectId, true);

    try {
      console.log('🚀 Starting writing process...');
      
      // Step 2: Sequential Writing with Context
      await this.writeSequentially(project, onProgress);
      
      // Step 3: Review and Refinement (if enabled)
      if (project.settings.enableReview) {
        console.log('👁️ Starting review process...');
        await this.reviewAndRefine(project, onProgress);
      }
      
      // Step 4: Final Formatting
      console.log('🎨 Final formatting...');
      await this.finalFormatting(project, onProgress);
      
      project.status = 'completed';
      project.progress = 100;
      project.updatedAt = new Date();
      
      console.log(`✅ Writing completed! Total words: ${project.wordCount}`);
      
      if (onProgress) onProgress(project);
    } catch (error) {
      console.error('❌ Writing process failed:', error);
      project.status = 'error';
      project.updatedAt = new Date();
      if (onProgress) onProgress(project);
      throw error;
    } finally {
      this.activeWritingProcesses.set(projectId, false);
    }
  }

  async pauseProject(projectId: string): Promise<void> {
    this.activeWritingProcesses.set(projectId, false);
    const project = this.projects.get(projectId);
    if (project) {
      project.status = 'paused';
      project.updatedAt = new Date();
    }
  }

  async handleSectionAction(projectId: string, sectionId: string, action: 'accept' | 'edit' | 'regenerate'): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) throw new Error('Project not found');

    const section = project.sections.find(s => s.id === sectionId);
    if (!section) throw new Error('Section not found');

    switch (action) {
      case 'accept':
        // Mark section as accepted, no changes needed
        break;
      case 'edit':
        // In a real implementation, this would open an editor
        console.log('Edit action would open editor for section:', sectionId);
        break;
      case 'regenerate':
        section.status = 'writing';
        section.content = '';
        section.wordCount = 0;
        // Regenerate the section
        await this.writeSection(project, section);
        break;
    }

    project.updatedAt = new Date();
  }

  async exportProject(projectId: string, format: 'pdf' | 'docx' | 'epub' | 'txt'): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) throw new Error('Project not found');

    // Combine all sections into final document
    const fullContent = this.combineAllSections(project);
    
    if (fullContent.trim().length === 0) {
      throw new Error('No content to export. Please ensure the document has been generated successfully.');
    }
    
    // Generate the actual file
    const blob = new Blob([fullContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.title}.${format === 'docx' ? 'txt' : format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async getUserProjects(): Promise<WriteupProject[]> {
    // In a real implementation, this would load from database
    return Array.from(this.projects.values()).sort((a, b) => 
      b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }

  async getProject(projectId: string): Promise<WriteupProject> {
    const project = this.projects.get(projectId);
    if (!project) throw new Error('Project not found');
    return project;
  }

  private generateTitle(prompt: string): string {
    // Extract a meaningful title from the prompt
    const words = prompt.split(' ').slice(0, 8);
    let title = words.join(' ').replace(/[^\w\s]/g, '').trim();
    
    // Capitalize first letter of each word
    title = title.replace(/\w\S*/g, (txt) => 
      txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
    
    return title || 'Untitled Document';
  }

  private async generateOutline(prompt: string, settings: WriteupSettings, userTier: UserTier): Promise<any> {
    // Get API key for planner model
    const apiKey = await globalApiService.getGlobalApiKey(this.modelAssignments.planner, userTier);
    if (!apiKey) {
      throw new Error('No API key available for planning. Please configure API keys or contact support.');
    }

    const systemPrompt = this.buildPlannerPrompt(settings);
    const userPrompt = `Create a detailed outline for: ${prompt}

Please provide a structured outline with clear sections that would be appropriate for a ${settings.format} in ${settings.style} style.`;

    try {
      console.log(`🧠 Calling ${this.modelAssignments.planner} for outline generation...`);
      const response = await this.callModel(this.modelAssignments.planner, systemPrompt, userPrompt, apiKey);
      console.log('📋 Outline response received, parsing...');
      return this.parseOutlineResponse(response);
    } catch (error) {
      console.error('❌ Outline generation failed:', error);
      throw new Error(`Failed to generate outline: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private createSectionsFromOutline(outline: any): WriteupSection[] {
    const sections: WriteupSection[] = [];
    
    // Create sections based on outline structure
    if (outline.sections && Array.isArray(outline.sections)) {
      outline.sections.forEach((section: any, index: number) => {
        sections.push({
          id: `section-${index + 1}`,
          title: section.title || `Section ${index + 1}`,
          content: '',
          status: 'pending',
          wordCount: 0,
          model: this.selectWriterModel(index),
          summary: section.summary || ''
        });
      });
    } else {
      // Fallback: create meaningful sections based on format
      const defaultSections = this.getDefaultSections(outline.format || 'research-paper');
      defaultSections.forEach((title, index) => {
        sections.push({
          id: `section-${index + 1}`,
          title,
          content: '',
          status: 'pending',
          wordCount: 0,
          model: this.selectWriterModel(index)
        });
      });
    }

    return sections;
  }

  private getDefaultSections(format: string): string[] {
    switch (format) {
      case 'research-paper':
        return ['Abstract', 'Introduction', 'Literature Review', 'Methodology', 'Results', 'Discussion', 'Conclusion', 'References'];
      case 'report':
        return ['Executive Summary', 'Introduction', 'Background', 'Analysis', 'Findings', 'Recommendations', 'Conclusion'];
      case 'novel':
        return ['Chapter 1', 'Chapter 2', 'Chapter 3', 'Chapter 4', 'Chapter 5'];
      case 'article':
        return ['Introduction', 'Main Content', 'Key Points', 'Analysis', 'Conclusion'];
      case 'manual':
        return ['Overview', 'Getting Started', 'Basic Operations', 'Advanced Features', 'Troubleshooting', 'Appendix'];
      case 'proposal':
        return ['Executive Summary', 'Problem Statement', 'Proposed Solution', 'Implementation Plan', 'Budget', 'Timeline', 'Conclusion'];
      default:
        return ['Introduction', 'Main Content', 'Analysis', 'Conclusion'];
    }
  }

  private async writeSequentially(project: WriteupProject, onProgress?: (project: WriteupProject) => void): Promise<void> {
    let context = '';
    
    console.log(`📝 Starting sequential writing for ${project.sections.length} sections...`);
    
    for (let i = 0; i < project.sections.length; i++) {
      if (!this.activeWritingProcesses.get(project.id)) {
        console.log('⏸️ Writing process paused');
        break; // Process was paused
      }

      const section = project.sections[i];
      section.status = 'writing';
      project.currentSection = i;
      
      console.log(`✍️ Writing section ${i + 1}/${project.sections.length}: ${section.title}`);
      
      if (onProgress) onProgress(project);

      try {
        await this.writeSection(project, section, context);
        
        // Generate summary for context
        const summary = await this.generateSectionSummary(section.content);
        section.summary = summary;
        context += `\n\nPrevious section "${section.title}": ${summary}`;
        
        // Update progress
        project.progress = Math.round(10 + ((i + 1) / project.sections.length) * 70); // 10% for planning + 70% for writing
        project.wordCount = project.sections.reduce((total, s) => total + s.wordCount, 0);
        project.estimatedPages = Math.ceil(project.wordCount / 250); // ~250 words per page
        project.updatedAt = new Date();
        
        console.log(`✅ Section "${section.title}" completed: ${section.wordCount} words`);
        
        if (onProgress) onProgress(project);
        
        // Rate limiting: wait between sections
        await this.delay(1000);
      } catch (error) {
        section.status = 'error';
        console.error(`❌ Failed to write section ${section.title}:`, error);
        // Continue with next section instead of failing completely
      }
    }
  }

  private async writeSection(project: WriteupProject, section: WriteupSection, context?: string): Promise<void> {
    const apiKey = await globalApiService.getGlobalApiKey(section.model, 'tier1'); // Use tier1 for global access
    if (!apiKey) {
      throw new Error(`No API key available for model ${section.model}`);
    }

    const systemPrompt = this.buildWriterPrompt(project.settings, section.title, context);
    const userPrompt = `Write a comprehensive "${section.title}" section for the following topic: ${project.prompt}

Make this section substantial and detailed, aiming for at least 500-1000 words. Ensure it flows well and provides valuable content.`;

    try {
      console.log(`🤖 Calling ${section.model} for section: ${section.title}`);
      const content = await this.callModel(section.model, systemPrompt, userPrompt, apiKey);
      
      if (!content || content.trim().length === 0) {
        throw new Error('Empty response from AI model');
      }
      
      section.content = content;
      section.wordCount = this.countWords(content);
      section.status = 'completed';
      
      console.log(`✅ Section content generated: ${section.wordCount} words`);
      
      // Increment global usage
      await globalApiService.incrementGlobalUsage(section.model);
    } catch (error) {
      console.error(`❌ Failed to write section ${section.title}:`, error);
      section.status = 'error';
      throw error;
    }
  }

  private async reviewAndRefine(project: WriteupProject, onProgress?: (project: WriteupProject) => void): Promise<void> {
    project.status = 'reviewing';
    if (onProgress) onProgress(project);

    // Review each section
    for (const section of project.sections) {
      if (section.status === 'completed') {
        try {
          const reviewNotes = await this.reviewSection(section);
          section.reviewNotes = reviewNotes;
        } catch (error) {
          console.error(`Failed to review section ${section.title}:`, error);
        }
      }
    }

    project.progress = 90;
    if (onProgress) onProgress(project);
  }

  private async finalFormatting(project: WriteupProject, onProgress?: (project: WriteupProject) => void): Promise<void> {
    // Final formatting and consistency checks
    project.progress = 95;
    if (onProgress) onProgress(project);
    
    // Simulate formatting time
    await this.delay(500);
  }

  private async reviewSection(section: WriteupSection): Promise<string> {
    const apiKey = await globalApiService.getGlobalApiKey(this.modelAssignments.reviewer, 'tier1');
    if (!apiKey) return 'Review skipped - no API key available';

    const systemPrompt = `You are a critical reviewer. Analyze the following text for clarity, coherence, and quality. Provide brief feedback in 2-3 sentences.`;
    
    try {
      const review = await this.callModel(this.modelAssignments.reviewer, systemPrompt, section.content, apiKey);
      await globalApiService.incrementGlobalUsage(this.modelAssignments.reviewer);
      return review;
    } catch (error) {
      return 'Review failed';
    }
  }

  private async generateSectionSummary(content: string): Promise<string> {
    // Generate a concise summary for context
    const words = content.split(' ');
    if (words.length <= 100) return content;
    
    // Take first 100 words as summary
    return words.slice(0, 100).join(' ') + '...';
  }

  private selectWriterModel(index: number): string {
    // Rotate between available writer models
    return this.modelAssignments.writer[index % this.modelAssignments.writer.length];
  }

  private buildPlannerPrompt(settings: WriteupSettings): string {
    return `You are an expert document planner. Create a detailed outline for a ${settings.format} in ${settings.style} style with a ${settings.tone} tone. 

Target length: ${this.getTargetWordCount(settings)} words
Format: ${settings.format}
Style: ${settings.style}
Tone: ${settings.tone}

Create a structured outline with clear sections that would be appropriate for this type of document. Focus on creating a logical flow and comprehensive coverage of the topic.

Respond with a simple list of section titles, one per line. Do not use JSON format.`;
  }

  private buildWriterPrompt(settings: WriteupSettings, sectionTitle: string, context?: string): string {
    let prompt = `You are an expert writer specializing in ${settings.style} writing. Write the "${sectionTitle}" section in ${settings.tone} tone for a ${settings.format}.

Style guidelines:
- Format: ${settings.format}
- Style: ${settings.style}
- Tone: ${settings.tone}
- Include references: ${settings.includeReferences ? 'Yes' : 'No'}

Write a comprehensive, well-structured section that flows naturally and maintains consistency. Aim for substantial content (500-1000 words minimum).`;

    if (context) {
      prompt += `\n\nContext from previous sections:\n${context}`;
    }

    return prompt;
  }

  private parseOutlineResponse(response: string): any {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(response);
      if (parsed.sections) return parsed;
    } catch {
      // Parse as text outline
    }
    
    // Parse as simple text outline
    const lines = response.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .filter(line => !line.startsWith('#') && !line.startsWith('*') && !line.startsWith('-'))
      .map(line => line.replace(/^\d+\.?\s*/, '').trim())
      .filter(line => line.length > 0);
    
    const sections = lines.map((line, index) => ({
      title: line,
      summary: `Content for ${line}`
    }));
    
    // Ensure we have at least some sections
    if (sections.length === 0) {
      return {
        sections: [
          { title: 'Introduction', summary: 'Opening section' },
          { title: 'Main Content', summary: 'Core content' },
          { title: 'Analysis', summary: 'Analysis and discussion' },
          { title: 'Conclusion', summary: 'Concluding remarks' }
        ]
      };
    }
    
    return { sections };
  }

  private async callModel(model: string, systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    switch (model) {
      case 'openai':
        return this.callOpenAI(messages, apiKey);
      case 'gemini':
        return this.callGemini(messages, apiKey);
      case 'deepseek':
        return this.callDeepSeek(messages, apiKey);
      default:
        throw new Error(`Unsupported model: ${model}`);
    }
  }

  private async callOpenAI(messages: any[], apiKey: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        max_tokens: 2000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content received from OpenAI');
    }
    
    return content;
  }

  private async callGemini(messages: any[], apiKey: string): Promise<string> {
    const contents = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

    // Prepend system message to first user message if exists
    const systemMessage = messages.find(msg => msg.role === 'system');
    if (systemMessage && contents.length > 0 && contents[0].role === 'user') {
      contents[0].parts[0].text = `${systemMessage.content}\n\n${contents[0].parts[0].text}`;
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
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
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error('No content received from Gemini');
    }
    
    return content;
  }

  private async callDeepSeek(messages: any[], apiKey: string): Promise<string> {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        max_tokens: 2000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content received from DeepSeek');
    }
    
    return content;
  }

  private getTargetWordCount(settings: WriteupSettings): string {
    switch (settings.targetLength) {
      case 'short': return '25,000 - 50,000';
      case 'medium': return '50,000 - 100,000';
      case 'long': return '100,000 - 150,000';
      case 'custom': return settings.customWordCount?.toLocaleString() || '0';
      default: return '50,000 - 100,000';
    }
  }

  private countWords(text: string): number {
    if (!text || text.trim().length === 0) return 0;
    return text.trim().split(/\s+/).length;
  }

  private combineAllSections(project: WriteupProject): string {
    let fullContent = `${project.title}\n${'='.repeat(project.title.length)}\n\n`;
    
    project.sections.forEach(section => {
      if (section.content && section.content.trim().length > 0) {
        fullContent += `${section.title}\n${'-'.repeat(section.title.length)}\n\n${section.content}\n\n`;
      }
    });

    return fullContent;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const writeupService = new WriteupService();
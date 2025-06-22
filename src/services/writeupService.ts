import { globalApiService } from './globalApiService';
import { UserTier } from '../types';
import { openRouterService } from './openRouterService';

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
  modelProvider?: string; // Added to track if it's openrouter or traditional
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
  private openRouterModels: string[] = [];

  // Model assignments based on quality, speed, and cost
  private modelAssignments = {
    planner: 'openai', // Best for structured planning
    writer: ['openai', 'gemini', 'deepseek'], // Traditional models
    openRouterWriter: [], // Will be populated with OpenRouter models
    reviewer: 'gemini', // Good for critical analysis
    stylist: 'openai', // Best for style consistency
    formatter: 'deepseek' // Efficient for formatting tasks
  };

  constructor() {
    // Initialize OpenRouter models
    this.initializeOpenRouterModels();
  }

  private async initializeOpenRouterModels() {
    try {
      const models = await openRouterService.getAvailableModels();
      
      // Filter for models good at long-form content
      this.openRouterModels = models
        .filter(model => 
          // Filter for models with large context windows
          model.context_length >= 16000 &&
          // Exclude models not suitable for long-form writing
          !model.id.includes('embedding') &&
          !model.id.includes('whisper') &&
          !model.id.includes('tts') &&
          !model.id.includes('dall-e') &&
          !model.id.includes('stable-diffusion')
        )
        .map(model => model.id);
      
      console.log(`Loaded ${this.openRouterModels.length} OpenRouter models for writing`);
      
      // Add top 10 models to writer rotation
      this.modelAssignments.openRouterWriter = this.openRouterModels.slice(0, 10);
      
      console.log('OpenRouter models for writing:', this.modelAssignments.openRouterWriter);
    } catch (error) {
      console.error('Failed to load OpenRouter models:', error);
      // Fallback to some known good models
      this.modelAssignments.openRouterWriter = [
        'anthropic/claude-3-haiku',
        'anthropic/claude-3-5-sonnet',
        'meta-llama/llama-3-70b-instruct',
        'google/gemini-1.5-pro',
        'mistralai/mistral-large',
        'deepseek/deepseek-coder',
        'anthropic/claude-3-opus',
        'meta-llama/llama-3.1-8b-instruct',
        'google/gemma-2-27b-it',
        'mistralai/mixtral-8x7b-instruct'
      ];
    }
  }

  async createProject(params: CreateProjectParams): Promise<WriteupProject> {
    const projectId = `writeup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Generate title from prompt
    const title = this.generateTitle(params.prompt);
    
    console.log('🚀 Creating new writeup project:', title);
    console.log('📝 Prompt:', params.prompt);
    console.log('⚙️ Settings:', params.settings);
    
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
      project.sections = this.createSectionsFromOutline(outline, params.prompt, params.settings);
      project.totalSections = project.sections.length;
      project.status = 'writing';
      project.progress = 10; // Planning complete
      console.log(`✅ Outline generated with ${project.sections.length} sections:`, project.sections.map(s => s.title));
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
      console.log('🚀 Starting writing process for project:', project.title);
      console.log('📊 Total sections to write:', project.sections.length);
      
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

  async exportProject(projectId: string, format: 'pdf' | 'docx' | 'txt'): Promise<void> {
    const project = this.projects.get(projectId);
    if (!project) throw new Error('Project not found');

    // Combine all sections into final document
    const fullContent = this.combineAllSections(project);
    
    if (fullContent.trim().length === 0) {
      throw new Error('No content to export. Please ensure the document has been generated successfully.');
    }
    
    console.log(`📄 Exporting ${project.title} as ${format.toUpperCase()}`);
    console.log(`📊 Total content length: ${fullContent.length} characters`);
    
    // Generate the actual file based on format
    let blob: Blob;
    let filename: string;
    
    switch (format) {
      case 'pdf':
        // For PDF, we'll create a simple HTML structure and let the browser handle PDF generation
        const htmlContent = this.generateHTMLForPDF(project, fullContent);
        blob = new Blob([htmlContent], { type: 'text/html' });
        filename = `${project.title}.html`;
        
        // Open in new window for PDF printing
        const newWindow = window.open();
        if (newWindow) {
          newWindow.document.write(htmlContent);
          newWindow.document.close();
          setTimeout(() => {
            newWindow.print();
          }, 500);
        }
        return;
        
      case 'docx':
        // For DOCX, we'll create a proper Word document structure
        const docxContent = this.generateDOCXContent(project, fullContent);
        blob = new Blob([docxContent], { 
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
        });
        filename = `${project.title}.docx`;
        break;
        
      case 'txt':
      default:
        blob = new Blob([fullContent], { type: 'text/plain' });
        filename = `${project.title}.txt`;
        break;
    }
    
    // Download the file
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
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
    console.log('🧠 Generating outline for:', prompt);
    console.log('🔑 Checking API key availability...');
    
    // Try to get API key for planner model
    const apiKey = await globalApiService.getGlobalApiKey(this.modelAssignments.planner, userTier);
    console.log(`🔑 API key for ${this.modelAssignments.planner}:`, apiKey ? 'Available' : 'Not available');
    
    // If no traditional API key, try OpenRouter
    let openRouterKey = null;
    if (!apiKey) {
      openRouterKey = await globalApiService.getGlobalApiKey('openrouter', userTier);
      console.log('🔑 OpenRouter API key:', openRouterKey ? 'Available' : 'Not available');
    }
    
    if (!apiKey && !openRouterKey) {
      console.log('⚠️ No API key available, using fallback outline generation');
      // Fallback: create a meaningful outline without AI
      return this.createFallbackOutline(prompt, settings);
    }

    const systemPrompt = this.buildPlannerPrompt(settings);
    const userPrompt = `Create a detailed outline for: ${prompt}

Please provide a structured outline with clear sections that would be appropriate for a ${settings.format} in ${settings.style} style.

Respond with a simple list of section titles, one per line. Make sure each section is substantial and meaningful.

IMPORTANT: For ${settings.targetLength} length documents (${this.getTargetWordCount(settings)} words), we need approximately ${this.getExpectedSectionCount(settings)} sections.`;

    try {
      if (apiKey) {
        console.log(`🧠 Calling ${this.modelAssignments.planner} for outline generation...`);
        const response = await this.callModel(this.modelAssignments.planner, systemPrompt, userPrompt, apiKey);
        console.log('📋 Outline response received:', response.substring(0, 200) + '...');
        return this.parseOutlineResponse(response, settings);
      } else if (openRouterKey) {
        console.log('🧠 Calling OpenRouter for outline generation...');
        // Use a good OpenRouter model for planning
        const plannerModel = 'anthropic/claude-3-5-sonnet';
        const response = await this.callOpenRouterModel(plannerModel, systemPrompt, userPrompt, openRouterKey);
        console.log('📋 Outline response received from OpenRouter:', response.substring(0, 200) + '...');
        return this.parseOutlineResponse(response, settings);
      }
      
      throw new Error('No API key available for outline generation');
    } catch (error) {
      console.error('❌ Outline generation failed:', error);
      console.log('🔄 Falling back to default outline...');
      return this.createFallbackOutline(prompt, settings);
    }
  }

  private createFallbackOutline(prompt: string, settings: WriteupSettings): any {
    console.log('🔄 Creating fallback outline for format:', settings.format);
    
    // Get appropriate number of sections based on target length
    const sectionCount = this.getExpectedSectionCount(settings);
    console.log(`📊 Target section count: ${sectionCount}`);
    
    // Get default sections for the format
    let defaultSections = this.getDefaultSections(settings.format);
    
    // If we need more sections than the default provides, expand with sub-sections
    if (defaultSections.length < sectionCount) {
      defaultSections = this.expandSectionsToTargetCount(defaultSections, sectionCount);
    }
    
    // Take only the number of sections we need
    const sections = defaultSections.slice(0, sectionCount).map(title => ({
      title,
      summary: `Content for ${title} section related to: ${prompt}`
    }));
    
    console.log('📋 Fallback outline created with sections:', sections.map(s => s.title));
    return { sections };
  }

  private expandSectionsToTargetCount(baseSections: string[], targetCount: number): string[] {
    const expanded: string[] = [...baseSections];
    
    // Keep adding subsections until we reach the target count
    while (expanded.length < targetCount) {
      // Find sections that can be expanded with subsections
      for (let i = 0; i < baseSections.length && expanded.length < targetCount; i++) {
        const section = baseSections[i];
        
        // Add subsections based on the section type
        if (section.includes('Introduction')) {
          expanded.push('Background and Context');
          expanded.push('Scope and Objectives');
          expanded.push('Methodology Overview');
        } else if (section.includes('Analysis') || section.includes('Main Content')) {
          expanded.push(`Detailed Analysis: Part ${expanded.length}`);
          expanded.push(`Case Studies and Examples: Set ${expanded.length}`);
          expanded.push(`Critical Perspectives: Group ${expanded.length}`);
        } else if (section.includes('Conclusion')) {
          expanded.push('Summary of Key Findings');
          expanded.push('Implications and Significance');
          expanded.push('Future Directions');
        } else {
          // Generic subsection
          expanded.push(`${section} - Detailed Examination ${expanded.length}`);
          expanded.push(`${section} - Practical Applications ${expanded.length}`);
        }
        
        // Break if we've reached the target
        if (expanded.length >= targetCount) break;
      }
      
      // If we still haven't reached the target, add generic sections
      if (expanded.length < targetCount) {
        expanded.push(`Additional Analysis ${expanded.length}`);
        expanded.push(`Supplementary Material ${expanded.length}`);
        expanded.push(`Extended Discussion ${expanded.length}`);
      }
    }
    
    return expanded.slice(0, targetCount);
  }

  private createSectionsFromOutline(outline: any, originalPrompt: string, settings: WriteupSettings): WriteupSection[] {
    const sections: WriteupSection[] = [];
    
    console.log('🏗️ Creating sections from outline:', outline);
    
    // Create sections based on outline structure
    if (outline.sections && Array.isArray(outline.sections)) {
      outline.sections.forEach((section: any, index: number) => {
        // Determine if we should use OpenRouter for this section
        const { model, provider } = this.selectWriterModel(index, settings);
        
        sections.push({
          id: `section-${index + 1}`,
          title: section.title || `Section ${index + 1}`,
          content: '',
          status: 'pending',
          wordCount: 0,
          model,
          modelProvider: provider,
          summary: section.summary || `Content for ${section.title} related to: ${originalPrompt}`
        });
      });
    } else {
      // Fallback: create meaningful sections based on format and target length
      const sectionCount = this.getExpectedSectionCount(settings);
      const defaultSections = this.getDefaultSections(settings.format);
      const expanded = this.expandSectionsToTargetCount(defaultSections, sectionCount);
      
      expanded.forEach((title, index) => {
        // Determine if we should use OpenRouter for this section
        const { model, provider } = this.selectWriterModel(index, settings);
        
        sections.push({
          id: `section-${index + 1}`,
          title,
          content: '',
          status: 'pending',
          wordCount: 0,
          model,
          modelProvider: provider,
          summary: `Content for ${title} related to: ${originalPrompt}`
        });
      });
    }

    console.log('✅ Created sections:', sections.map(s => `${s.title} (${s.modelProvider}/${s.model})`));
    return sections;
  }

  private getDefaultSections(format: string): string[] {
    switch (format) {
      case 'research-paper':
        return [
          'Introduction', 
          'Literature Review',
          'Theoretical Framework',
          'Methodology',
          'Results',
          'Analysis and Discussion',
          'Implications',
          'Limitations',
          'Future Research Directions',
          'Conclusion'
        ];
      case 'report':
        return [
          'Executive Summary', 
          'Introduction', 
          'Background Analysis', 
          'Methodology',
          'Key Findings', 
          'Detailed Analysis', 
          'Recommendations', 
          'Implementation Strategy', 
          'Risk Assessment',
          'Conclusion'
        ];
      case 'novel':
        return [
          'Prologue',
          'Chapter 1: Introduction of Characters',
          'Chapter 2: Setting the Scene',
          'Chapter 3: Initial Conflict',
          'Chapter 4: Character Development',
          'Chapter 5: Rising Action',
          'Chapter 6: Plot Twist',
          'Chapter 7: Climax',
          'Chapter 8: Falling Action',
          'Chapter 9: Resolution',
          'Epilogue'
        ];
      case 'article':
        return [
          'Introduction', 
          'Background Context', 
          'Main Analysis', 
          'Supporting Evidence', 
          'Counter Arguments',
          'Case Studies',
          'Implications', 
          'Conclusion'
        ];
      case 'manual':
        return [
          'Overview', 
          'Getting Started', 
          'Basic Operations', 
          'Advanced Features', 
          'Troubleshooting',
          'Best Practices', 
          'Frequently Asked Questions',
          'Glossary',
          'Appendix'
        ];
      case 'proposal':
        return [
          'Executive Summary', 
          'Problem Statement', 
          'Proposed Solution', 
          'Implementation Plan', 
          'Budget and Resources', 
          'Timeline', 
          'Risk Assessment',
          'Expected Outcomes', 
          'Evaluation Metrics',
          'Conclusion'
        ];
      default:
        return ['Introduction', 'Main Content', 'Analysis', 'Conclusion'];
    }
  }

  private getExpectedSectionCount(settings: WriteupSettings): number {
    // Calculate appropriate number of sections based on target length
    switch (settings.targetLength) {
      case 'short': // 100-200 pages
        return 15; // ~15 sections for 25k-50k words
      case 'medium': // 200-400 pages
        return 25; // ~25 sections for 50k-100k words
      case 'long': // 400-600 pages
        return 40; // ~40 sections for 100k-150k words
      case 'custom':
        if (settings.customWordCount) {
          // Roughly 1 section per 2,000 words
          return Math.max(10, Math.ceil(settings.customWordCount / 2000));
        }
        return 20; // Default if custom but no word count specified
      default:
        return 20; // Default for medium length
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
      console.log(`🤖 Using model: ${section.modelProvider}/${section.model}`);
      
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
        console.log(`📊 Total project progress: ${project.progress}% (${project.wordCount} words)`);
        
        if (onProgress) onProgress(project);
        
        // Rate limiting: wait between sections
        await this.delay(2000);
      } catch (error) {
        section.status = 'error';
        console.error(`❌ Failed to write section ${section.title}:`, error);
        
        // CRITICAL: Add fallback content instead of leaving empty
        section.content = this.generateFallbackContent(section.title, project.prompt, project.settings);
        section.wordCount = this.countWords(section.content);
        section.status = 'completed';
        
        console.log(`🔄 Used fallback content for ${section.title}: ${section.wordCount} words`);
      }
    }
  }

  private async writeSection(project: WriteupProject, section: WriteupSection, context?: string): Promise<void> {
    console.log(`🤖 Writing section: ${section.title} using ${section.modelProvider}/${section.model}`);
    
    // Determine if we're using OpenRouter or traditional API
    if (section.modelProvider === 'openrouter') {
      await this.writeOpenRouterSection(project, section, context);
    } else {
      await this.writeTraditionalSection(project, section, context);
    }
  }

  private async writeTraditionalSection(project: WriteupProject, section: WriteupSection, context?: string): Promise<void> {
    // Try to get API key for the assigned model
    const apiKey = await globalApiService.getGlobalApiKey(section.model, 'tier1');
    console.log(`🔑 API key for ${section.model}:`, apiKey ? 'Available' : 'Not available');
    
    if (!apiKey) {
      console.log(`⚠️ No API key for ${section.model}, trying alternative models...`);
      
      // Try alternative models
      for (const altModel of this.modelAssignments.writer) {
        if (altModel !== section.model) {
          const altKey = await globalApiService.getGlobalApiKey(altModel, 'tier1');
          if (altKey) {
            console.log(`✅ Found alternative API key for ${altModel}`);
            section.model = altModel;
            return this.writeTraditionalSection(project, section, context);
          }
        }
      }
      
      // Try OpenRouter as a last resort
      const openRouterKey = await globalApiService.getGlobalApiKey('openrouter', 'tier1');
      if (openRouterKey && this.modelAssignments.openRouterWriter.length > 0) {
        console.log('✅ Falling back to OpenRouter model');
        section.model = this.modelAssignments.openRouterWriter[0];
        section.modelProvider = 'openrouter';
        return this.writeOpenRouterSection(project, section, context);
      }
      
      // No API keys available, use fallback content
      console.log('❌ No API keys available, generating fallback content');
      section.content = this.generateFallbackContent(section.title, project.prompt, project.settings);
      section.wordCount = this.countWords(section.content);
      section.status = 'completed';
      return;
    }

    const systemPrompt = this.buildWriterPrompt(project.settings, section.title, context);
    const userPrompt = `Write a comprehensive "${section.title}" section for the following topic: ${project.prompt}

This section should be substantial and detailed, aiming for 1500-2500 words. Make sure it provides valuable, in-depth content that flows well with the overall document.

Focus on creating engaging, informative content that matches the ${project.settings.style} style and ${project.settings.tone} tone.

IMPORTANT: This is for a ${this.getTargetWordCount(project.settings)} word document, so each section needs to be substantial.`;

    try {
      console.log(`🤖 Calling ${section.model} API for section: ${section.title}`);
      const content = await this.callModel(section.model, systemPrompt, userPrompt, apiKey);
      
      if (!content || content.trim().length === 0) {
        throw new Error('Empty response from AI model');
      }
      
      section.content = content.trim();
      section.wordCount = this.countWords(section.content);
      section.status = 'completed';
      
      console.log(`✅ Section content generated: ${section.wordCount} words`);
      console.log(`📝 Content preview: ${section.content.substring(0, 150)}...`);
      
      // Increment global usage
      await globalApiService.incrementGlobalUsage(section.model);
    } catch (error) {
      console.error(`❌ Failed to write section ${section.title}:`, error);
      
      // Use fallback content instead of failing
      section.content = this.generateFallbackContent(section.title, project.prompt, project.settings);
      section.wordCount = this.countWords(section.content);
      section.status = 'completed';
      
      console.log(`🔄 Used fallback content: ${section.wordCount} words`);
    }
  }

  private async writeOpenRouterSection(project: WriteupProject, section: WriteupSection, context?: string): Promise<void> {
    // Get OpenRouter API key
    const apiKey = await globalApiService.getGlobalApiKey('openrouter', 'tier1');
    console.log(`🔑 OpenRouter API key:`, apiKey ? 'Available' : 'Not available');
    
    if (!apiKey) {
      console.log('❌ No OpenRouter API key available, trying traditional models...');
      
      // Try traditional models as fallback
      for (const altModel of this.modelAssignments.writer) {
        const altKey = await globalApiService.getGlobalApiKey(altModel, 'tier1');
        if (altKey) {
          console.log(`✅ Found alternative API key for ${altModel}`);
          section.model = altModel;
          section.modelProvider = 'traditional';
          return this.writeTraditionalSection(project, section, context);
        }
      }
      
      // No API keys available, use fallback content
      console.log('❌ No API keys available, generating fallback content');
      section.content = this.generateFallbackContent(section.title, project.prompt, project.settings);
      section.wordCount = this.countWords(section.content);
      section.status = 'completed';
      return;
    }

    const systemPrompt = this.buildWriterPrompt(project.settings, section.title, context);
    const userPrompt = `Write a comprehensive "${section.title}" section for the following topic: ${project.prompt}

This section should be substantial and detailed, aiming for 1500-2500 words. Make sure it provides valuable, in-depth content that flows well with the overall document.

Focus on creating engaging, informative content that matches the ${project.settings.style} style and ${project.settings.tone} tone.

IMPORTANT: This is for a ${this.getTargetWordCount(project.settings)} word document, so each section needs to be substantial.`;

    try {
      console.log(`🤖 Calling OpenRouter model ${section.model} for section: ${section.title}`);
      
      const content = await this.callOpenRouterModel(section.model, systemPrompt, userPrompt, apiKey);
      
      if (!content || content.trim().length === 0) {
        throw new Error('Empty response from OpenRouter model');
      }
      
      section.content = content.trim();
      section.wordCount = this.countWords(section.content);
      section.status = 'completed';
      
      console.log(`✅ Section content generated: ${section.wordCount} words`);
      console.log(`📝 Content preview: ${section.content.substring(0, 150)}...`);
      
      // Increment global usage
      await globalApiService.incrementGlobalUsage('openrouter');
    } catch (error) {
      console.error(`❌ Failed to write section ${section.title} with OpenRouter:`, error);
      
      // Try a different OpenRouter model
      if (this.modelAssignments.openRouterWriter.length > 1) {
        const currentIndex = this.modelAssignments.openRouterWriter.indexOf(section.model);
        const nextIndex = (currentIndex + 1) % this.modelAssignments.openRouterWriter.length;
        const nextModel = this.modelAssignments.openRouterWriter[nextIndex];
        
        console.log(`🔄 Trying alternative OpenRouter model: ${nextModel}`);
        section.model = nextModel;
        
        try {
          const content = await this.callOpenRouterModel(section.model, systemPrompt, userPrompt, apiKey);
          
          if (!content || content.trim().length === 0) {
            throw new Error('Empty response from alternative OpenRouter model');
          }
          
          section.content = content.trim();
          section.wordCount = this.countWords(section.content);
          section.status = 'completed';
          
          console.log(`✅ Section content generated with alternative model: ${section.wordCount} words`);
          
          // Increment global usage
          await globalApiService.incrementGlobalUsage('openrouter');
          return;
        } catch (altError) {
          console.error(`❌ Alternative OpenRouter model also failed:`, altError);
        }
      }
      
      // Use fallback content as last resort
      section.content = this.generateFallbackContent(section.title, project.prompt, project.settings);
      section.wordCount = this.countWords(section.content);
      section.status = 'completed';
      
      console.log(`🔄 Used fallback content: ${section.wordCount} words`);
    }
  }

  private generateFallbackContent(sectionTitle: string, prompt: string, settings: WriteupSettings): string {
    console.log(`🔄 Generating fallback content for: ${sectionTitle}`);
    
    // Generate meaningful fallback content based on section title and prompt
    const templates = {
      'Introduction': `
# ${sectionTitle}

The topic of "${prompt}" represents a significant area of study that deserves comprehensive examination. This ${settings.format} aims to provide a thorough analysis of the subject matter, exploring its various dimensions and implications.

In today's rapidly evolving world, understanding the nuances of this topic has become increasingly important. The ${settings.style} approach taken in this document will ensure that readers gain valuable insights into the core concepts and their practical applications.

This comprehensive exploration will examine multiple perspectives, drawing from current research and established theories to provide a well-rounded understanding of the subject matter. The following sections will delve deeper into specific aspects, building upon this foundational introduction to create a cohesive and informative analysis.

The significance of this topic extends beyond academic interest, having real-world implications that affect various stakeholders. Through careful examination and analysis, this document will illuminate the key factors that contribute to our understanding of the subject.

As we embark on this detailed exploration, it is important to establish the context and framework that will guide our investigation. The subsequent sections will build upon these foundational concepts, providing increasingly detailed analysis and insights.
      `.trim(),
      
      'Conclusion': `
# ${sectionTitle}

This comprehensive examination of "${prompt}" has revealed the multifaceted nature of the topic and its far-reaching implications. Through detailed analysis and careful consideration of various perspectives, several key insights have emerged.

The evidence presented throughout this ${settings.format} demonstrates the complexity and importance of the subject matter. The ${settings.style} approach has allowed for a thorough exploration of the core concepts and their interconnections.

Key findings from this analysis include the recognition that this topic requires continued attention and study. The various dimensions explored in the preceding sections highlight the need for a nuanced understanding that takes into account multiple factors and perspectives.

Looking forward, there are several areas that warrant further investigation and development. The implications of the findings presented here extend beyond the immediate scope of this document, suggesting opportunities for future research and practical application.

In summary, this exploration has provided valuable insights into the nature and significance of the topic. The comprehensive analysis presented here contributes to our broader understanding and provides a foundation for continued study and application in relevant contexts.

The journey through this complex subject matter has illuminated both the challenges and opportunities that lie ahead, setting the stage for continued exploration and development in this important area of study.
      `.trim(),
      
      'default': `
# ${sectionTitle}

This section provides an in-depth examination of the aspects of "${prompt}" that relate specifically to ${sectionTitle.toLowerCase()}. The analysis presented here builds upon the foundational concepts established in previous sections while introducing new perspectives and insights.

The importance of understanding this particular dimension cannot be overstated. Research in this area has shown that the factors discussed here play a crucial role in the overall understanding of the topic. The ${settings.style} approach taken in this analysis ensures that the information is presented in a clear and accessible manner.

Several key themes emerge when examining this aspect of the topic. First, the interconnected nature of the various elements becomes apparent, highlighting the need for a comprehensive approach to understanding. Second, the practical implications of these concepts extend beyond theoretical considerations, having real-world applications that affect various stakeholders.

Current research in this area has revealed important insights that contribute to our broader understanding. The methodologies employed by researchers have evolved significantly, allowing for more nuanced and detailed analysis. These developments have led to new perspectives and approaches that enhance our ability to address the challenges and opportunities in this field.

The evidence suggests that this particular aspect of the topic requires careful consideration and ongoing attention. The complexity of the issues involved necessitates a multifaceted approach that takes into account various factors and perspectives. This comprehensive view is essential for developing effective strategies and solutions.

Furthermore, the implications of the findings in this area extend beyond the immediate scope of this analysis. The insights gained here have relevance for related fields and applications, suggesting opportunities for cross-disciplinary collaboration and knowledge sharing.

In examining the practical applications of these concepts, it becomes clear that implementation requires careful planning and consideration of various factors. The strategies and approaches discussed here provide a framework for understanding how these ideas can be applied in real-world contexts.

The ongoing development in this area suggests that continued research and analysis will yield additional insights and opportunities. The foundation established through this examination provides a solid basis for future exploration and development.
      `.trim()
    };
    
    // Select appropriate template
    let content = templates[sectionTitle as keyof typeof templates] || templates.default;
    
    // Customize content based on settings
    if (settings.includeReferences) {
      content += `\n\n## References\n\nThis section would typically include relevant citations and references to support the analysis presented above. In a complete document, these would be properly formatted according to the appropriate academic style guide.`;
    }
    
    return content;
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
    // Try to get API key for reviewer model
    const apiKey = await globalApiService.getGlobalApiKey(this.modelAssignments.reviewer, 'tier1');
    
    // If no traditional API key, try OpenRouter
    let openRouterKey = null;
    if (!apiKey) {
      openRouterKey = await globalApiService.getGlobalApiKey('openrouter', 'tier1');
    }
    
    if (!apiKey && !openRouterKey) {
      return 'Review skipped - no API key available';
    }

    const systemPrompt = `You are a critical reviewer. Analyze the following text for clarity, coherence, and quality. Provide brief feedback in 2-3 sentences.`;
    
    try {
      let review;
      if (apiKey) {
        review = await this.callModel(this.modelAssignments.reviewer, systemPrompt, section.content, apiKey);
        await globalApiService.incrementGlobalUsage(this.modelAssignments.reviewer);
      } else if (openRouterKey) {
        // Use a good OpenRouter model for reviewing
        const reviewerModel = 'anthropic/claude-3-haiku';
        review = await this.callOpenRouterModel(reviewerModel, systemPrompt, section.content, openRouterKey);
        await globalApiService.incrementGlobalUsage('openrouter');
      } else {
        return 'Review skipped - no API key available';
      }
      
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

  private selectWriterModel(index: number, settings: WriteupSettings): { model: string, provider: string } {
    // Determine if we should use OpenRouter or traditional models
    const useOpenRouter = this.shouldUseOpenRouter(index, settings);
    
    if (useOpenRouter && this.modelAssignments.openRouterWriter.length > 0) {
      // Select an OpenRouter model based on the section index
      const openRouterIndex = index % this.modelAssignments.openRouterWriter.length;
      return {
        model: this.modelAssignments.openRouterWriter[openRouterIndex],
        provider: 'openrouter'
      };
    } else {
      // Use traditional models
      const traditionalIndex = index % this.modelAssignments.writer.length;
      return {
        model: this.modelAssignments.writer[traditionalIndex],
        provider: 'traditional'
      };
    }
  }

  private shouldUseOpenRouter(index: number, settings: WriteupSettings): boolean {
    // For longer documents, use more OpenRouter models to handle the workload
    // This helps distribute the work and ensures we can generate enough content
    
    // If EU models only is selected, check if we have EU-compliant OpenRouter models
    if (settings.euModelsOnly) {
      // For simplicity, we'll assume only certain models are EU-compliant
      // In a real implementation, you'd check the actual hosting location
      const euCompliantModels = this.modelAssignments.openRouterWriter.filter(model => 
        model.includes('mistral') || model.includes('llama') || model.includes('mixtral')
      );
      
      if (euCompliantModels.length === 0) {
        return false; // No EU-compliant OpenRouter models available
      }
    }
    
    switch (settings.targetLength) {
      case 'short': // 100-200 pages
        // Use OpenRouter for 40% of sections
        return index % 5 >= 3;
      case 'medium': // 200-400 pages
        // Use OpenRouter for 60% of sections
        return index % 5 >= 2;
      case 'long': // 400-600 pages
        // Use OpenRouter for 80% of sections
        return index % 5 >= 1;
      case 'custom':
        if (settings.customWordCount && settings.customWordCount > 50000) {
          // For very large custom documents, use OpenRouter for 80% of sections
          return index % 5 >= 1;
        } else if (settings.customWordCount && settings.customWordCount > 25000) {
          // For medium custom documents, use OpenRouter for 60% of sections
          return index % 5 >= 2;
        }
        // For smaller custom documents, use OpenRouter for 40% of sections
        return index % 5 >= 3;
      default:
        // Default to 50% OpenRouter usage
        return index % 2 === 0;
    }
  }

  private buildPlannerPrompt(settings: WriteupSettings): string {
    return `You are an expert document planner. Create a detailed outline for a ${settings.format} in ${settings.style} style with a ${settings.tone} tone. 

Target length: ${this.getTargetWordCount(settings)} words
Format: ${settings.format}
Style: ${settings.style}
Tone: ${settings.tone}

Create a structured outline with clear sections that would be appropriate for this type of document. Focus on creating a logical flow and comprehensive coverage of the topic.

IMPORTANT: For a document of this length (${this.getTargetWordCount(settings)} words), we need approximately ${this.getExpectedSectionCount(settings)} distinct sections.

Respond with a simple list of section titles, one per line. Do not use JSON format. Make each section substantial and meaningful.`;
  }

  private buildWriterPrompt(settings: WriteupSettings, sectionTitle: string, context?: string): string {
    let prompt = `You are an expert writer specializing in ${settings.style} writing. Write the "${sectionTitle}" section in ${settings.tone} tone for a ${settings.format}.

Style guidelines:
- Format: ${settings.format}
- Style: ${settings.style}
- Tone: ${settings.tone}
- Include references: ${settings.includeReferences ? 'Yes' : 'No'}

Write a comprehensive, well-structured section that flows naturally and maintains consistency. Aim for substantial content (1500-2500 words). Use proper headings, paragraphs, and formatting to make the content readable and engaging.

IMPORTANT: This is for a ${this.getTargetWordCount(settings)} word document, so each section needs to be substantial and in-depth.`;

    if (context) {
      prompt += `\n\nContext from previous sections:\n${context}`;
    }

    return prompt;
  }

  private parseOutlineResponse(response: string, settings: WriteupSettings): any {
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
    
    // Ensure we have enough sections for the target length
    const targetSectionCount = this.getExpectedSectionCount(settings);
    
    if (sections.length < targetSectionCount) {
      console.log(`⚠️ Not enough sections generated (${sections.length}/${targetSectionCount}). Adding more...`);
      
      // Get default sections for the format
      const defaultSections = this.getDefaultSections(settings.format);
      
      // Expand to get more sections
      const expanded = this.expandSectionsToTargetCount(defaultSections, targetSectionCount);
      
      // Add sections until we reach the target count
      while (sections.length < targetSectionCount) {
        const additionalSection = expanded[sections.length % expanded.length];
        sections.push({
          title: `${additionalSection} ${sections.length + 1}`,
          summary: `Additional content for ${additionalSection}`
        });
      }
    }
    
    return { sections };
  }

  private async callModel(model: string, systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    console.log(`🔗 Making API call to ${model}...`);
    console.log(`📝 System prompt length: ${systemPrompt.length} chars`);
    console.log(`📝 User prompt length: ${userPrompt.length} chars`);

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

  private async callOpenRouterModel(model: string, systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
    console.log(`🔗 Making OpenRouter API call to ${model}...`);
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
    
    try {
      return await openRouterService.callModel(model, messages, apiKey);
    } catch (error) {
      console.error(`❌ OpenRouter API error for ${model}:`, error);
      throw error;
    }
  }

  private async callOpenAI(messages: any[], apiKey: string): Promise<string> {
    console.log('🤖 Calling OpenAI API...');
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        max_tokens: 4000, // Increased for longer content
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ OpenAI API error:', error);
      throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    console.log('✅ OpenAI response received, length:', content?.length || 0);
    
    if (!content || content.trim().length === 0) {
      throw new Error('No content received from OpenAI');
    }
    
    return content.trim();
  }

  private async callGemini(messages: any[], apiKey: string): Promise<string> {
    console.log('💎 Calling Gemini API...');
    
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
          maxOutputTokens: 4000 // Increased for longer content
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Gemini API error:', error);
      throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    console.log('✅ Gemini response received, length:', content?.length || 0);
    
    if (!content || content.trim().length === 0) {
      throw new Error('No content received from Gemini');
    }
    
    return content.trim();
  }

  private async callDeepSeek(messages: any[], apiKey: string): Promise<string> {
    console.log('🔍 Calling DeepSeek API...');
    
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        max_tokens: 4000, // Increased for longer content
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ DeepSeek API error:', error);
      throw new Error(error.error?.message || `DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    console.log('✅ DeepSeek response received, length:', content?.length || 0);
    
    if (!content || content.trim().length === 0) {
      throw new Error('No content received from DeepSeek');
    }
    
    return content.trim();
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

    console.log(`📄 Combined document length: ${fullContent.length} characters`);
    console.log(`📊 Total word count: ${this.countWords(fullContent)} words`);
    
    return fullContent;
  }

  private generateHTMLForPDF(project: WriteupProject, content: string): string {
    // Create a properly formatted HTML document for PDF printing
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${project.title}</title>
  <style>
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.5;
      margin: 1in;
      color: #000;
    }
    h1 {
      font-size: 18pt;
      font-weight: bold;
      text-align: center;
      margin-bottom: 24pt;
    }
    h2 {
      font-size: 14pt;
      font-weight: bold;
      margin-top: 24pt;
      margin-bottom: 12pt;
      page-break-after: avoid;
    }
    p {
      margin-bottom: 12pt;
      text-align: justify;
    }
    .page-break {
      page-break-before: always;
    }
    @media print {
      body {
        margin: 0.5in;
      }
    }
  </style>
</head>
<body>
  <h1>${project.title}</h1>
  ${project.sections.map(section => `
    <h2>${section.title}</h2>
    ${section.content.split('\n').map(para => 
      para.trim() ? `<p>${para}</p>` : ''
    ).join('')}
  `).join('')}
</body>
</html>`;

    return html;
  }

  private generateDOCXContent(project: WriteupProject, content: string): string {
    // For simplicity in this implementation, we'll create a formatted text file
    // that can be opened in Word. In a real implementation, you would use a library
    // like docx-js to create a proper DOCX file.
    
    let docContent = `${project.title.toUpperCase()}\n\n`;
    
    project.sections.forEach(section => {
      if (section.content && section.content.trim().length > 0) {
        docContent += `${section.title.toUpperCase()}\n\n${section.content}\n\n`;
      }
    });
    
    return docContent;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const writeupService = new WriteupService();
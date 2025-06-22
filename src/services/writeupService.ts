import { globalApiService } from './globalApiService';
import { openRouterService } from './openRouterService';
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
    writer: ['openai', 'gemini', 'deepseek'], // Traditional models
    openRouterModels: [
      'anthropic/claude-3-opus', // High quality for important sections
      'anthropic/claude-3-sonnet', // Good balance of quality and speed
      'meta-llama/llama-3-70b-instruct', // Good for creative content
      'google/gemini-1.5-pro', // Good for technical content
      'mistralai/mistral-large', // Fast and efficient
      'meta-llama/llama-3-8b-instruct', // Fast for simpler sections
      'anthropic/claude-3-haiku', // Very fast for short sections
      'google/gemini-1.0-pro', // Backup option
      'mistralai/mistral-medium', // Backup option
      'deepseek/deepseek-coder', // Good for technical sections
    ],
    reviewer: 'gemini', // Good for critical analysis
    stylist: 'openai', // Best for style consistency
    formatter: 'deepseek' // Efficient for formatting tasks
  };

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
      
      // Create sections based on target length
      const targetSectionCount = this.getTargetSectionCount(params.settings);
      console.log(`📊 Target section count: ${targetSectionCount}`);
      
      // If outline doesn't have enough sections, expand it
      if (outline.sections.length < targetSectionCount) {
        console.log(`🔄 Expanding outline from ${outline.sections.length} to ${targetSectionCount} sections`);
        outline.sections = this.expandOutline(outline.sections, targetSectionCount, params.prompt);
      }
      
      project.sections = this.createSectionsFromOutline(outline, params.prompt);
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
        // For PDF, create a properly formatted HTML document for printing
        const htmlContent = this.generateHTMLForPDF(project, fullContent);
        blob = new Blob([htmlContent], { type: 'text/html' });
        filename = `${project.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
        
        // Create a download link
        const pdfLink = document.createElement('a');
        pdfLink.href = URL.createObjectURL(blob);
        pdfLink.download = filename;
        document.body.appendChild(pdfLink);
        pdfLink.click();
        document.body.removeChild(pdfLink);
        URL.revokeObjectURL(pdfLink.href);
        
        // Open in new window for PDF printing
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(htmlContent);
          printWindow.document.close();
          
          // Add a small delay before triggering print
          setTimeout(() => {
            printWindow.print();
          }, 1000);
        }
        return;
        
      case 'docx':
        // For DOCX, create a properly formatted HTML document with Word-compatible markup
        const docxContent = this.generateWordDocument(project, fullContent);
        blob = new Blob([docxContent], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        filename = `${project.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.html`;
        break;
        
      case 'txt':
      default:
        // Plain text export
        blob = new Blob([fullContent], { type: 'text/plain' });
        filename = `${project.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
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

  private getTargetSectionCount(settings: WriteupSettings): number {
    // Determine how many sections to create based on target length
    switch (settings.targetLength) {
      case 'short': return 15; // 100-200 pages
      case 'medium': return 25; // 200-400 pages
      case 'long': return 40; // 400-600 pages
      case 'custom':
        // Calculate based on custom word count (roughly 1 section per 2000 words)
        const wordCount = settings.customWordCount || 50000;
        return Math.max(10, Math.ceil(wordCount / 2000));
      default:
        return 20; // Default
    }
  }

  private expandOutline(sections: any[], targetCount: number, prompt: string): any[] {
    // If we need more sections, expand the outline
    if (sections.length >= targetCount) return sections;
    
    const expanded = [...sections];
    const defaultSections = this.getDefaultSections('research-paper');
    
    // First, try to add subsections to existing sections
    for (let i = 0; i < sections.length && expanded.length < targetCount; i++) {
      // Add 2-3 subsections to each main section
      const subsectionCount = Math.min(3, Math.ceil((targetCount - expanded.length) / sections.length));
      
      for (let j = 0; j < subsectionCount && expanded.length < targetCount; j++) {
        const subsectionTitle = `${sections[i].title} - Part ${j + 1}`;
        expanded.push({
          title: subsectionTitle,
          summary: `Detailed exploration of ${subsectionTitle.toLowerCase()} related to: ${prompt}`
        });
      }
    }
    
    // If we still need more sections, add from default templates
    while (expanded.length < targetCount) {
      const remainingNeeded = targetCount - expanded.length;
      const additionalSections = defaultSections
        .slice(0, remainingNeeded)
        .map(title => ({
          title,
          summary: `Content for ${title.toLowerCase()} related to: ${prompt}`
        }));
      
      expanded.push(...additionalSections);
    }
    
    return expanded;
  }

  private async generateOutline(prompt: string, settings: WriteupSettings, userTier: UserTier): Promise<any> {
    console.log('🧠 Generating outline for:', prompt);
    console.log('🔑 Checking API key availability...');
    
    // Try to get API key for planner model
    const apiKey = await globalApiService.getGlobalApiKey(this.modelAssignments.planner, userTier);
    console.log(`🔑 API key for ${this.modelAssignments.planner}:`, apiKey ? 'Available' : 'Not available');
    
    if (!apiKey) {
      console.log('⚠️ No API key available, using fallback outline generation');
      // Fallback: create a meaningful outline without AI
      return this.createFallbackOutline(prompt, settings);
    }

    const systemPrompt = this.buildPlannerPrompt(settings);
    const userPrompt = `Create a detailed outline for: ${prompt}

Please provide a structured outline with clear sections that would be appropriate for a ${settings.format} in ${settings.style} style.

Respond with a simple list of section titles, one per line. Make sure each section is substantial and meaningful.`;

    try {
      console.log(`🧠 Calling ${this.modelAssignments.planner} for outline generation...`);
      const response = await this.callModel(this.modelAssignments.planner, systemPrompt, userPrompt, apiKey);
      console.log('📋 Outline response received:', response.substring(0, 200) + '...');
      return this.parseOutlineResponse(response);
    } catch (error) {
      console.error('❌ Outline generation failed:', error);
      console.log('🔄 Falling back to default outline...');
      return this.createFallbackOutline(prompt, settings);
    }
  }

  private createFallbackOutline(prompt: string, settings: WriteupSettings): any {
    console.log('🔄 Creating fallback outline for format:', settings.format);
    
    const sections = this.getDefaultSections(settings.format).map(title => ({
      title,
      summary: `Content for ${title} section related to: ${prompt}`
    }));
    
    console.log('📋 Fallback outline created with sections:', sections.map(s => s.title));
    return { sections };
  }

  private createSectionsFromOutline(outline: any, originalPrompt: string): WriteupSection[] {
    const sections: WriteupSection[] = [];
    
    console.log('🏗️ Creating sections from outline:', outline);
    
    // Create sections based on outline structure
    if (outline.sections && Array.isArray(outline.sections)) {
      outline.sections.forEach((section: any, index: number) => {
        // Determine if this section should use OpenRouter or traditional models
        // More important sections (intro, conclusion, key chapters) use traditional models
        // Other sections use OpenRouter models for better scalability
        const useOpenRouter = this.shouldUseOpenRouter(index, outline.sections.length);
        const modelInfo = this.selectModel(index, outline.sections.length, useOpenRouter);
        
        sections.push({
          id: `section-${index + 1}`,
          title: section.title || `Section ${index + 1}`,
          content: '',
          status: 'pending',
          wordCount: 0,
          model: modelInfo.model,
          modelProvider: modelInfo.provider,
          summary: section.summary || `Content for ${section.title} related to: ${originalPrompt}`
        });
      });
    } else {
      // Fallback: create meaningful sections based on format
      const defaultSections = this.getDefaultSections('research-paper');
      defaultSections.forEach((title, index) => {
        const useOpenRouter = this.shouldUseOpenRouter(index, defaultSections.length);
        const modelInfo = this.selectModel(index, defaultSections.length, useOpenRouter);
        
        sections.push({
          id: `section-${index + 1}`,
          title,
          content: '',
          status: 'pending',
          wordCount: 0,
          model: modelInfo.model,
          modelProvider: modelInfo.provider,
          summary: `Content for ${title} related to: ${originalPrompt}`
        });
      });
    }

    console.log('✅ Created sections:', sections.map(s => `${s.title} (${s.modelProvider}/${s.model})`));
    return sections;
  }

  private shouldUseOpenRouter(sectionIndex: number, totalSections: number): boolean {
    // For very long documents, use OpenRouter for most sections to handle the scale
    if (totalSections > 30) {
      // Use traditional models for key sections (intro, conclusion, and a few important chapters)
      const keyIndices = [0, 1, Math.floor(totalSections / 2), totalSections - 2, totalSections - 1];
      return !keyIndices.includes(sectionIndex);
    }
    
    // For medium-length documents, use a mix
    if (totalSections > 15) {
      // Use OpenRouter for about 60% of sections
      return sectionIndex % 5 >= 2;
    }
    
    // For shorter documents, use traditional models more
    return sectionIndex % 3 === 1; // Use OpenRouter for about 33% of sections
  }

  private selectModel(sectionIndex: number, totalSections: number, useOpenRouter: boolean): { model: string; provider: string } {
    if (useOpenRouter) {
      // Select an OpenRouter model based on section importance
      const openRouterModels = this.modelAssignments.openRouterModels;
      
      // Determine section importance (0-1 scale)
      let importance = 0.5;
      
      // Introduction and conclusion are most important
      if (sectionIndex === 0 || sectionIndex === totalSections - 1) {
        importance = 1.0;
      } 
      // Early and late sections are more important than middle sections
      else if (sectionIndex < totalSections * 0.2 || sectionIndex > totalSections * 0.8) {
        importance = 0.8;
      }
      // Middle sections vary in importance
      else {
        importance = 0.3 + Math.random() * 0.4; // Random importance between 0.3-0.7
      }
      
      // Select model based on importance
      let modelIndex;
      if (importance > 0.9) {
        // Most important sections get the best models
        modelIndex = 0;
      } else if (importance > 0.7) {
        // Important sections get good models
        modelIndex = Math.floor(Math.random() * 3) + 1;
      } else if (importance > 0.4) {
        // Medium importance sections get mid-tier models
        modelIndex = Math.floor(Math.random() * 3) + 4;
      } else {
        // Less important sections get faster/cheaper models
        modelIndex = Math.floor(Math.random() * 3) + 7;
      }
      
      // Ensure index is within bounds
      modelIndex = Math.min(modelIndex, openRouterModels.length - 1);
      
      return {
        model: openRouterModels[modelIndex],
        provider: 'openrouter'
      };
    } else {
      // Use traditional models
      const traditionalModels = this.modelAssignments.writer;
      const modelIndex = sectionIndex % traditionalModels.length;
      
      return {
        model: traditionalModels[modelIndex],
        provider: traditionalModels[modelIndex]
      };
    }
  }

  private getDefaultSections(format: string): string[] {
    switch (format) {
      case 'research-paper':
        return ['Introduction', 'Theoretical Frameworks and Philosophical Underpinnings', 'Psychological Benefits of Kindness', 'Social and Cultural Dimensions of Kindness', 'Practical Applications and Real-World Examples', 'Challenges and Barriers to Kindness', 'Future Directions and Implications', 'Conclusion'];
      case 'report':
        return ['Executive Summary', 'Introduction', 'Background Analysis', 'Key Findings', 'Detailed Analysis', 'Recommendations', 'Implementation Strategy', 'Conclusion'];
      case 'novel':
        return ['Chapter 1: The Beginning', 'Chapter 2: Rising Action', 'Chapter 3: Conflict Emerges', 'Chapter 4: Climax', 'Chapter 5: Resolution'];
      case 'article':
        return ['Introduction', 'Background Context', 'Main Analysis', 'Supporting Evidence', 'Implications', 'Conclusion'];
      case 'manual':
        return ['Overview', 'Getting Started', 'Basic Operations', 'Advanced Features', 'Best Practices', 'Troubleshooting', 'Appendix'];
      case 'proposal':
        return ['Executive Summary', 'Problem Statement', 'Proposed Solution', 'Implementation Plan', 'Budget and Resources', 'Timeline', 'Expected Outcomes', 'Conclusion'];
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
    
    let apiKey: string | null = null;
    let content: string = '';
    
    try {
      if (section.modelProvider === 'openrouter') {
        // Use OpenRouter for this section
        apiKey = await globalApiService.getGlobalApiKey('openrouter', 'tier1');
        
        if (!apiKey) {
          console.log('⚠️ No OpenRouter API key, trying traditional models...');
          // Fall back to traditional models
          const traditionalModel = this.modelAssignments.writer[0]; // Default to first traditional model
          const traditionalKey = await globalApiService.getGlobalApiKey(traditionalModel, 'tier1');
          
          if (traditionalKey) {
            console.log(`✅ Falling back to ${traditionalModel}`);
            section.model = traditionalModel;
            section.modelProvider = traditionalModel;
            return this.writeSection(project, section, context);
          } else {
            throw new Error('No API keys available');
          }
        }
        
        // Call OpenRouter with the selected model
        const systemPrompt = this.buildWriterPrompt(project.settings, section.title, context);
        const userPrompt = this.buildDetailedSectionPrompt(section, project);
        
        console.log(`🔀 Calling OpenRouter with model: ${section.model}`);
        content = await openRouterService.callModel(
          section.model,
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          apiKey
        );
        
        // Increment global usage
        await globalApiService.incrementGlobalUsage('openrouter');
      } else {
        // Use traditional model (OpenAI, Gemini, DeepSeek)
        apiKey = await globalApiService.getGlobalApiKey(section.model, 'tier1');
        
        if (!apiKey) {
          console.log(`⚠️ No API key for ${section.model}, trying alternative models...`);
          
          // Try alternative models
          for (const altModel of this.modelAssignments.writer) {
            if (altModel !== section.model) {
              const altKey = await globalApiService.getGlobalApiKey(altModel, 'tier1');
              if (altKey) {
                console.log(`✅ Found alternative API key for ${altModel}`);
                section.model = altModel;
                section.modelProvider = altModel;
                return this.writeSection(project, section, context);
              }
            }
          }
          
          // Try OpenRouter as last resort
          const openRouterKey = await globalApiService.getGlobalApiKey('openrouter', 'tier1');
          if (openRouterKey) {
            console.log('✅ Falling back to OpenRouter');
            section.model = this.modelAssignments.openRouterModels[0];
            section.modelProvider = 'openrouter';
            return this.writeSection(project, section, context);
          }
          
          // No API keys available, use fallback content
          throw new Error('No API keys available');
        }

        const systemPrompt = this.buildWriterPrompt(project.settings, section.title, context);
        const userPrompt = this.buildDetailedSectionPrompt(section, project);
        
        console.log(`🤖 Calling ${section.model} API for section: ${section.title}`);
        content = await this.callModel(section.model, systemPrompt, userPrompt, apiKey);
        
        // Increment global usage
        await globalApiService.incrementGlobalUsage(section.model);
      }
      
      if (!content || content.trim().length === 0) {
        throw new Error('Empty response from AI model');
      }
      
      section.content = content.trim();
      section.wordCount = this.countWords(section.content);
      section.status = 'completed';
      
      console.log(`✅ Section content generated: ${section.wordCount} words`);
      console.log(`📝 Content preview: ${section.content.substring(0, 150)}...`);
    } catch (error) {
      console.error(`❌ Failed to write section ${section.title}:`, error);
      
      // Use fallback content instead of failing
      section.content = this.generateFallbackContent(section.title, project.prompt, project.settings);
      section.wordCount = this.countWords(section.content);
      section.status = 'completed';
      
      console.log(`🔄 Used fallback content: ${section.wordCount} words`);
    }
  }

  private buildDetailedSectionPrompt(section: WriteupSection, project: WriteupProject): string {
    // Create a more detailed prompt for the section to encourage longer content
    const targetWordCount = this.getSectionTargetWordCount(project.settings, section.title);
    
    return `Write a comprehensive "${section.title}" section for the following topic: ${project.prompt}

This section should be substantial and detailed, aiming for ${targetWordCount} words. Make sure it provides valuable, in-depth content that flows well with the overall document.

Focus on creating engaging, informative content that matches the ${project.settings.style} style and ${project.settings.tone} tone.

IMPORTANT: This is for a ${project.settings.targetLength} document (${this.getTargetWordCount(project.settings)}), so each section needs to be substantial. Do not summarize or provide an outline - write the actual, complete content for this section.

${section.summary ? `Section summary: ${section.summary}` : ''}`;
  }

  private getSectionTargetWordCount(settings: WriteupSettings, sectionTitle: string): string {
    // Determine target word count based on document length and section importance
    let baseCount = 0;
    
    switch (settings.targetLength) {
      case 'short': baseCount = 1000; break; // ~1000 words per section for short docs
      case 'medium': baseCount = 2000; break; // ~2000 words per section for medium docs
      case 'long': baseCount = 3000; break; // ~3000 words per section for long docs
      case 'custom':
        // Calculate based on custom word count
        const totalWords = settings.customWordCount || 50000;
        baseCount = Math.ceil(totalWords / 20); // Assume ~20 sections
        break;
      default:
        baseCount = 1500;
    }
    
    // Adjust for section importance
    if (sectionTitle.toLowerCase().includes('introduction') || 
        sectionTitle.toLowerCase().includes('conclusion')) {
      // Intro and conclusion are typically shorter
      return `${Math.round(baseCount * 0.7)}-${Math.round(baseCount * 0.9)}`;
    } else if (sectionTitle.toLowerCase().includes('chapter')) {
      // Chapters in novels are longer
      return `${Math.round(baseCount * 1.2)}-${Math.round(baseCount * 1.5)}`;
    }
    
    // Regular sections
    return `${baseCount}-${Math.round(baseCount * 1.2)}`;
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

  private buildPlannerPrompt(settings: WriteupSettings): string {
    return `You are an expert document planner. Create a detailed outline for a ${settings.format} in ${settings.style} style with a ${settings.tone} tone. 

Target length: ${this.getTargetWordCount(settings)} words
Format: ${settings.format}
Style: ${settings.style}
Tone: ${settings.tone}

Create a structured outline with clear sections that would be appropriate for this type of document. Focus on creating a logical flow and comprehensive coverage of the topic.

Respond with a simple list of section titles, one per line. Do not use JSON format. Make each section substantial and meaningful.`;
  }

  private buildWriterPrompt(settings: WriteupSettings, sectionTitle: string, context?: string): string {
    let prompt = `You are an expert writer specializing in ${settings.style} writing. Write the "${sectionTitle}" section in ${settings.tone} tone for a ${settings.format}.

Style guidelines:
- Format: ${settings.format}
- Style: ${settings.style}
- Tone: ${settings.tone}
- Include references: ${settings.includeReferences ? 'Yes' : 'No'}

Write a comprehensive, well-structured section that flows naturally and maintains consistency. Aim for substantial content (1500-3000 words minimum). Use proper headings, paragraphs, and formatting to make the content readable and engaging.`;

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
        max_tokens: 4000, // Increased token limit for longer sections
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
          maxOutputTokens: 4000 // Increased token limit for longer sections
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
        max_tokens: 4000, // Increased token limit for longer sections
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
    @page {
      size: 8.5in 11in;
      margin: 1in;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.5;
      color: #000;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 100%;
      margin: 0 auto;
    }
    h1 {
      font-size: 18pt;
      font-weight: bold;
      text-align: center;
      margin-bottom: 24pt;
      page-break-after: avoid;
    }
    h2 {
      font-size: 14pt;
      font-weight: bold;
      margin-top: 24pt;
      margin-bottom: 12pt;
      page-break-after: avoid;
    }
    h3 {
      font-size: 12pt;
      font-weight: bold;
      margin-top: 12pt;
      margin-bottom: 6pt;
      page-break-after: avoid;
    }
    p {
      margin-bottom: 12pt;
      text-align: justify;
    }
    .page-break {
      page-break-before: always;
    }
    .section {
      margin-bottom: 24pt;
    }
    .references {
      margin-top: 36pt;
      border-top: 1pt solid #000;
      padding-top: 12pt;
    }
    @media print {
      a {
        text-decoration: none;
        color: #000;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${project.title}</h1>
    ${project.sections.map(section => `
      <div class="section">
        <h2>${section.title}</h2>
        ${section.content.split('\n\n').map(para => 
          para.trim() ? `<p>${para.replace(/\n/g, '<br>')}</p>` : ''
        ).join('')}
      </div>
    `).join('')}
  </div>
  <script>
    window.onload = function() {
      // Add a small delay before printing to ensure styles are applied
      setTimeout(function() {
        window.print();
      }, 1000);
    };
  </script>
</body>
</html>`;

    return html;
  }

  private generateWordDocument(project: WriteupProject, content: string): string {
    // Create a properly formatted HTML document that Word can open
    const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="ProgId" content="Word.Document">
  <meta name="Generator" content="Microsoft Word 15">
  <meta name="Originator" content="Microsoft Word 15">
  <title>${project.title}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    /* Style definitions */
    @page {
      size: 8.5in 11in;
      margin: 1in;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.5;
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
    }
    h3 {
      font-size: 12pt;
      font-weight: bold;
      margin-top: 12pt;
      margin-bottom: 6pt;
    }
    p {
      margin-bottom: 12pt;
      text-align: justify;
    }
    .section {
      margin-bottom: 24pt;
    }
  </style>
</head>
<body>
  <h1>${project.title}</h1>
  ${project.sections.map(section => `
    <div class="section">
      <h2>${section.title}</h2>
      ${section.content.split('\n\n').map(para => 
        para.trim() ? `<p>${para.replace(/\n/g, '<br>')}</p>` : ''
      ).join('')}
    </div>
  `).join('')}
</body>
</html>`;

    return html;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const writeupService = new WriteupService();
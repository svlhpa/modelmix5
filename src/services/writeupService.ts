import { globalApiService } from './globalApiService';
import { openRouterService } from './openRouterService';
import { aiService } from './aiService';
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
  plannerModel?: string; // Track which model is used for planning
  reviewerModel?: string; // Track which model is used for reviewing
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
    
    // Generate outline and sections using premium planner model
    const outline = await this.generateOutlineWithPlanner(params.prompt, params.settings);
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
      settings: params.settings,
      plannerModel: 'Claude 3.5 Sonnet', // Premium planner
      reviewerModel: 'GPT-4o' // Premium reviewer
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
            const content = await this.generateSectionContentWithQuality(
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

  // CRITICAL: Get premium models instead of free ones
  private async getPremiumModels(): Promise<Array<{name: string, provider: string, id: string, tier: 'premium' | 'standard'}>> {
    const models: Array<{name: string, provider: string, id: string, tier: 'premium' | 'standard'}> = [];

    try {
      // Load AI service settings
      await aiService.loadSettings();
      await aiService.loadModelSettings();

      // CRITICAL: Prioritize premium traditional models
      const premiumTraditionalModels = [
        { name: 'OpenAI GPT-4o', provider: 'openai', id: 'gpt-4o', tier: 'premium' as const },
        { name: 'Google Gemini 2.0 Flash', provider: 'gemini', id: 'gemini-2.0-flash-001', tier: 'premium' as const },
        { name: 'DeepSeek Chat', provider: 'deepseek', id: 'deepseek-chat', tier: 'premium' as const }
      ];

      // Check which traditional models are available
      for (const model of premiumTraditionalModels) {
        try {
          const globalKey = await globalApiService.getGlobalApiKey(model.provider, 'tier2');
          if (globalKey) {
            models.push(model);
          }
        } catch (error) {
          console.log(`${model.provider} not available:`, error);
        }
      }

      // CRITICAL: Get premium OpenRouter models (avoid free models)
      try {
        const openRouterKey = await globalApiService.getGlobalApiKey('openrouter', 'tier2');
        if (openRouterKey) {
          const openRouterModels = await openRouterService.getAvailableModels();
          
          // CRITICAL: Select only premium, high-quality models for writing
          const premiumOpenRouterModels = openRouterModels
            .filter(model => {
              const modelName = model.name.toLowerCase();
              const modelId = model.id.toLowerCase();
              
              // CRITICAL: Prioritize premium models, avoid free models
              const isPremium = !openRouterService.isFreeModel(model);
              
              // Select top-tier models for writing
              const isHighQuality = (
                // Claude models (premium)
                (modelId.includes('claude') && (
                  modelId.includes('3.5-sonnet') || 
                  modelId.includes('3-opus') || 
                  modelId.includes('3-sonnet')
                )) ||
                // GPT models (premium)
                (modelId.includes('gpt-4') && !modelId.includes('mini')) ||
                // Gemini models (premium) - use correct model IDs
                (modelId.includes('gemini') && (
                  modelId.includes('2.0-flash') ||
                  modelId.includes('1.5-pro')
                )) ||
                // Other premium models
                modelId.includes('wizardlm-2') ||
                modelId.includes('mixtral-8x22b') ||
                modelId.includes('llama-3.1-405b') ||
                modelId.includes('qwen2.5-72b') ||
                modelId.includes('deepseek-r1')
              );
              
              // Good context length for long-form writing
              const hasGoodContext = model.context_length >= 32000;
              
              return isPremium && isHighQuality && hasGoodContext;
            })
            .sort((a, b) => {
              // Sort by quality/preference
              const getModelPriority = (model: any) => {
                const id = model.id.toLowerCase();
                if (id.includes('claude-3.5-sonnet')) return 10;
                if (id.includes('gpt-4o')) return 9;
                if (id.includes('claude-3-opus')) return 8;
                if (id.includes('gemini-2.0-flash')) return 7;
                if (id.includes('gemini-1.5-pro')) return 6;
                if (id.includes('wizardlm-2')) return 5;
                if (id.includes('mixtral-8x22b')) return 4;
                if (id.includes('llama-3.1-405b')) return 3;
                if (id.includes('qwen2.5-72b')) return 2;
                if (id.includes('deepseek-r1')) return 1;
                return 0;
              };
              return getModelPriority(b) - getModelPriority(a);
            })
            .slice(0, 15) // Limit to top 15 premium models
            .map(model => ({
              name: model.name,
              provider: 'openrouter',
              id: model.id,
              tier: 'premium' as const
            }));

          models.push(...premiumOpenRouterModels);
        }
      } catch (error) {
        console.log('OpenRouter not available:', error);
      }

      console.log(`Found ${models.length} premium models for writing:`, models.map(m => m.name));
      return models;
      
    } catch (error) {
      console.error('Error getting premium models:', error);
      return models;
    }
  }

  // Select the best model for each section based on content type and model capabilities
  private selectBestModelForSection(
    availableModels: Array<{name: string, provider: string, id: string, tier: string}>, 
    section: WriteupSection, 
    sectionIndex: number
  ): {name: string, provider: string, id: string, tier: string} {
    if (availableModels.length === 0) {
      throw new Error('No models available for section generation');
    }

    // Prioritize models based on section type
    const sectionTitle = section.title.toLowerCase();
    
    // For academic/research sections, prefer Claude or GPT-4
    if (sectionTitle.includes('literature') || sectionTitle.includes('methodology') || sectionTitle.includes('analysis')) {
      const academicModels = availableModels.filter(m => 
        m.name.includes('Claude') || m.name.includes('GPT-4') || m.name.includes('Gemini')
      );
      if (academicModels.length > 0) {
        return academicModels[sectionIndex % academicModels.length];
      }
    }
    
    // For creative sections, prefer models known for creativity
    if (sectionTitle.includes('introduction') || sectionTitle.includes('conclusion') || sectionTitle.includes('discussion')) {
      const creativeModels = availableModels.filter(m => 
        m.name.includes('Claude') || m.name.includes('WizardLM') || m.name.includes('Mixtral')
      );
      if (creativeModels.length > 0) {
        return creativeModels[sectionIndex % creativeModels.length];
      }
    }
    
    // Default: rotate through all available premium models
    return availableModels[sectionIndex % availableModels.length];
  }

  // Enhanced outline generation with premium planner model
  private async generateOutlineWithPlanner(prompt: string, settings: WriteupSettings): Promise<any> {
    const targetWordCount = this.getTargetWordCount(settings);
    const sectionsCount = Math.max(8, Math.min(25, Math.round(targetWordCount / 4000))); // 4000 words per section average

    try {
      // Use premium model for planning
      const plannerPrompt = `You are an expert academic writer and content strategist. Create a comprehensive outline for a ${settings.format} about: "${prompt}"

Requirements:
- Target length: ${targetWordCount} words (${Math.round(targetWordCount / 250)} pages)
- Writing style: ${settings.style}
- Tone: ${settings.tone}
- Format: ${settings.format}
- Number of sections: ${sectionsCount}

Create a detailed outline with:
1. A compelling title
2. ${sectionsCount} main sections with descriptive titles
3. Each section should target approximately ${Math.round(targetWordCount / sectionsCount)} words
4. Ensure logical flow and comprehensive coverage of the topic
5. Include specific subtopics and key points for each section

Format your response as a JSON object with this structure:
{
  "title": "Compelling title here",
  "sections": [
    {
      "id": "section-1",
      "title": "Section title",
      "targetWords": ${Math.round(targetWordCount / sectionsCount)},
      "order": 1,
      "keyPoints": ["point 1", "point 2", "point 3"],
      "description": "Brief description of what this section covers"
    }
  ]
}

Provide a comprehensive, well-structured outline that ensures complete coverage of the topic.`;

      // Try to get outline from premium planner model
      const outlineResponse = await this.callPremiumModel(plannerPrompt, 'planner');
      
      try {
        const outline = JSON.parse(outlineResponse);
        if (outline.sections && Array.isArray(outline.sections)) {
          return outline;
        }
      } catch (parseError) {
        console.warn('Failed to parse outline JSON, using fallback');
      }
    } catch (error) {
      console.warn('Failed to generate outline with planner, using fallback:', error);
    }

    // Fallback to manual outline generation
    return this.generateFallbackOutline(prompt, settings, sectionsCount, targetWordCount);
  }

  private generateFallbackOutline(prompt: string, settings: WriteupSettings, sectionsCount: number, targetWordCount: number): any {
    const outline = {
      title: this.generateTitle(prompt),
      sections: []
    };

    // Generate section titles based on format
    const sectionTitles = this.generateSectionTitles(prompt, settings, sectionsCount);
    
    for (let i = 0; i < sectionTitles.length; i++) {
      outline.sections.push({
        id: `section-${i + 1}`,
        title: sectionTitles[i],
        targetWords: Math.round(targetWordCount / sectionsCount),
        order: i + 1,
        keyPoints: [`Key point 1 for ${sectionTitles[i]}`, `Key point 2 for ${sectionTitles[i]}`],
        description: `This section covers ${sectionTitles[i].toLowerCase()}`
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
      reviewNotes: '',
      retryCount: 0,
      targetWords: section.targetWords || Math.round(this.getTargetWordCount(settings) / outline.sections.length)
    }));
  }

  // Enhanced section content generation with quality assurance
  private async generateSectionContentWithQuality(
    project: WriteupProject,
    section: WriteupSection,
    model: {name: string, provider: string, id: string},
    isRetry: boolean = false
  ): Promise<string> {
    const targetWords = section.targetWords || Math.round(this.getTargetWordCount(project.settings) / project.totalSections);
    
    // Enhanced prompt for premium models
    const prompt = `You are an expert ${project.settings.style} writer creating a comprehensive ${project.settings.format} about "${project.prompt}".

Write a detailed section titled "${section.title}" with the following requirements:

CRITICAL REQUIREMENTS:
- Target length: ${targetWords} words (this is important - write substantial content)
- Writing style: ${project.settings.style}
- Tone: ${project.settings.tone}
- Format: ${project.settings.format}
- This is section ${project.sections.indexOf(section) + 1} of ${project.totalSections}

CONTEXT:
- Overall document topic: ${project.prompt}
- Document format: ${project.settings.format}
- Previous sections completed: ${project.sections.slice(0, project.sections.indexOf(section)).map(s => s.title).join(', ')}

CONTENT GUIDELINES:
1. Write comprehensive, well-researched content that thoroughly covers the topic
2. Include specific examples, analysis, and insights relevant to the subject
3. Maintain consistency with the overall document theme and previous sections
4. Use proper academic/professional language appropriate for the format
5. Include relevant details, explanations, and supporting information
6. Ensure the content flows naturally and logically
7. Write at least ${targetWords} words of substantial, meaningful content

${isRetry ? 'RETRY INSTRUCTIONS: The previous attempt failed. Please ensure you write comprehensive, detailed content that meets the word count requirement.' : ''}

${project.settings.includeReferences ? 'Include relevant citations and references where appropriate.' : ''}

Write the complete section content now. Make it comprehensive and detailed:`;

    try {
      let content: string;
      
      if (model.provider === 'openrouter') {
        // Use OpenRouter service with premium model
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
      
      // Quality check
      if (!content || content.trim().length < 200) {
        throw new Error('Generated content is too short or empty');
      }
      
      return content;
      
    } catch (error) {
      console.error(`Error generating content for section ${section.title}:`, error);
      throw new Error(`Failed to generate content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Review and improve project quality
  private async reviewAndImproveProject(project: WriteupProject, onProgress: (project: WriteupProject) => void): Promise<void> {
    console.log('🔍 Starting project review phase...');
    
    try {
      // Review each section for quality and completeness
      for (let i = 0; i < project.sections.length; i++) {
        const section = project.sections[i];
        
        if (section.status === 'completed' && section.content.length > 0) {
          project.progress = 90 + Math.round((i / project.sections.length) * 8); // 90-98%
          this.updateProject(project, onProgress);
          
          // Quick quality check
          const wordCount = this.countWords(section.content);
          const targetWords = section.targetWords || 1000;
          
          if (wordCount < targetWords * 0.7) { // Less than 70% of target
            console.log(`⚠️ Section "${section.title}" is shorter than expected (${wordCount}/${targetWords} words)`);
            section.reviewNotes = `Section is shorter than target (${wordCount}/${targetWords} words)`;
          } else {
            section.reviewNotes = `Quality check passed (${wordCount} words)`;
          }
        }
      }
      
      project.progress = 98;
      this.updateProject(project, onProgress);
      
      console.log('✅ Project review completed');
      
    } catch (error) {
      console.error('Review phase error:', error);
      // Don't fail the entire project for review errors
    }
  }

  // Call premium model for planning/reviewing
  private async callPremiumModel(prompt: string, purpose: 'planner' | 'reviewer'): Promise<string> {
    try {
      // Try Claude 3.5 Sonnet first (best for planning)
      const openRouterKey = await globalApiService.getGlobalApiKey('openrouter', 'tier2');
      if (openRouterKey) {
        const claudeModel = 'anthropic/claude-3.5-sonnet';
        const response = await openRouterService.callModel(
          claudeModel,
          [{ role: 'user', content: prompt }],
          openRouterKey
        );
        await globalApiService.incrementGlobalUsage('openrouter');
        return response;
      }
      
      // Fallback to GPT-4o
      const openaiKey = await globalApiService.getGlobalApiKey('openai', 'tier2');
      if (openaiKey) {
        return await this.callOpenAI([{ role: 'user', content: prompt }]);
      }
      
      throw new Error('No premium models available for planning/reviewing');
      
    } catch (error) {
      console.error(`Error calling premium model for ${purpose}:`, error);
      throw error;
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
        max_tokens: 4000, // Increased for longer content
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

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4000 // Increased for longer content
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
        max_tokens: 4000, // Increased for longer content
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
        section.retryCount = 0;
        break;
    }

    project.updatedAt = new Date();
    this.projects.set(projectId, project);
  }

  // UPDATED: Use the new export service
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
}

export const writeupService = new WriteupService();
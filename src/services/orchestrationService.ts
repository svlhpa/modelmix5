import { supabase } from '../lib/supabase';
import { globalApiService } from './globalApiService';

interface Project {
  id: string;
  title: string;
  original_prompt: string;
  status: 'draft' | 'planning' | 'writing' | 'reviewing' | 'completed' | 'paused' | 'error';
  created_at: string;
  updated_at: string;
  user_id: string;
}

interface ProjectMetadata {
  id: string;
  project_id: string;
  audience: string | null;
  tone: string | null;
  purpose: string | null;
  doc_type: string | null;
  word_count: number;
}

interface Section {
  id: string;
  project_id: string;
  title: string;
  assigned_model: string;
  token_budget: number;
  status: 'pending' | 'writing' | 'completed' | 'reviewing' | 'error';
  order: number;
  created_at: string;
  updated_at: string;
}

interface SectionOutput {
  id: string;
  section_id: string;
  raw_output: string;
  ai_notes: string | null;
  is_finalized: boolean;
  created_at: string;
  updated_at: string;
}

interface ProjectWithDetails {
  id: string;
  title: string;
  original_prompt: string;
  status: 'draft' | 'planning' | 'writing' | 'reviewing' | 'completed' | 'paused' | 'error';
  created_at: string;
  updated_at: string;
  user_id: string;
  metadata: ProjectMetadata | null;
  sections: (Section & { output?: SectionOutput | null })[];
  progress: number;
  currentSection: number;
  totalSections: number;
  wordCount: number;
}

class OrchestrationService {
  async getUserProjects(userId: string): Promise<ProjectWithDetails[]> {
    try {
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (projectsError) throw projectsError;

      const projectsWithDetails: ProjectWithDetails[] = [];

      for (const project of projectsData) {
        // Get metadata
        const { data: metadataData } = await supabase
          .from('project_metadata')
          .select('*')
          .eq('project_id', project.id)
          .single();

        // Get sections
        const { data: sectionsData } = await supabase
          .from('sections')
          .select('*')
          .eq('project_id', project.id)
          .order('order', { ascending: true });

        // Get section outputs
        const sectionsWithOutputs = await Promise.all((sectionsData || []).map(async (section) => {
          const { data: outputData } = await supabase
            .from('section_outputs')
            .select('*')
            .eq('section_id', section.id)
            .single();

          return {
            ...section,
            output: outputData || null
          };
        }));

        // Calculate progress
        const totalSections = sectionsWithOutputs.length;
        const completedSections = sectionsWithOutputs.filter(s => s.status === 'completed').length;
        const progress = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;
        
        // Calculate current section
        const currentSection = sectionsWithOutputs.findIndex(s => s.status === 'writing' || s.status === 'pending');
        
        // Calculate word count
        const wordCount = sectionsWithOutputs.reduce((total, section) => {
          if (section.output?.raw_output) {
            return total + this.countWords(section.output.raw_output);
          }
          return total;
        }, 0);

        projectsWithDetails.push({
          ...project,
          metadata: metadataData || null,
          sections: sectionsWithOutputs,
          progress,
          currentSection: currentSection >= 0 ? currentSection : totalSections,
          totalSections,
          wordCount
        });
      }

      return projectsWithDetails;
    } catch (error) {
      console.error('Failed to load projects:', error);
      throw error;
    }
  }

  async getProjectDetails(projectId: string): Promise<ProjectWithDetails> {
    try {
      // Get project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;

      // Get metadata
      const { data: metadataData } = await supabase
        .from('project_metadata')
        .select('*')
        .eq('project_id', projectId)
        .single();

      // Get sections
      const { data: sectionsData } = await supabase
        .from('sections')
        .select('*')
        .eq('project_id', projectId)
        .order('order', { ascending: true });

      // Get section outputs
      const sectionsWithOutputs = await Promise.all((sectionsData || []).map(async (section) => {
        const { data: outputData } = await supabase
          .from('section_outputs')
          .select('*')
          .eq('section_id', section.id)
          .single();

        return {
          ...section,
          output: outputData || null
        };
      }));

      // Calculate progress
      const totalSections = sectionsWithOutputs.length;
      const completedSections = sectionsWithOutputs.filter(s => s.status === 'completed').length;
      const progress = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;
      
      // Calculate current section
      const currentSection = sectionsWithOutputs.findIndex(s => s.status === 'writing' || s.status === 'pending');
      
      // Calculate word count
      const wordCount = sectionsWithOutputs.reduce((total, section) => {
        if (section.output?.raw_output) {
          return total + this.countWords(section.output.raw_output);
        }
        return total;
      }, 0);

      return {
        ...projectData,
        metadata: metadataData || null,
        sections: sectionsWithOutputs,
        progress,
        currentSection: currentSection >= 0 ? currentSection : totalSections,
        totalSections,
        wordCount
      };
    } catch (error) {
      console.error('Failed to load project details:', error);
      throw error;
    }
  }

  async createProject(
    userId: string,
    prompt: string,
    settings: {
      audience: string;
      tone: string;
      purpose: string;
      docType: string;
      wordCount: number;
    }
  ): Promise<string> {
    try {
      // Create project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert({
          title: this.generateTitle(prompt),
          user_id: userId,
          original_prompt: prompt.trim(),
          status: 'planning'
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Create project metadata
      const { error: metadataError } = await supabase
        .from('project_metadata')
        .insert({
          project_id: projectData.id,
          audience: settings.audience || null,
          tone: settings.tone,
          purpose: settings.purpose || null,
          doc_type: settings.docType,
          word_count: settings.wordCount
        });

      if (metadataError) throw metadataError;

      return projectData.id;
    } catch (error) {
      console.error('Failed to create project:', error);
      throw error;
    }
  }

  async generateOutline(
    prompt: string,
    settings: {
      audience: string;
      tone: string;
      purpose: string;
      docType: string;
      wordCount: number;
    }
  ): Promise<any> {
    try {
      // Get OpenAI API key from global keys
      const { data: openaiKey, error: keyError } = await supabase.rpc(
        'get_global_api_key',
        { provider_name: 'openai', user_tier: 'tier2' }
      );

      if (keyError || !openaiKey) {
        throw new Error('Failed to get OpenAI API key');
      }

      const targetWordCount = settings.wordCount;
      const sectionsCount = Math.max(5, Math.min(15, Math.round(targetWordCount / 1000))); // ~1000 words per section

      const plannerPrompt = `You are an expert academic writer and content strategist. Create a comprehensive outline for a ${settings.docType} about: "${prompt}"

Requirements:
- Target length: ${targetWordCount} words (${Math.round(targetWordCount / 250)} pages)
- Writing style: ${settings.tone}
- Audience: ${settings.audience || 'General audience'}
- Purpose: ${settings.purpose || 'Informational'}
- Number of sections: ${sectionsCount}

Create a detailed outline with:
1. A compelling title
2. ${sectionsCount} main sections with descriptive titles
3. Each section should target approximately ${Math.round(targetWordCount / sectionsCount)} words
4. Ensure logical flow and comprehensive coverage of the topic
5. For each section, suggest an appropriate AI model from this list:
   - anthropic/claude-3.5-sonnet (best for creative writing)
   - anthropic/claude-3-opus (best for detailed analysis)
   - openai/gpt-4o (best for technical content)
   - google/gemini-1.5-pro (best for research)
   - meta-llama/llama-3.1-70b-instruct (good general purpose)
   - mistralai/mistral-large (good for structured content)

Format your response as a JSON object with this structure:
{
  "title": "Compelling title here",
  "sections": [
    {
      "id": "section-1",
      "title": "Section title",
      "token_budget": ${Math.round((targetWordCount / sectionsCount) * 4)},
      "order": 1,
      "assigned_model": "anthropic/claude-3.5-sonnet",
      "key_points": ["point 1", "point 2", "point 3"],
      "description": "Brief description of what this section covers"
    }
  ]
}

Provide a comprehensive, well-structured outline that ensures complete coverage of the topic.`;

      // Call OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: plannerPrompt }],
          max_tokens: 2000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const outlineText = data.choices[0]?.message?.content || '';
      
      // Increment global usage
      await supabase.rpc('increment_global_usage', { provider_name: 'openai' });
      
      // Extract JSON from the response
      const jsonMatch = outlineText.match(/```json\n([\s\S]*?)\n```/) || 
                        outlineText.match(/```\n([\s\S]*?)\n```/) || 
                        outlineText.match(/{[\s\S]*}/);
      
      const jsonString = jsonMatch ? jsonMatch[1] || jsonMatch[0] : outlineText;
      
      try {
        const outline = JSON.parse(jsonString);
        if (outline.sections && Array.isArray(outline.sections)) {
          return outline;
        }
      } catch (parseError) {
        console.error('Failed to parse outline JSON:', parseError);
      }
      
      // Fallback to manual outline generation
      return this.generateFallbackOutline(prompt, settings, sectionsCount, targetWordCount);
    } catch (error) {
      console.error('Failed to generate outline:', error);
      return this.generateFallbackOutline(prompt, settings, sectionsCount, settings.wordCount);
    }
  }

  async generateSectionContent(
    projectId: string,
    sectionId: string,
    previousSectionId: string | null
  ): Promise<string> {
    try {
      // Get project details
      const project = await this.getProjectDetails(projectId);
      
      // Get section
      const section = project.sections.find(s => s.id === sectionId);
      if (!section) {
        throw new Error('Section not found');
      }
      
      // Get previous section content if available
      let previousContent = '';
      if (previousSectionId) {
        const previousSection = project.sections.find(s => s.id === previousSectionId);
        if (previousSection && previousSection.output) {
          previousContent = `
Previous section "${previousSection.title}":
${previousSection.output.raw_output.substring(0, 1000)}...
`;
        }
      }
      
      // Get OpenRouter API key from global keys
      const { data: openRouterKey, error: keyError } = await supabase.rpc(
        'get_global_api_key',
        { provider_name: 'openrouter', user_tier: 'tier2' }
      );

      if (keyError || !openRouterKey) {
        throw new Error('Failed to get OpenRouter API key');
      }

      // Build prompt for section generation
      const prompt = `You are an expert writer creating a comprehensive ${project.metadata?.doc_type || 'document'} about "${project.original_prompt}".

Write a detailed section titled "${section.title}" with the following requirements:

CRITICAL REQUIREMENTS:
- Target length: ${Math.round(section.token_budget / 4)} words (this is important - write substantial content)
- Writing style: ${project.metadata?.tone || 'formal'}
- Audience: ${project.metadata?.audience || 'General audience'}
- Purpose: ${project.metadata?.purpose || 'Informational'}
- This is section ${project.sections.indexOf(section) + 1} of ${project.totalSections}

CONTEXT:
- Overall document topic: ${project.original_prompt}
- Document format: ${project.metadata?.doc_type || 'document'}
${previousContent}

CONTENT GUIDELINES:
1. Write comprehensive, well-researched content that thoroughly covers the topic
2. Include specific examples, analysis, and insights relevant to the subject
3. Maintain consistency with the overall document theme and previous sections
4. Use proper language appropriate for the format and audience
5. Include relevant details, explanations, and supporting information
6. Ensure the content flows naturally and logically
7. Write at least ${Math.round(section.token_budget / 4)} words of substantial, meaningful content

Write the complete section content now. Make it comprehensive and detailed:`;

      // Call OpenRouter API with the assigned model
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openRouterKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'ModelMix - Document Generator'
        },
        body: JSON.stringify({
          model: section.assigned_model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: Math.min(section.token_budget, 4000), // Limit to model's max tokens or section budget
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Increment global usage
      await supabase.rpc('increment_global_usage', { provider_name: 'openrouter' });
      
      return data.choices[0]?.message?.content || 'No content generated';
    } catch (error) {
      console.error('Failed to generate section content:', error);
      throw error;
    }
  }

  async updateSectionModel(sectionId: string, modelId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('sections')
        .update({ 
          assigned_model: modelId,
          updated_at: new Date().toISOString()
        })
        .eq('id', sectionId);
      
      if (error) throw error;
    } catch (error) {
      console.error('Failed to update section model:', error);
      throw error;
    }
  }

  async pauseResumeProject(projectId: string, action: 'pause' | 'resume'): Promise<void> {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ 
          status: action === 'pause' ? 'paused' : 'writing',
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);
      
      if (error) throw error;
    } catch (error) {
      console.error(`Failed to ${action} project:`, error);
      throw error;
    }
  }

  async regenerateSection(sectionId: string): Promise<void> {
    try {
      // Reset section status
      const { error: sectionError } = await supabase
        .from('sections')
        .update({ 
          status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('id', sectionId);
      
      if (sectionError) throw sectionError;
      
      // Delete existing output
      const { error: outputError } = await supabase
        .from('section_outputs')
        .delete()
        .eq('section_id', sectionId);
      
      if (outputError) throw outputError;
    } catch (error) {
      console.error('Failed to regenerate section:', error);
      throw error;
    }
  }

  async recordExport(projectId: string, format: 'pdf' | 'docx' | 'txt'): Promise<void> {
    try {
      const { error } = await supabase
        .from('final_exports')
        .insert({
          project_id: projectId,
          format
        });
      
      if (error) throw error;
    } catch (error) {
      console.error('Failed to record export:', error);
      throw error;
    }
  }

  private generateTitle(prompt: string): string {
    // Extract a title from the prompt
    const words = prompt.split(' ').slice(0, 8);
    return words.join(' ').replace(/[^\w\s]/g, '').trim();
  }

  private generateFallbackOutline(prompt: string, settings: any, sectionsCount: number, targetWordCount: number): any {
    const title = this.generateTitle(prompt);
    const sections = [];
    
    // Generate section titles based on document type
    const sectionTitles = this.generateSectionTitles(settings.docType, sectionsCount);
    
    // Assign models in a round-robin fashion
    const defaultModels = [
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4o',
      'google/gemini-1.5-pro',
      'meta-llama/llama-3.1-70b-instruct',
      'mistralai/mistral-large'
    ];
    
    for (let i = 0; i < sectionTitles.length; i++) {
      sections.push({
        id: `section-${i + 1}`,
        title: sectionTitles[i],
        token_budget: Math.round((targetWordCount / sectionsCount) * 4), // ~4 tokens per word
        order: i,
        assigned_model: defaultModels[i % defaultModels.length],
        key_points: [`Key point 1 for ${sectionTitles[i]}`, `Key point 2 for ${sectionTitles[i]}`],
        description: `This section covers ${sectionTitles[i].toLowerCase()}`
      });
    }

    return {
      title,
      sections
    };
  }

  private generateSectionTitles(docType: string, count: number): string[] {
    switch (docType) {
      case 'research-paper':
        return [
          'Abstract',
          'Introduction',
          'Literature Review',
          'Methodology',
          'Results',
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
      
      case 'book':
        return Array.from({length: count}, (_, i) => `Chapter ${i + 1}`);
      
      default:
        return Array.from({length: count}, (_, i) => `Section ${i + 1}`);
    }
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }
}

export const orchestrationService = new OrchestrationService();
export type { 
  Project, 
  ProjectMetadata, 
  Section, 
  SectionOutput, 
  ProjectWithDetails 
};
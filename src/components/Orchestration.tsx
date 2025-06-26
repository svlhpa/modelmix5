import React, { useState, useEffect, useRef } from 'react';
import { X, Zap, CheckCircle, AlertCircle, Clock, Play, Pause, Download, Eye, Edit, RotateCcw, Target, Users, DollarSign, Sparkles, BookOpen, FileCheck, Layers, Globe, ChevronDown, ChevronUp, Save, FileText, Brain } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface OrchestrationProps {
  isOpen: boolean;
  onClose: () => void;
}

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

interface OpenRouterModel {
  id: string;
  name: string;
}

export const Orchestration: React.FC<OrchestrationProps> = ({ isOpen, onClose }) => {
  const { user, getCurrentTier } = useAuth();
  const [step, setStep] = useState<'setup' | 'planning' | 'writing' | 'review' | 'completed'>('setup');
  const [currentProject, setCurrentProject] = useState<ProjectWithDetails | null>(null);
  const [projects, setProjects] = useState<ProjectWithDetails[]>([]);
  const [prompt, setPrompt] = useState('');
  const [settings, setSettings] = useState({
    audience: '',
    tone: 'formal',
    purpose: '',
    docType: 'research-paper',
    wordCount: 5000
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showFullDocument, setShowFullDocument] = useState(false);
  const [availableModels, setAvailableModels] = useState<OpenRouterModel[]>([]);
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentTier = getCurrentTier();
  const isProUser = currentTier === 'tier2';

  useEffect(() => {
    if (isOpen) {
      if (isProUser) {
        loadProjects();
        loadAvailableModels();
      }
    }
  }, [isOpen, isProUser]);

  useEffect(() => {
    scrollToBottom();
  }, [currentProject?.sections]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadProjects = async () => {
    if (!user) return;
    
    try {
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
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
            return total + countWords(section.output.raw_output);
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

      setProjects(projectsWithDetails);
    } catch (error) {
      console.error('Failed to load projects:', error);
      setError('Failed to load projects. Please try again.');
    }
  };

  const loadAvailableModels = async () => {
    try {
      // Get OpenRouter API key from global keys
      const { data: openRouterKey, error: keyError } = await supabase.rpc(
        'get_global_api_key',
        { provider_name: 'openrouter', user_tier: 'tier2' }
      );

      if (keyError || !openRouterKey) {
        console.error('Failed to get OpenRouter API key:', keyError);
        return;
      }

      // Fetch models from OpenRouter
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openRouterKey}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const data = await response.json();
      
      // Filter models suitable for document generation (with good context length)
      const filteredModels = data.data
        .filter((model: any) => {
          // Filter out models that are likely not suitable for document generation
          const isChat = !model.id.includes('embedding') && 
                        !model.id.includes('whisper') && 
                        !model.id.includes('tts') &&
                        !model.id.includes('dall-e') &&
                        !model.id.includes('stable-diffusion');
          
          // Only include models with reasonable context length
          const hasGoodContext = model.context_length >= 8000;
          
          return isChat && hasGoodContext;
        })
        .sort((a: any, b: any) => {
          // Sort by quality/preference
          const getModelPriority = (model: any) => {
            const id = model.id.toLowerCase();
            if (id.includes('claude-3.5-sonnet')) return 10;
            if (id.includes('gpt-4o')) return 9;
            if (id.includes('claude-3-opus')) return 8;
            if (id.includes('gemini-1.5-pro')) return 7;
            if (id.includes('wizardlm-2')) return 6;
            if (id.includes('mixtral-8x22b')) return 5;
            if (id.includes('llama-3.1-405b')) return 4;
            if (id.includes('qwen2.5-72b')) return 3;
            if (id.includes('deepseek-r1')) return 2;
            return 1;
          };
          return getModelPriority(b) - getModelPriority(a);
        });

      setAvailableModels(filteredModels.map((model: any) => ({
        id: model.id,
        name: model.name
      })));
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  };

  const handleStartProject = async () => {
    if (!user) {
      setError('Please sign in to use the Document Generator');
      return;
    }

    if (!isProUser) {
      setError('This feature is only available for Pro users');
      return;
    }

    if (!prompt.trim()) {
      setError('Please enter a prompt for your document');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setStep('planning');

    try {
      // Create project in Supabase
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .insert({
          title: generateTitle(prompt),
          user_id: user.id,
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

      // Generate document outline using GPT-4o
      const outline = await generateOutline(prompt, settings);

      // Create sections in Supabase
      const sectionsToInsert = outline.sections.map((section: any, index: number) => ({
        project_id: projectData.id,
        title: section.title,
        assigned_model: section.assigned_model || getDefaultModel(),
        token_budget: section.token_budget || Math.round((settings.wordCount / outline.sections.length) * 4), // ~4 tokens per word
        status: 'pending',
        order: index
      }));

      const { data: sectionsData, error: sectionsError } = await supabase
        .from('sections')
        .insert(sectionsToInsert)
        .select();

      if (sectionsError) throw sectionsError;

      // Update project status
      const { error: updateError } = await supabase
        .from('projects')
        .update({ 
          status: 'writing',
          title: outline.title || generateTitle(prompt),
          updated_at: new Date().toISOString()
        })
        .eq('id', projectData.id);

      if (updateError) throw updateError;

      // Load the full project with details
      await loadProjectDetails(projectData.id);
      setStep('writing');
      
    } catch (error) {
      console.error('Failed to start project:', error);
      setError(error instanceof Error ? error.message : 'Failed to start project');
      setStep('setup');
    } finally {
      setIsGenerating(false);
    }
  };

  const loadProjectDetails = async (projectId: string) => {
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
          return total + countWords(section.output.raw_output);
        }
        return total;
      }, 0);

      const projectWithDetails: ProjectWithDetails = {
        ...projectData,
        metadata: metadataData || null,
        sections: sectionsWithOutputs,
        progress,
        currentSection: currentSection >= 0 ? currentSection : totalSections,
        totalSections,
        wordCount
      };

      setCurrentProject(projectWithDetails);
      
      // Initialize selected models
      const modelSelections: Record<string, string> = {};
      sectionsWithOutputs.forEach(section => {
        modelSelections[section.id] = section.assigned_model;
      });
      setSelectedModels(modelSelections);

      return projectWithDetails;
    } catch (error) {
      console.error('Failed to load project details:', error);
      throw error;
    }
  };

  const startWritingProcess = async (project: ProjectWithDetails) => {
    if (!project) return;

    try {
      setIsGenerating(true);
      
      // Update project status
      await supabase
        .from('projects')
        .update({ 
          status: 'writing',
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id);
      
      // Process each section sequentially
      for (let i = 0; i < project.sections.length; i++) {
        const section = project.sections[i];
        
        // Skip completed sections
        if (section.status === 'completed' && section.output) {
          continue;
        }
        
        // Update section status to writing
        await supabase
          .from('sections')
          .update({ 
            status: 'writing',
            updated_at: new Date().toISOString()
          })
          .eq('id', section.id);
        
        // Reload project to get latest status
        const updatedProject = await loadProjectDetails(project.id);
        
        // Generate content for this section
        try {
          const content = await generateSectionContent(
            updatedProject,
            section,
            i > 0 ? updatedProject.sections[i-1] : null
          );
          
          // Save section output
          const { error: outputError } = await supabase
            .from('section_outputs')
            .upsert({
              section_id: section.id,
              raw_output: content,
              ai_notes: `Generated using ${section.assigned_model}`,
              is_finalized: false,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'section_id'
            });
          
          if (outputError) throw outputError;
          
          // Update section status to completed
          await supabase
            .from('sections')
            .update({ 
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', section.id);
          
        } catch (error) {
          console.error(`Error generating content for section ${section.title}:`, error);
          
          // Update section status to error
          await supabase
            .from('sections')
            .update({ 
              status: 'error',
              updated_at: new Date().toISOString()
            })
            .eq('id', section.id);
          
          // Create error output
          await supabase
            .from('section_outputs')
            .upsert({
              section_id: section.id,
              raw_output: `Error generating content: ${error instanceof Error ? error.message : 'Unknown error'}`,
              ai_notes: 'Error occurred during generation',
              is_finalized: false,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'section_id'
            });
        }
        
        // Reload project after each section
        await loadProjectDetails(project.id);
      }
      
      // Update project status to completed
      await supabase
        .from('projects')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id);
      
      // Final reload
      await loadProjectDetails(project.id);
      setStep('completed');
      
    } catch (error) {
      console.error('Writing process failed:', error);
      setError(error instanceof Error ? error.message : 'Writing process failed');
      
      // Update project status to error
      await supabase
        .from('projects')
        .update({ 
          status: 'error',
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id);
        
    } finally {
      setIsGenerating(false);
    }
  };

  const generateOutline = async (prompt: string, settings: any): Promise<any> => {
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
      return generateFallbackOutline(prompt, settings, sectionsCount, targetWordCount);
    } catch (error) {
      console.error('Failed to generate outline:', error);
      return generateFallbackOutline(prompt, settings, sectionsCount, targetWordCount);
    }
  };

  const generateFallbackOutline = (prompt: string, settings: any, sectionsCount: number, targetWordCount: number): any => {
    const title = generateTitle(prompt);
    const sections = [];
    
    // Generate section titles based on document type
    const sectionTitles = generateSectionTitles(settings.docType, sectionsCount);
    
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
  };

  const generateSectionTitles = (docType: string, count: number): string[] => {
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
  };

  const generateSectionContent = async (
    project: ProjectWithDetails,
    section: Section & { output?: SectionOutput | null },
    previousSection: (Section & { output?: SectionOutput | null }) | null
  ): Promise<string> => {
    // Get OpenRouter API key from global keys
    const { data: openRouterKey, error: keyError } = await supabase.rpc(
      'get_global_api_key',
      { provider_name: 'openrouter', user_tier: 'tier2' }
    );

    if (keyError || !openRouterKey) {
      throw new Error('Failed to get OpenRouter API key');
    }

    // Build context from previous sections
    let previousContent = '';
    if (previousSection && previousSection.output) {
      previousContent = `
Previous section "${previousSection.title}":
${previousSection.output.raw_output.substring(0, 1000)}...
`;
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

    try {
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
      console.error(`Error generating content for section ${section.title}:`, error);
      throw error;
    }
  };

  const handlePauseResume = async () => {
    if (!currentProject) return;

    try {
      if (currentProject.status === 'writing') {
        // Pause the project
        await supabase
          .from('projects')
          .update({ 
            status: 'paused',
            updated_at: new Date().toISOString()
          })
          .eq('id', currentProject.id);
        
        await loadProjectDetails(currentProject.id);
      } else if (currentProject.status === 'paused' || currentProject.status === 'error') {
        // Resume the project
        await supabase
          .from('projects')
          .update({ 
            status: 'writing',
            updated_at: new Date().toISOString()
          })
          .eq('id', currentProject.id);
        
        const updatedProject = await loadProjectDetails(currentProject.id);
        startWritingProcess(updatedProject);
      }
    } catch (error) {
      console.error('Failed to pause/resume project:', error);
      setError(error instanceof Error ? error.message : 'Failed to pause/resume project');
    }
  };

  const handleSectionAction = async (sectionId: string, action: 'accept' | 'edit' | 'regenerate') => {
    if (!currentProject) return;

    try {
      const section = currentProject.sections.find(s => s.id === sectionId);
      if (!section) return;

      switch (action) {
        case 'accept':
          // Mark section output as finalized
          await supabase
            .from('section_outputs')
            .update({ 
              is_finalized: true,
              updated_at: new Date().toISOString()
            })
            .eq('section_id', sectionId);
          break;
          
        case 'edit':
          // In a real implementation, this would open an editor
          // For now, we'll just mark it as reviewing
          await supabase
            .from('sections')
            .update({ 
              status: 'reviewing',
              updated_at: new Date().toISOString()
            })
            .eq('id', sectionId);
          break;
          
        case 'regenerate':
          // Reset section status and delete output
          await supabase
            .from('sections')
            .update({ 
              status: 'pending',
              updated_at: new Date().toISOString()
            })
            .eq('id', sectionId);
          
          // Delete existing output
          await supabase
            .from('section_outputs')
            .delete()
            .eq('section_id', sectionId);
          
          // Reload project
          const updatedProject = await loadProjectDetails(currentProject.id);
          
          // Generate new content for this section
          setIsGenerating(true);
          
          try {
            const sectionIndex = updatedProject.sections.findIndex(s => s.id === sectionId);
            const previousSection = sectionIndex > 0 ? updatedProject.sections[sectionIndex - 1] : null;
            
            // Update section status to writing
            await supabase
              .from('sections')
              .update({ 
                status: 'writing',
                updated_at: new Date().toISOString()
              })
              .eq('id', sectionId);
            
            // Reload to get latest status
            await loadProjectDetails(currentProject.id);
            
            // Generate content
            const content = await generateSectionContent(
              updatedProject,
              section,
              previousSection
            );
            
            // Save section output
            await supabase
              .from('section_outputs')
              .insert({
                section_id: sectionId,
                raw_output: content,
                ai_notes: `Regenerated using ${section.assigned_model}`,
                is_finalized: false
              });
            
            // Update section status to completed
            await supabase
              .from('sections')
              .update({ 
                status: 'completed',
                updated_at: new Date().toISOString()
              })
              .eq('id', sectionId);
            
          } catch (error) {
            console.error(`Error regenerating content for section ${section.title}:`, error);
            
            // Update section status to error
            await supabase
              .from('sections')
              .update({ 
                status: 'error',
                updated_at: new Date().toISOString()
              })
              .eq('id', sectionId);
            
            setError(`Failed to regenerate section: ${error instanceof Error ? error.message : 'Unknown error'}`);
          } finally {
            setIsGenerating(false);
            await loadProjectDetails(currentProject.id);
          }
          break;
      }

      // Reload project to get latest status
      await loadProjectDetails(currentProject.id);
    } catch (error) {
      console.error('Failed to handle section action:', error);
      setError(error instanceof Error ? error.message : 'Failed to process section action');
    }
  };

  const handleUpdateSectionModel = async (sectionId: string, modelId: string) => {
    if (!currentProject) return;

    try {
      await supabase
        .from('sections')
        .update({ 
          assigned_model: modelId,
          updated_at: new Date().toISOString()
        })
        .eq('id', sectionId);
      
      // Update local state
      setSelectedModels(prev => ({
        ...prev,
        [sectionId]: modelId
      }));
      
      // Reload project
      await loadProjectDetails(currentProject.id);
    } catch (error) {
      console.error('Failed to update section model:', error);
      setError(error instanceof Error ? error.message : 'Failed to update section model');
    }
  };

  const handleExportPDF = async () => {
    if (!currentProject) return;

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Set up document properties
      pdf.setProperties({
        title: currentProject.title,
        subject: 'Generated by ModelMix Orchestration',
        author: 'ModelMix AI',
        creator: 'ModelMix Document Generator'
      });

      let yPosition = 20;
      const pageHeight = pdf.internal.pageSize.height;
      const pageWidth = pdf.internal.pageSize.width;
      const margin = 20;
      const maxWidth = pageWidth - (margin * 2);

      // Helper function to add new page if needed
      const checkPageBreak = (requiredHeight: number) => {
        if (yPosition + requiredHeight > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
      };

      // Helper function to add text with word wrapping
      const addText = (text: string, fontSize: number, isBold: boolean = false, isTitle: boolean = false) => {
        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', isBold ? 'bold' : 'normal');

        if (isTitle) {
          checkPageBreak(20);
          pdf.text(text, pageWidth / 2, yPosition, { align: 'center' });
          yPosition += 15;
        } else {
          const lines = pdf.splitTextToSize(text, maxWidth);
          
          for (let i = 0; i < lines.length; i++) {
            checkPageBreak(8);
            pdf.text(lines[i], margin, yPosition);
            yPosition += 7;
          }
          yPosition += 5; // Extra spacing after paragraphs
        }
      };

      // Title Page
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.text(currentProject.title, pageWidth / 2, 60, { align: 'center' });

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Generated by ModelMix Document Generator', pageWidth / 2, 80, { align: 'center' });
      pdf.text(`Created: ${new Date(currentProject.created_at).toLocaleDateString()}`, pageWidth / 2, 90, { align: 'center' });
      pdf.text(`Word Count: ${currentProject.wordCount.toLocaleString()}`, pageWidth / 2, 100, { align: 'center' });
      pdf.text(`Pages: ${Math.round(currentProject.wordCount / 250)}`, pageWidth / 2, 110, { align: 'center' });

      // Document details
      yPosition = 130;
      addText(`Format: ${currentProject.metadata?.doc_type || 'Document'}`, 10);
      addText(`Tone: ${currentProject.metadata?.tone || 'Formal'}`, 10);
      if (currentProject.metadata?.audience) {
        addText(`Audience: ${currentProject.metadata.audience}`, 10);
      }
      if (currentProject.metadata?.purpose) {
        addText(`Purpose: ${currentProject.metadata.purpose}`, 10);
      }

      // Add separator line
      yPosition += 10;
      pdf.setLineWidth(0.5);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 20;

      // Add new page for content
      pdf.addPage();
      yPosition = margin;

      // Process each section
      currentProject.sections.forEach((section, index) => {
        if (section.output?.raw_output) {
          // Section title
          addText(`${index + 1}. ${section.title}`, 16, true);
          yPosition += 5;

          // Section content - clean up markdown and format
          const cleanContent = cleanMarkdownForPDF(section.output.raw_output);
          const paragraphs = cleanContent.split('\n\n').filter(p => p.trim());

          paragraphs.forEach(paragraph => {
            if (paragraph.trim()) {
              addText(paragraph.trim(), 11);
            }
          });

          // Add section separator
          yPosition += 10;
          checkPageBreak(5);
          pdf.setLineWidth(0.2);
          pdf.line(margin, yPosition, pageWidth - margin, yPosition);
          yPosition += 15;
        }
      });

      // Save the PDF
      pdf.save(`${sanitizeFilename(currentProject.title)}.pdf`);
      
      // Record export in database
      await supabase
        .from('final_exports')
        .insert({
          project_id: currentProject.id,
          format: 'pdf'
        });
        
    } catch (error) {
      console.error('PDF export error:', error);
      setError('Failed to export PDF. Please try again.');
    }
  };

  const handleExportDocx = async () => {
    if (!currentProject) return;

    try {
      // Create paragraphs array
      const paragraphs: Paragraph[] = [];

      // Title page
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: currentProject.title,
              bold: true,
              size: 32,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        })
      );

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Generated by ModelMix Document Generator',
              size: 20,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        })
      );

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Created: ${new Date(currentProject.created_at).toLocaleDateString()}`,
              size: 16,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 100 },
        })
      );

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Word Count: ${currentProject.wordCount.toLocaleString()} | Pages: ${Math.round(currentProject.wordCount / 250)}`,
              size: 16,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        })
      );

      // Document metadata
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Format: ${currentProject.metadata?.doc_type || 'Document'} | Tone: ${currentProject.metadata?.tone || 'Formal'}${
                currentProject.metadata?.audience ? ` | Audience: ${currentProject.metadata.audience}` : ''
              }${
                currentProject.metadata?.purpose ? ` | Purpose: ${currentProject.metadata.purpose}` : ''
              }`,
              size: 14,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 600 },
        })
      );

      // Page break before content
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: '' })],
          pageBreakBefore: true,
        })
      );

      // Process each section
      currentProject.sections.forEach((section, index) => {
        if (section.output?.raw_output) {
          // Section heading
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${index + 1}. ${section.title}`,
                  bold: true,
                  size: 24,
                }),
              ],
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            })
          );

          // Section content
          const cleanContent = cleanMarkdownForText(section.output.raw_output);
          const contentParagraphs = cleanContent.split('\n\n').filter(p => p.trim());

          contentParagraphs.forEach(paragraph => {
            if (paragraph.trim()) {
              paragraphs.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: paragraph.trim(),
                      size: 22, // 11pt in half-points
                    }),
                  ],
                  spacing: { after: 200 },
                })
              );
            }
          });

          // Section separator
          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: '' })],
              spacing: { after: 400 },
            })
          );
        }
      });

      // Create document
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: paragraphs,
          },
        ],
        title: currentProject.title,
        description: 'Generated by ModelMix Document Generator',
        creator: 'ModelMix AI',
      });

      // Generate buffer and save
      const buffer = await Packer.toBuffer(doc);
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      
      saveAs(blob, `${sanitizeFilename(currentProject.title)}.docx`);
      
      // Record export in database
      await supabase
        .from('final_exports')
        .insert({
          project_id: currentProject.id,
          format: 'docx'
        });
        
    } catch (error) {
      console.error('Word export error:', error);
      setError(`Failed to export Word document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleExportText = async () => {
    if (!currentProject) return;

    try {
      let content = `${currentProject.title}\n\n`;
      content += `Generated by ModelMix Document Generator\n`;
      content += `Created: ${new Date(currentProject.created_at).toLocaleDateString()}\n`;
      content += `Word Count: ${currentProject.wordCount.toLocaleString()}\n`;
      content += `Pages: ${Math.round(currentProject.wordCount / 250)}\n\n`;
      content += `Format: ${currentProject.metadata?.doc_type || 'Document'}\n`;
      content += `Tone: ${currentProject.metadata?.tone || 'Formal'}\n`;
      if (currentProject.metadata?.audience) {
        content += `Audience: ${currentProject.metadata.audience}\n`;
      }
      if (currentProject.metadata?.purpose) {
        content += `Purpose: ${currentProject.metadata.purpose}\n`;
      }
      content += '='.repeat(80) + '\n\n';

      currentProject.sections.forEach((section, index) => {
        if (section.output?.raw_output) {
          content += `${index + 1}. ${section.title}\n\n`;
          
          // Clean markdown for text export
          const cleanContent = cleanMarkdownForText(section.output.raw_output);
          content += `${cleanContent}\n\n`;
          content += '-'.repeat(60) + '\n\n';
        }
      });

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      saveAs(blob, `${sanitizeFilename(currentProject.title)}.txt`);
      
      // Record export in database
      await supabase
        .from('final_exports')
        .insert({
          project_id: currentProject.id,
          format: 'txt'
        });
        
    } catch (error) {
      console.error('Text export error:', error);
      setError('Failed to export text file. Please try again.');
    }
  };

  const toggleSectionExpansion = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const generateTitle = (prompt: string): string => {
    // Extract a title from the prompt
    const words = prompt.split(' ').slice(0, 8);
    return words.join(' ').replace(/[^\w\s]/g, '').trim();
  };

  const getDefaultModel = (): string => {
    // Return a default model for section generation
    return 'anthropic/claude-3.5-sonnet';
  };

  const countWords = (text: string): number => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const cleanMarkdownForPDF = (text: string): string => {
    return text
      .replace(/#{1,6}\s+/g, '') // Remove markdown headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
      .replace(/`(.*?)`/g, '$1') // Remove code markdown
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
      .replace(/^\s*[-*+]\s+/gm, '• ') // Convert bullet points
      .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list markers
      .replace(/\n{3,}/g, '\n\n') // Normalize line breaks
      .trim();
  };

  const cleanMarkdownForText = (text: string): string => {
    return text
      .replace(/#{1,6}\s+/g, '') // Remove markdown headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
      .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
      .replace(/`(.*?)`/g, '$1') // Remove code markdown
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
      .replace(/^\s*[-*+]\s+/gm, '• ') // Convert bullet points
      .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list markers
      .replace(/\n{3,}/g, '\n\n') // Normalize line breaks
      .trim();
  };

  const sanitizeFilename = (filename: string): string => {
    return filename
      .replace(/[^a-z0-9\s]/gi, '_')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();
  };

  const getProgressColor = (progress: number) => {
    if (progress < 25) return 'bg-red-500';
    if (progress < 50) return 'bg-orange-500';
    if (progress < 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (!isOpen) return null;

  // Pro-only feature check
  if (!isProUser) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
        <div className="bg-white rounded-xl max-w-md w-full p-6 transform animate-slideUp">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Crown size={20} className="text-yellow-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Pro Feature</h2>
                <p className="text-sm text-gray-500">Upgrade to access Document Generator</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-all duration-200 hover:scale-110"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-yellow-800 mb-2 flex items-center space-x-2">
              <Zap size={18} className="text-yellow-600" />
              <span>Document Generator</span>
            </h3>
            <p className="text-sm text-yellow-700 mb-4">
              Generate comprehensive, long-form documents using AI orchestration. This Pro feature allows you to:
            </p>
            <ul className="text-sm text-yellow-700 space-y-1 mb-4">
              <li>• Create documents up to 30,000 characters</li>
              <li>• Use multiple AI models for different sections</li>
              <li>• Export in PDF, Word, or Markdown formats</li>
              <li>• Save and resume document generation</li>
              <li>• Edit and regenerate specific sections</li>
            </ul>
            <p className="text-sm text-yellow-700">
              Upgrade to Pro to unlock this and other premium features.
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden transform animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg animate-bounceIn">
                <Zap size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Document Generator</h2>
                <p className="text-emerald-100">Generate comprehensive documents with AI orchestration</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/20 transition-all duration-200 hover:scale-110"
              disabled={isGenerating}
            >
              <X size={24} />
            </button>
          </div>

          {/* Enhanced Progress Bar with Real-time Updates */}
          {currentProject && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span>{currentProject.title}</span>
                <div className="flex items-center space-x-4">
                  <span>{currentProject.progress}% Complete</span>
                  <span className="text-emerald-200">
                    Section {currentProject.currentSection + 1} of {currentProject.totalSections}
                  </span>
                  <span className="text-emerald-200">
                    {currentProject.wordCount.toLocaleString()} words
                  </span>
                </div>
              </div>
              <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ease-out ${getProgressColor(currentProject.progress)}`}
                  style={{ width: `${currentProject.progress}%` }}
                />
              </div>
              {/* Real-time status indicator */}
              <div className="flex items-center justify-between text-xs mt-2 text-emerald-200">
                <span>Status: {currentProject.status}</span>
                {isGenerating && (
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <span>AI is writing...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {step === 'setup' && (
            <div className="p-6 h-full overflow-y-auto">
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Feature Overview */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-emerald-800 mb-4 flex items-center space-x-2">
                    <Sparkles className="text-emerald-600" size={20} />
                    <span>AI-Orchestrated Document Generation</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-start space-x-3">
                      <Brain className="text-emerald-600 flex-shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="font-medium text-emerald-800">Smart Planning</p>
                        <p className="text-emerald-700">AI creates structured outlines and assigns tasks to optimal models</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Layers className="text-emerald-600 flex-shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="font-medium text-emerald-800">Sequential Writing</p>
                        <p className="text-emerald-700">Context-aware section generation with automatic checkpointing</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Eye className="text-emerald-600 flex-shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="font-medium text-emerald-800">Quality Review</p>
                        <p className="text-emerald-700">Self-critic models ensure consistency and quality</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <DollarSign className="text-emerald-600 flex-shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="font-medium text-emerald-800">Cost Efficient</p>
                        <p className="text-emerald-700">Smart model selection and caching reduce token usage</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Project Setup */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Setup</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Project Prompt *
                      </label>
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe what you want to write about. Be specific about the topic, scope, and any requirements..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                        rows={4}
                        maxLength={2000}
                      />
                      <p className="text-xs text-gray-500 mt-1">{prompt.length}/2000 characters</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Target Word Count</label>
                        <input
                          type="number"
                          value={settings.wordCount}
                          onChange={(e) => setSettings({ ...settings, wordCount: parseInt(e.target.value) || 5000 })}
                          min={1000}
                          max={30000}
                          step={1000}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Recommended: 5,000 - 30,000 words</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Document Format</label>
                        <select
                          value={settings.docType}
                          onChange={(e) => setSettings({ ...settings, docType: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="research-paper">Research Paper</option>
                          <option value="report">Business Report</option>
                          <option value="book">Book/Novel</option>
                          <option value="article">Article/Blog</option>
                          <option value="manual">Technical Manual</option>
                          <option value="proposal">Project Proposal</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
                        <select
                          value={settings.tone}
                          onChange={(e) => setSettings({ ...settings, tone: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="formal">Formal</option>
                          <option value="casual">Casual</option>
                          <option value="persuasive">Persuasive</option>
                          <option value="informative">Informative</option>
                          <option value="engaging">Engaging</option>
                          <option value="technical">Technical</option>
                          <option value="academic">Academic</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Target Audience</label>
                        <input
                          type="text"
                          value={settings.audience}
                          onChange={(e) => setSettings({ ...settings, audience: e.target.value })}
                          placeholder="e.g., Professionals, Students, General public..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Purpose</label>
                      <input
                        type="text"
                        value={settings.purpose}
                        onChange={(e) => setSettings({ ...settings, purpose: e.target.value })}
                        placeholder="e.g., Educational, Informational, Persuasive..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Existing Projects */}
                {projects.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Projects</h3>
                    <div className="space-y-3">
                      {projects.map(project => (
                        <div 
                          key={project.id}
                          className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => {
                            loadProjectDetails(project.id);
                            setStep(project.status === 'completed' ? 'completed' : 'writing');
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-gray-900">{project.title}</h4>
                              <p className="text-sm text-gray-500">
                                {new Date(project.created_at).toLocaleDateString()} • {project.wordCount.toLocaleString()} words • {project.sections.length} sections
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                project.status === 'completed' ? 'bg-green-100 text-green-800' :
                                project.status === 'error' ? 'bg-red-100 text-red-800' :
                                project.status === 'paused' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                              </span>
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${getProgressColor(project.progress)}`}
                                  style={{ width: `${project.progress}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 text-red-700">
                      <AlertCircle size={16} />
                      <span className="text-sm">{error}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={onClose}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    disabled={isGenerating}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartProject}
                    disabled={!prompt.trim() || isGenerating}
                    className="flex items-center space-x-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 transform"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Starting...</span>
                      </>
                    ) : (
                      <>
                        <Play size={16} />
                        <span>Start Document Generation</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {(step === 'planning' || step === 'writing' || step === 'review') && currentProject && (
            <div className="h-full flex flex-col">
              {/* Project Info */}
              <div className="bg-gray-50 border-b border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{currentProject.title}</h3>
                    <p className="text-sm text-gray-600">
                      {currentProject.wordCount.toLocaleString()} words • {Math.round(currentProject.wordCount / 250)} pages • {currentProject.status}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {currentProject.status === 'writing' && (
                      <button
                        onClick={handlePauseResume}
                        className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                        disabled={isGenerating}
                      >
                        <Pause size={16} />
                        <span>Pause</span>
                      </button>
                    )}
                    {(currentProject.status === 'paused' || currentProject.status === 'error') && (
                      <button
                        onClick={handlePauseResume}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        disabled={isGenerating}
                      >
                        <Play size={16} />
                        <span>Resume</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Sections */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  {currentProject.sections.map((section, index) => (
                    <div
                      key={section.id}
                      className={`border rounded-lg p-4 transition-all duration-200 ${
                        section.status === 'completed' ? 'border-green-200 bg-green-50' :
                        section.status === 'writing' ? 'border-blue-200 bg-blue-50' :
                        section.status === 'error' ? 'border-red-200 bg-red-50' :
                        'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-gray-900">{section.title}</h4>
                          <div className="flex items-center space-x-2">
                            <select
                              value={selectedModels[section.id] || section.assigned_model}
                              onChange={(e) => handleUpdateSectionModel(section.id, e.target.value)}
                              className="text-xs border border-gray-300 rounded px-2 py-1"
                              disabled={section.status === 'writing' || section.status === 'completed' || isGenerating}
                            >
                              {availableModels.map(model => (
                                <option key={model.id} value={model.id}>
                                  {model.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {section.status === 'completed' && (
                            <CheckCircle size={16} className="text-green-600" />
                          )}
                          {section.status === 'writing' && (
                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          )}
                          {section.status === 'error' && (
                            <AlertCircle size={16} className="text-red-600" />
                          )}
                          <span className="text-xs text-gray-500">{section.output ? countWords(section.output.raw_output) : 0} words</span>
                        </div>
                      </div>

                      {section.output?.raw_output && (
                        <div className="prose prose-sm max-w-none mb-4">
                          <div className="text-gray-800 text-sm leading-relaxed">
                            {expandedSections.has(section.id) ? (
                              <div dangerouslySetInnerHTML={{ __html: section.output.raw_output.replace(/\n/g, '<br>') }} />
                            ) : (
                              <>
                                {section.output.raw_output.substring(0, 300)}
                                {section.output.raw_output.length > 300 && '...'}
                              </>
                            )}
                          </div>
                          <button
                            onClick={() => toggleSectionExpansion(section.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 mt-2"
                          >
                            {expandedSections.has(section.id) ? 'Show less' : 'Show more'}
                          </button>
                        </div>
                      )}

                      {section.status === 'completed' && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleSectionAction(section.id, 'accept')}
                            className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
                            disabled={isGenerating}
                          >
                            <CheckCircle size={14} />
                            <span>Accept</span>
                          </button>
                          <button
                            onClick={() => handleSectionAction(section.id, 'edit')}
                            className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                            disabled={isGenerating}
                          >
                            <Edit size={14} />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleSectionAction(section.id, 'regenerate')}
                            className="flex items-center space-x-1 px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 transition-colors"
                            disabled={isGenerating}
                          >
                            <RotateCcw size={14} />
                            <span>Regenerate</span>
                          </button>
                        </div>
                      )}

                      {section.status === 'pending' && index === currentProject.currentSection && !isGenerating && (
                        <button
                          onClick={() => startWritingProcess(currentProject)}
                          className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                        >
                          <Play size={14} />
                          <span>Start Writing</span>
                        </button>
                      )}

                      {section.status === 'error' && (
                        <div className="bg-red-50 p-2 rounded text-xs text-red-700 mt-2">
                          Error occurred during generation. Please try regenerating this section.
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {isGenerating && (
                    <div className="text-center py-8">
                      <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-gray-600">AI is working on your document...</p>
                      {currentProject && (
                        <div className="mt-2 text-sm text-gray-500">
                          <p>Section {currentProject.currentSection + 1} of {currentProject.totalSections}</p>
                          <p>{currentProject.wordCount.toLocaleString()} words written so far</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          {step === 'completed' && currentProject && (
            <div className="p-6 h-full overflow-y-auto">
              <div className="max-w-4xl mx-auto">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} className="text-green-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Document Completed!</h3>
                  <p className="text-gray-600 mb-6">
                    Your {currentProject.wordCount.toLocaleString()}-word document is ready for export.
                  </p>
                </div>

                {/* Document Review Section */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-gray-900 flex items-center space-x-2">
                      <Eye size={20} />
                      <span>Document Review</span>
                    </h4>
                    <button
                      onClick={() => setShowFullDocument(!showFullDocument)}
                      className="flex items-center space-x-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      {showFullDocument ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      <span>{showFullDocument ? 'Hide' : 'Show'} Full Document</span>
                    </button>
                  </div>

                  {/* Section Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {currentProject.sections.map((section) => (
                      <div key={section.id} className="bg-white border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2 min-w-0">
                            <h5 className="font-medium text-gray-900 text-sm truncate">{section.title}</h5>
                            <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded-full text-gray-600 flex items-center space-x-0.5 flex-shrink-0 truncate max-w-[120px]">
                              {section.assigned_model.split('/').pop()}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500">{section.output ? countWords(section.output.raw_output) : 0} words</span>
                            <button
                              onClick={() => toggleSectionExpansion(section.id)}
                              className="p-1 rounded hover:bg-gray-100"
                            >
                              {expandedSections.has(section.id) ? 
                                <ChevronUp size={14} /> : 
                                <ChevronDown size={14} />
                              }
                            </button>
                          </div>
                        </div>
                        
                        {expandedSections.has(section.id) && section.output && (
                          <div className="text-xs text-gray-700 leading-relaxed max-h-40 overflow-y-auto">
                            <div dangerouslySetInnerHTML={{ __html: section.output.raw_output.replace(/\n/g, '<br>') }} />
                          </div>
                        )}
                        
                        {!expandedSections.has(section.id) && section.output && (
                          <div className="text-xs text-gray-600">
                            {section.output.raw_output.substring(0, 150)}...
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Full Document View */}
                  {showFullDocument && (
                    <div className="bg-white border border-gray-200 rounded-lg p-6 max-h-96 overflow-y-auto">
                      <div className="prose prose-sm max-w-none">
                        <h1 className="text-2xl font-bold mb-6">{currentProject.title}</h1>
                        {currentProject.sections.map((section) => (
                          <div key={section.id} className="mb-8">
                            <h2 className="text-xl font-semibold mb-4 border-b border-gray-200 pb-2">
                              {section.title}
                            </h2>
                            {section.output && (
                              <div className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                                <div dangerouslySetInnerHTML={{ __html: section.output.raw_output.replace(/\n/g, '<br>') }} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Export Options */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                  <h4 className="font-semibold text-gray-900 mb-4">Export Options</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      onClick={handleExportPDF}
                      className="flex flex-col items-center space-y-2 p-4 border border-gray-200 rounded-lg hover:bg-white hover:shadow-md transition-all duration-200 hover:scale-105"
                    >
                      <FileText size={24} className="text-emerald-600" />
                      <span className="text-sm font-medium">PDF</span>
                      <span className="text-xs text-gray-500 text-center">Portable Document Format</span>
                    </button>
                    
                    <button
                      onClick={handleExportDocx}
                      className="flex flex-col items-center space-y-2 p-4 border border-gray-200 rounded-lg hover:bg-white hover:shadow-md transition-all duration-200 hover:scale-105"
                    >
                      <FileCheck size={24} className="text-emerald-600" />
                      <span className="text-sm font-medium">Word</span>
                      <span className="text-xs text-gray-500 text-center">Microsoft Word Document</span>
                    </button>
                    
                    <button
                      onClick={handleExportText}
                      className="flex flex-col items-center space-y-2 p-4 border border-gray-200 rounded-lg hover:bg-white hover:shadow-md transition-all duration-200 hover:scale-105"
                    >
                      <FileText size={24} className="text-emerald-600" />
                      <span className="text-sm font-medium">Text</span>
                      <span className="text-xs text-gray-500 text-center">Plain Text File</span>
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center space-x-2 text-red-700">
                      <AlertCircle size={16} />
                      <span className="text-sm">{error}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-center space-x-3">
                  <button
                    onClick={() => {
                      setStep('setup');
                      setCurrentProject(null);
                      setPrompt('');
                      setExpandedSections(new Set());
                      setShowFullDocument(false);
                    }}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    New Document
                  </button>
                  <button
                    onClick={onClose}
                    className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
import React, { useState, useEffect, useRef } from 'react';
import { X, Zap, FileText, CheckCircle, AlertCircle, Clock, Play, Pause, Download, Eye, Edit, RotateCcw, Target, Users, Shield, Sparkles, BookOpen, FileCheck, Layers, Globe, ChevronDown, ChevronUp, Save, Trash2, Plus, Settings, RefreshCw, Copy, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';

interface OrchestrationProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Project {
  id: string;
  title: string;
  user_id: string;
  original_prompt: string;
  status: 'draft' | 'planning' | 'writing' | 'reviewing' | 'completed' | 'paused' | 'error';
  created_at: string;
  updated_at: string;
}

interface ProjectMetadata {
  id: string;
  project_id: string;
  audience: string;
  tone: string;
  purpose: string;
  doc_type: string;
  word_count: number;
  created_at: string;
}

interface Section {
  id: string;
  project_id: string;
  title: string;
  assigned_model: string;
  token_budget: number;
  status: 'pending' | 'writing' | 'completed' | 'error';
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

export const Orchestration: React.FC<OrchestrationProps> = ({ isOpen, onClose }) => {
  const { user, getCurrentTier } = useAuth();
  const [step, setStep] = useState<'projects' | 'setup' | 'details' | 'plan' | 'writing' | 'review' | 'export'>('projects');
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [projectMetadata, setProjectMetadata] = useState<ProjectMetadata | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionOutputs, setSectionOutputs] = useState<Record<string, SectionOutput>>({});
  
  // Form states
  const [prompt, setPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('professional');
  const [purpose, setPurpose] = useState('');
  const [docType, setDocType] = useState('guide');
  const [wordCount, setWordCount] = useState(5000);
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showFullDocument, setShowFullDocument] = useState(false);
  const [availableModels, setAvailableModels] = useState<{id: string, name: string}[]>([]);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentTier = getCurrentTier();
  const isProUser = currentTier === 'tier2';

  useEffect(() => {
    if (isOpen) {
      loadProjects();
      loadAvailableModels();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [sections]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadProjects = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('Error loading projects:', error);
      setError('Failed to load your projects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableModels = async () => {
    try {
      // In a real implementation, this would fetch from OpenRouter API
      // For now, we'll use a hardcoded list of models
      setAvailableModels([
        { id: 'anthropic/claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
        { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus' },
        { id: 'openai/gpt-4o', name: 'GPT-4o' },
        { id: 'google/gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
        { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B' },
        { id: 'mistralai/mistral-large', name: 'Mistral Large' },
        { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' }
      ]);
    } catch (error) {
      console.error('Error loading models:', error);
    }
  };

  const createProject = async () => {
    if (!user) {
      setError('Please sign in to create a project');
      return;
    }

    if (!isProUser) {
      setError('Orchestration is a Pro feature. Please upgrade to access this feature.');
      return;
    }

    if (!prompt.trim()) {
      setError('Please enter a prompt for your document');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Generate a title if not provided
      const projectTitle = title.trim() || generateTitle(prompt);
      
      // Create project in database
      const { data, error } = await supabase
        .from('projects')
        .insert({
          title: projectTitle,
          user_id: user.id,
          original_prompt: prompt,
          status: 'draft'
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setCurrentProject(data);
      setTitle(projectTitle);
      setStep('details');
      setSuccess('Project created successfully! Now let\'s add some details.');
    } catch (error) {
      console.error('Error creating project:', error);
      setError('Failed to create project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const saveProjectMetadata = async () => {
    if (!currentProject) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Save metadata to database
      const { data, error } = await supabase
        .from('project_metadata')
        .insert({
          project_id: currentProject.id,
          audience,
          tone,
          purpose,
          doc_type: docType,
          word_count: wordCount
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setProjectMetadata(data);
      
      // Update project status
      await supabase
        .from('projects')
        .update({ status: 'planning' })
        .eq('id', currentProject.id);
      
      if (currentProject) {
        setCurrentProject({
          ...currentProject,
          status: 'planning'
        });
      }
      
      setStep('plan');
      setSuccess('Details saved! Now generating your writing plan...');
      
      // Generate writing plan
      generateWritingPlan();
    } catch (error) {
      console.error('Error saving project metadata:', error);
      setError('Failed to save project details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateWritingPlan = async () => {
    if (!currentProject || !projectMetadata) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      // In a real implementation, this would call OpenAI API to generate a plan
      // For now, we'll simulate the response
      
      // Calculate number of sections based on word count
      const sectionCount = Math.max(3, Math.min(10, Math.ceil(wordCount / 1000)));
      const tokensPerSection = Math.ceil((wordCount * 1.5) / sectionCount); // ~1.5 tokens per word
      
      // Generate section titles based on document type
      const sectionTitles = generateSectionTitles(docType, prompt, sectionCount);
      
      // Create sections in database
      const sectionsToInsert = sectionTitles.map((title, index) => ({
        project_id: currentProject.id,
        title,
        assigned_model: getRandomModel().id,
        token_budget: tokensPerSection,
        status: 'pending',
        order: index + 1
      }));
      
      const { data, error } = await supabase
        .from('sections')
        .insert(sectionsToInsert)
        .select();
      
      if (error) throw error;
      
      setSections(data);
      
      // Update project status
      await supabase
        .from('projects')
        .update({ status: 'planning' })
        .eq('id', currentProject.id);
      
      setSuccess('Writing plan generated successfully!');
    } catch (error) {
      console.error('Error generating writing plan:', error);
      setError('Failed to generate writing plan. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const startWritingProcess = async () => {
    if (!currentProject || sections.length === 0) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Update project status
      await supabase
        .from('projects')
        .update({ status: 'writing' })
        .eq('id', currentProject.id);
      
      if (currentProject) {
        setCurrentProject({
          ...currentProject,
          status: 'writing'
        });
      }
      
      setStep('writing');
      setSuccess('Starting the writing process...');
      
      // Start generating content for each section
      generateSectionContent();
    } catch (error) {
      console.error('Error starting writing process:', error);
      setError('Failed to start writing process. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateSectionContent = async () => {
    if (!currentProject || sections.length === 0) return;
    
    setIsGenerating(true);
    
    try {
      // Process sections sequentially
      for (const section of sections) {
        if (section.status === 'completed') continue;
        
        // Update section status
        const updatedSection = { ...section, status: 'writing' };
        await updateSection(updatedSection);
        
        // In a real implementation, this would call the assigned AI model
        // For now, we'll simulate the response with a delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Generate content based on section title and project details
        const content = await simulateAIResponse(section.title, currentProject.original_prompt, projectMetadata);
        
        // Save section output
        const { data: outputData, error: outputError } = await supabase
          .from('section_outputs')
          .insert({
            section_id: section.id,
            raw_output: content,
            ai_notes: `Generated using ${section.assigned_model}`,
            is_finalized: true
          })
          .select()
          .single();
        
        if (outputError) throw outputError;
        
        // Update section status
        const completedSection = { ...section, status: 'completed' };
        await updateSection(completedSection);
        
        // Update local state
        setSectionOutputs(prev => ({
          ...prev,
          [section.id]: outputData
        }));
      }
      
      // Update project status
      await supabase
        .from('projects')
        .update({ status: 'completed' })
        .eq('id', currentProject.id);
      
      if (currentProject) {
        setCurrentProject({
          ...currentProject,
          status: 'completed'
        });
      }
      
      setStep('review');
      setSuccess('All sections completed! You can now review your document.');
    } catch (error) {
      console.error('Error generating section content:', error);
      setError('Failed to generate content. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const updateSection = async (section: Section) => {
    try {
      const { error } = await supabase
        .from('sections')
        .update({
          assigned_model: section.assigned_model,
          status: section.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', section.id);
      
      if (error) throw error;
      
      // Update local state
      setSections(prev => prev.map(s => s.id === section.id ? section : s));
    } catch (error) {
      console.error('Error updating section:', error);
      throw error;
    }
  };

  const handleModelChange = async (sectionId: string, modelId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;
    
    try {
      const updatedSection = { ...section, assigned_model: modelId };
      await updateSection(updatedSection);
      setSuccess(`Model updated for "${section.title}"`);
    } catch (error) {
      console.error('Error changing model:', error);
      setError('Failed to update model. Please try again.');
    }
  };

  const handleEditSection = (sectionId: string) => {
    const output = sectionOutputs[sectionId];
    if (!output) return;
    
    setEditingSectionId(sectionId);
    setEditingContent(output.raw_output);
  };

  const handleSaveEdit = async () => {
    if (!editingSectionId) return;
    
    setLoading(true);
    
    try {
      // Update section output
      const { error } = await supabase
        .from('section_outputs')
        .update({
          raw_output: editingContent,
          updated_at: new Date().toISOString()
        })
        .eq('section_id', editingSectionId);
      
      if (error) throw error;
      
      // Update local state
      if (sectionOutputs[editingSectionId]) {
        setSectionOutputs(prev => ({
          ...prev,
          [editingSectionId]: {
            ...prev[editingSectionId],
            raw_output: editingContent
          }
        }));
      }
      
      setEditingSectionId(null);
      setEditingContent('');
      setSuccess('Section updated successfully!');
    } catch (error) {
      console.error('Error saving edit:', error);
      setError('Failed to save changes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateSection = async (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;
    
    setLoading(true);
    
    try {
      // Update section status
      const updatedSection = { ...section, status: 'writing' };
      await updateSection(updatedSection);
      
      // In a real implementation, this would call the assigned AI model
      // For now, we'll simulate the response with a delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate new content
      const content = await simulateAIResponse(section.title, currentProject?.original_prompt || '', projectMetadata, true);
      
      // Update section output
      const { error } = await supabase
        .from('section_outputs')
        .update({
          raw_output: content,
          ai_notes: `Regenerated using ${section.assigned_model}`,
          updated_at: new Date().toISOString()
        })
        .eq('section_id', sectionId);
      
      if (error) throw error;
      
      // Update local state
      if (sectionOutputs[sectionId]) {
        setSectionOutputs(prev => ({
          ...prev,
          [sectionId]: {
            ...prev[sectionId],
            raw_output: content,
            ai_notes: `Regenerated using ${section.assigned_model}`
          }
        }));
      }
      
      // Update section status
      const completedSection = { ...section, status: 'completed' };
      await updateSection(completedSection);
      
      setSuccess('Section regenerated successfully!');
    } catch (error) {
      console.error('Error regenerating section:', error);
      setError('Failed to regenerate section. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const exportDocument = async (format: 'pdf' | 'markdown' | 'docx') => {
    if (!currentProject || sections.length === 0) return;
    
    try {
      switch (format) {
        case 'pdf':
          exportToPDF();
          break;
        case 'markdown':
          exportToMarkdown();
          break;
        case 'docx':
          exportToDocx();
          break;
      }
      
      // Save export record in database
      await supabase
        .from('final_exports')
        .insert({
          project_id: currentProject.id,
          format,
          exported_at: new Date().toISOString()
        });
      
      setSuccess(`Document exported as ${format.toUpperCase()} successfully!`);
    } catch (error) {
      console.error(`Error exporting as ${format}:`, error);
      setError(`Failed to export as ${format}. Please try again.`);
    }
  };

  const exportToPDF = () => {
    if (!currentProject) return;
    
    const doc = new jsPDF();
    let yPosition = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const titleFontSize = 16;
    const subtitleFontSize = 14;
    const bodyFontSize = 12;
    
    // Add title
    doc.setFontSize(titleFontSize);
    doc.setFont('helvetica', 'bold');
    doc.text(currentProject.title, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;
    
    // Add metadata
    doc.setFontSize(bodyFontSize);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated by ModelMix Orchestration`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;
    doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 20;
    
    // Add sections
    for (const section of sections) {
      // Check if we need a new page
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }
      
      // Add section title
      doc.setFontSize(subtitleFontSize);
      doc.setFont('helvetica', 'bold');
      doc.text(section.title, margin, yPosition);
      yPosition += 10;
      
      // Add section content
      const output = sectionOutputs[section.id];
      if (output) {
        doc.setFontSize(bodyFontSize);
        doc.setFont('helvetica', 'normal');
        
        // Split text into lines to fit page width
        const contentLines = doc.splitTextToSize(output.raw_output, pageWidth - (margin * 2));
        
        // Check if we need a new page for content
        if (yPosition + (contentLines.length * 7) > 280) {
          doc.addPage();
          yPosition = 20;
        }
        
        doc.text(contentLines, margin, yPosition);
        yPosition += (contentLines.length * 7) + 15;
      }
    }
    
    // Save the PDF
    doc.save(`${currentProject.title.replace(/\s+/g, '_')}.pdf`);
  };

  const exportToMarkdown = () => {
    if (!currentProject) return;
    
    let markdown = `# ${currentProject.title}\n\n`;
    markdown += `*Generated by ModelMix Orchestration on ${new Date().toLocaleDateString()}*\n\n`;
    
    // Add sections
    for (const section of sections) {
      markdown += `## ${section.title}\n\n`;
      
      const output = sectionOutputs[section.id];
      if (output) {
        markdown += `${output.raw_output}\n\n`;
      }
    }
    
    // Create and download file
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    saveAs(blob, `${currentProject.title.replace(/\s+/g, '_')}.md`);
  };

  const exportToDocx = () => {
    // In a real implementation, this would use html-docx-js
    // For now, we'll just export as markdown
    exportToMarkdown();
  };

  const selectProject = async (projectId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // Load project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();
      
      if (projectError) throw projectError;
      setCurrentProject(projectData);
      
      // Load project metadata
      const { data: metadataData, error: metadataError } = await supabase
        .from('project_metadata')
        .select('*')
        .eq('project_id', projectId)
        .single();
      
      if (!metadataError) {
        setProjectMetadata(metadataData);
        setAudience(metadataData.audience);
        setTone(metadataData.tone);
        setPurpose(metadataData.purpose);
        setDocType(metadataData.doc_type);
        setWordCount(metadataData.word_count);
      }
      
      // Load sections
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('sections')
        .select('*')
        .eq('project_id', projectId)
        .order('order', { ascending: true });
      
      if (sectionsError) throw sectionsError;
      setSections(sectionsData || []);
      
      // Load section outputs
      if (sectionsData && sectionsData.length > 0) {
        const sectionIds = sectionsData.map(s => s.id);
        const { data: outputsData, error: outputsError } = await supabase
          .from('section_outputs')
          .select('*')
          .in('section_id', sectionIds);
        
        if (outputsError) throw outputsError;
        
        const outputsMap: Record<string, SectionOutput> = {};
        outputsData?.forEach(output => {
          outputsMap[output.section_id] = output;
        });
        
        setSectionOutputs(outputsMap);
      }
      
      // Set step based on project status
      switch (projectData.status) {
        case 'draft':
          setStep('details');
          break;
        case 'planning':
          setStep('plan');
          break;
        case 'writing':
          setStep('writing');
          break;
        case 'completed':
          setStep('review');
          break;
        default:
          setStep('details');
      }
    } catch (error) {
      console.error('Error loading project:', error);
      setError('Failed to load project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const deleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Delete project and all related data (cascade delete should handle this)
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);
      
      if (error) throw error;
      
      // Update local state
      setProjects(prev => prev.filter(p => p.id !== projectId));
      
      if (currentProject?.id === projectId) {
        setCurrentProject(null);
        setProjectMetadata(null);
        setSections([]);
        setSectionOutputs({});
        setStep('projects');
      }
      
      setSuccess('Project deleted successfully!');
    } catch (error) {
      console.error('Error deleting project:', error);
      setError('Failed to delete project. Please try again.');
    } finally {
      setLoading(false);
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

  const resetForm = () => {
    setPrompt('');
    setTitle('');
    setAudience('');
    setTone('professional');
    setPurpose('');
    setDocType('guide');
    setWordCount(5000);
    setCurrentProject(null);
    setProjectMetadata(null);
    setSections([]);
    setSectionOutputs({});
    setError(null);
    setSuccess(null);
  };

  // Helper functions
  const generateTitle = (prompt: string): string => {
    // Extract a title from the prompt
    const words = prompt.split(' ').slice(0, 8);
    return words.join(' ').replace(/[^\w\s]/g, '').trim();
  };

  const generateSectionTitles = (docType: string, prompt: string, count: number): string[] => {
    // Generate section titles based on document type
    switch (docType) {
      case 'guide':
        return [
          'Introduction',
          'Background',
          'Key Concepts',
          'Step-by-Step Process',
          'Best Practices',
          'Common Challenges',
          'Case Studies',
          'Tools and Resources',
          'Future Trends',
          'Conclusion'
        ].slice(0, count);
      
      case 'research':
        return [
          'Abstract',
          'Introduction',
          'Literature Review',
          'Methodology',
          'Results',
          'Analysis',
          'Discussion',
          'Limitations',
          'Future Research',
          'Conclusion'
        ].slice(0, count);
      
      case 'business':
        return [
          'Executive Summary',
          'Company Overview',
          'Market Analysis',
          'Competitive Landscape',
          'Product/Service Description',
          'Marketing Strategy',
          'Operations Plan',
          'Financial Projections',
          'Risk Assessment',
          'Implementation Timeline'
        ].slice(0, count);
      
      case 'creative':
        return Array.from({ length: count }, (_, i) => `Chapter ${i + 1}`);
      
      default:
        return Array.from({ length: count }, (_, i) => `Section ${i + 1}`);
    }
  };

  const getRandomModel = () => {
    return availableModels[Math.floor(Math.random() * availableModels.length)];
  };

  const simulateAIResponse = async (
    sectionTitle: string, 
    originalPrompt: string, 
    metadata: ProjectMetadata | null,
    isRegeneration: boolean = false
  ): Promise<string> => {
    // In a real implementation, this would call the OpenAI API
    // For now, we'll return a placeholder response based on the section title
    
    const baseContent = `# ${sectionTitle}

${isRegeneration ? 'This is a regenerated section with improved content.' : 'This is an AI-generated section.'} 

## Overview

This section covers ${sectionTitle.toLowerCase()} in the context of ${originalPrompt}. The content is tailored for ${metadata?.audience || 'a general audience'} with a ${metadata?.tone || 'professional'} tone.

## Main Points

1. First key point about ${sectionTitle.toLowerCase()}
2. Second key point with detailed explanation
3. Third key point with examples and case studies

## Detailed Analysis

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam auctor, nisl eget ultricies tincidunt, nisl nisl aliquam nisl, eget ultricies nisl nisl eget nisl. Nullam auctor, nisl eget ultricies tincidunt, nisl nisl aliquam nisl, eget ultricies nisl nisl eget nisl.

## Practical Applications

- Application 1: Description and benefits
- Application 2: Implementation strategies
- Application 3: Case study and results

## Summary

In conclusion, ${sectionTitle.toLowerCase()} plays a crucial role in ${originalPrompt}. The key takeaways are...`;

    // Add some randomness to make each section unique
    const randomParagraphs = [
      "The implementation of these concepts requires careful planning and execution. Organizations should consider their specific needs and constraints before proceeding with any major changes.",
      
      "Research has shown that early adopters of these methodologies often gain significant competitive advantages. However, the learning curve can be steep and requires dedicated resources.",
      
      "Industry experts predict that these trends will continue to evolve over the next decade, with increasing integration of artificial intelligence and machine learning technologies.",
      
      "Case studies from leading companies demonstrate the potential for substantial return on investment when these principles are applied correctly and consistently.",
      
      "It's important to note that regional regulations may impact implementation strategies, and organizations should consult with legal experts to ensure compliance."
    ];
    
    // Add 2-3 random paragraphs
    const paragraphCount = 2 + Math.floor(Math.random() * 2);
    let additionalContent = "\n\n## Additional Insights\n\n";
    
    for (let i = 0; i < paragraphCount; i++) {
      const randomIndex = Math.floor(Math.random() * randomParagraphs.length);
      additionalContent += randomParagraphs[randomIndex] + "\n\n";
    }
    
    return baseContent + additionalContent;
  };

  const getModelNameById = (modelId: string): string => {
    const model = availableModels.find(m => m.id === modelId);
    return model ? model.name : modelId;
  };

  const getTotalWordCount = (): number => {
    return Object.values(sectionOutputs).reduce((total, output) => {
      const wordCount = output.raw_output.split(/\s+/).length;
      return total + wordCount;
    }, 0);
  };

  const getProjectProgress = (): number => {
    if (!sections.length) return 0;
    
    const completedSections = sections.filter(s => s.status === 'completed').length;
    return Math.round((completedSections / sections.length) * 100);
  };

  if (!isOpen) return null;

  // Pro-only check
  if (!isProUser) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
        <div className="bg-white rounded-xl max-w-md w-full p-6 transform animate-slideUp">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Crown size={20} className="text-yellow-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Pro Feature</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>
          
          <div className="text-center py-6">
            <Zap size={48} className="text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Upgrade to Pro</h3>
            <p className="text-gray-600 mb-6">
              Orchestration is a Pro-only feature that lets you generate comprehensive, long-form documents using AI.
            </p>
            <button
              className="w-full px-4 py-2 bg-gradient-to-r from-yellow-600 to-orange-600 text-white rounded-lg hover:from-yellow-700 hover:to-orange-700 transition-colors"
            >
              Upgrade to Pro
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden transform animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg animate-bounceIn">
                <Zap size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">AI Orchestration</h2>
                <p className="text-blue-100">Generate comprehensive documents with orchestrated AI models</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/20 transition-all duration-200 hover:scale-110"
            >
              <X size={24} />
            </button>
          </div>

          {/* Project Progress Bar (only show when project is selected) */}
          {currentProject && step !== 'projects' && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span>{currentProject.title}</span>
                <div className="flex items-center space-x-4">
                  <span>{getProjectProgress()}% Complete</span>
                  {sections.length > 0 && (
                    <span className="text-blue-200">
                      {sections.filter(s => s.status === 'completed').length} of {sections.length} sections
                    </span>
                  )}
                  {Object.keys(sectionOutputs).length > 0 && (
                    <span className="text-blue-200">
                      {getTotalWordCount().toLocaleString()} words
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-green-400 to-blue-400"
                  style={{ width: `${getProjectProgress()}%` }}
                />
              </div>
              {/* Status indicator */}
              <div className="flex items-center justify-between text-xs mt-2 text-blue-200">
                <span>Status: {currentProject.status}</span>
                {isGenerating && (
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <span>AI is working...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {/* Projects List */}
          {step === 'projects' && (
            <div className="h-full flex flex-col">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Your Projects</h3>
                  <button
                    onClick={() => {
                      resetForm();
                      setStep('setup');
                    }}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={16} />
                    <span>New Project</span>
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                      <p className="text-gray-600">Loading your projects...</p>
                    </div>
                  </div>
                ) : projects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <FileText size={48} className="text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Yet</h3>
                    <p className="text-gray-600 mb-6 max-w-md">
                      Create your first project to start generating comprehensive documents with AI orchestration.
                    </p>
                    <button
                      onClick={() => {
                        resetForm();
                        setStep('setup');
                      }}
                      className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus size={18} />
                      <span>Create Your First Project</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {projects.map(project => (
                      <div
                        key={project.id}
                        className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-1">{project.title}</h4>
                            <p className="text-sm text-gray-600">
                              Created: {new Date(project.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              project.status === 'completed' ? 'bg-green-100 text-green-800' :
                              project.status === 'writing' ? 'bg-blue-100 text-blue-800' :
                              project.status === 'planning' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                            </span>
                            <button
                              onClick={() => deleteProject(project.id)}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                              title="Delete project"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                        <p className="text-gray-700 mb-4 line-clamp-2">{project.original_prompt}</p>
                        <button
                          onClick={() => selectProject(project.id)}
                          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          <Eye size={16} />
                          <span>Open Project</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Project Setup */}
          {step === 'setup' && (
            <div className="h-full overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto">
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Create New Project</h3>
                  <p className="text-gray-600">
                    Describe what you want to write about, and our AI orchestration system will help you create a comprehensive document.
                  </p>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 animate-shakeX">
                    <div className="flex items-center space-x-2">
                      <AlertCircle size={16} />
                      <span>{error}</span>
                    </div>
                  </div>
                )}

                {success && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 animate-fadeInUp">
                    <div className="flex items-center space-x-2">
                      <CheckCircle size={16} />
                      <span>{success}</span>
                    </div>
                  </div>
                )}

                <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        What would you like to write about? *
                      </label>
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe your document in detail. For example: 'Write a comprehensive guide on sustainable farming practices for small-scale farmers in temperate climates.'"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 resize-none"
                        rows={5}
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Be specific about the topic, scope, and any particular requirements.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Document Title (Optional)
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Leave blank to auto-generate from your prompt"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        If left blank, we'll generate a title based on your prompt.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setStep('projects')}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Back to Projects
                  </button>
                  <button
                    onClick={createProject}
                    disabled={!prompt.trim() || loading}
                    className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <ArrowRight size={18} />
                        <span>Continue</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Project Details */}
          {step === 'details' && currentProject && (
            <div className="h-full overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto">
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{currentProject.title}</h3>
                  <p className="text-gray-600">
                    Let's add some details to help the AI generate better content for your document.
                  </p>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 animate-shakeX">
                    <div className="flex items-center space-x-2">
                      <AlertCircle size={16} />
                      <span>{error}</span>
                    </div>
                  </div>
                )}

                {success && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 animate-fadeInUp">
                    <div className="flex items-center space-x-2">
                      <CheckCircle size={16} />
                      <span>{success}</span>
                    </div>
                  </div>
                )}

                <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Users size={16} className="inline mr-1" />
                        Target Audience
                      </label>
                      <input
                        type="text"
                        value={audience}
                        onChange={(e) => setAudience(e.target.value)}
                        placeholder="e.g., Beginners, Professionals, Students, etc."
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <BookOpen size={16} className="inline mr-1" />
                        Document Type
                      </label>
                      <select
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                      >
                        <option value="guide">Guide / Tutorial</option>
                        <option value="research">Research Paper</option>
                        <option value="business">Business Document</option>
                        <option value="creative">Creative Writing</option>
                        <option value="technical">Technical Documentation</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Target size={16} className="inline mr-1" />
                        Purpose
                      </label>
                      <input
                        type="text"
                        value={purpose}
                        onChange={(e) => setPurpose(e.target.value)}
                        placeholder="e.g., Educate, Persuade, Inform, Entertain, etc."
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Settings size={16} className="inline mr-1" />
                        Tone
                      </label>
                      <select
                        value={tone}
                        onChange={(e) => setTone(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                      >
                        <option value="professional">Professional</option>
                        <option value="casual">Casual</option>
                        <option value="academic">Academic</option>
                        <option value="technical">Technical</option>
                        <option value="persuasive">Persuasive</option>
                        <option value="conversational">Conversational</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <FileText size={16} className="inline mr-1" />
                        Target Word Count
                      </label>
                      <input
                        type="range"
                        min="1000"
                        max="30000"
                        step="1000"
                        value={wordCount}
                        onChange={(e) => setWordCount(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>1,000 words</span>
                        <span>{wordCount.toLocaleString()} words (~{Math.round(wordCount / 250)} pages)</span>
                        <span>30,000 words</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => {
                      resetForm();
                      setStep('setup');
                    }}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={saveProjectMetadata}
                    disabled={loading}
                    className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <ArrowRight size={18} />
                        <span>Continue</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Writing Plan */}
          {step === 'plan' && currentProject && (
            <div className="h-full overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Writing Plan</h3>
                  <p className="text-gray-600">
                    Review the AI-generated writing plan for your document. You can adjust the assigned models for each section.
                  </p>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 animate-shakeX">
                    <div className="flex items-center space-x-2">
                      <AlertCircle size={16} />
                      <span>{error}</span>
                    </div>
                  </div>
                )}

                {success && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 animate-fadeInUp">
                    <div className="flex items-center space-x-2">
                      <CheckCircle size={16} />
                      <span>{success}</span>
                    </div>
                  </div>
                )}

                {isGenerating ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-6"></div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Generating Writing Plan</h3>
                    <p className="text-gray-600 mb-2">
                      Our AI is creating a detailed plan for your document...
                    </p>
                    <p className="text-sm text-gray-500">
                      This may take a moment as we analyze your requirements and structure the content.
                    </p>
                  </div>
                ) : sections.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <RefreshCw size={48} className="text-blue-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Generating Plan</h3>
                    <p className="text-gray-600 mb-4">
                      We're preparing to generate your writing plan.
                    </p>
                    <button
                      onClick={generateWritingPlan}
                      className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Play size={18} />
                      <span>Generate Plan Now</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Section</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Model</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token Budget</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {sections.map((section) => (
                              <tr key={section.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm font-medium text-gray-900">{section.title}</div>
                                  <div className="text-xs text-gray-500">Section {section.order}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <select
                                    value={section.assigned_model}
                                    onChange={(e) => handleModelChange(section.id, e.target.value)}
                                    className="text-sm border border-gray-300 rounded px-2 py-1"
                                  >
                                    {availableModels.map((model) => (
                                      <option key={model.id} value={model.id}>
                                        {model.name}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">{section.token_budget.toLocaleString()} tokens</div>
                                  <div className="text-xs text-gray-500">~{Math.round(section.token_budget / 1.5).toLocaleString()} words</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    section.status === 'completed' ? 'bg-green-100 text-green-800' :
                                    section.status === 'writing' ? 'bg-blue-100 text-blue-800' :
                                    section.status === 'error' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {section.status.charAt(0).toUpperCase() + section.status.slice(1)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="flex justify-between">
                      <button
                        onClick={() => setStep('details')}
                        className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={startWritingProcess}
                        disabled={loading || sections.length === 0}
                        className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {loading ? (
                          <>
                            <Loader2 size={18} className="animate-spin" />
                            <span>Starting...</span>
                          </>
                        ) : (
                          <>
                            <Play size={18} />
                            <span>Start Writing</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Writing Process */}
          {step === 'writing' && currentProject && (
            <div className="h-full overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Writing in Progress</h3>
                  <p className="text-gray-600">
                    Our AI models are generating content for your document. This process may take a few minutes.
                  </p>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 animate-shakeX">
                    <div className="flex items-center space-x-2">
                      <AlertCircle size={16} />
                      <span>{error}</span>
                    </div>
                  </div>
                )}

                {success && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 animate-fadeInUp">
                    <div className="flex items-center space-x-2">
                      <CheckCircle size={16} />
                      <span>{success}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-6">
                  {sections.map((section) => (
                    <div
                      key={section.id}
                      className={`border rounded-lg p-6 transition-all duration-300 ${
                        section.status === 'completed' ? 'border-green-200 bg-green-50' :
                        section.status === 'writing' ? 'border-blue-200 bg-blue-50 animate-pulse' :
                        section.status === 'error' ? 'border-red-200 bg-red-50' :
                        'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          {section.status === 'completed' ? (
                            <CheckCircle size={20} className="text-green-600" />
                          ) : section.status === 'writing' ? (
                            <Loader2 size={20} className="text-blue-600 animate-spin" />
                          ) : section.status === 'error' ? (
                            <AlertCircle size={20} className="text-red-600" />
                          ) : (
                            <Clock size={20} className="text-gray-400" />
                          )}
                          <div>
                            <h4 className="font-medium text-gray-900">{section.title}</h4>
                            <div className="flex items-center space-x-2 text-sm text-gray-500">
                              <span>Model: {getModelNameById(section.assigned_model)}</span>
                              <span>•</span>
                              <span>Budget: {Math.round(section.token_budget / 1.5).toLocaleString()} words</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {section.status === 'completed' && sectionOutputs[section.id] && (
                            <button
                              onClick={() => toggleSectionExpansion(section.id)}
                              className="p-1 rounded hover:bg-gray-100 transition-colors"
                            >
                              {expandedSections.has(section.id) ? (
                                <ChevronUp size={20} className="text-gray-600" />
                              ) : (
                                <ChevronDown size={20} className="text-gray-600" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {section.status === 'completed' && sectionOutputs[section.id] && expandedSections.has(section.id) && (
                        <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200 max-h-96 overflow-y-auto">
                          <div className="prose prose-sm max-w-none">
                            <div dangerouslySetInnerHTML={{ 
                              __html: sectionOutputs[section.id].raw_output
                                .replace(/\n\n/g, '<br/><br/>')
                                .replace(/# (.*)/g, '<h1>$1</h1>')
                                .replace(/## (.*)/g, '<h2>$1</h2>')
                                .replace(/### (.*)/g, '<h3>$1</h3>')
                            }} />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {isGenerating && (
                  <div className="flex flex-col items-center justify-center py-8 mt-6">
                    <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">AI Orchestration in Progress</h3>
                    <p className="text-gray-600 text-center max-w-md">
                      Our AI models are working together to generate high-quality content for your document. This process may take a few minutes depending on the length and complexity.
                    </p>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          {/* Review Document */}
          {step === 'review' && currentProject && (
            <div className="h-full overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Review Your Document</h3>
                  <p className="text-gray-600">
                    Your document is complete! Review the content, make any edits, and export when ready.
                  </p>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 animate-shakeX">
                    <div className="flex items-center space-x-2">
                      <AlertCircle size={16} />
                      <span>{error}</span>
                    </div>
                  </div>
                )}

                {success && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 animate-fadeInUp">
                    <div className="flex items-center space-x-2">
                      <CheckCircle size={16} />
                      <span>{success}</span>
                    </div>
                  </div>
                )}

                <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-lg font-semibold text-gray-900">Document Overview</h4>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => setShowFullDocument(!showFullDocument)}
                        className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        {showFullDocument ? (
                          <>
                            <ChevronUp size={16} />
                            <span>Hide Full Document</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown size={16} />
                            <span>Show Full Document</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500 mb-1">Total Sections</div>
                      <div className="text-2xl font-bold text-gray-900">{sections.length}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500 mb-1">Word Count</div>
                      <div className="text-2xl font-bold text-gray-900">{getTotalWordCount().toLocaleString()}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="text-sm text-gray-500 mb-1">Estimated Pages</div>
                      <div className="text-2xl font-bold text-gray-900">{Math.round(getTotalWordCount() / 250)}</div>
                    </div>
                  </div>

                  {/* Section List */}
                  {!showFullDocument && (
                    <div className="space-y-4">
                      {sections.map((section) => (
                        <div key={section.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium text-gray-900">{section.title}</h5>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => toggleSectionExpansion(section.id)}
                                className="p-1 rounded hover:bg-gray-100 transition-colors"
                              >
                                {expandedSections.has(section.id) ? (
                                  <ChevronUp size={16} className="text-gray-600" />
                                ) : (
                                  <ChevronDown size={16} className="text-gray-600" />
                                )}
                              </button>
                            </div>
                          </div>
                          
                          {expandedSections.has(section.id) && sectionOutputs[section.id] && (
                            <div className="mt-2">
                              <div className="p-4 bg-gray-50 rounded-lg max-h-64 overflow-y-auto">
                                <div className="prose prose-sm max-w-none">
                                  <div dangerouslySetInnerHTML={{ 
                                    __html: sectionOutputs[section.id].raw_output
                                      .replace(/\n\n/g, '<br/><br/>')
                                      .replace(/# (.*)/g, '<h1>$1</h1>')
                                      .replace(/## (.*)/g, '<h2>$1</h2>')
                                      .replace(/### (.*)/g, '<h3>$1</h3>')
                                  }} />
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-2 mt-3">
                                <button
                                  onClick={() => handleEditSection(section.id)}
                                  className="flex items-center space-x-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors text-sm"
                                >
                                  <Edit size={14} />
                                  <span>Edit</span>
                                </button>
                                <button
                                  onClick={() => handleRegenerateSection(section.id)}
                                  className="flex items-center space-x-1 px-3 py-1.5 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors text-sm"
                                >
                                  <RefreshCw size={14} />
                                  <span>Regenerate</span>
                                </button>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(sectionOutputs[section.id].raw_output);
                                    setSuccess('Section copied to clipboard!');
                                  }}
                                  className="flex items-center space-x-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm"
                                >
                                  <Copy size={14} />
                                  <span>Copy</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Full Document View */}
                  {showFullDocument && (
                    <div className="border border-gray-200 rounded-lg p-6 max-h-[50vh] overflow-y-auto">
                      <div className="prose prose-sm max-w-none">
                        <h1 className="text-2xl font-bold mb-6">{currentProject.title}</h1>
                        
                        {sections.map((section) => {
                          const output = sectionOutputs[section.id];
                          if (!output) return null;
                          
                          return (
                            <div key={section.id} className="mb-8">
                              <div dangerouslySetInnerHTML={{ 
                                __html: output.raw_output
                                  .replace(/\n\n/g, '<br/><br/>')
                                  .replace(/# (.*)/g, '<h1>$1</h1>')
                                  .replace(/## (.*)/g, '<h2>$1</h2>')
                                  .replace(/### (.*)/g, '<h3>$1</h3>')
                              }} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Section Editor Modal */}
                {editingSectionId && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Edit Section: {sections.find(s => s.id === editingSectionId)?.title}
                        </h3>
                        <button
                          onClick={() => {
                            setEditingSectionId(null);
                            setEditingContent('');
                          }}
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <X size={20} className="text-gray-500" />
                        </button>
                      </div>
                      
                      <textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 resize-none font-mono"
                        rows={20}
                      />
                      
                      <div className="flex justify-end space-x-3 mt-4">
                        <button
                          onClick={() => {
                            setEditingSectionId(null);
                            setEditingContent('');
                          }}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          disabled={loading}
                          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {loading ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <Save size={16} />
                              <span>Save Changes</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Export Options */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Export Options</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                      onClick={() => exportDocument('pdf')}
                      className="flex flex-col items-center p-6 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
                    >
                      <FileText size={32} className="text-red-500 mb-3" />
                      <span className="font-medium text-gray-900">Export as PDF</span>
                      <span className="text-xs text-gray-500 mt-1">Portable Document Format</span>
                    </button>
                    
                    <button
                      onClick={() => exportDocument('markdown')}
                      className="flex flex-col items-center p-6 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
                    >
                      <FileCheck size={32} className="text-blue-500 mb-3" />
                      <span className="font-medium text-gray-900">Export as Markdown</span>
                      <span className="text-xs text-gray-500 mt-1">Plain text with formatting</span>
                    </button>
                    
                    <button
                      onClick={() => exportDocument('docx')}
                      className="flex flex-col items-center p-6 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
                    >
                      <FileText size={32} className="text-blue-600 mb-3" />
                      <span className="font-medium text-gray-900">Export as DOCX</span>
                      <span className="text-xs text-gray-500 mt-1">Microsoft Word format</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setStep('plan')}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Back to Plan
                  </button>
                  <button
                    onClick={() => {
                      resetForm();
                      setStep('projects');
                    }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Finish & Return to Projects
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
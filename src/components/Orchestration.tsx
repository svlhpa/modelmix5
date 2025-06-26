import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Brain, CheckCircle, AlertCircle, Clock, Play, Pause, Download, Eye, Edit, RotateCcw, Zap, Target, Users, Shield, DollarSign, Sparkles, BookOpen, FileCheck, Layers, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { orchestrationService, ProjectWithDetails, Section } from '../services/orchestrationService';
import { exportService } from '../services/exportService';

interface OrchestrationProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProjectSettings {
  audience: string;
  tone: string;
  purpose: string;
  docType: string;
  wordCount: number;
}

export const Orchestration: React.FC<OrchestrationProps> = ({ isOpen, onClose }) => {
  const { user, getCurrentTier } = useAuth();
  const [step, setStep] = useState<'setup' | 'planning' | 'writing' | 'review' | 'completed'>('setup');
  const [currentProject, setCurrentProject] = useState<ProjectWithDetails | null>(null);
  const [projects, setProjects] = useState<ProjectWithDetails[]>([]);
  const [prompt, setPrompt] = useState('');
  const [settings, setSettings] = useState<ProjectSettings>({
    audience: 'General audience',
    tone: 'formal',
    purpose: 'informational',
    docType: 'research-paper',
    wordCount: 5000
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showFullDocument, setShowFullDocument] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [outline, setOutline] = useState<any>(null);

  const currentTier = getCurrentTier();
  const isProUser = currentTier === 'tier2';

  useEffect(() => {
    if (isOpen && user) {
      loadProjects();
    }
  }, [isOpen, user]);

  useEffect(() => {
    scrollToBottom();
  }, [currentProject?.sections]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadProjects = async () => {
    if (!user) return;
    
    try {
      const userProjects = await orchestrationService.getUserProjects(user.id);
      setProjects(userProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
      setError('Failed to load your projects. Please try again later.');
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
      // Generate outline
      const generatedOutline = await orchestrationService.generateOutline(
        prompt.trim(),
        settings
      );
      
      setOutline(generatedOutline);
      
      // Create project in database
      const projectId = await orchestrationService.createProject(
        user.id,
        prompt.trim(),
        settings
      );
      
      // Create sections from outline
      for (const section of generatedOutline.sections) {
        await supabase
          .from('sections')
          .insert({
            project_id: projectId,
            title: section.title,
            assigned_model: section.assigned_model,
            token_budget: section.token_budget,
            order: section.order,
            status: 'pending'
          });
      }
      
      // Update project title
      await supabase
        .from('projects')
        .update({ 
          title: generatedOutline.title,
          status: 'writing',
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);
      
      // Load the project details
      const projectDetails = await orchestrationService.getProjectDetails(projectId);
      setCurrentProject(projectDetails);
      setStep('writing');
      
      // Start the writing process
      await startWritingProcess(projectDetails);
    } catch (error) {
      console.error('Failed to start project:', error);
      setError(error instanceof Error ? error.message : 'Failed to start project');
      setStep('setup');
    } finally {
      setIsGenerating(false);
    }
  };

  const startWritingProcess = async (project: ProjectWithDetails) => {
    try {
      setIsGenerating(true);
      
      // Process each section sequentially
      for (let i = 0; i < project.sections.length; i++) {
        const section = project.sections[i];
        if (section.status === 'completed') continue;
        
        // Update section status to writing
        await supabase
          .from('sections')
          .update({ 
            status: 'writing',
            updated_at: new Date().toISOString()
          })
          .eq('id', section.id);
        
        // Get previous section ID for context
        const previousSectionId = i > 0 ? project.sections[i - 1].id : null;
        
        try {
          // Generate content for this section
          const content = await orchestrationService.generateSectionContent(
            project.id,
            section.id,
            previousSectionId
          );
          
          // Update section status to completed
          await supabase
            .from('sections')
            .update({ 
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', section.id);
          
          // Refresh project details
          const updatedProject = await orchestrationService.getProjectDetails(project.id);
          setCurrentProject(updatedProject);
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
          
          // Refresh project details
          const updatedProject = await orchestrationService.getProjectDetails(project.id);
          setCurrentProject(updatedProject);
          
          // Show error but continue with next section
          setError(`Error generating content for section ${section.title}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // Update project status to completed
      await supabase
        .from('projects')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id);
      
      // Refresh project details one last time
      const finalProject = await orchestrationService.getProjectDetails(project.id);
      setCurrentProject(finalProject);
      setStep('completed');
    } catch (error) {
      console.error('Writing process failed:', error);
      setError(error instanceof Error ? error.message : 'Writing process failed');
      
      // Update project status to error
      if (project) {
        await supabase
          .from('projects')
          .update({ 
            status: 'error',
            updated_at: new Date().toISOString()
          })
          .eq('id', project.id);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePauseResume = async () => {
    if (!currentProject) return;

    try {
      if (currentProject.status === 'writing') {
        await orchestrationService.pauseResumeProject(currentProject.id, 'pause');
        setCurrentProject({ ...currentProject, status: 'paused' });
        setIsGenerating(false);
      } else if (currentProject.status === 'paused') {
        await orchestrationService.pauseResumeProject(currentProject.id, 'resume');
        setIsGenerating(true);
        const updatedProject = await orchestrationService.getProjectDetails(currentProject.id);
        setCurrentProject(updatedProject);
        await startWritingProcess(updatedProject);
      }
    } catch (error) {
      console.error('Failed to pause/resume project:', error);
      setError(error instanceof Error ? error.message : 'Failed to pause/resume project');
    }
  };

  const handleRegenerateSection = async (sectionId: string) => {
    if (!currentProject) return;

    try {
      await orchestrationService.regenerateSection(sectionId);
      
      // Refresh project details
      const updatedProject = await orchestrationService.getProjectDetails(currentProject.id);
      setCurrentProject(updatedProject);
      
      // Find the section index
      const sectionIndex = updatedProject.sections.findIndex(s => s.id === sectionId);
      if (sectionIndex >= 0) {
        // Get previous section ID for context
        const previousSectionId = sectionIndex > 0 ? updatedProject.sections[sectionIndex - 1].id : null;
        
        // Generate new content
        setIsGenerating(true);
        
        try {
          // Update section status to writing
          await supabase
            .from('sections')
            .update({ 
              status: 'writing',
              updated_at: new Date().toISOString()
            })
            .eq('id', sectionId);
          
          // Refresh project details
          const writingProject = await orchestrationService.getProjectDetails(currentProject.id);
          setCurrentProject(writingProject);
          
          // Generate content
          await orchestrationService.generateSectionContent(
            updatedProject.id,
            sectionId,
            previousSectionId
          );
          
          // Update section status to completed
          await supabase
            .from('sections')
            .update({ 
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', sectionId);
          
          // Refresh project details
          const finalProject = await orchestrationService.getProjectDetails(currentProject.id);
          setCurrentProject(finalProject);
        } catch (error) {
          console.error(`Error regenerating content for section:`, error);
          
          // Update section status to error
          await supabase
            .from('sections')
            .update({ 
              status: 'error',
              updated_at: new Date().toISOString()
            })
            .eq('id', sectionId);
          
          // Refresh project details
          const errorProject = await orchestrationService.getProjectDetails(currentProject.id);
          setCurrentProject(errorProject);
          
          setError(`Error regenerating content: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
          setIsGenerating(false);
        }
      }
    } catch (error) {
      console.error('Failed to regenerate section:', error);
      setError(error instanceof Error ? error.message : 'Failed to regenerate section');
    }
  };

  const handleExport = async (format: 'pdf' | 'docx' | 'txt') => {
    if (!currentProject) return;

    try {
      // Record the export
      await orchestrationService.recordExport(currentProject.id, format);
      
      // Prepare document for export
      const document = {
        title: currentProject.title,
        sections: currentProject.sections.map(section => ({
          title: section.title,
          content: section.output?.raw_output || ''
        })),
        createdAt: new Date(currentProject.created_at),
        settings: {
          audience: currentProject.metadata?.audience || 'General audience',
          tone: currentProject.metadata?.tone || 'formal',
          purpose: currentProject.metadata?.purpose || 'informational',
          format: currentProject.metadata?.doc_type || 'document'
        },
        wordCount: currentProject.wordCount
      };
      
      // Export the document
      switch (format) {
        case 'pdf':
          await exportService.exportToPDF(document);
          break;
        case 'docx':
          await exportService.exportToWord(document);
          break;
        case 'txt':
          exportService.exportToText(document);
          break;
      }
    } catch (error) {
      console.error('Failed to export document:', error);
      setError(error instanceof Error ? error.message : 'Failed to export document');
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

  const getModelIcon = (modelId: string): string => {
    if (modelId.includes('claude')) return '🧠';
    if (modelId.includes('gpt')) return '🤖';
    if (modelId.includes('gemini')) return '💎';
    if (modelId.includes('llama')) return '🦙';
    if (modelId.includes('mistral')) return '🌪️';
    return '🤖';
  };

  const getProgressColor = (progress: number) => {
    if (progress < 25) return 'bg-red-500';
    if (progress < 50) return 'bg-orange-500';
    if (progress < 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (!isOpen) return null;

  // If user is not Pro, show upgrade message
  if (!isProUser) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
        <div className="bg-white rounded-xl w-full max-w-md p-6 transform animate-slideUp">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Crown size={20} className="text-yellow-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Pro Feature</h2>
                <p className="text-sm text-gray-500">Upgrade to access AI Orchestration</p>
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
            <div className="flex items-start space-x-3">
              <Zap className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="font-medium text-yellow-800 mb-1">AI Document Generator</h3>
                <p className="text-sm text-yellow-700">
                  This premium feature uses AI orchestration to generate comprehensive, long-form documents up to 30,000 characters.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center space-x-2 text-gray-700">
              <CheckCircle size={16} className="text-green-500" />
              <span>Generate complete documents with multiple AI models</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-700">
              <CheckCircle size={16} className="text-green-500" />
              <span>Export to PDF, Word, or plain text</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-700">
              <CheckCircle size={16} className="text-green-500" />
              <span>Customize tone, audience, and purpose</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-700">
              <CheckCircle size={16} className="text-green-500" />
              <span>Access to premium AI models</span>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
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
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg animate-bounceIn">
                <Zap size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">AI Document Generator</h2>
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
                        <select
                          value={settings.wordCount}
                          onChange={(e) => setSettings({ ...settings, wordCount: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value={1000}>Short (1,000 words)</option>
                          <option value={3000}>Medium (3,000 words)</option>
                          <option value={5000}>Standard (5,000 words)</option>
                          <option value={10000}>Long (10,000 words)</option>
                          <option value={20000}>Very Long (20,000 words)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Approximately {Math.round(settings.wordCount / 250)} pages</p>
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">Audience</label>
                        <select
                          value={settings.audience}
                          onChange={(e) => setSettings({ ...settings, audience: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="General audience">General Audience</option>
                          <option value="Professionals">Professionals</option>
                          <option value="Academics">Academics</option>
                          <option value="Students">Students</option>
                          <option value="Executives">Executives</option>
                          <option value="Technical experts">Technical Experts</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Purpose</label>
                      <select
                        value={settings.purpose}
                        onChange={(e) => setSettings({ ...settings, purpose: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="informational">Informational</option>
                        <option value="educational">Educational</option>
                        <option value="persuasive">Persuasive</option>
                        <option value="entertainment">Entertainment</option>
                        <option value="decision-making">Decision Making</option>
                        <option value="research">Research</option>
                      </select>
                    </div>
                  </div>
                </div>

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
                      >
                        <Pause size={16} />
                        <span>Pause</span>
                      </button>
                    )}
                    {currentProject.status === 'paused' && (
                      <button
                        onClick={handlePauseResume}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
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
                          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600 flex items-center space-x-1">
                            <span>{getModelIcon(section.assigned_model)}</span>
                            <span>{section.assigned_model.split('/').pop()}</span>
                          </span>
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
                          <span className="text-xs text-gray-500">{section.output ? orchestrationService.countWords(section.output.raw_output) : 0} words</span>
                        </div>
                      </div>

                      {section.output && (
                        <div className="prose prose-sm max-w-none mb-4">
                          <div className="text-gray-800 text-sm leading-relaxed">
                            {section.output.raw_output.substring(0, 500)}
                            {section.output.raw_output.length > 500 && '...'}
                          </div>
                        </div>
                      )}

                      {section.status === 'error' && (
                        <div className="flex space-x-2 mt-2">
                          <button
                            onClick={() => handleRegenerateSection(section.id)}
                            className="flex items-center space-x-1 px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 transition-colors"
                            disabled={isGenerating}
                          >
                            <RotateCcw size={14} />
                            <span>Retry</span>
                          </button>
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
                            <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded-full text-gray-600 flex items-center space-x-0.5 flex-shrink-0">
                              <span>{getModelIcon(section.assigned_model)}</span>
                              <span className="truncate max-w-[60px]">{section.assigned_model.split('/').pop()}</span>
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500">{section.output ? orchestrationService.countWords(section.output.raw_output) : 0} words</span>
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
                            {section.output.raw_output}
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
                                {section.output.raw_output}
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
                    {[
                      { format: 'pdf', label: 'PDF', icon: FileText, description: 'Portable Document Format' },
                      { format: 'docx', label: 'Word', icon: FileCheck, description: 'Microsoft Word Document' },
                      { format: 'txt', label: 'Text', icon: FileText, description: 'Plain Text File' }
                    ].map(({ format, label, icon: Icon, description }) => (
                      <button
                        key={format}
                        onClick={() => handleExport(format as any)}
                        className="flex flex-col items-center space-y-2 p-4 border border-gray-200 rounded-lg hover:bg-white hover:shadow-md transition-all duration-200 hover:scale-105"
                      >
                        <Icon size={24} className="text-emerald-600" />
                        <span className="text-sm font-medium">{label}</span>
                        <span className="text-xs text-gray-500 text-center">{description}</span>
                      </button>
                    ))}
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
                    New Project
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
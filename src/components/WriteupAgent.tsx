import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Brain, CheckCircle, AlertCircle, Clock, Play, Pause, Download, Eye, Edit, RotateCcw, Zap, Target, Users, Shield, DollarSign, Sparkles, BookOpen, FileCheck, Layers, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { writeupService } from '../services/writeupService';

interface WriteupAgentProps {
  isOpen: boolean;
  onClose: () => void;
}

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

export const WriteupAgent: React.FC<WriteupAgentProps> = ({ isOpen, onClose }) => {
  const { user, getCurrentTier } = useAuth();
  const [step, setStep] = useState<'setup' | 'planning' | 'writing' | 'review' | 'completed'>('setup');
  const [currentProject, setCurrentProject] = useState<WriteupProject | null>(null);
  const [projects, setProjects] = useState<WriteupProject[]>([]);
  const [prompt, setPrompt] = useState('');
  const [settings, setSettings] = useState<WriteupSettings>({
    targetLength: 'medium',
    style: 'academic',
    tone: 'formal',
    format: 'research-paper',
    includeReferences: true,
    enableReview: true,
    euModelsOnly: false
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showFullDocument, setShowFullDocument] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentTier = getCurrentTier();
  const isProUser = currentTier === 'tier2';

  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [currentProject?.sections]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadProjects = async () => {
    try {
      const userProjects = await writeupService.getUserProjects();
      setProjects(userProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const handleStartProject = async () => {
    if (!user) {
      setError('Please sign in to use Write-up Agent');
      return;
    }

    if (!prompt.trim()) {
      setError('Please enter a prompt for your write-up');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setStep('planning');

    try {
      const project = await writeupService.createProject({
        prompt: prompt.trim(),
        settings,
        userTier: currentTier
      });

      setCurrentProject(project);
      setStep('writing');
      
      // Start the writing process
      await startWritingProcess(project);
    } catch (error) {
      console.error('Failed to start project:', error);
      setError(error instanceof Error ? error.message : 'Failed to start project');
      setStep('setup');
    } finally {
      setIsGenerating(false);
    }
  };

  const startWritingProcess = async (project: WriteupProject) => {
    try {
      setIsGenerating(true);
      
      // Start the orchestrated writing process
      await writeupService.startWriting(project.id, (updatedProject) => {
        setCurrentProject(updatedProject);
        
        if (updatedProject.status === 'completed') {
          setStep('completed');
          setIsGenerating(false);
        } else if (updatedProject.status === 'error') {
          setError('An error occurred during writing');
          setIsGenerating(false);
        }
      });
    } catch (error) {
      console.error('Writing process failed:', error);
      setError(error instanceof Error ? error.message : 'Writing process failed');
      setIsGenerating(false);
    }
  };

  const handlePauseResume = async () => {
    if (!currentProject) return;

    try {
      if (currentProject.status === 'writing') {
        await writeupService.pauseProject(currentProject.id);
        setCurrentProject({ ...currentProject, status: 'paused' });
        setIsGenerating(false);
      } else if (currentProject.status === 'paused') {
        setIsGenerating(true);
        await startWritingProcess(currentProject);
      }
    } catch (error) {
      console.error('Failed to pause/resume project:', error);
      setError(error instanceof Error ? error.message : 'Failed to pause/resume project');
    }
  };

  const handleSectionAction = async (sectionId: string, action: 'accept' | 'edit' | 'regenerate') => {
    if (!currentProject) return;

    try {
      await writeupService.handleSectionAction(currentProject.id, sectionId, action);
      // Reload project to get updated state
      const updatedProject = await writeupService.getProject(currentProject.id);
      setCurrentProject(updatedProject);
    } catch (error) {
      console.error('Failed to handle section action:', error);
      setError(error instanceof Error ? error.message : 'Failed to process section action');
    }
  };

  const handleExport = async (format: 'pdf' | 'docx' | 'txt') => {
    if (!currentProject) return;

    try {
      await writeupService.exportProject(currentProject.id, format);
    } catch (error) {
      console.error('Failed to export project:', error);
      setError(error instanceof Error ? error.message : 'Failed to export project');
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

  const getTargetWordCount = () => {
    switch (settings.targetLength) {
      case 'short': return '25,000 - 50,000 words (100-200 pages)';
      case 'medium': return '50,000 - 100,000 words (200-400 pages)';
      case 'long': return '100,000 - 150,000 words (400-600 pages)';
      case 'custom': return `${settings.customWordCount?.toLocaleString() || 0} words`;
      default: return '50,000 - 100,000 words';
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress < 25) return 'bg-red-500';
    if (progress < 50) return 'bg-orange-500';
    if (progress < 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getModelIcon = (modelProvider?: string) => {
    if (modelProvider === 'openrouter') return '🔀';
    return '🤖';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden transform animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg animate-bounceIn">
                <FileText size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Write-up Agent</h2>
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

          {/* Progress Bar */}
          {currentProject && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span>{currentProject.title}</span>
                <span>{currentProject.progress}% Complete</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${getProgressColor(currentProject.progress)}`}
                  style={{ width: `${currentProject.progress}%` }}
                />
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
                    <span>AI-Orchestrated Long-Form Writing</span>
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">Target Length</label>
                        <select
                          value={settings.targetLength}
                          onChange={(e) => setSettings({ ...settings, targetLength: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="short">Short (100-200 pages)</option>
                          <option value="medium">Medium (200-400 pages)</option>
                          <option value="long">Long (400-600 pages)</option>
                          <option value="custom">Custom Length</option>
                        </select>
                        {settings.targetLength === 'custom' && (
                          <input
                            type="number"
                            value={settings.customWordCount || ''}
                            onChange={(e) => setSettings({ ...settings, customWordCount: parseInt(e.target.value) || 0 })}
                            placeholder="Target word count"
                            className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        )}
                        <p className="text-xs text-gray-500 mt-1">{getTargetWordCount()}</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Document Format</label>
                        <select
                          value={settings.format}
                          onChange={(e) => setSettings({ ...settings, format: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="research-paper">Research Paper</option>
                          <option value="report">Business Report</option>
                          <option value="novel">Novel/Fiction</option>
                          <option value="article">Article/Blog</option>
                          <option value="manual">Technical Manual</option>
                          <option value="proposal">Project Proposal</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Writing Style</label>
                        <select
                          value={settings.style}
                          onChange={(e) => setSettings({ ...settings, style: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="academic">Academic</option>
                          <option value="business">Business</option>
                          <option value="creative">Creative</option>
                          <option value="technical">Technical</option>
                          <option value="journalistic">Journalistic</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
                        <select
                          value={settings.tone}
                          onChange={(e) => setSettings({ ...settings, tone: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="formal">Formal</option>
                          <option value="casual">Casual</option>
                          <option value="persuasive">Persuasive</option>
                          <option value="informative">Informative</option>
                          <option value="engaging">Engaging</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={settings.includeReferences}
                          onChange={(e) => setSettings({ ...settings, includeReferences: e.target.checked })}
                          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-gray-700">Include references and citations</span>
                      </label>

                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={settings.enableReview}
                          onChange={(e) => setSettings({ ...settings, enableReview: e.target.checked })}
                          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-gray-700">Enable AI review and refinement</span>
                      </label>

                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={settings.euModelsOnly}
                          onChange={(e) => setSettings({ ...settings, euModelsOnly: e.target.checked })}
                          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-gray-700 flex items-center space-x-1">
                          <Globe size={14} />
                          <span>Use EU-hosted models only (GDPR compliance)</span>
                        </span>
                      </label>
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
                        <span>Start Writing Project</span>
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
                      {currentProject.wordCount.toLocaleString()} words • {currentProject.estimatedPages} pages • {currentProject.status}
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
                          {section.modelProvider && (
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600 flex items-center space-x-1">
                              <span>{getModelIcon(section.modelProvider)}</span>
                              <span>{section.modelProvider === 'openrouter' ? 'OpenRouter' : section.model}</span>
                            </span>
                          )}
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
                          <span className="text-xs text-gray-500">{section.wordCount} words</span>
                        </div>
                      </div>

                      {section.content && (
                        <div className="prose prose-sm max-w-none mb-4">
                          <div className="text-gray-800 text-sm leading-relaxed">
                            {section.content.substring(0, 500)}
                            {section.content.length > 500 && '...'}
                          </div>
                        </div>
                      )}

                      {section.status === 'completed' && step === 'review' && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleSectionAction(section.id, 'accept')}
                            className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
                          >
                            <CheckCircle size={14} />
                            <span>Accept</span>
                          </button>
                          <button
                            onClick={() => handleSectionAction(section.id, 'edit')}
                            className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                          >
                            <Edit size={14} />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleSectionAction(section.id, 'regenerate')}
                            className="flex items-center space-x-1 px-3 py-1 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 transition-colors"
                          >
                            <RotateCcw size={14} />
                            <span>Regenerate</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {isGenerating && (
                    <div className="text-center py-8">
                      <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-gray-600">AI is working on your document...</p>
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
                            {section.modelProvider && (
                              <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded-full text-gray-600 flex items-center space-x-0.5 flex-shrink-0">
                                <span>{getModelIcon(section.modelProvider)}</span>
                                <span className="truncate max-w-[60px]">{section.model.split('/').pop()}</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500">{section.wordCount} words</span>
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
                        
                        {expandedSections.has(section.id) && (
                          <div className="text-xs text-gray-700 leading-relaxed max-h-40 overflow-y-auto">
                            {section.content}
                          </div>
                        )}
                        
                        {!expandedSections.has(section.id) && (
                          <div className="text-xs text-gray-600">
                            {section.content.substring(0, 150)}...
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
                            <div className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                              {section.content}
                            </div>
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
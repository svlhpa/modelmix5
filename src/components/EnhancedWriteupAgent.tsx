import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Brain, CheckCircle, AlertCircle, Clock, Play, Pause, Download, Eye, Edit, RotateCcw, Zap, Target, Users, Shield, DollarSign, Sparkles, BookOpen, FileCheck, Layers, Globe, ChevronDown, ChevronUp, Bot, Crown, Workflow, Network } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { picaosService, PicaosProject, PicaosSection, PicaosSettings } from '../services/picaosService';

interface EnhancedWriteupAgentProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EnhancedWriteupAgent: React.FC<EnhancedWriteupAgentProps> = ({ isOpen, onClose }) => {
  const { user, getCurrentTier } = useAuth();
  const [step, setStep] = useState<'setup' | 'planning' | 'orchestrating' | 'monitoring' | 'completed'>('setup');
  const [currentProject, setCurrentProject] = useState<PicaosProject | null>(null);
  const [projects, setProjects] = useState<PicaosProject[]>([]);
  const [prompt, setPrompt] = useState('');
  const [settings, setSettings] = useState<PicaosSettings>({
    targetLength: 'medium',
    style: 'academic',
    tone: 'formal',
    format: 'research-paper',
    includeReferences: true,
    enableQualityReview: true,
    maxIterations: 3
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showFullDocument, setShowFullDocument] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentTier = getCurrentTier();
  const isProUser = currentTier === 'tier2';

  useEffect(() => {
    if (isOpen) {
      loadProjects();
      checkPicaosConnection();
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
      const userProjects = await picaosService.getUserProjects();
      setProjects(userProjects);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const checkPicaosConnection = async () => {
    setConnectionStatus('checking');
    try {
      const isConnected = await picaosService.testConnection(currentTier);
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
    } catch (error) {
      console.error('PicaOS connection check failed:', error);
      setConnectionStatus('disconnected');
    }
  };

  const handleStartProject = async () => {
    if (!user) {
      setError('Please sign in to use Enhanced Write-up Agent');
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
      const project = await picaosService.createProject({
        prompt: prompt.trim(),
        settings,
        userTier: currentTier
      });

      setCurrentProject(project);
      setStep('orchestrating');
      
      // Start the PicaOS orchestration process
      await startOrchestration(project);
    } catch (error) {
      console.error('Failed to start project:', error);
      setError(error instanceof Error ? error.message : 'Failed to start project');
      setStep('setup');
    } finally {
      setIsGenerating(false);
    }
  };

  const startOrchestration = async (project: PicaosProject) => {
    try {
      setIsGenerating(true);
      setStep('monitoring');
      
      // Start the PicaOS orchestration with real-time updates
      await picaosService.startOrchestration(project.id, (updatedProject) => {
        console.log('PicaOS orchestration progress:', {
          progress: updatedProject.progress,
          status: updatedProject.status,
          completedSections: updatedProject.sections.filter(s => s.status === 'completed').length,
          totalSections: updatedProject.sections.length,
          wordCount: updatedProject.wordCount
        });
        
        // Update the current project state immediately
        setCurrentProject(updatedProject);
        
        if (updatedProject.status === 'completed') {
          setStep('completed');
          setIsGenerating(false);
        } else if (updatedProject.status === 'error') {
          setError('An error occurred during orchestration');
          setIsGenerating(false);
        }
      });
    } catch (error) {
      console.error('PicaOS orchestration failed:', error);
      setError(error instanceof Error ? error.message : 'Orchestration process failed');
      setIsGenerating(false);
    }
  };

  const handlePauseResume = async () => {
    if (!currentProject) return;

    try {
      if (currentProject.status === 'writing') {
        await picaosService.pauseProject(currentProject.id);
        setCurrentProject({ ...currentProject, status: 'planning' });
        setIsGenerating(false);
      } else if (currentProject.status === 'planning') {
        setIsGenerating(true);
        await startOrchestration(currentProject);
      }
    } catch (error) {
      console.error('Failed to pause/resume project:', error);
      setError(error instanceof Error ? error.message : 'Failed to pause/resume project');
    }
  };

  const handleExport = async (format: 'pdf' | 'docx' | 'txt') => {
    if (!currentProject) return;

    try {
      await picaosService.exportProject(currentProject.id, format);
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

  const getSectionStatusIcon = (section: PicaosSection) => {
    switch (section.status) {
      case 'completed':
        return <CheckCircle size={16} className="text-green-600" />;
      case 'writing':
        return <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>;
      case 'error':
        return <AlertCircle size={16} className="text-red-600" />;
      default:
        return <Clock size={16} className="text-gray-400" />;
    }
  };

  if (!isOpen) return null;

  // Pro-only check
  if (!isProUser) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
        <div className="bg-white rounded-xl max-w-md w-full p-6 text-center transform animate-slideUp">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Crown size={32} className="text-yellow-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Pro Feature</h2>
          <p className="text-gray-600 mb-6">
            Enhanced Write-up Agent with PicaOS orchestration is available exclusively to Pro tier users. Upgrade to Pro to access advanced multi-agent writing capabilities.
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
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
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg animate-bounceIn">
                <Bot size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Enhanced Write-up Agent</h2>
                <p className="text-purple-100">Powered by PicaOS multi-agent orchestration</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* Connection Status */}
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                connectionStatus === 'connected' ? 'bg-green-500/20 text-green-100' :
                connectionStatus === 'disconnected' ? 'bg-red-500/20 text-red-100' :
                'bg-yellow-500/20 text-yellow-100'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-400' :
                  connectionStatus === 'disconnected' ? 'bg-red-400' :
                  'bg-yellow-400 animate-pulse'
                }`}></div>
                <span>
                  {connectionStatus === 'connected' ? 'PicaOS Connected' :
                   connectionStatus === 'disconnected' ? 'PicaOS Offline' :
                   'Checking...'}
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/20 transition-all duration-200 hover:scale-110"
                disabled={isGenerating}
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Enhanced Progress Bar with Multi-Agent Status */}
          {currentProject && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span>{currentProject.title}</span>
                <div className="flex items-center space-x-4">
                  <span>{currentProject.progress}% Complete</span>
                  <span className="text-purple-200">
                    {currentProject.sections.filter(s => s.status === 'completed').length} / {currentProject.sections.length} sections
                  </span>
                  <span className="text-purple-200">
                    {currentProject.wordCount.toLocaleString()} words
                  </span>
                  {currentProject.status === 'writing' && (
                    <div className="flex items-center space-x-2">
                      <Network size={14} className="text-purple-200" />
                      <span className="text-purple-200">Multi-agent active</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ease-out ${getProgressColor(currentProject.progress)}`}
                  style={{ width: `${currentProject.progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs mt-2 text-purple-200">
                <span>Status: {currentProject.status}</span>
                {isGenerating && (
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <span>PicaOS orchestrating...</span>
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
                {/* PicaOS Features Overview */}
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-purple-800 mb-4 flex items-center space-x-2">
                    <Bot className="text-purple-600" size={20} />
                    <span>PicaOS Multi-Agent Orchestration</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-start space-x-3">
                      <Workflow className="text-purple-600 flex-shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="font-medium text-purple-800">Intelligent Planning</p>
                        <p className="text-purple-700">AI orchestrator creates optimal multi-agent workflows</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Network className="text-purple-600 flex-shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="font-medium text-purple-800">Parallel Processing</p>
                        <p className="text-purple-700">Multiple AI models work simultaneously on different sections</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Target className="text-purple-600 flex-shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="font-medium text-purple-800">Quality Assurance</p>
                        <p className="text-purple-700">Dedicated reviewer agents ensure consistency and quality</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Zap className="text-purple-600 flex-shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="font-medium text-purple-800">Adaptive Coordination</p>
                        <p className="text-purple-700">Real-time coordination and dependency management</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Connection Status Alert */}
                {connectionStatus === 'disconnected' && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={16} />
                      <div>
                        <h4 className="font-medium text-amber-800 mb-1">PicaOS Connection Required</h4>
                        <p className="text-sm text-amber-700 mb-3">
                          Enhanced Write-up Agent requires a connection to PicaOS for multi-agent orchestration. The system will fall back to local processing if PicaOS is unavailable.
                        </p>
                        <button
                          onClick={checkPicaosConnection}
                          className="flex items-center space-x-2 px-3 py-1 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm"
                        >
                          <RotateCcw size={14} />
                          <span>Retry Connection</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Project Setup */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Configuration</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Project Prompt *
                      </label>
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe your writing project in detail. The more specific you are, the better the AI orchestration will be..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                            className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        )}
                        <p className="text-xs text-gray-500 mt-1">{getTargetWordCount()}</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Document Format</label>
                        <select
                          value={settings.format}
                          onChange={(e) => setSettings({ ...settings, format: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Include references and citations</span>
                      </label>

                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={settings.enableQualityReview}
                          onChange={(e) => setSettings({ ...settings, enableQualityReview: e.target.checked })}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Enable multi-agent quality review</span>
                      </label>

                      <div className="flex items-center space-x-4">
                        <label className="text-sm text-gray-700">Max iterations per section:</label>
                        <select
                          value={settings.maxIterations}
                          onChange={(e) => setSettings({ ...settings, maxIterations: parseInt(e.target.value) })}
                          className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value={1}>1</option>
                          <option value={2}>2</option>
                          <option value={3}>3</option>
                          <option value={5}>5</option>
                        </select>
                      </div>
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
                    className="flex items-center space-x-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 transform"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Initializing...</span>
                      </>
                    ) : (
                      <>
                        <Bot size={16} />
                        <span>Start PicaOS Orchestration</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {(step === 'planning' || step === 'orchestrating' || step === 'monitoring') && currentProject && (
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
                    {currentProject.status === 'planning' && (
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

              {/* Multi-Agent Section Status */}
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
                          <span className="text-xs bg-purple-100 px-2 py-0.5 rounded-full text-purple-600 flex items-center space-x-1">
                            <Bot size={10} />
                            <span>{section.assignedModel}</span>
                          </span>
                          {section.qualityScore && (
                            <span className="text-xs bg-green-100 px-2 py-0.5 rounded-full text-green-600">
                              Quality: {Math.round(section.qualityScore * 100)}%
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          {getSectionStatusIcon(section)}
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

                      {section.status === 'writing' && (
                        <div className="flex items-center space-x-2 text-sm text-blue-600">
                          <Network size={14} />
                          <span>Agent {section.assignedModel} is writing...</span>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {isGenerating && (
                    <div className="text-center py-8">
                      <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-gray-600">PicaOS orchestration in progress...</p>
                      {currentProject && (
                        <div className="mt-2 text-sm text-gray-500">
                          <p>Multi-agent coordination active</p>
                          <p>{currentProject.wordCount.toLocaleString()} words generated so far</p>
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
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Orchestration Complete!</h3>
                  <p className="text-gray-600 mb-6">
                    Your {currentProject.wordCount.toLocaleString()}-word document has been generated using PicaOS multi-agent orchestration.
                  </p>
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
                        <Icon size={24} className="text-purple-600" />
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
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
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
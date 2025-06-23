import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Brain, CheckCircle, AlertCircle, Clock, Play, Pause, Download, Eye, Edit, RotateCcw, Zap, Target, Users, Shield, DollarSign, BookOpen, FileCheck, Layers, Globe, ChevronDown, ChevronUp, Bot, Network, FileText } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { picaosService } from '../services/picaosService';

interface ContentCreationAgentProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ContentProject {
  id: string;
  title: string;
  prompt: string;
  status: 'planning' | 'drafting' | 'refining' | 'reviewing' | 'completed' | 'error';
  progress: number;
  currentDraft: number;
  totalDrafts: number;
  content: string;
  wordCount: number;
  createdAt: Date;
  updatedAt: Date;
  settings: ContentSettings;
  draftHistory: ContentDraft[];
  feedback: string[];
}

interface ContentDraft {
  id: string;
  version: number;
  content: string;
  wordCount: number;
  createdAt: Date;
  model: string;
  feedback: string;
}

interface ContentSettings {
  contentType: 'blog' | 'article' | 'whitepaper' | 'social' | 'email' | 'custom';
  tone: 'professional' | 'casual' | 'persuasive' | 'informative' | 'entertaining';
  targetAudience: string;
  seoOptimize: boolean;
  includeCta: boolean;
  targetLength: 'short' | 'medium' | 'long';
  keywords: string[];
}

export const ContentCreationAgent: React.FC<ContentCreationAgentProps> = ({ isOpen, onClose }) => {
  const { user, getCurrentTier } = useAuth();
  const [step, setStep] = useState<'setup' | 'creating' | 'completed'>('setup');
  const [prompt, setPrompt] = useState('');
  const [settings, setSettings] = useState<ContentSettings>({
    contentType: 'blog',
    tone: 'professional',
    targetAudience: '',
    seoOptimize: true,
    includeCta: true,
    targetLength: 'medium',
    keywords: []
  });
  const [currentKeyword, setCurrentKeyword] = useState('');
  const [currentProject, setCurrentProject] = useState<ContentProject | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [showDraftHistory, setShowDraftHistory] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<ContentDraft | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentTier = getCurrentTier();
  const isProUser = currentTier === 'tier2';

  useEffect(() => {
    if (isOpen) {
      checkPicaosConnection();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [currentProject?.draftHistory]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const handleAddKeyword = () => {
    if (currentKeyword.trim() && !settings.keywords.includes(currentKeyword.trim())) {
      setSettings({
        ...settings,
        keywords: [...settings.keywords, currentKeyword.trim()]
      });
      setCurrentKeyword('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setSettings({
      ...settings,
      keywords: settings.keywords.filter(k => k !== keyword)
    });
  };

  const handleStartProject = async () => {
    if (!user) {
      setError('Please sign in to use Content Creation Agent');
      return;
    }

    if (!prompt.trim()) {
      setError('Please enter a content prompt');
      return;
    }

    if (settings.seoOptimize && settings.keywords.length === 0) {
      setError('Please add at least one keyword for SEO optimization');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setStep('creating');

    try {
      // Initialize a new content project
      const project: ContentProject = {
        id: `content-${Date.now()}`,
        title: generateTitle(prompt),
        prompt: prompt.trim(),
        status: 'planning',
        progress: 0,
        currentDraft: 0,
        totalDrafts: 3,
        content: '',
        wordCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        settings,
        draftHistory: [],
        feedback: []
      };
      
      setCurrentProject(project);
      
      // Simulate the content creation process
      await simulateContentCreation(project);
      
    } catch (error) {
      console.error('Content creation process failed:', error);
      setError(error instanceof Error ? error.message : 'Content creation process failed');
      if (currentProject) {
        currentProject.status = 'error';
        setCurrentProject({...currentProject});
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const simulateContentCreation = async (project: ContentProject) => {
    // Step 1: Planning phase
    project.status = 'planning';
    project.progress = 5;
    setCurrentProject({...project});
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 2: First draft
    project.status = 'drafting';
    project.progress = 20;
    project.currentDraft = 1;
    
    const firstDraft: ContentDraft = {
      id: `draft-${Date.now()}-1`,
      version: 1,
      content: generateMockContent(project.prompt, project.settings, 1),
      wordCount: calculateWordCount(1, project.settings),
      createdAt: new Date(),
      model: 'GPT-4o',
      feedback: 'Initial draft created. Needs refinement for tone and structure.'
    };
    
    project.draftHistory.push(firstDraft);
    project.content = firstDraft.content;
    project.wordCount = firstDraft.wordCount;
    
    setCurrentProject({...project});
    await new Promise(resolve => setTimeout(resolve, 4000));
    
    // Step 3: Refinement phase
    project.status = 'refining';
    project.progress = 50;
    project.currentDraft = 2;
    project.feedback.push('Improve the introduction to better hook the reader');
    project.feedback.push('Add more specific examples in the middle section');
    
    const secondDraft: ContentDraft = {
      id: `draft-${Date.now()}-2`,
      version: 2,
      content: generateMockContent(project.prompt, project.settings, 2),
      wordCount: calculateWordCount(2, project.settings),
      createdAt: new Date(),
      model: 'Claude 3.5 Sonnet',
      feedback: 'Improved structure and flow. Enhanced introduction and added examples.'
    };
    
    project.draftHistory.push(secondDraft);
    project.content = secondDraft.content;
    project.wordCount = secondDraft.wordCount;
    
    setCurrentProject({...project});
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 4: Review phase
    project.status = 'reviewing';
    project.progress = 80;
    project.currentDraft = 3;
    project.feedback.push('Optimize for SEO with better keyword placement');
    project.feedback.push('Strengthen the call-to-action at the end');
    
    const finalDraft: ContentDraft = {
      id: `draft-${Date.now()}-3`,
      version: 3,
      content: generateMockContent(project.prompt, project.settings, 3),
      wordCount: calculateWordCount(3, project.settings),
      createdAt: new Date(),
      model: 'GPT-4o',
      feedback: 'Final version with SEO optimization and strong CTA. Ready for publication.'
    };
    
    project.draftHistory.push(finalDraft);
    project.content = finalDraft.content;
    project.wordCount = finalDraft.wordCount;
    
    setCurrentProject({...project});
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 5: Completion
    project.status = 'completed';
    project.progress = 100;
    setCurrentProject({...project});
    setStep('completed');
  };

  const generateTitle = (prompt: string): string => {
    // Extract a title from the prompt
    const words = prompt.split(' ').slice(0, 8);
    return words.join(' ').replace(/[^\w\s]/g, '').trim();
  };

  const calculateWordCount = (draftVersion: number, settings: ContentSettings): number => {
    // Calculate word count based on settings and draft version
    let baseCount = 0;
    
    switch (settings.targetLength) {
      case 'short':
        baseCount = 500;
        break;
      case 'medium':
        baseCount = 1200;
        break;
      case 'long':
        baseCount = 2500;
        break;
    }
    
    // Each draft gets slightly longer
    const multiplier = 1 + (draftVersion - 1) * 0.15;
    
    return Math.round(baseCount * multiplier);
  };

  const generateMockContent = (prompt: string, settings: ContentSettings, draftVersion: number): string => {
    const wordCount = calculateWordCount(draftVersion, settings);
    const paragraphCount = Math.max(3, Math.round(wordCount / 200));
    
    let content = '';
    
    // Generate title
    content += `# ${generateTitle(prompt)}\n\n`;
    
    // Generate introduction
    if (draftVersion >= 2) {
      content += `## Introduction\n\n`;
    }
    
    content += generateLoremIpsum(Math.round(wordCount * 0.2));
    content += '\n\n';
    
    // Generate main content sections
    const sectionCount = Math.max(2, Math.round(paragraphCount / 2));
    
    for (let i = 0; i < sectionCount; i++) {
      if (draftVersion >= 2) {
        content += `## ${getRandomSectionTitle(prompt, i)}\n\n`;
      }
      
      content += generateLoremIpsum(Math.round(wordCount * 0.6 / sectionCount));
      content += '\n\n';
    }
    
    // Generate conclusion
    if (draftVersion >= 2) {
      content += `## Conclusion\n\n`;
    }
    
    content += generateLoremIpsum(Math.round(wordCount * 0.2));
    content += '\n\n';
    
    // Add CTA if enabled
    if (settings.includeCta && draftVersion >= 2) {
      content += `---\n\n`;
      content += `**Ready to take the next step?** [Contact us today](#) to learn more about how we can help you with ${prompt.split(' ').slice(0, 3).join(' ')}.\n\n`;
    }
    
    // Add SEO keywords if enabled
    if (settings.seoOptimize && settings.keywords.length > 0 && draftVersion >= 3) {
      // Sprinkle keywords throughout the content
      content = settings.keywords.reduce((text, keyword) => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        if (!regex.test(text)) {
          // If keyword doesn't exist, add it somewhere
          const sentences = text.split('. ');
          if (sentences.length > 3) {
            const randomIndex = Math.floor(Math.random() * (sentences.length - 2)) + 1;
            sentences[randomIndex] = sentences[randomIndex].replace(/\b\w+\b/, keyword);
            return sentences.join('. ');
          }
        }
        return text;
      }, content);
    }
    
    return content;
  };

  const generateLoremIpsum = (wordCount: number): string => {
    const loremIpsum = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?`;
    
    const words = loremIpsum.split(' ');
    let result = '';
    
    // Generate enough words by repeating the lorem ipsum text
    for (let i = 0; i < wordCount; i += words.length) {
      result += loremIpsum + ' ';
    }
    
    // Trim to exact word count
    return result.split(' ').slice(0, wordCount).join(' ');
  };

  const getRandomSectionTitle = (prompt: string, index: number): string => {
    const sectionTitles = [
      `Understanding ${prompt.split(' ').slice(0, 3).join(' ')}`,
      `Key Benefits of ${prompt.split(' ').slice(0, 2).join(' ')}`,
      `How to Implement ${prompt.split(' ').slice(0, 2).join(' ')}`,
      `Best Practices for ${prompt.split(' ').slice(0, 2).join(' ')}`,
      `Common Challenges with ${prompt.split(' ').slice(0, 2).join(' ')}`,
      `Future Trends in ${prompt.split(' ').slice(0, 2).join(' ')}`,
      `Case Studies: ${prompt.split(' ').slice(0, 3).join(' ')}`,
      `Expert Insights on ${prompt.split(' ').slice(0, 2).join(' ')}`
    ];
    
    return sectionTitles[index % sectionTitles.length];
  };

  const handleExport = async (format: 'pdf' | 'docx' | 'txt') => {
    if (!currentProject) return;

    try {
      // In a real implementation, this would call an export service
      alert(`Exporting content in ${format.toUpperCase()} format`);
    } catch (error) {
      console.error('Failed to export content:', error);
      setError(error instanceof Error ? error.message : 'Failed to export content');
    }
  };

  const handleSelectDraft = (draft: ContentDraft) => {
    setSelectedDraft(draft);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden transform animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg animate-bounceIn">
                <Sparkles size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Content Creation Agent</h2>
                <p className="text-purple-100">Multi-agent content creation with PicaOS orchestration</p>
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

          {/* Progress Bar */}
          {currentProject && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span>{currentProject.title}</span>
                <div className="flex items-center space-x-4">
                  <span>{currentProject.progress}% Complete</span>
                  <span className="text-purple-200">
                    Draft {currentProject.currentDraft}/{currentProject.totalDrafts}
                  </span>
                  <span className="text-purple-200">
                    {currentProject.wordCount} words
                  </span>
                </div>
              </div>
              <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ease-out ${
                    currentProject.progress < 25 ? 'bg-red-500' :
                    currentProject.progress < 50 ? 'bg-orange-500' :
                    currentProject.progress < 75 ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${currentProject.progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs mt-2 text-purple-200">
                <span>Status: {currentProject.status}</span>
                {isGenerating && (
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <span>Content creation in progress...</span>
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
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-purple-800 mb-4 flex items-center space-x-2">
                    <Bot className="text-purple-600" size={20} />
                    <span>PicaOS Content Creation</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-start space-x-3">
                      <Sparkles className="text-purple-600 flex-shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="font-medium text-purple-800">Multi-Draft Refinement</p>
                        <p className="text-purple-700">Iterative improvement through multiple drafts</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Target className="text-purple-600 flex-shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="font-medium text-purple-800">SEO Optimization</p>
                        <p className="text-purple-700">Strategic keyword placement and optimization</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Brain className="text-purple-600 flex-shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="font-medium text-purple-800">Self-Critique</p>
                        <p className="text-purple-700">AI reviews and improves its own content</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Network className="text-purple-600 flex-shrink-0 mt-0.5" size={16} />
                      <div>
                        <p className="font-medium text-purple-800">Multi-Agent Collaboration</p>
                        <p className="text-purple-700">Different models handle specialized aspects</p>
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
                          Content Creation Agent requires a connection to PicaOS for multi-agent orchestration. The system will fall back to local processing if PicaOS is unavailable.
                        </p>
                        <button
                          onClick={checkPicaosConnection}
                          className="flex items-center space-x-2 px-3 py-1 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm"
                        >
                          <RefreshCw size={14} />
                          <span>Retry Connection</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Content Setup */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Content Configuration</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Content Brief *
                      </label>
                      <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Describe the content you want to create. Include topic, purpose, and any specific requirements..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                        rows={4}
                        maxLength={1000}
                      />
                      <p className="text-xs text-gray-500 mt-1">{prompt.length}/1000 characters</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Content Type</label>
                        <select
                          value={settings.contentType}
                          onChange={(e) => setSettings({ ...settings, contentType: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="blog">Blog Post</option>
                          <option value="article">Article</option>
                          <option value="whitepaper">White Paper</option>
                          <option value="social">Social Media</option>
                          <option value="email">Email Campaign</option>
                          <option value="custom">Custom</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
                        <select
                          value={settings.tone}
                          onChange={(e) => setSettings({ ...settings, tone: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="professional">Professional</option>
                          <option value="casual">Casual</option>
                          <option value="persuasive">Persuasive</option>
                          <option value="informative">Informative</option>
                          <option value="entertaining">Entertaining</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Target Length</label>
                        <select
                          value={settings.targetLength}
                          onChange={(e) => setSettings({ ...settings, targetLength: e.target.value as any })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="short">Short (300-500 words)</option>
                          <option value="medium">Medium (800-1500 words)</option>
                          <option value="long">Long (2000+ words)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Target Audience</label>
                        <input
                          type="text"
                          value={settings.targetAudience}
                          onChange={(e) => setSettings({ ...settings, targetAudience: e.target.value })}
                          placeholder="e.g., Marketing professionals, Tech enthusiasts, etc."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Keywords (for SEO)</label>
                      <div className="flex space-x-2 mb-2">
                        <input
                          type="text"
                          value={currentKeyword}
                          onChange={(e) => setCurrentKeyword(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddKeyword()}
                          placeholder="Add keyword and press Enter"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <button
                          onClick={handleAddKeyword}
                          className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          Add
                        </button>
                      </div>
                      
                      {settings.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {settings.keywords.map((keyword, index) => (
                            <span 
                              key={index} 
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
                            >
                              {keyword}
                              <button
                                onClick={() => handleRemoveKeyword(keyword)}
                                className="ml-1 text-purple-600 hover:text-purple-800"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={settings.seoOptimize}
                          onChange={(e) => setSettings({ ...settings, seoOptimize: e.target.checked })}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Optimize for SEO</span>
                      </label>

                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={settings.includeCta}
                          onChange={(e) => setSettings({ ...settings, includeCta: e.target.checked })}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Include call-to-action</span>
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
                    disabled={!prompt.trim() || isGenerating || (settings.seoOptimize && settings.keywords.length === 0)}
                    className="flex items-center space-x-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 transform"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Initializing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        <span>Start Content Creation</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'creating' && currentProject && (
            <div className="h-full flex flex-col">
              {/* Project Info */}
              <div className="bg-gray-50 border-b border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{currentProject.title}</h3>
                    <p className="text-sm text-gray-600">
                      {currentProject.wordCount} words • Draft {currentProject.currentDraft}/{currentProject.totalDrafts} • {currentProject.status}
                    </p>
                  </div>
                </div>
              </div>

              {/* Content Creation Process */}
              <div className="flex-1 overflow-y-auto">
                <div className="flex h-full">
                  {/* Left panel - Draft history */}
                  <div className="w-1/3 border-r border-gray-200 p-4 overflow-y-auto">
                    <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center space-x-2">
                      <Clock size={18} className="text-purple-600" />
                      <span>Draft History</span>
                    </h4>
                    
                    <div className="space-y-3">
                      {currentProject.draftHistory.map((draft) => (
                        <div
                          key={draft.id}
                          className={`border rounded-lg p-3 cursor-pointer transition-all duration-200 hover:shadow-md ${
                            selectedDraft?.id === draft.id
                              ? 'border-purple-300 bg-purple-50'
                              : 'border-gray-200 bg-white'
                          }`}
                          onClick={() => handleSelectDraft(draft)}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-gray-900">Draft {draft.version}</span>
                              <span className="text-xs bg-purple-100 px-2 py-0.5 rounded-full text-purple-600">
                                {draft.model}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {draft.wordCount} words
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-2">
                            {draft.feedback}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {draft.createdAt.toLocaleTimeString()}
                          </p>
                        </div>
                      ))}
                      
                      {isGenerating && currentProject.status !== 'completed' && (
                        <div className="border border-dashed border-gray-300 rounded-lg p-3 bg-gray-50">
                          <div className="flex items-center space-x-2 mb-1">
                            <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm font-medium text-gray-900">
                              {currentProject.status === 'planning' ? 'Planning content...' :
                               currentProject.status === 'drafting' ? `Creating draft ${currentProject.currentDraft + 1}...` :
                               currentProject.status === 'refining' ? 'Refining content...' :
                               'Reviewing content...'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">
                            PicaOS agents are working on your content
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Feedback Section */}
                    {currentProject.feedback.length > 0 && (
                      <div className="mt-6">
                        <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center space-x-2">
                          <Edit size={14} className="text-purple-600" />
                          <span>Improvement Feedback</span>
                        </h4>
                        
                        <div className="space-y-2">
                          {currentProject.feedback.map((feedback, index) => (
                            <div key={index} className="text-xs bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                              {feedback}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Right panel - Content preview */}
                  <div className="w-2/3 p-4 overflow-y-auto">
                    <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center space-x-2">
                      <FileText size={18} className="text-purple-600" />
                      <span>
                        {selectedDraft 
                          ? `Draft ${selectedDraft.version} Preview` 
                          : 'Current Content Preview'}
                      </span>
                    </h4>
                    
                    <div className="prose prose-sm max-w-none border border-gray-200 rounded-lg p-4 bg-white min-h-[400px]">
                      <div className="whitespace-pre-wrap">
                        {selectedDraft 
                          ? selectedDraft.content 
                          : currentProject.content || 'Content will appear here as it is generated...'}
                      </div>
                    </div>
                    
                    {/* SEO Analysis for later drafts */}
                    {settings.seoOptimize && currentProject.currentDraft >= 2 && (
                      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <h5 className="text-sm font-medium text-blue-800 mb-2">SEO Analysis</h5>
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span>Keyword density:</span>
                            <span className="font-medium text-blue-700">Optimal</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Readability score:</span>
                            <span className="font-medium text-blue-700">Good</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Meta description:</span>
                            <span className="font-medium text-blue-700">Optimized</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Heading structure:</span>
                            <span className="font-medium text-blue-700">Well-structured</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
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
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Content Creation Complete!</h3>
                  <p className="text-gray-600 mb-6">
                    Your {currentProject.wordCount}-word {settings.contentType} has been created and refined through {currentProject.draftHistory.length} drafts.
                  </p>
                </div>

                {/* Final Content */}
                <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-gray-900 flex items-center space-x-2">
                      <FileText size={20} />
                      <span>Final Content</span>
                    </h4>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">{currentProject.wordCount} words</span>
                      <button
                        onClick={() => setShowDraftHistory(!showDraftHistory)}
                        className="flex items-center space-x-1 px-2 py-1 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"
                      >
                        {showDraftHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        <span>{showDraftHistory ? 'Hide' : 'Show'} Draft History</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* Draft History */}
                  {showDraftHistory && (
                    <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                      {currentProject.draftHistory.map((draft) => (
                        <div
                          key={draft.id}
                          className={`border rounded-lg p-3 cursor-pointer transition-all duration-200 hover:shadow-md ${
                            selectedDraft?.id === draft.id
                              ? 'border-purple-300 bg-purple-50'
                              : 'border-gray-200 bg-white'
                          }`}
                          onClick={() => handleSelectDraft(draft)}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-900">Draft {draft.version}</span>
                            <span className="text-xs text-gray-500">{draft.wordCount} words</span>
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-2">{draft.feedback}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Content Preview */}
                  <div className="prose prose-sm max-w-none border border-gray-200 rounded-lg p-4 bg-white max-h-96 overflow-y-auto">
                    <div className="whitespace-pre-wrap">
                      {selectedDraft ? selectedDraft.content : currentProject.content}
                    </div>
                  </div>
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
                      setSelectedDraft(null);
                      setShowDraftHistory(false);
                    }}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    New Content
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
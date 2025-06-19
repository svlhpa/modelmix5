import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, Users, Trophy, Play, Pause, RotateCcw, Crown, Share2, Download, ExternalLink, Copy, CheckCircle, MessageSquare, ThumbsUp, ThumbsDown, Gavel, Award, Globe, Zap, Clock, Brain } from 'lucide-react';
import { aiService } from '../services/aiService';
import { debateService } from '../services/debateService';
import { useAuth } from '../hooks/useAuth';
import { openRouterService, OpenRouterModel } from '../services/openRouterService';

interface DebateClubProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DebateMessage {
  id: string;
  speaker: 'ai1' | 'ai2' | 'user';
  content: string;
  timestamp: Date;
  model?: string;
  position?: string;
}

interface DebateSession {
  id: string;
  topic: string;
  ai1Model: string;
  ai2Model: string;
  ai1Position: string;
  ai2Position: string;
  status: 'setup' | 'opening' | 'debate' | 'closing' | 'finished' | 'winner_declared';
  currentTurn: 'ai1' | 'ai2';
  messages: DebateMessage[];
  votes: { ai1: number; ai2: number };
  userVote?: 'ai1' | 'ai2';
  winner?: 'ai1' | 'ai2' | 'tie';
  winnerDeclaredBy?: 'user' | 'votes';
  winnerReason?: string;
  createdAt: Date;
  turnCount: number;
  round?: number;
  isPublic?: boolean;
  shareUrl?: string;
}

interface DebateStats {
  totalDebates: number;
  modelWins: { [model: string]: number };
  topTopics: string[];
  userParticipation: number;
}

interface WinnerDeclaration {
  winner: 'ai1' | 'ai2' | 'tie';
  reason?: string;
}

export const DebateClub: React.FC<DebateClubProps> = ({ isOpen, onClose }) => {
  const { user, getCurrentTier } = useAuth();
  const [activeTab, setActiveTab] = useState<'lobby' | 'live' | 'leaderboard'>('lobby');
  const [currentDebate, setCurrentDebate] = useState<DebateSession | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentlyThinking, setCurrentlyThinking] = useState<string>(''); // Track which AI is thinking
  const [userInput, setUserInput] = useState('');
  const [stats, setStats] = useState<DebateStats>({ totalDebates: 0, modelWins: {}, topTopics: [], userParticipation: 0 });
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Model selection states
  const [selectedAI1, setSelectedAI1] = useState('openai');
  const [selectedAI2, setSelectedAI2] = useState('gemini');
  const [debateTopic, setDebateTopic] = useState('');
  const [availableModels, setAvailableModels] = useState<{ traditional: any[], openrouter: OpenRouterModel[] }>({
    traditional: [],
    openrouter: []
  });
  const [loadingModels, setLoadingModels] = useState(false);

  const currentTier = getCurrentTier();

  useEffect(() => {
    if (isOpen) {
      loadStats();
      loadAvailableModels();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [currentDebate?.messages]);

  const loadAvailableModels = async () => {
    setLoadingModels(true);
    try {
      // Load traditional models
      const traditional = [
        { id: 'openai', name: 'OpenAI GPT-4o', icon: '🤖', description: 'Latest GPT model with advanced reasoning' },
        { id: 'gemini', name: 'Google Gemini Pro', icon: '💎', description: 'Google\'s multimodal AI model' },
        { id: 'deepseek', name: 'DeepSeek Chat', icon: '🔍', description: 'Advanced reasoning and analysis model' }
      ];

      // Load OpenRouter models
      const openRouterModels = await openRouterService.getAvailableModels();
      
      // Filter OpenRouter models for debate (exclude embedding, image, etc.)
      const debateModels = openRouterModels.filter(model => {
        const modelName = model.name.toLowerCase();
        const modelId = model.id.toLowerCase();
        
        // Include popular chat models
        return !modelId.includes('embedding') && 
               !modelId.includes('whisper') && 
               !modelId.includes('dall-e') &&
               !modelId.includes('stable-diffusion') &&
               !modelId.includes('tts') &&
               model.context_length >= 8000; // Ensure good context for debates
      }).slice(0, 20); // Limit to top 20 for UI performance

      setAvailableModels({
        traditional,
        openrouter: debateModels
      });
    } catch (error) {
      console.error('Failed to load available models:', error);
    } finally {
      setLoadingModels(false);
    }
  };

  const loadStats = async () => {
    try {
      const debateStats = await debateService.getDebateStats();
      setStats(debateStats);
    } catch (error) {
      console.error('Failed to load debate stats:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getAllModels = () => {
    return [
      ...availableModels.traditional,
      ...availableModels.openrouter.map(model => ({
        id: model.id,
        name: model.name,
        icon: getOpenRouterModelIcon(model),
        description: model.description || 'OpenRouter AI model',
        isOpenRouter: true,
        isFree: model.pricing.prompt === "0"
      }))
    ];
  };

  const getOpenRouterModelIcon = (model: OpenRouterModel) => {
    const modelId = model.id.toLowerCase();
    const modelName = model.name.toLowerCase();
    
    if (modelId.includes('claude') || modelId.includes('anthropic')) return '🔮';
    if (modelId.includes('gpt') || modelId.includes('openai')) return '🤖';
    if (modelId.includes('gemini') || modelId.includes('google')) return '💎';
    if (modelId.includes('llama') || modelId.includes('meta')) return '🦙';
    if (modelId.includes('deepseek')) return '🔍';
    if (modelId.includes('mistral')) return '⚡';
    if (modelId.includes('qwen')) return '🌟';
    if (modelId.includes('gemma')) return '🔷';
    if (modelId.includes('yi')) return '🎯';
    if (modelId.includes('mixtral')) return '🌀';
    return '🤖';
  };

  const getModelDisplayName = (modelId: string) => {
    const allModels = getAllModels();
    const model = allModels.find(m => m.id === modelId);
    return model ? model.name : modelId;
  };

  const getModelIcon = (modelId: string) => {
    const allModels = getAllModels();
    const model = allModels.find(m => m.id === modelId);
    return model ? model.icon : '🤖';
  };

  const isModelFree = (modelId: string) => {
    const allModels = getAllModels();
    const model = allModels.find(m => m.id === modelId);
    return model?.isFree || false;
  };

  const startDebate = async () => {
    if (!debateTopic.trim() || !user) return;

    try {
      const debate = await debateService.createDebate({
        topic: debateTopic.trim(),
        ai1Model: selectedAI1,
        ai2Model: selectedAI2,
        userId: user.id
      });

      setCurrentDebate(debate);
      setActiveTab('live');
      
      // Start with AI1's opening statement
      await generateNextResponse(debate);
    } catch (error) {
      console.error('Failed to start debate:', error);
    }
  };

  const generateNextResponse = async (debate?: DebateSession) => {
    const currentDebateState = debate || currentDebate;
    if (!currentDebateState || isGenerating) return;

    setIsGenerating(true);
    const currentSpeaker = currentDebateState.currentTurn;
    const model = currentSpeaker === 'ai1' ? currentDebateState.ai1Model : currentDebateState.ai2Model;
    const modelName = getModelDisplayName(model);
    
    // Set thinking state
    setCurrentlyThinking(modelName);

    try {
      const position = currentSpeaker === 'ai1' ? currentDebateState.ai1Position : currentDebateState.ai2Position;
      
      // Determine response type based on turn count
      let responseType: 'opening' | 'rebuttal' | 'closing' | 'response_to_user' = 'rebuttal';
      if (currentDebateState.turnCount === 0) {
        responseType = 'opening';
      } else if (currentDebateState.turnCount >= 5) {
        responseType = 'closing';
      }

      console.log(`Generating ${responseType} for ${model} (${currentSpeaker})`);

      const response = await aiService.generateDebateResponse(
        currentDebateState.topic,
        position,
        currentDebateState.messages,
        model,
        responseType
      );

      const newMessage: DebateMessage = {
        id: `msg-${Date.now()}`,
        speaker: currentSpeaker,
        content: response,
        timestamp: new Date(),
        model: modelName,
        position
      };

      const updatedDebate: DebateSession = {
        ...currentDebateState,
        messages: [...currentDebateState.messages, newMessage],
        currentTurn: currentSpeaker === 'ai1' ? 'ai2' : 'ai1',
        turnCount: currentDebateState.turnCount + 1,
        status: currentDebateState.turnCount >= 5 ? 'finished' : currentDebateState.status
      };

      setCurrentDebate(updatedDebate);
      await debateService.updateDebate(updatedDebate);

      // Auto-continue if not finished and less than 6 turns
      if (updatedDebate.status !== 'finished' && updatedDebate.turnCount < 6) {
        setTimeout(() => generateNextResponse(updatedDebate), 2000);
      }

    } catch (error) {
      console.error('Error generating debate response:', error);
    } finally {
      setIsGenerating(false);
      setCurrentlyThinking('');
    }
  };

  const handleUserInput = async () => {
    if (!userInput.trim() || !currentDebate || isGenerating) return;

    const userMessage: DebateMessage = {
      id: `msg-${Date.now()}`,
      speaker: 'user',
      content: userInput.trim(),
      timestamp: new Date()
    };

    const updatedDebate: DebateSession = {
      ...currentDebate,
      messages: [...currentDebate.messages, userMessage]
    };

    setCurrentDebate(updatedDebate);
    setUserInput('');
    await debateService.updateDebate(updatedDebate);

    // Generate AI response to user input
    setTimeout(() => generateNextResponse(updatedDebate), 1000);
  };

  const handleVote = async (side: 'ai1' | 'ai2') => {
    if (!currentDebate || currentDebate.userVote) return;

    const updatedDebate: DebateSession = {
      ...currentDebate,
      votes: {
        ...currentDebate.votes,
        [side]: currentDebate.votes[side] + 1
      },
      userVote: side
    };

    setCurrentDebate(updatedDebate);
    await debateService.updateDebate(updatedDebate);
  };

  const declareWinner = async (declaration: WinnerDeclaration) => {
    if (!currentDebate) return;

    const updatedDebate: DebateSession = {
      ...currentDebate,
      winner: declaration.winner,
      winnerDeclaredBy: 'user',
      winnerReason: declaration.reason,
      status: 'winner_declared'
    };

    setCurrentDebate(updatedDebate);
    await debateService.updateDebate(updatedDebate);
    setShowWinnerModal(false);
    await loadStats();
  };

  const shareDebate = async () => {
    if (!currentDebate) return;

    const shareId = `${currentDebate.id}-${Date.now()}`;
    const url = `${window.location.origin}/debate/${shareId}`;
    
    const updatedDebate: DebateSession = {
      ...currentDebate,
      isPublic: true,
      shareUrl: url
    };

    setCurrentDebate(updatedDebate);
    await debateService.updateDebate(updatedDebate);
    setShareUrl(url);
    setShowShareModal(true);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const downloadDebate = () => {
    if (!currentDebate) return;

    const transcript = generateDebateTranscript(currentDebate);
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debate-${currentDebate.topic.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateDebateTranscript = (debate: DebateSession): string => {
    let transcript = `🏛️ AI DEBATE CLUB - PARLIAMENTARY PROCEEDINGS 🏛️\n\n`;
    transcript += `📋 DEBATE DETAILS:\n`;
    transcript += `Topic: ${debate.topic}\n`;
    transcript += `Date: ${debate.createdAt.toLocaleDateString()}\n`;
    transcript += `Government Bench: ${getModelDisplayName(debate.ai1Model)} (${debate.ai1Position})\n`;
    transcript += `Opposition Bench: ${getModelDisplayName(debate.ai2Model)} (${debate.ai2Position})\n\n`;
    
    if (debate.winner) {
      const winnerModel = debate.winner === 'ai1' ? getModelDisplayName(debate.ai1Model) : 
                         debate.winner === 'ai2' ? getModelDisplayName(debate.ai2Model) : 'Honorable Tie';
      transcript += `🏆 DECLARED WINNER: ${winnerModel}\n`;
      if (debate.winnerReason) {
        transcript += `📝 Reasoning: ${debate.winnerReason}\n`;
      }
      transcript += `📊 Final Votes: Government ${debate.votes.ai1} - Opposition ${debate.votes.ai2}\n\n`;
    }
    
    transcript += `📜 DEBATE PROCEEDINGS:\n`;
    transcript += `${'='.repeat(50)}\n\n`;

    debate.messages.forEach((message, index) => {
      const timestamp = message.timestamp.toLocaleTimeString();
      
      if (message.speaker === 'user') {
        transcript += `[${timestamp}] 🎤 POINT OF ORDER FROM THE GALLERY:\n`;
        transcript += `${message.content}\n\n`;
      } else {
        const speakerLabel = message.speaker === 'ai1' ? 
          `🏛️ GOVERNMENT BENCH - ${message.model}` : 
          `🏛️ OPPOSITION BENCH - ${message.model}`;
        
        transcript += `[${timestamp}] ${speakerLabel}:\n`;
        transcript += `${message.content}\n\n`;
      }
    });

    transcript += `${'='.repeat(50)}\n`;
    transcript += `📊 DEBATE STATISTICS:\n`;
    transcript += `Total Turns: ${debate.turnCount}\n`;
    transcript += `User Interventions: ${debate.messages.filter(m => m.speaker === 'user').length}\n`;
    transcript += `Status: ${debate.status.toUpperCase()}\n\n`;
    transcript += `Generated by ModelMix AI Debate Club\n`;
    transcript += `${new Date().toISOString()}\n`;

    return transcript;
  };

  const shareToSocial = (platform: 'twitter' | 'facebook' | 'linkedin') => {
    if (!currentDebate || !shareUrl) return;

    const text = `🏛️ Just witnessed an epic AI debate: "${currentDebate.topic}" between ${getModelDisplayName(currentDebate.ai1Model)} vs ${getModelDisplayName(currentDebate.ai2Model)}! ${currentDebate.winner ? `Winner: ${currentDebate.winner === 'ai1' ? getModelDisplayName(currentDebate.ai1Model) : currentDebate.winner === 'ai2' ? getModelDisplayName(currentDebate.ai2Model) : 'Tie'}` : ''} Check it out:`;
    
    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`
    };

    window.open(urls[platform], '_blank', 'width=600,height=400');
  };

  const parseMarkdown = (text: string) => {
    if (!text) return text;
    
    // Replace **bold** with <strong>
    let parsed = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Replace *italic* with <em>
    parsed = parsed.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Replace `code` with <code>
    parsed = parsed.replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>');
    
    // Replace line breaks with <br>
    parsed = parsed.replace(/\n/g, '<br>');
    
    return parsed;
  };

  const resetDebate = () => {
    setCurrentDebate(null);
    setActiveTab('lobby');
    setDebateTopic('');
    setUserInput('');
    setIsGenerating(false);
    setCurrentlyThinking('');
  };

  const suggestedTopics = [
    "Is artificial intelligence a threat to humanity?",
    "Should we colonize Mars?",
    "Is remote work better than office work?",
    "Should social media be regulated?",
    "Is cryptocurrency the future of money?",
    "Should we ban autonomous weapons?",
    "Is universal basic income necessary?",
    "Should we edit human genes?",
    "Is nuclear energy safe?",
    "Should we tax carbon emissions?"
  ];

  // Generate debate proceedings summary
  const getDebateProceedings = () => {
    if (!currentDebate) return null;

    const totalTurns = Math.ceil(currentDebate.turnCount / 2);
    const maxTurns = 6;
    const progress = (totalTurns / maxTurns) * 100;
    
    const phases = [
      { name: 'Opening Statements', turns: '1-2', completed: totalTurns >= 2 },
      { name: 'Main Arguments', turns: '3-4', completed: totalTurns >= 4 },
      { name: 'Closing Statements', turns: '5-6', completed: totalTurns >= 6 }
    ];

    return {
      totalTurns,
      maxTurns,
      progress,
      phases,
      currentPhase: totalTurns <= 2 ? 'Opening Statements' : 
                   totalTurns <= 4 ? 'Main Arguments' : 'Closing Statements',
      nextSpeaker: currentDebate.currentTurn === 'ai1' ? 
        getModelDisplayName(currentDebate.ai1Model) : 
        getModelDisplayName(currentDebate.ai2Model)
    };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-7xl w-full h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Mic size={24} className="animate-pulse" />
              <div>
                <h2 className="text-2xl font-bold">AI Debate Club 🏛️ ⚖️</h2>
                <p className="text-purple-100">Parliamentary-style AI debates with formal proceedings!</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          {[
            { id: 'lobby', label: 'Debate Lobby', icon: Users },
            { id: 'live', label: 'Live Debate', icon: Mic },
            { id: 'leaderboard', label: 'Leaderboard', icon: Trophy }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center space-x-2 px-6 py-4 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <tab.icon size={20} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'lobby' && (
            <div className="h-full overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto space-y-8">
                {/* Topic Selection */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">🎯 Choose Your Debate Topic</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Enter a debate topic or question:
                      </label>
                      <input
                        type="text"
                        value={debateTopic}
                        onChange={(e) => setDebateTopic(e.target.value)}
                        placeholder="e.g., Should artificial intelligence replace human teachers?"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-600 mb-3">Or choose from popular topics:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {suggestedTopics.map((topic, index) => (
                          <button
                            key={index}
                            onClick={() => setDebateTopic(topic)}
                            className="text-left p-3 bg-gray-50 hover:bg-purple-50 border border-gray-200 hover:border-purple-300 rounded-lg transition-colors text-sm"
                          >
                            {topic}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Model Selection */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Government Bench (AI1) */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-blue-900 mb-4">
                      🏛️ Government Bench (Pro Position)
                    </h3>
                    {loadingModels ? (
                      <div className="text-center py-8">
                        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-blue-600">Loading AI models...</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {getAllModels().map((model) => (
                          <div
                            key={model.id}
                            onClick={() => setSelectedAI1(model.id)}
                            className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                              selectedAI1 === model.id
                                ? 'border-blue-500 bg-blue-100'
                                : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <span className="text-2xl">{model.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <h4 className="font-medium text-gray-900 truncate">{model.name}</h4>
                                  {model.isOpenRouter && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                      <Globe size={10} className="mr-1" />
                                      OpenRouter
                                    </span>
                                  )}
                                  {model.isFree && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      <Zap size={10} className="mr-1" />
                                      Free
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 truncate">{model.description}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Opposition Bench (AI2) */}
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-red-900 mb-4">
                      🏛️ Opposition Bench (Con Position)
                    </h3>
                    {loadingModels ? (
                      <div className="text-center py-8">
                        <div className="w-8 h-8 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-red-600">Loading AI models...</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {getAllModels().map((model) => (
                          <div
                            key={model.id}
                            onClick={() => setSelectedAI2(model.id)}
                            className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                              selectedAI2 === model.id
                                ? 'border-red-500 bg-red-100'
                                : 'border-gray-200 hover:border-red-300 hover:bg-red-50'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <span className="text-2xl">{model.icon}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2">
                                  <h4 className="font-medium text-gray-900 truncate">{model.name}</h4>
                                  {model.isOpenRouter && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                      <Globe size={10} className="mr-1" />
                                      OpenRouter
                                    </span>
                                  )}
                                  {model.isFree && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      <Zap size={10} className="mr-1" />
                                      Free
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 truncate">{model.description}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Start Debate Button */}
                <div className="text-center">
                  <button
                    onClick={startDebate}
                    disabled={!debateTopic.trim() || selectedAI1 === selectedAI2 || loadingModels}
                    className="inline-flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 text-lg font-semibold"
                  >
                    <Play size={24} />
                    <span>Start Parliamentary Debate! 🏛️</span>
                  </button>
                  {selectedAI1 === selectedAI2 && (
                    <p className="text-red-600 text-sm mt-2">Please select different AI models for each bench</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'live' && (
            <div className="h-full flex flex-col">
              {/* Debate Proceedings Summary */}
              {currentDebate && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-b border-gray-200 p-4">
                  <div className="max-w-6xl mx-auto">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">🏛️ Parliamentary Proceedings</h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <span>📋 Topic: {currentDebate.topic}</span>
                        <span>⏱️ {new Date(currentDebate.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    {(() => {
                      const proceedings = getDebateProceedings();
                      if (!proceedings) return null;

                      return (
                        <div className="space-y-4">
                          {/* Progress Bar */}
                          <div className="bg-white rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">Debate Progress</span>
                              <span className="text-sm text-gray-600">Turn {proceedings.totalTurns}/{proceedings.maxTurns}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(proceedings.progress, 100)}%` }}
                              />
                            </div>
                          </div>

                          {/* Current Status */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Current Phase */}
                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                              <div className="flex items-center space-x-2 mb-2">
                                <Clock size={16} className="text-blue-600" />
                                <span className="text-sm font-medium text-gray-700">Current Phase</span>
                              </div>
                              <p className="text-lg font-semibold text-blue-900">{proceedings.currentPhase}</p>
                            </div>

                            {/* Next Speaker */}
                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                              <div className="flex items-center space-x-2 mb-2">
                                <Mic size={16} className="text-green-600" />
                                <span className="text-sm font-medium text-gray-700">
                                  {isGenerating ? 'Currently Speaking' : 'Next Speaker'}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">{getModelIcon(currentDebate.currentTurn === 'ai1' ? currentDebate.ai1Model : currentDebate.ai2Model)}</span>
                                <p className="text-lg font-semibold text-green-900">{proceedings.nextSpeaker}</p>
                                {isGenerating && (
                                  <Brain size={16} className="text-purple-600 animate-pulse" />
                                )}
                              </div>
                            </div>

                            {/* Voting Status */}
                            <div className="bg-white rounded-lg p-4 border border-gray-200">
                              <div className="flex items-center space-x-2 mb-2">
                                <Trophy size={16} className="text-yellow-600" />
                                <span className="text-sm font-medium text-gray-700">Current Votes</span>
                              </div>
                              <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-1">
                                  <ThumbsUp size={14} className="text-blue-600" />
                                  <span className="font-semibold text-blue-900">{currentDebate.votes.ai1}</span>
                                </div>
                                <span className="text-gray-400">vs</span>
                                <div className="flex items-center space-x-1">
                                  <ThumbsDown size={14} className="text-red-600" />
                                  <span className="font-semibold text-red-900">{currentDebate.votes.ai2}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Thinking Animation */}
                          {isGenerating && currentlyThinking && (
                            <div className="bg-gradient-to-r from-purple-100 to-pink-100 border border-purple-200 rounded-lg p-4">
                              <div className="flex items-center space-x-3">
                                <div className="flex space-x-1">
                                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                                <Brain size={20} className="text-purple-600 animate-pulse" />
                                <span className="font-medium text-purple-800">
                                  {currentlyThinking} is formulating their argument...
                                </span>
                                <div className="flex items-center space-x-1 text-purple-600">
                                  <span className="text-sm">Thinking</span>
                                  <div className="flex space-x-1">
                                    <div className="w-1 h-1 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-1 h-1 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '200ms' }}></div>
                                    <div className="w-1 h-1 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '400ms' }}></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Phase Breakdown */}
                          <div className="bg-white rounded-lg p-4 border border-gray-200">
                            <h4 className="text-sm font-medium text-gray-700 mb-3">📋 Debate Structure</h4>
                            <div className="grid grid-cols-3 gap-4">
                              {proceedings.phases.map((phase, index) => (
                                <div 
                                  key={index}
                                  className={`text-center p-3 rounded-lg border ${
                                    phase.completed 
                                      ? 'bg-green-50 border-green-200 text-green-800' 
                                      : phase.name === proceedings.currentPhase
                                        ? 'bg-blue-50 border-blue-200 text-blue-800'
                                        : 'bg-gray-50 border-gray-200 text-gray-600'
                                  }`}
                                >
                                  <div className="font-medium text-sm">{phase.name}</div>
                                  <div className="text-xs mt-1">Turns {phase.turns}</div>
                                  {phase.completed && (
                                    <CheckCircle size={16} className="mx-auto mt-2 text-green-600" />
                                  )}
                                  {phase.name === proceedings.currentPhase && !phase.completed && (
                                    <Clock size={16} className="mx-auto mt-2 text-blue-600 animate-pulse" />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Debate Header */}
              {currentDebate && (
                <div className="bg-gray-50 border-b border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">🏛️ {currentDebate.topic}</h3>
                      <div className="flex items-center space-x-4 mt-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">👥 0 votes</span>
                          <span className="text-sm text-gray-500">⏱️ Round {currentDebate.round} - Turn {Math.ceil((currentDebate.turnCount + 1) / 2)}/6</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleVote('ai1')}
                          disabled={!!currentDebate.userVote}
                          className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-sm transition-colors ${
                            currentDebate.userVote === 'ai1'
                              ? 'bg-blue-600 text-white'
                              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          }`}
                        >
                          <ThumbsUp size={14} />
                          <span>Government</span>
                          <span className="font-bold">{currentDebate.votes.ai1}</span>
                        </button>
                        
                        <button
                          onClick={() => handleVote('ai2')}
                          disabled={!!currentDebate.userVote}
                          className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-sm transition-colors ${
                            currentDebate.userVote === 'ai2'
                              ? 'bg-red-600 text-white'
                              : 'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          <ThumbsDown size={14} />
                          <span>Opposition</span>
                          <span className="font-bold">{currentDebate.votes.ai2}</span>
                        </button>
                      </div>
                      
                      {(currentDebate.status === 'finished' || currentDebate.turnCount >= 3) && !currentDebate.winner && (
                        <button
                          onClick={() => setShowWinnerModal(true)}
                          className="flex items-center space-x-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                        >
                          <Gavel size={16} />
                          <span>Declare Winner</span>
                        </button>
                      )}
                      
                      {currentDebate.winner && (
                        <button
                          onClick={shareDebate}
                          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <Share2 size={16} />
                          <span>Share</span>
                        </button>
                      )}
                      
                      <button
                        onClick={resetDebate}
                        className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        <RotateCcw size={16} />
                        <span>New Debate</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Messages or Empty State */}
              {currentDebate ? (
                <>
                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {currentDebate.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.speaker === 'user' ? 'justify-center' : 
                          message.speaker === 'ai1' ? 'justify-start' : 'justify-end'
                        }`}
                      >
                        <div
                          className={`max-w-2xl p-4 rounded-lg ${
                            message.speaker === 'user'
                              ? 'bg-yellow-100 border border-yellow-300'
                              : message.speaker === 'ai1'
                                ? 'bg-blue-100 border border-blue-300'
                                : 'bg-red-100 border border-red-300'
                          }`}
                        >
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-lg">
                              {message.speaker === 'user' ? '🎤' : getModelIcon(currentDebate[message.speaker === 'ai1' ? 'ai1Model' : 'ai2Model'])}
                            </span>
                            <span className="font-semibold text-sm">
                              {message.speaker === 'user' 
                                ? '🎤 Point of Order from the Gallery'
                                : `🏛️ ${message.speaker === 'ai1' ? 'Government Bench' : 'Opposition Bench'} - ${message.model}`
                              }
                            </span>
                            <span className="text-xs text-gray-500">
                              {message.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                          <div 
                            className="text-gray-800 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: parseMarkdown(message.content) }}
                          />
                        </div>
                      </div>
                    ))}
                    
                    {currentDebate.winner && (
                      <div className="text-center py-8">
                        <div className="inline-block bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-8 py-4 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Trophy size={24} />
                            <div>
                              <div className="font-bold text-lg">
                                🏆 Winner Declared: {
                                  currentDebate.winner === 'ai1' ? `Government Bench (${getModelDisplayName(currentDebate.ai1Model)})` :
                                  currentDebate.winner === 'ai2' ? `Opposition Bench (${getModelDisplayName(currentDebate.ai2Model)})` :
                                  'Honorable Tie'
                                }
                              </div>
                              {currentDebate.winnerReason && (
                                <div className="text-sm mt-1 opacity-90">{currentDebate.winnerReason}</div>
                              )}
                              <div className="text-sm mt-2">
                                📊 Final Votes: Government {currentDebate.votes.ai1} - Opposition {currentDebate.votes.ai2}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                  </div>

                  {/* User Input */}
                  {currentDebate.status !== 'winner_declared' && (
                    <div className="border-t border-gray-200 p-4">
                      <div className="flex space-x-3">
                        <input
                          type="text"
                          value={userInput}
                          onChange={(e) => setUserInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleUserInput()}
                          placeholder="🎤 Interrupt from the gallery with your point..."
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          disabled={isGenerating}
                        />
                        <button
                          onClick={handleUserInput}
                          disabled={!userInput.trim() || isGenerating}
                          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          <MessageSquare size={18} />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        💡 Your input will appear in the center as a "Point of Order from the Gallery"
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Mic size={64} className="text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Active Debate</h3>
                    <p className="text-gray-600 mb-4">Start a new debate from the Debate Lobby to begin parliamentary proceedings</p>
                    <button
                      onClick={() => setActiveTab('lobby')}
                      className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Go to Debate Lobby
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <div className="h-full overflow-y-auto p-6">
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">🏆 AI Debate Championship</h3>
                  <p className="text-gray-600">Rankings based on declared winners only</p>
                </div>

                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-900">{stats.totalDebates}</div>
                    <div className="text-sm text-blue-600">Total Debates</div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-900">{stats.userParticipation}</div>
                    <div className="text-sm text-green-600">User Participated</div>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-purple-900">{Object.keys(stats.modelWins).length}</div>
                    <div className="text-sm text-purple-600">Active Models</div>
                  </div>
                </div>

                {/* Model Rankings */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">🥇 Model Performance Rankings</h4>
                  {Object.keys(stats.modelWins).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(stats.modelWins)
                        .sort(([,a], [,b]) => b - a)
                        .map(([model, wins], index) => (
                          <div key={model} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                                index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-gray-300'
                              }`}>
                                {index + 1}
                              </div>
                              <span className="text-2xl">{getModelIcon(model)}</span>
                              <span className="font-medium text-gray-900">{getModelDisplayName(model)}</span>
                            </div>
                            <div className="flex-1"></div>
                            <div className="text-right">
                              <div className="font-bold text-lg text-gray-900">{wins}</div>
                              <div className="text-sm text-gray-500">wins</div>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Trophy size={48} className="mx-auto mb-4 opacity-50" />
                      <p>No declared winners yet. Start debating to see rankings!</p>
                    </div>
                  )}
                </div>

                {/* Popular Topics */}
                {stats.topTopics.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">🔥 Popular Debate Topics</h4>
                    <div className="space-y-2">
                      {stats.topTopics.map((topic, index) => (
                        <div key={index} className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                          <span className="text-sm font-medium text-gray-600">#{index + 1}</span>
                          <span className="text-sm text-gray-900">{topic}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Winner Declaration Modal */}
        {showWinnerModal && currentDebate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">🏛️ Declare the Winner</h3>
              <p className="text-gray-600 mb-6">Who presented the most compelling arguments in this parliamentary debate?</p>
              
              <div className="space-y-3 mb-6">
                <button
                  onClick={() => declareWinner({ winner: 'ai1' })}
                  className="w-full p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-left"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getModelIcon(currentDebate.ai1Model)}</span>
                    <div>
                      <div className="font-medium text-blue-900">Government Bench</div>
                      <div className="text-sm text-blue-600">{getModelDisplayName(currentDebate.ai1Model)} - {currentDebate.ai1Position}</div>
                    </div>
                  </div>
                </button>
                
                <button
                  onClick={() => declareWinner({ winner: 'ai2' })}
                  className="w-full p-4 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-left"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">{getModelIcon(currentDebate.ai2Model)}</span>
                    <div>
                      <div className="font-medium text-red-900">Opposition Bench</div>
                      <div className="text-sm text-red-600">{getModelDisplayName(currentDebate.ai2Model)} - {currentDebate.ai2Position}</div>
                    </div>
                  </div>
                </button>
                
                <button
                  onClick={() => declareWinner({ winner: 'tie' })}
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors text-left"
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">⚖️</span>
                    <div>
                      <div className="font-medium text-gray-900">Honorable Tie</div>
                      <div className="text-sm text-gray-600">Both sides presented equally compelling arguments</div>
                    </div>
                  </div>
                </button>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowWinnerModal(false)}
                  className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Share Modal */}
        {showShareModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">🌐 Share This Debate</h3>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Share URL:</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={shareUrl}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                    />
                    <button
                      onClick={() => copyToClipboard(shareUrl)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {copySuccess ? <CheckCircle size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Share on social media:</label>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => shareToSocial('twitter')}
                      className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                    >
                      Twitter
                    </button>
                    <button
                      onClick={() => shareToSocial('facebook')}
                      className="flex-1 px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors text-sm"
                    >
                      Facebook
                    </button>
                    <button
                      onClick={() => shareToSocial('linkedin')}
                      className="flex-1 px-4 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-900 transition-colors text-sm"
                    >
                      LinkedIn
                    </button>
                  </div>
                </div>
                
                <button
                  onClick={downloadDebate}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download size={16} />
                  <span>Download Transcript</span>
                </button>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowShareModal(false)}
                  className="flex-1 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
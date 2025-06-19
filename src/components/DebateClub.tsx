import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, Users, Trophy, ThumbsUp, ThumbsDown, MessageCircle, Send, Zap, Crown, Fire, Brain, Laugh, Clock, Vote, TrendingUp, Shuffle, History, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { debateService } from '../services/debateService';
import { aiService } from '../services/aiService';

interface DebateClubProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DebateMessage {
  id: string;
  speaker: 'ai1' | 'ai2' | 'user' | 'moderator';
  content: string;
  timestamp: Date;
  model?: string;
  reactions?: { [emoji: string]: number };
  userReaction?: string;
}

interface DebateSession {
  id: string;
  topic: string;
  ai1Model: string;
  ai2Model: string;
  ai1Position: string;
  ai2Position: string;
  status: 'setup' | 'opening' | 'debate' | 'closing' | 'finished';
  currentTurn: 'ai1' | 'ai2';
  messages: DebateMessage[];
  votes: { ai1: number; ai2: number };
  userVote?: 'ai1' | 'ai2';
  winner?: 'ai1' | 'ai2' | 'tie';
  createdAt: Date;
}

interface DebateStats {
  totalDebates: number;
  modelWins: { [model: string]: number };
  topTopics: string[];
  userParticipation: number;
}

const DEBATE_TOPICS = [
  "Is artificial intelligence a threat to humanity?",
  "Should social media be regulated by governments?",
  "Is remote work better than office work?",
  "Should we colonize Mars?",
  "Is cryptocurrency the future of money?",
  "Should we ban single-use plastics?",
  "Is TikTok harmful to society?",
  "Should we have universal basic income?",
  "Is nuclear energy the solution to climate change?",
  "Should we edit human genes?",
  "Is pineapple on pizza acceptable?",
  "Are cats better than dogs?",
  "Should we have a 4-day work week?",
  "Is the metaverse the future of the internet?",
  "Should we tax billionaires more?"
];

const AVAILABLE_MODELS = [
  { id: 'openai', name: 'GPT-4o', personality: 'Analytical and precise' },
  { id: 'gemini', name: 'Gemini Pro', personality: 'Creative and thoughtful' },
  { id: 'deepseek', name: 'DeepSeek', personality: 'Logical and methodical' },
  { id: 'claude', name: 'Claude', personality: 'Balanced and nuanced' }
];

const REACTION_EMOJIS = ['🔥', '🤯', '😂', '👏', '💯', '🎯', '🤔', '😴'];

export const DebateClub: React.FC<DebateClubProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'lobby' | 'debate' | 'stats'>('lobby');
  const [currentDebate, setCurrentDebate] = useState<DebateSession | null>(null);
  const [customTopic, setCustomTopic] = useState('');
  const [selectedModels, setSelectedModels] = useState({ ai1: 'openai', ai2: 'gemini' });
  const [userMessage, setUserMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [stats, setStats] = useState<DebateStats | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [currentDebate?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadStats = async () => {
    try {
      const debateStats = await debateService.getDebateStats();
      setStats(debateStats);
    } catch (error) {
      console.error('Failed to load debate stats:', error);
    }
  };

  const startDebate = async (topic: string) => {
    if (!user) return;

    setIsGenerating(true);
    try {
      const debate = await debateService.createDebate({
        topic,
        ai1Model: selectedModels.ai1,
        ai2Model: selectedModels.ai2,
        userId: user.id
      });

      setCurrentDebate(debate);
      setActiveTab('debate');
      setShowSetup(false);

      // Start with opening statements
      await generateOpeningStatements(debate);
    } catch (error) {
      console.error('Failed to start debate:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateOpeningStatements = async (debate: DebateSession) => {
    setIsGenerating(true);
    try {
      // Generate opening statement for AI1
      const ai1Opening = await aiService.generateDebateResponse(
        debate.topic,
        debate.ai1Position,
        [],
        debate.ai1Model,
        'opening'
      );

      const ai1Message: DebateMessage = {
        id: `ai1-opening-${Date.now()}`,
        speaker: 'ai1',
        content: ai1Opening,
        timestamp: new Date(),
        model: debate.ai1Model,
        reactions: {}
      };

      // Generate opening statement for AI2
      const ai2Opening = await aiService.generateDebateResponse(
        debate.topic,
        debate.ai2Position,
        [ai1Message],
        debate.ai2Model,
        'opening'
      );

      const ai2Message: DebateMessage = {
        id: `ai2-opening-${Date.now()}`,
        speaker: 'ai2',
        content: ai2Opening,
        timestamp: new Date(),
        model: debate.ai2Model,
        reactions: {}
      };

      const updatedDebate = {
        ...debate,
        status: 'debate' as const,
        messages: [ai1Message, ai2Message],
        currentTurn: 'ai1' as const
      };

      setCurrentDebate(updatedDebate);
      await debateService.updateDebate(updatedDebate);
    } catch (error) {
      console.error('Failed to generate opening statements:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const continueDebate = async () => {
    if (!currentDebate || isGenerating) return;

    setIsGenerating(true);
    try {
      const currentModel = currentDebate.currentTurn === 'ai1' ? currentDebate.ai1Model : currentDebate.ai2Model;
      const currentPosition = currentDebate.currentTurn === 'ai1' ? currentDebate.ai1Position : currentDebate.ai2Position;

      const response = await aiService.generateDebateResponse(
        currentDebate.topic,
        currentPosition,
        currentDebate.messages,
        currentModel,
        'rebuttal'
      );

      const newMessage: DebateMessage = {
        id: `${currentDebate.currentTurn}-${Date.now()}`,
        speaker: currentDebate.currentTurn,
        content: response,
        timestamp: new Date(),
        model: currentModel,
        reactions: {}
      };

      const updatedDebate = {
        ...currentDebate,
        messages: [...currentDebate.messages, newMessage],
        currentTurn: currentDebate.currentTurn === 'ai1' ? 'ai2' as const : 'ai1' as const
      };

      setCurrentDebate(updatedDebate);
      await debateService.updateDebate(updatedDebate);
    } catch (error) {
      console.error('Failed to continue debate:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const addUserMessage = async () => {
    if (!userMessage.trim() || !currentDebate || isGenerating) return;

    const newMessage: DebateMessage = {
      id: `user-${Date.now()}`,
      speaker: 'user',
      content: userMessage,
      timestamp: new Date(),
      reactions: {}
    };

    const updatedDebate = {
      ...currentDebate,
      messages: [...currentDebate.messages, newMessage]
    };

    setCurrentDebate(updatedDebate);
    setUserMessage('');

    // Generate AI response to user
    setIsGenerating(true);
    try {
      const currentModel = currentDebate.currentTurn === 'ai1' ? currentDebate.ai1Model : currentDebate.ai2Model;
      const currentPosition = currentDebate.currentTurn === 'ai1' ? currentDebate.ai1Position : currentDebate.ai2Position;

      const response = await aiService.generateDebateResponse(
        currentDebate.topic,
        currentPosition,
        updatedDebate.messages,
        currentModel,
        'response_to_user'
      );

      const aiResponse: DebateMessage = {
        id: `${currentDebate.currentTurn}-response-${Date.now()}`,
        speaker: currentDebate.currentTurn,
        content: response,
        timestamp: new Date(),
        model: currentModel,
        reactions: {}
      };

      const finalDebate = {
        ...updatedDebate,
        messages: [...updatedDebate.messages, aiResponse]
      };

      setCurrentDebate(finalDebate);
      await debateService.updateDebate(finalDebate);
    } catch (error) {
      console.error('Failed to generate AI response:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const voteForAI = async (aiSide: 'ai1' | 'ai2') => {
    if (!currentDebate || !user) return;

    const updatedDebate = {
      ...currentDebate,
      votes: {
        ...currentDebate.votes,
        [aiSide]: currentDebate.votes[aiSide] + (currentDebate.userVote === aiSide ? -1 : 1),
        [currentDebate.userVote === 'ai1' ? 'ai1' : 'ai2']: currentDebate.userVote ? currentDebate.votes[currentDebate.userVote] - 1 : currentDebate.votes[currentDebate.userVote === 'ai1' ? 'ai1' : 'ai2']
      },
      userVote: currentDebate.userVote === aiSide ? undefined : aiSide
    };

    setCurrentDebate(updatedDebate);
    await debateService.updateDebate(updatedDebate);
  };

  const addReaction = async (messageId: string, emoji: string) => {
    if (!currentDebate) return;

    const updatedMessages = currentDebate.messages.map(msg => {
      if (msg.id === messageId) {
        const reactions = { ...msg.reactions };
        const currentCount = reactions[emoji] || 0;
        const userHasReacted = msg.userReaction === emoji;

        if (userHasReacted) {
          reactions[emoji] = Math.max(0, currentCount - 1);
          if (reactions[emoji] === 0) delete reactions[emoji];
        } else {
          // Remove previous reaction if exists
          if (msg.userReaction && reactions[msg.userReaction]) {
            reactions[msg.userReaction] = Math.max(0, reactions[msg.userReaction] - 1);
            if (reactions[msg.userReaction] === 0) delete reactions[msg.userReaction];
          }
          reactions[emoji] = currentCount + 1;
        }

        return {
          ...msg,
          reactions,
          userReaction: userHasReacted ? undefined : emoji
        };
      }
      return msg;
    });

    const updatedDebate = {
      ...currentDebate,
      messages: updatedMessages
    };

    setCurrentDebate(updatedDebate);
    await debateService.updateDebate(updatedDebate);
  };

  const getModelDisplayName = (modelId: string) => {
    return AVAILABLE_MODELS.find(m => m.id === modelId)?.name || modelId;
  };

  const getModelPersonality = (modelId: string) => {
    return AVAILABLE_MODELS.find(m => m.id === modelId)?.personality || '';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-xl max-w-6xl w-full h-[90vh] flex flex-col overflow-hidden transform animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg animate-bounceIn">
                <Mic size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">AI Debate Club 🎤🤖</h2>
                <p className="text-purple-100">Watch AI models battle it out in epic debates!</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/20 transition-all duration-200 hover:scale-110"
            >
              <X size={24} />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 mt-6 bg-white/10 p-1 rounded-lg">
            {[
              { id: 'lobby', label: 'Debate Lobby', icon: Users },
              { id: 'debate', label: 'Live Debate', icon: Mic },
              { id: 'stats', label: 'Leaderboard', icon: Trophy }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md transition-all duration-200 ${
                  activeTab === tab.id 
                    ? 'bg-white text-purple-600 shadow-sm transform scale-105' 
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <tab.icon size={16} />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'lobby' && (
            <div className="p-6 h-full overflow-y-auto">
              {!showSetup ? (
                <div className="space-y-6">
                  {/* Quick Start */}
                  <div className="text-center mb-8 animate-fadeInUp">
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">Ready to Watch AI Models Battle? 🥊</h3>
                    <p className="text-gray-600 mb-6">Choose a topic and watch two AI models debate it out in real-time!</p>
                    
                    <button
                      onClick={() => setShowSetup(true)}
                      className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-200 transform hover:scale-105 shadow-lg"
                    >
                      <Sparkles size={20} />
                      <span className="font-medium">Start New Debate</span>
                    </button>
                  </div>

                  {/* Trending Topics */}
                  <div className="animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                      <TrendingUp size={20} className="text-purple-600" />
                      <span>Trending Debate Topics</span>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {DEBATE_TOPICS.slice(0, 8).map((topic, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            setCustomTopic(topic);
                            setShowSetup(true);
                          }}
                          className="p-4 text-left bg-gray-50 hover:bg-purple-50 border border-gray-200 hover:border-purple-300 rounded-lg transition-all duration-200 hover:shadow-md transform hover:scale-105"
                        >
                          <p className="text-sm font-medium text-gray-900">{topic}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fun Modes */}
                  <div className="animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                      <Zap size={20} className="text-pink-600" />
                      <span>Fun Debate Modes</span>
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <Fire size={20} className="text-red-600" />
                          <h5 className="font-semibold text-red-900">Roast Mode</h5>
                        </div>
                        <p className="text-sm text-red-700">AI models hilariously destroy bad takes</p>
                      </div>
                      
                      <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <History size={20} className="text-blue-600" />
                          <h5 className="font-semibold text-blue-900">Historical</h5>
                        </div>
                        <p className="text-sm text-blue-700">Famous figures debate through AI</p>
                      </div>
                      
                      <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <Shuffle size={20} className="text-green-600" />
                          <h5 className="font-semibold text-green-900">Random Style</h5>
                        </div>
                        <p className="text-sm text-green-700">Debate like pirates, poets, or aliens!</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Setup Form */
                <div className="max-w-2xl mx-auto space-y-6 animate-slideUp">
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Set Up Your Debate</h3>
                    <p className="text-gray-600">Configure the topic and choose your AI combatants</p>
                  </div>

                  {/* Topic Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Debate Topic</label>
                    <textarea
                      value={customTopic}
                      onChange={(e) => setCustomTopic(e.target.value)}
                      placeholder="Enter a debate topic or question..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                      rows={3}
                    />
                  </div>

                  {/* Model Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">AI Debater #1</label>
                      <select
                        value={selectedModels.ai1}
                        onChange={(e) => setSelectedModels(prev => ({ ...prev, ai1: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        {AVAILABLE_MODELS.map(model => (
                          <option key={model.id} value={model.id}>{model.name}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">{getModelPersonality(selectedModels.ai1)}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">AI Debater #2</label>
                      <select
                        value={selectedModels.ai2}
                        onChange={(e) => setSelectedModels(prev => ({ ...prev, ai2: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        {AVAILABLE_MODELS.map(model => (
                          <option key={model.id} value={model.id}>{model.name}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">{getModelPersonality(selectedModels.ai2)}</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-4">
                    <button
                      onClick={() => setShowSetup(false)}
                      className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Back to Lobby
                    </button>
                    <button
                      onClick={() => startDebate(customTopic)}
                      disabled={!customTopic.trim() || isGenerating}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
                    >
                      {isGenerating ? 'Starting Debate...' : 'Start Debate! 🎤'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'debate' && currentDebate && (
            <div className="h-full flex flex-col">
              {/* Debate Header */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">{currentDebate.topic}</h3>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Vote size={16} className="text-gray-500" />
                      <span className="text-sm text-gray-600">
                        {currentDebate.votes.ai1 + currentDebate.votes.ai2} votes
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock size={16} className="text-gray-500" />
                      <span className="text-sm text-gray-600">
                        {currentDebate.messages.length} exchanges
                      </span>
                    </div>
                  </div>
                </div>

                {/* Debaters */}
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-3 rounded-lg border-2 transition-all ${
                    currentDebate.userVote === 'ai1' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900">{getModelDisplayName(currentDebate.ai1Model)}</h4>
                        <p className="text-sm text-gray-600">{currentDebate.ai1Position}</p>
                      </div>
                      <button
                        onClick={() => voteForAI('ai1')}
                        className={`p-2 rounded-lg transition-all ${
                          currentDebate.userVote === 'ai1' 
                            ? 'bg-purple-600 text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-purple-100'
                        }`}
                      >
                        <ThumbsUp size={16} />
                      </button>
                    </div>
                    <div className="mt-2 text-sm text-purple-600 font-medium">
                      {currentDebate.votes.ai1} votes
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg border-2 transition-all ${
                    currentDebate.userVote === 'ai2' ? 'border-pink-500 bg-pink-50' : 'border-gray-200 bg-white'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900">{getModelDisplayName(currentDebate.ai2Model)}</h4>
                        <p className="text-sm text-gray-600">{currentDebate.ai2Position}</p>
                      </div>
                      <button
                        onClick={() => voteForAI('ai2')}
                        className={`p-2 rounded-lg transition-all ${
                          currentDebate.userVote === 'ai2' 
                            ? 'bg-pink-600 text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-pink-100'
                        }`}
                      >
                        <ThumbsUp size={16} />
                      </button>
                    </div>
                    <div className="mt-2 text-sm text-pink-600 font-medium">
                      {currentDebate.votes.ai2} votes
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {currentDebate.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.speaker === 'user' ? 'justify-end' : 'justify-start'} animate-fadeInUp`}
                  >
                    <div className={`max-w-3xl p-4 rounded-lg ${
                      message.speaker === 'ai1' ? 'bg-purple-100 border border-purple-200' :
                      message.speaker === 'ai2' ? 'bg-pink-100 border border-pink-200' :
                      message.speaker === 'user' ? 'bg-blue-600 text-white' :
                      'bg-gray-100 border border-gray-200'
                    }`}>
                      {message.speaker !== 'user' && (
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Brain size={16} className={
                              message.speaker === 'ai1' ? 'text-purple-600' : 'text-pink-600'
                            } />
                            <span className="font-semibold text-sm">
                              {message.model ? getModelDisplayName(message.model) : 'Moderator'}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {message.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                      )}
                      
                      <p className="leading-relaxed">{message.content}</p>
                      
                      {message.speaker !== 'user' && (
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center space-x-1">
                            {REACTION_EMOJIS.map(emoji => (
                              <button
                                key={emoji}
                                onClick={() => addReaction(message.id, emoji)}
                                className={`p-1 rounded hover:bg-white/50 transition-all text-sm ${
                                  message.userReaction === emoji ? 'bg-white/70 scale-110' : ''
                                }`}
                              >
                                {emoji} {message.reactions?.[emoji] || ''}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {isGenerating && (
                  <div className="flex justify-center animate-pulse">
                    <div className="bg-gray-100 p-4 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Brain size={16} className="text-gray-600 animate-spin" />
                        <span className="text-gray-600">AI is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-gray-200 bg-white">
                <div className="flex space-x-4 mb-3">
                  <button
                    onClick={continueDebate}
                    disabled={isGenerating}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 transition-all duration-200 transform hover:scale-105"
                  >
                    {isGenerating ? 'AI Responding...' : 'Continue Debate'}
                  </button>
                </div>
                
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={userMessage}
                    onChange={(e) => setUserMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addUserMessage()}
                    placeholder="Jump in with your own argument..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    disabled={isGenerating}
                  />
                  <button
                    onClick={addUserMessage}
                    disabled={!userMessage.trim() || isGenerating}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="p-6 h-full overflow-y-auto">
              <div className="space-y-6 animate-fadeInUp">
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Debate Leaderboard 🏆</h3>
                  <p className="text-gray-600">See which AI models dominate the debate arena</p>
                </div>

                {stats ? (
                  <div className="space-y-6">
                    {/* Overall Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                        <div className="flex items-center space-x-3">
                          <Mic className="text-purple-600" size={24} />
                          <div>
                            <p className="text-sm text-purple-600 font-medium">Total Debates</p>
                            <p className="text-2xl font-bold text-purple-900">{stats.totalDebates}</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-4 rounded-lg border border-pink-200">
                        <div className="flex items-center space-x-3">
                          <Users className="text-pink-600" size={24} />
                          <div>
                            <p className="text-sm text-pink-600 font-medium">User Participation</p>
                            <p className="text-2xl font-bold text-pink-900">{stats.userParticipation}</p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                        <div className="flex items-center space-x-3">
                          <TrendingUp className="text-blue-600" size={24} />
                          <div>
                            <p className="text-sm text-blue-600 font-medium">Active Topics</p>
                            <p className="text-2xl font-bold text-blue-900">{stats.topTopics.length}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Model Rankings */}
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                        <Crown size={20} className="text-yellow-600" />
                        <span>AI Model Rankings</span>
                      </h4>
                      <div className="space-y-3">
                        {Object.entries(stats.modelWins)
                          .sort(([,a], [,b]) => b - a)
                          .map(([model, wins], index) => (
                            <div key={model} className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
                              <div className="flex items-center space-x-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                                  index === 0 ? 'bg-yellow-500' :
                                  index === 1 ? 'bg-gray-400' :
                                  index === 2 ? 'bg-amber-600' :
                                  'bg-gray-300'
                                }`}>
                                  {index + 1}
                                </div>
                                <div>
                                  <h5 className="font-semibold text-gray-900">{getModelDisplayName(model)}</h5>
                                  <p className="text-sm text-gray-500">{getModelPersonality(model)}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-gray-900">{wins}</p>
                                <p className="text-sm text-gray-500">wins</p>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>

                    {/* Top Topics */}
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                        <Fire size={20} className="text-red-600" />
                        <span>Hottest Debate Topics</span>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {stats.topTopics.map((topic, index) => (
                          <div key={index} className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                            <p className="text-sm font-medium text-gray-900">{topic}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Trophy size={48} className="text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Debates Yet</h3>
                    <p className="text-gray-500">Start your first debate to see the leaderboard!</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
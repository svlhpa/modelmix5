import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, Users, Trophy, ThumbsUp, ThumbsDown, MessageCircle, Send, Zap, Crown, Siren as Fire, Brain, Laugh, Clock, Vote, TrendingUp, Shuffle, History, Sparkles } from 'lucide-react';
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
  turnCount: number;
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
  { id: 'deepseek', name: 'DeepSeek', personality: 'Logical and methodical' }
];

const REACTION_EMOJIS = ['🔥', '🤯', '😂', '👏', '💯', '🎯', '🤔', '😴'];

export const DebateClub: React.FC<DebateClubProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'lobby' | 'debate' | 'leaderboard'>('lobby');
  const [currentDebate, setCurrentDebate] = useState<DebateSession | null>(null);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [selectedAI1, setSelectedAI1] = useState('openai');
  const [selectedAI2, setSelectedAI2] = useState('gemini');
  const [userInput, setUserInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [stats, setStats] = useState<DebateStats>({
    totalDebates: 0,
    modelWins: {},
    topTopics: [],
    userParticipation: 0
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadStats();
      // CRITICAL: Load AI settings when debate club opens
      initializeAIService();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [currentDebate?.messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initializeAIService = async () => {
    try {
      // Load current API settings to ensure AI service has access to keys
      await aiService.loadSettings();
      await aiService.loadModelSettings();
      console.log('AI service initialized for debate club');
    } catch (error) {
      console.error('Failed to initialize AI service:', error);
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

  const startDebate = async () => {
    if (!user) return;

    const topic = customTopic.trim() || selectedTopic;
    if (!topic) return;

    try {
      setIsGenerating(true);
      
      // CRITICAL: Ensure AI service is ready
      await initializeAIService();
      
      const debate = await debateService.createDebate({
        topic,
        ai1Model: selectedAI1,
        ai2Model: selectedAI2,
        userId: user.id
      });

      setCurrentDebate(debate);
      setActiveTab('debate');

      // Add moderator introduction
      const introMessage: DebateMessage = {
        id: `msg-${Date.now()}`,
        speaker: 'moderator',
        content: `🎭 Welcome to the AI Debate Club! Today's topic: "${topic}"\n\n🤖 ${AVAILABLE_MODELS.find(m => m.id === selectedAI1)?.name} will argue ${debate.ai1Position}\n🤖 ${AVAILABLE_MODELS.find(m => m.id === selectedAI2)?.name} will argue ${debate.ai2Position}\n\nLet the debate begin! 🎤`,
        timestamp: new Date()
      };

      debate.messages.push(introMessage);
      debate.status = 'opening';
      setCurrentDebate({ ...debate });
      
      // Start the debate with a small delay for better UX
      setTimeout(() => {
        generateNextResponse(debate);
      }, 1000);
      
    } catch (error) {
      console.error('Failed to start debate:', error);
      setIsGenerating(false);
    }
  };

  const generateNextResponse = async (debate: DebateSession) => {
    if (!debate || debate.status === 'finished') {
      setIsGenerating(false);
      return;
    }

    console.log(`Generating response for ${debate.currentTurn}, turn ${debate.turnCount}`);
    setIsGenerating(true);
    
    try {
      const isAI1Turn = debate.currentTurn === 'ai1';
      const model = isAI1Turn ? debate.ai1Model : debate.ai2Model;
      const position = isAI1Turn ? debate.ai1Position : debate.ai2Position;
      
      // Determine response type based on turn count
      let responseType: 'opening' | 'rebuttal' | 'closing' = 'rebuttal';
      if (debate.turnCount === 0 || debate.turnCount === 1) {
        responseType = 'opening';
      } else if (debate.turnCount >= 5) {
        responseType = 'closing';
      }

      console.log(`Calling AI service for ${model} with response type: ${responseType}`);
      
      const response = await aiService.generateDebateResponse(
        debate.topic,
        position,
        debate.messages,
        model,
        responseType
      );

      console.log(`Got response from ${model}:`, response.substring(0, 100) + '...');

      const newMessage: DebateMessage = {
        id: `msg-${Date.now()}`,
        speaker: isAI1Turn ? 'ai1' : 'ai2',
        content: response,
        timestamp: new Date(),
        model: AVAILABLE_MODELS.find(m => m.id === model)?.name,
        reactions: {}
      };

      const updatedDebate = { ...debate };
      updatedDebate.messages.push(newMessage);
      updatedDebate.turnCount++;
      
      // Switch turns
      updatedDebate.currentTurn = isAI1Turn ? 'ai2' : 'ai1';
      
      // Check if debate should end
      if (updatedDebate.turnCount >= 6) {
        updatedDebate.status = 'finished';
        
        // Determine winner based on votes
        if (updatedDebate.votes.ai1 > updatedDebate.votes.ai2) {
          updatedDebate.winner = 'ai1';
        } else if (updatedDebate.votes.ai2 > updatedDebate.votes.ai1) {
          updatedDebate.winner = 'ai2';
        } else {
          updatedDebate.winner = 'tie';
        }

        // Add conclusion message
        const conclusionMessage: DebateMessage = {
          id: `msg-${Date.now()}-conclusion`,
          speaker: 'moderator',
          content: `🏁 The debate has concluded!\n\n📊 Final Results:\n🤖 ${AVAILABLE_MODELS.find(m => m.id === updatedDebate.ai1Model)?.name}: ${updatedDebate.votes.ai1} votes\n🤖 ${AVAILABLE_MODELS.find(m => m.id === updatedDebate.ai2Model)?.name}: ${updatedDebate.votes.ai2} votes\n\n${updatedDebate.winner === 'tie' ? '🤝 It\'s a tie! Both AIs presented compelling arguments.' : `🏆 Winner: ${AVAILABLE_MODELS.find(m => m.id === (updatedDebate.winner === 'ai1' ? updatedDebate.ai1Model : updatedDebate.ai2Model))?.name}!`}\n\nThank you for participating! 👏`,
          timestamp: new Date()
        };
        
        updatedDebate.messages.push(conclusionMessage);
        setIsGenerating(false);
        await loadStats(); // Refresh stats after debate ends
      }

      await debateService.updateDebate(updatedDebate);
      setCurrentDebate(updatedDebate);
      
      // Continue the debate if not finished
      if (updatedDebate.status !== 'finished') {
        setTimeout(() => generateNextResponse(updatedDebate), 3000); // 3 second delay between responses
      }
      
    } catch (error) {
      console.error('Failed to generate debate response:', error);
      setIsGenerating(false);
      
      // Add error message to debate
      const errorMessage: DebateMessage = {
        id: `msg-${Date.now()}-error`,
        speaker: 'moderator',
        content: `⚠️ ${AVAILABLE_MODELS.find(m => m.id === (debate.currentTurn === 'ai1' ? debate.ai1Model : debate.ai2Model))?.name} encountered an issue generating a response. The debate will continue with the next participant.`,
        timestamp: new Date()
      };
      
      const updatedDebate = { ...debate };
      updatedDebate.messages.push(errorMessage);
      updatedDebate.currentTurn = debate.currentTurn === 'ai1' ? 'ai2' : 'ai1';
      
      setCurrentDebate(updatedDebate);
      await debateService.updateDebate(updatedDebate);
      
      // Continue with next AI if possible
      if (updatedDebate.turnCount < 6) {
        setTimeout(() => generateNextResponse(updatedDebate), 2000);
      }
    }
  };

  const handleVote = async (side: 'ai1' | 'ai2') => {
    if (!currentDebate || currentDebate.userVote) return;

    const updatedDebate = { ...currentDebate };
    updatedDebate.votes[side]++;
    updatedDebate.userVote = side;
    
    await debateService.updateDebate(updatedDebate);
    setCurrentDebate(updatedDebate);
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!currentDebate) return;

    const updatedDebate = { ...currentDebate };
    const message = updatedDebate.messages.find(m => m.id === messageId);
    
    if (message) {
      if (!message.reactions) message.reactions = {};
      
      // Remove previous reaction if exists
      if (message.userReaction) {
        message.reactions[message.userReaction] = Math.max(0, (message.reactions[message.userReaction] || 0) - 1);
      }
      
      // Add new reaction
      message.reactions[emoji] = (message.reactions[emoji] || 0) + 1;
      message.userReaction = emoji;
      
      await debateService.updateDebate(updatedDebate);
      setCurrentDebate(updatedDebate);
    }
  };

  const handleUserInput = async () => {
    if (!currentDebate || !userInput.trim() || isGenerating) return;

    const userMessage: DebateMessage = {
      id: `msg-${Date.now()}-user`,
      speaker: 'user',
      content: userInput.trim(),
      timestamp: new Date()
    };

    const updatedDebate = { ...currentDebate };
    updatedDebate.messages.push(userMessage);
    
    setUserInput('');
    setCurrentDebate(updatedDebate);
    
    // Generate AI response to user input
    setIsGenerating(true);
    
    try {
      const isAI1Turn = updatedDebate.currentTurn === 'ai1';
      const model = isAI1Turn ? updatedDebate.ai1Model : updatedDebate.ai2Model;
      const position = isAI1Turn ? updatedDebate.ai1Position : updatedDebate.ai2Position;
      
      const response = await aiService.generateDebateResponse(
        updatedDebate.topic,
        position,
        updatedDebate.messages,
        model,
        'response_to_user'
      );

      const aiResponse: DebateMessage = {
        id: `msg-${Date.now()}-ai-response`,
        speaker: isAI1Turn ? 'ai1' : 'ai2',
        content: response,
        timestamp: new Date(),
        model: AVAILABLE_MODELS.find(m => m.id === model)?.name,
        reactions: {}
      };

      updatedDebate.messages.push(aiResponse);
      await debateService.updateDebate(updatedDebate);
      setCurrentDebate(updatedDebate);
      
    } catch (error) {
      console.error('Failed to generate AI response to user:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const getModelIcon = (modelId: string) => {
    switch (modelId) {
      case 'openai': return '🤖';
      case 'gemini': return '💎';
      case 'deepseek': return '🔍';
      default: return '🤖';
    }
  };

  const getSpeakerColor = (speaker: string) => {
    switch (speaker) {
      case 'ai1': return 'from-blue-500 to-blue-600';
      case 'ai2': return 'from-purple-500 to-purple-600';
      case 'user': return 'from-green-500 to-green-600';
      case 'moderator': return 'from-gray-500 to-gray-600';
      default: return 'from-gray-500 to-gray-600';
    }
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
          <div className="flex space-x-1 mt-4 bg-white/10 p-1 rounded-lg">
            {[
              { id: 'lobby', label: 'Debate Lobby', icon: Users },
              { id: 'debate', label: 'Live Debate', icon: Mic },
              { id: 'leaderboard', label: 'Leaderboard', icon: Trophy }
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
              <div className="max-w-4xl mx-auto space-y-6">
                {/* API Key Notice */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <div className="p-1 bg-blue-100 rounded-lg">
                      <Sparkles className="text-blue-600" size={16} />
                    </div>
                    <div>
                      <h4 className="font-medium text-blue-800 mb-1">🔑 API Key Information</h4>
                      <p className="text-sm text-blue-700">
                        The debate will use your configured API keys from Settings, or fall back to free trial access if available. 
                        Make sure you have at least one AI model configured to participate in debates!
                      </p>
                    </div>
                  </div>
                </div>

                {/* Topic Selection */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <Sparkles className="text-purple-600" size={20} />
                    <span>Choose Your Debate Topic</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    {DEBATE_TOPICS.map((topic, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setSelectedTopic(topic);
                          setCustomTopic('');
                        }}
                        className={`p-3 text-left rounded-lg border-2 transition-all duration-200 hover:scale-105 ${
                          selectedTopic === topic
                            ? 'border-purple-500 bg-purple-50 text-purple-900'
                            : 'border-gray-200 bg-white hover:border-purple-300'
                        }`}
                      >
                        <span className="text-sm font-medium">{topic}</span>
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      value={customTopic}
                      onChange={(e) => {
                        setCustomTopic(e.target.value);
                        setSelectedTopic('');
                      }}
                      placeholder="Or enter your own debate topic..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <Shuffle className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  </div>
                </div>

                {/* AI Model Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h4 className="font-semibold text-blue-900 mb-4 flex items-center space-x-2">
                      <Brain className="text-blue-600" size={20} />
                      <span>AI Debater #1</span>
                    </h4>
                    <div className="space-y-3">
                      {AVAILABLE_MODELS.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => setSelectedAI1(model.id)}
                          className={`w-full p-3 text-left rounded-lg border-2 transition-all duration-200 hover:scale-105 ${
                            selectedAI1 === model.id
                              ? 'border-blue-500 bg-blue-100'
                              : 'border-gray-200 bg-white hover:border-blue-300'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <span className="text-xl">{getModelIcon(model.id)}</span>
                            <div>
                              <div className="font-medium text-gray-900">{model.name}</div>
                              <div className="text-xs text-gray-500">{model.personality}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                    <h4 className="font-semibold text-purple-900 mb-4 flex items-center space-x-2">
                      <Brain className="text-purple-600" size={20} />
                      <span>AI Debater #2</span>
                    </h4>
                    <div className="space-y-3">
                      {AVAILABLE_MODELS.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => setSelectedAI2(model.id)}
                          className={`w-full p-3 text-left rounded-lg border-2 transition-all duration-200 hover:scale-105 ${
                            selectedAI2 === model.id
                              ? 'border-purple-500 bg-purple-100'
                              : 'border-gray-200 bg-white hover:border-purple-300'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <span className="text-xl">{getModelIcon(model.id)}</span>
                            <div>
                              <div className="font-medium text-gray-900">{model.name}</div>
                              <div className="text-xs text-gray-500">{model.personality}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Start Debate Button */}
                <div className="text-center">
                  <button
                    onClick={startDebate}
                    disabled={(!selectedTopic && !customTopic.trim()) || selectedAI1 === selectedAI2 || isGenerating}
                    className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold text-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 transform shadow-lg"
                  >
                    {isGenerating ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Starting Debate...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Zap size={20} />
                        <span>Start Epic Debate! 🚀</span>
                      </div>
                    )}
                  </button>
                  
                  {selectedAI1 === selectedAI2 && (
                    <p className="text-red-600 text-sm mt-2">Please select different AI models for the debate!</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'debate' && currentDebate && (
            <div className="h-full flex flex-col">
              {/* Debate Header */}
              <div className="bg-gray-50 border-b border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{currentDebate.topic}</h3>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                      <span className="flex items-center space-x-1">
                        <Vote size={14} />
                        <span>{currentDebate.votes.ai1 + currentDebate.votes.ai2} votes</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Clock size={14} />
                        <span>Turn {currentDebate.turnCount}/6</span>
                      </span>
                      {isGenerating && (
                        <span className="flex items-center space-x-1 text-purple-600">
                          <div className="w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                          <span>AI thinking...</span>
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Vote Buttons */}
                  {currentDebate.status !== 'finished' && !currentDebate.userVote && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleVote('ai1')}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                      >
                        <ThumbsUp size={16} />
                        <span>{AVAILABLE_MODELS.find(m => m.id === currentDebate.ai1Model)?.name}</span>
                        <span className="bg-blue-200 px-2 py-1 rounded-full text-xs">{currentDebate.votes.ai1}</span>
                      </button>
                      <button
                        onClick={() => handleVote('ai2')}
                        className="flex items-center space-x-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                      >
                        <ThumbsUp size={16} />
                        <span>{AVAILABLE_MODELS.find(m => m.id === currentDebate.ai2Model)?.name}</span>
                        <span className="bg-purple-200 px-2 py-1 rounded-full text-xs">{currentDebate.votes.ai2}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {currentDebate.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-3xl ${message.speaker === 'moderator' ? 'w-full' : ''}`}>
                      <div
                        className={`p-4 rounded-lg ${
                          message.speaker === 'moderator'
                            ? 'bg-gray-100 border border-gray-200 text-center'
                            : message.speaker === 'user'
                              ? 'bg-gradient-to-r from-green-500 to-green-600 text-white'
                              : `bg-gradient-to-r ${getSpeakerColor(message.speaker)} text-white`
                        }`}
                      >
                        {message.speaker !== 'moderator' && message.speaker !== 'user' && (
                          <div className="flex items-center space-x-2 mb-2 text-white/80">
                            <span className="text-lg">{getModelIcon(message.speaker === 'ai1' ? currentDebate.ai1Model : currentDebate.ai2Model)}</span>
                            <span className="font-medium text-sm">{message.model}</span>
                            <span className="text-xs">
                              {message.speaker === 'ai1' ? currentDebate.ai1Position : currentDebate.ai2Position}
                            </span>
                          </div>
                        )}
                        
                        <div className="whitespace-pre-wrap leading-relaxed">
                          {message.content}
                        </div>
                        
                        <div className="flex items-center justify-between mt-3">
                          <span className={`text-xs ${message.speaker === 'moderator' ? 'text-gray-500' : 'text-white/70'}`}>
                            {message.timestamp.toLocaleTimeString()}
                          </span>
                          
                          {message.speaker !== 'moderator' && message.speaker !== 'user' && (
                            <div className="flex items-center space-x-1">
                              {REACTION_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleReaction(message.id, emoji)}
                                  className={`p-1 rounded hover:bg-white/20 transition-colors ${
                                    message.userReaction === emoji ? 'bg-white/20' : ''
                                  }`}
                                >
                                  <span className="text-sm">{emoji}</span>
                                  {message.reactions?.[emoji] && (
                                    <span className="text-xs ml-1">{message.reactions[emoji]}</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {isGenerating && (
                  <div className="flex justify-center">
                    <div className="bg-gray-100 p-4 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <span className="text-sm text-gray-600">
                          {AVAILABLE_MODELS.find(m => m.id === (currentDebate.currentTurn === 'ai1' ? currentDebate.ai1Model : currentDebate.ai2Model))?.name} is crafting a response...
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* User Input */}
              {currentDebate.status !== 'finished' && (
                <div className="border-t border-gray-200 p-4">
                  <div className="flex space-x-3">
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleUserInput()}
                      placeholder="Jump in with your own argument..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={isGenerating}
                    />
                    <button
                      onClick={handleUserInput}
                      disabled={!userInput.trim() || isGenerating}
                      className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <div className="p-6 h-full overflow-y-auto">
              <div className="max-w-4xl mx-auto space-y-6">
                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-3">
                      <Trophy className="text-blue-600" size={24} />
                      <div>
                        <p className="text-sm text-blue-600 font-medium">Total Debates</p>
                        <p className="text-2xl font-bold text-blue-900">{stats.totalDebates}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-3">
                      <Users className="text-green-600" size={24} />
                      <div>
                        <p className="text-sm text-green-600 font-medium">User Participation</p>
                        <p className="text-2xl font-bold text-green-900">{stats.userParticipation}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                    <div className="flex items-center space-x-3">
                      <TrendingUp className="text-purple-600" size={24} />
                      <div>
                        <p className="text-sm text-purple-600 font-medium">Top Topics</p>
                        <p className="text-2xl font-bold text-purple-900">{stats.topTopics.length}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Model Leaderboard */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <Crown className="text-yellow-500" size={20} />
                    <span>AI Model Leaderboard</span>
                  </h3>
                  
                  {Object.keys(stats.modelWins).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(stats.modelWins)
                        .sort(([,a], [,b]) => b - a)
                        .map(([model, wins], index) => (
                          <div key={model} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                index === 0 ? 'bg-yellow-100 text-yellow-600' :
                                index === 1 ? 'bg-gray-100 text-gray-600' :
                                'bg-orange-100 text-orange-600'
                              }`}>
                                {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                              </div>
                              <span className="text-xl">{getModelIcon(model)}</span>
                              <span className="font-medium">{AVAILABLE_MODELS.find(m => m.id === model)?.name || model}</span>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-lg">{wins}</div>
                              <div className="text-xs text-gray-500">wins</div>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Trophy size={48} className="mx-auto mb-4 opacity-50" />
                      <p>No debates completed yet!</p>
                      <p className="text-sm">Start a debate to see the leaderboard.</p>
                    </div>
                  )}
                </div>

                {/* Popular Topics */}
                {stats.topTopics.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                      <Fire className="text-red-500" size={20} />
                      <span>Trending Topics</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {stats.topTopics.map((topic, index) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg">
                          <span className="text-sm font-medium text-gray-900">{topic}</span>
                        </div>
                      ))}
                    </div>
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
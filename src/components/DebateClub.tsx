import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, Users, Trophy, ThumbsUp, ThumbsDown, MessageCircle, Send, Zap, Crown, Siren as Fire, Brain, Laugh, Clock, Vote, TrendingUp, Shuffle, History, Sparkles, RotateCcw, Play } from 'lucide-react';
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
  round: number;
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

  // CRITICAL: Enhanced markdown parser for debate messages
  const parseMarkdown = (text: string) => {
    if (!text) return text;
    
    let parsed = text;
    
    // Parse headers (### Header, ## Header, # Header)
    parsed = parsed.replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold mb-2 mt-3">$1</h3>');
    parsed = parsed.replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mb-2 mt-4">$1</h2>');
    parsed = parsed.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mb-3 mt-4">$1</h1>');
    
    // Parse **bold** text
    parsed = parsed.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>');
    
    // Parse *italic* text
    parsed = parsed.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
    
    // Parse `code` text
    parsed = parsed.replace(/`(.*?)`/g, '<code class="bg-white/20 px-1 py-0.5 rounded text-sm font-mono">$1</code>');
    
    // Parse bullet points (- item or • item)
    parsed = parsed.replace(/^[-•]\s+(.*$)/gm, '<li class="ml-4 mb-1">• $1</li>');
    
    // Wrap consecutive list items in ul tags
    parsed = parsed.replace(/(<li.*?<\/li>\s*)+/g, '<ul class="mb-2">$&</ul>');
    
    // Parse numbered lists (1. item, 2. item, etc.)
    parsed = parsed.replace(/^\d+\.\s+(.*$)/gm, '<li class="ml-4 mb-1">$1</li>');
    
    // Parse line breaks
    parsed = parsed.replace(/\n/g, '<br>');
    
    // Parse quotes (> text)
    parsed = parsed.replace(/^>\s+(.*$)/gm, '<blockquote class="border-l-4 border-white/30 pl-4 italic opacity-90 my-2">$1</blockquote>');
    
    return parsed;
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

      // Initialize round counter
      debate.round = 1;

      setCurrentDebate(debate);
      setActiveTab('debate');

      // Add moderator introduction with Parliament style
      const introMessage: DebateMessage = {
        id: `msg-${Date.now()}`,
        speaker: 'moderator',
        content: `🏛️ **Order! Order!** Welcome to the Parliamentary AI Debate Chamber!\n\n📜 **Motion before the House:** "${topic}"\n\n🎭 **The Honorable Members:**\n• **${AVAILABLE_MODELS.find(m => m.id === selectedAI1)?.name}** (Government Bench) - ${debate.ai1Position}\n• **${AVAILABLE_MODELS.find(m => m.id === selectedAI2)?.name}** (Opposition Bench) - ${debate.ai2Position}\n\n⚖️ **Round 1 of Parliamentary Debate**\n\nThe Chair recognizes the Government to open proceedings! 🎤`,
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

    console.log(`Generating response for ${debate.currentTurn}, turn ${debate.turnCount}, round ${debate.round}`);
    setIsGenerating(true);
    
    try {
      const isAI1Turn = debate.currentTurn === 'ai1';
      const model = isAI1Turn ? debate.ai1Model : debate.ai2Model;
      const position = isAI1Turn ? debate.ai1Position : debate.ai2Position;
      const modelName = AVAILABLE_MODELS.find(m => m.id === model)?.name;
      const opponentName = AVAILABLE_MODELS.find(m => m.id === isAI1Turn ? debate.ai2Model : debate.ai1Model)?.name;
      
      // Determine response type based on turn count
      let responseType: 'opening' | 'rebuttal' | 'closing' = 'rebuttal';
      if (debate.turnCount === 0 || debate.turnCount === 1) {
        responseType = 'opening';
      } else if (debate.turnCount >= 5) {
        responseType = 'closing';
      }

      console.log(`Calling AI service for ${model} with response type: ${responseType}`);
      
      // Enhanced system prompt for Parliament-style debate
      const parliamentPrompt = `You are ${modelName} participating in a formal Parliamentary debate about: "${debate.topic}"

Your position: ${position}
Your opponent: ${opponentName}
Current round: ${debate.round}

CRITICAL PARLIAMENTARY DEBATE RULES:
- Address your opponent directly by name (e.g., "The Honorable ${opponentName}")
- Use formal parliamentary language ("I yield the floor", "Point of order", "The distinguished member")
- Reference previous arguments made by your opponent
- Be respectful but assertive in your disagreement
- Use phrases like "My learned colleague is mistaken when they claim..."
- Build upon the debate flow, don't just repeat your position
- Keep responses 2-3 paragraphs maximum
- End with a strong statement that invites rebuttal

This is ${responseType === 'opening' ? 'your opening statement' : responseType === 'closing' ? 'your closing argument' : 'a rebuttal to your opponent'}. Make it compelling and directly engage with the ongoing debate!`;
      
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
        model: modelName,
        reactions: {}
      };

      const updatedDebate = { ...debate };
      updatedDebate.messages.push(newMessage);
      updatedDebate.turnCount++;
      
      // Switch turns
      updatedDebate.currentTurn = isAI1Turn ? 'ai2' : 'ai1';
      
      // Check if round should end (after 6 turns)
      if (updatedDebate.turnCount >= 6) {
        // Add round conclusion
        const roundConclusionMessage: DebateMessage = {
          id: `msg-${Date.now()}-round-end`,
          speaker: 'moderator',
          content: `🏛️ **The Chair calls for order!**\n\n⚖️ **Round ${updatedDebate.round} has concluded.**\n\n📊 **Current Standing:**\n• ${AVAILABLE_MODELS.find(m => m.id === updatedDebate.ai1Model)?.name}: ${updatedDebate.votes.ai1} votes\n• ${AVAILABLE_MODELS.find(m => m.id === updatedDebate.ai2Model)?.name}: ${updatedDebate.votes.ai2} votes\n\n🎭 **The House may now vote on this round, or call for another round to strengthen arguments!**`,
          timestamp: new Date()
        };
        
        updatedDebate.messages.push(roundConclusionMessage);
        updatedDebate.status = 'finished';
        setIsGenerating(false);
        await loadStats(); // Refresh stats after round ends
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
        content: `⚠️ The Honorable ${AVAILABLE_MODELS.find(m => m.id === (debate.currentTurn === 'ai1' ? debate.ai1Model : debate.ai2Model))?.name} has encountered a technical difficulty. The Chair will proceed with the next speaker.`,
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

  const startNewRound = async () => {
    if (!currentDebate) return;

    setIsGenerating(true);
    
    const updatedDebate = { ...currentDebate };
    updatedDebate.round = (updatedDebate.round || 1) + 1;
    updatedDebate.turnCount = 0;
    updatedDebate.status = 'debate';
    updatedDebate.currentTurn = 'ai1'; // Government starts new round
    
    // Add new round announcement
    const newRoundMessage: DebateMessage = {
      id: `msg-${Date.now()}-new-round`,
      speaker: 'moderator',
      content: `🏛️ **The Speaker calls the House to order!**\n\n🔥 **Round ${updatedDebate.round} - Strengthening Arguments**\n\nThe previous round has concluded, and the House has called for continued debate to strengthen the proposition!\n\n📜 **Motion remains:** "${updatedDebate.topic}"\n\n⚖️ Both sides may now present **stronger, more compelling arguments** building upon the previous round.\n\nThe Chair recognizes the Government to begin Round ${updatedDebate.round}! 🎤`,
      timestamp: new Date()
    };
    
    updatedDebate.messages.push(newRoundMessage);
    
    await debateService.updateDebate(updatedDebate);
    setCurrentDebate(updatedDebate);
    
    // Start the new round
    setTimeout(() => {
      generateNextResponse(updatedDebate);
    }, 1000);
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
      content: `🎤 **Point of Order from the Gallery!**\n\n"${userInput.trim()}"`,
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
      const modelName = AVAILABLE_MODELS.find(m => m.id === model)?.name;
      
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
        content: `**The Honorable ${modelName} responds to the gallery:**\n\n${response}`,
        timestamp: new Date(),
        model: modelName,
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

  const getSpeakerAlignment = (speaker: string) => {
    switch (speaker) {
      case 'ai1': return 'justify-start'; // Left side (Government)
      case 'ai2': return 'justify-end';   // Right side (Opposition)
      case 'user': return 'justify-center'; // Center
      case 'moderator': return 'justify-center'; // Center
      default: return 'justify-center';
    }
  };

  const getSpeakerColor = (speaker: string) => {
    switch (speaker) {
      case 'ai1': return 'from-blue-500 to-blue-600'; // Government Blue
      case 'ai2': return 'from-red-500 to-red-600';   // Opposition Red
      case 'user': return 'from-green-500 to-green-600'; // User Green
      case 'moderator': return 'from-gray-500 to-gray-600'; // Moderator Gray
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const getSpeakerLabel = (speaker: string, debate: DebateSession) => {
    switch (speaker) {
      case 'ai1': return `🏛️ Government Bench - ${AVAILABLE_MODELS.find(m => m.id === debate.ai1Model)?.name}`;
      case 'ai2': return `⚖️ Opposition Bench - ${AVAILABLE_MODELS.find(m => m.id === debate.ai2Model)?.name}`;
      case 'user': return '🎤 Gallery Intervention';
      case 'moderator': return '🏛️ The Speaker';
      default: return 'Unknown Speaker';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-white rounded-xl w-full h-full md:max-w-6xl md:w-full md:h-[90vh] flex flex-col overflow-hidden transform animate-slideUp">
        {/* Compact Header for Mobile */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-3 md:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 md:space-x-3 min-w-0">
              <div className="p-1 md:p-2 bg-white/20 rounded-lg animate-bounceIn">
                <Mic size={16} className="md:hidden" />
                <Mic size={24} className="hidden md:block" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg md:text-2xl font-bold truncate">AI Debate Club 🏛️</h2>
                <p className="text-xs md:text-sm text-purple-100 hidden md:block">Parliamentary-style AI debates with formal proceedings!</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 md:p-2 rounded-lg hover:bg-white/20 transition-all duration-200 hover:scale-110 flex-shrink-0"
            >
              <X size={20} className="md:hidden" />
              <X size={24} className="hidden md:block" />
            </button>
          </div>

          {/* Compact Tab Navigation for Mobile */}
          <div className="flex space-x-1 mt-2 md:mt-4 bg-white/10 p-1 rounded-lg">
            {[
              { id: 'lobby', label: 'Lobby', icon: Users },
              { id: 'debate', label: 'Live', icon: Mic },
              { id: 'leaderboard', label: 'Stats', icon: Trophy }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center space-x-1 md:space-x-2 px-2 md:px-4 py-1.5 md:py-2 rounded-md transition-all duration-200 text-xs md:text-sm ${
                  activeTab === tab.id 
                    ? 'bg-white text-purple-600 shadow-sm transform scale-105' 
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <tab.icon size={14} className="md:hidden" />
                <tab.icon size={16} className="hidden md:block" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content - Optimized for Mobile */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'lobby' && (
            <div className="p-3 md:p-6 h-full overflow-y-auto">
              <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
                {/* Compact API Key Notice for Mobile */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 md:p-4">
                  <div className="flex items-start space-x-2 md:space-x-3">
                    <div className="p-1 bg-blue-100 rounded-lg flex-shrink-0">
                      <Sparkles className="text-blue-600" size={14} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-medium text-blue-800 mb-1 text-sm md:text-base">🏛️ Parliamentary Rules</h4>
                      <p className="text-xs md:text-sm text-blue-700">
                        AIs address each other formally in Parliament style! They reference previous arguments and engage in proper debate flow.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Compact Topic Selection for Mobile */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-3 md:p-6">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4 flex items-center space-x-2">
                    <Sparkles className="text-purple-600" size={16} />
                    <span>Choose Your Motion</span>
                  </h3>
                  
                  {/* Mobile-optimized topic grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3 mb-3 md:mb-4">
                    {DEBATE_TOPICS.slice(0, 6).map((topic, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setSelectedTopic(topic);
                          setCustomTopic('');
                        }}
                        className={`p-2 md:p-3 text-left rounded-lg border-2 transition-all duration-200 hover:scale-105 text-xs md:text-sm ${
                          selectedTopic === topic
                            ? 'border-purple-500 bg-purple-50 text-purple-900'
                            : 'border-gray-200 bg-white hover:border-purple-300'
                        }`}
                      >
                        <span className="font-medium">{topic}</span>
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
                      placeholder="Or propose your own motion..."
                      className="w-full px-3 md:px-4 py-2 md:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm md:text-base"
                    />
                    <Shuffle className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  </div>
                </div>

                {/* Compact AI Model Selection for Mobile */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 md:p-6">
                    <h4 className="font-semibold text-blue-900 mb-2 md:mb-4 flex items-center space-x-2 text-sm md:text-base">
                      <Brain className="text-blue-600" size={16} />
                      <span>🏛️ Government (Pro)</span>
                    </h4>
                    <div className="space-y-2 md:space-y-3">
                      {AVAILABLE_MODELS.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => setSelectedAI1(model.id)}
                          className={`w-full p-2 md:p-3 text-left rounded-lg border-2 transition-all duration-200 hover:scale-105 ${
                            selectedAI1 === model.id
                              ? 'border-blue-500 bg-blue-100'
                              : 'border-gray-200 bg-white hover:border-blue-300'
                          }`}
                        >
                          <div className="flex items-center space-x-2 md:space-x-3">
                            <span className="text-lg md:text-xl">{getModelIcon(model.id)}</span>
                            <div className="min-w-0">
                              <div className="font-medium text-gray-900 text-sm md:text-base">{model.name}</div>
                              <div className="text-xs text-gray-500 hidden md:block">{model.personality}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 md:p-6">
                    <h4 className="font-semibold text-red-900 mb-2 md:mb-4 flex items-center space-x-2 text-sm md:text-base">
                      <Brain className="text-red-600" size={16} />
                      <span>⚖️ Opposition (Con)</span>
                    </h4>
                    <div className="space-y-2 md:space-y-3">
                      {AVAILABLE_MODELS.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => setSelectedAI2(model.id)}
                          className={`w-full p-2 md:p-3 text-left rounded-lg border-2 transition-all duration-200 hover:scale-105 ${
                            selectedAI2 === model.id
                              ? 'border-red-500 bg-red-100'
                              : 'border-gray-200 bg-white hover:border-red-300'
                          }`}
                        >
                          <div className="flex items-center space-x-2 md:space-x-3">
                            <span className="text-lg md:text-xl">{getModelIcon(model.id)}</span>
                            <div className="min-w-0">
                              <div className="font-medium text-gray-900 text-sm md:text-base">{model.name}</div>
                              <div className="text-xs text-gray-500 hidden md:block">{model.personality}</div>
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
                    className="w-full md:w-auto px-6 md:px-8 py-3 md:py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold text-sm md:text-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 transform shadow-lg"
                  >
                    {isGenerating ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Convening...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center space-x-2">
                        <Zap size={16} className="md:hidden" />
                        <Zap size={20} className="hidden md:block" />
                        <span>🏛️ Start Debate!</span>
                      </div>
                    )}
                  </button>
                  
                  {selectedAI1 === selectedAI2 && (
                    <p className="text-red-600 text-xs md:text-sm mt-2">Please select different AI models!</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'debate' && currentDebate && (
            <div className="h-full flex flex-col">
              {/* Compact Debate Header for Mobile */}
              <div className="bg-gray-50 border-b border-gray-200 p-2 md:p-4">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 text-sm md:text-base truncate">🏛️ {currentDebate.topic}</h3>
                    <div className="flex items-center space-x-2 md:space-x-4 mt-1 text-xs md:text-sm text-gray-600">
                      <span className="flex items-center space-x-1">
                        <Vote size={12} />
                        <span>{currentDebate.votes.ai1 + currentDebate.votes.ai2} votes</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Clock size={12} />
                        <span>R{currentDebate.round || 1} - T{currentDebate.turnCount}/6</span>
                      </span>
                      {isGenerating && (
                        <span className="flex items-center space-x-1 text-purple-600">
                          <div className="w-2 h-2 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                          <span className="hidden md:inline">AI debating...</span>
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Compact Vote Buttons for Mobile */}
                  {currentDebate.status !== 'finished' && !currentDebate.userVote && (
                    <div className="flex space-x-1 md:space-x-2 flex-shrink-0">
                      <button
                        onClick={() => handleVote('ai1')}
                        className="flex items-center space-x-1 px-2 md:px-4 py-1 md:py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-xs md:text-sm"
                      >
                        <ThumbsUp size={12} />
                        <span className="hidden md:inline">Gov</span>
                        <span className="bg-blue-200 px-1 md:px-2 py-0.5 md:py-1 rounded-full text-xs">{currentDebate.votes.ai1}</span>
                      </button>
                      <button
                        onClick={() => handleVote('ai2')}
                        className="flex items-center space-x-1 px-2 md:px-4 py-1 md:py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-xs md:text-sm"
                      >
                        <ThumbsUp size={12} />
                        <span className="hidden md:inline">Opp</span>
                        <span className="bg-red-200 px-1 md:px-2 py-0.5 md:py-1 rounded-full text-xs">{currentDebate.votes.ai2}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Messages - Optimized for Mobile Reading */}
              <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2 md:space-y-4">
                {currentDebate.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${getSpeakerAlignment(message.speaker)}`}
                  >
                    <div className={`max-w-full ${message.speaker === 'moderator' || message.speaker === 'user' ? 'w-full' : 'max-w-[85%] md:max-w-2xl'}`}>
                      <div
                        className={`p-2 md:p-4 rounded-lg text-sm md:text-base ${
                          message.speaker === 'moderator'
                            ? 'bg-gray-100 border border-gray-200 text-center'
                            : message.speaker === 'user'
                              ? 'bg-gradient-to-r from-green-500 to-green-600 text-white'
                              : `bg-gradient-to-r ${getSpeakerColor(message.speaker)} text-white`
                        }`}
                      >
                        {message.speaker !== 'moderator' && (
                          <div className="flex items-center space-x-1 md:space-x-2 mb-1 md:mb-2 text-white/80">
                            <span className="text-sm md:text-lg">{getModelIcon(message.speaker === 'ai1' ? currentDebate.ai1Model : currentDebate.ai2Model)}</span>
                            <span className="font-medium text-xs md:text-sm truncate">{getSpeakerLabel(message.speaker, currentDebate)}</span>
                          </div>
                        )}
                        
                        {/* Enhanced message content with markdown parsing */}
                        <div 
                          className="leading-relaxed"
                          dangerouslySetInnerHTML={{ 
                            __html: parseMarkdown(message.content) 
                          }}
                        />
                        
                        <div className="flex items-center justify-between mt-2 md:mt-3">
                          <span className={`text-xs ${message.speaker === 'moderator' ? 'text-gray-500' : 'text-white/70'}`}>
                            {message.timestamp.toLocaleTimeString()}
                          </span>
                          
                          {message.speaker !== 'moderator' && message.speaker !== 'user' && (
                            <div className="flex items-center space-x-1">
                              {REACTION_EMOJIS.slice(0, 4).map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleReaction(message.id, emoji)}
                                  className={`p-1 rounded hover:bg-white/20 transition-colors ${
                                    message.userReaction === emoji ? 'bg-white/20' : ''
                                  }`}
                                >
                                  <span className="text-xs md:text-sm">{emoji}</span>
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
                    <div className="bg-gray-100 p-2 md:p-4 rounded-lg">
                      <div className="flex items-center space-x-2 md:space-x-3">
                        <div className="flex space-x-1">
                          <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <span className="text-xs md:text-sm text-gray-600">
                          {AVAILABLE_MODELS.find(m => m.id === (currentDebate.currentTurn === 'ai1' ? currentDebate.ai1Model : currentDebate.ai2Model))?.name} is preparing...
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* New Round Button */}
                {currentDebate.status === 'finished' && (
                  <div className="flex justify-center">
                    <button
                      onClick={startNewRound}
                      disabled={isGenerating}
                      className="flex items-center space-x-2 px-4 md:px-6 py-2 md:py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 transition-all duration-200 hover:scale-105 transform shadow-lg text-sm md:text-base"
                    >
                      <RotateCcw size={14} className="md:hidden" />
                      <RotateCcw size={18} className="hidden md:block" />
                      <span>🏛️ New Round!</span>
                    </button>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Compact User Input for Mobile */}
              {currentDebate.status !== 'finished' && (
                <div className="border-t border-gray-200 p-2 md:p-4">
                  <div className="flex space-x-2 md:space-x-3">
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleUserInput()}
                      placeholder="🎤 Interrupt from the gallery..."
                      className="flex-1 px-2 md:px-4 py-1.5 md:py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm md:text-base"
                      disabled={isGenerating}
                    />
                    <button
                      onClick={handleUserInput}
                      disabled={!userInput.trim() || isGenerating}
                      className="px-3 md:px-6 py-1.5 md:py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send size={14} className="md:hidden" />
                      <Send size={18} className="hidden md:block" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 md:mt-2 text-center">
                    💡 Your input appears as a "Point of Order from the Gallery"
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <div className="p-3 md:p-6 h-full overflow-y-auto">
              <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
                {/* Compact Stats Overview for Mobile */}
                <div className="grid grid-cols-3 gap-2 md:gap-4">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-2 md:p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-1 md:space-x-3">
                      <Trophy className="text-blue-600" size={16} className="md:hidden" />
                      <Trophy className="text-blue-600" size={24} className="hidden md:block" />
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm text-blue-600 font-medium">Debates</p>
                        <p className="text-lg md:text-2xl font-bold text-blue-900">{stats.totalDebates}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-green-50 to-green-100 p-2 md:p-4 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-1 md:space-x-3">
                      <Users className="text-green-600" size={16} className="md:hidden" />
                      <Users className="text-green-600" size={24} className="hidden md:block" />
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm text-green-600 font-medium">Users</p>
                        <p className="text-lg md:text-2xl font-bold text-green-900">{stats.userParticipation}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-2 md:p-4 rounded-lg border border-purple-200">
                    <div className="flex items-center space-x-1 md:space-x-3">
                      <TrendingUp className="text-purple-600" size={16} className="md:hidden" />
                      <TrendingUp className="text-purple-600" size={24} className="hidden md:block" />
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm text-purple-600 font-medium">Topics</p>
                        <p className="text-lg md:text-2xl font-bold text-purple-900">{stats.topTopics.length}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Compact Model Leaderboard for Mobile */}
                <div className="bg-white border border-gray-200 rounded-lg p-3 md:p-6">
                  <h3 className="text-base md:text-lg font-semibold text-gray-900 mb-3 md:mb-4 flex items-center space-x-2">
                    <Crown className="text-yellow-500" size={16} />
                    <span>🏛️ Champions</span>
                  </h3>
                  
                  {Object.keys(stats.modelWins).length > 0 ? (
                    <div className="space-y-2 md:space-y-3">
                      {Object.entries(stats.modelWins)
                        .sort(([,a], [,b]) => b - a)
                        .map(([model, wins], index) => (
                          <div key={model} className="flex items-center justify-between p-2 md:p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center space-x-2 md:space-x-3 min-w-0">
                              <div className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center text-xs md:text-sm ${
                                index === 0 ? 'bg-yellow-100 text-yellow-600' :
                                index === 1 ? 'bg-gray-100 text-gray-600' :
                                'bg-orange-100 text-orange-600'
                              }`}>
                                {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                              </div>
                              <span className="text-lg md:text-xl">{getModelIcon(model)}</span>
                              <span className="font-medium text-sm md:text-base truncate">{AVAILABLE_MODELS.find(m => m.id === model)?.name || model}</span>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="font-bold text-sm md:text-lg">{wins}</div>
                              <div className="text-xs text-gray-500">wins</div>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 md:py-8 text-gray-500">
                      <Trophy size={32} className="mx-auto mb-4 opacity-50 md:hidden" />
                      <Trophy size={48} className="mx-auto mb-4 opacity-50 hidden md:block" />
                      <p className="text-sm md:text-base">No debates completed yet!</p>
                      <p className="text-xs md:text-sm">Start a debate to see champions.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
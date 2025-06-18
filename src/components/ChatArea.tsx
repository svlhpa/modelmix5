import React, { useState, useRef, useEffect } from 'react';
import { Send, Menu, MessageSquare, Image, X, Paperclip, StopCircle, RotateCcw, SkipForward, Crown, Gift, Infinity, Globe } from 'lucide-react';
import { ComparisonView } from './ComparisonView';
import { MessageBubble } from './MessageBubble';
import { Logo } from './Logo';
import { APIResponse, ConversationTurn, ModelSettings } from '../types';
import { useAuth } from '../hooks/useAuth';
import { tierService } from '../services/tierService';
import { aiService } from '../services/aiService';
import { globalApiService } from '../services/globalApiService';

interface ChatAreaProps {
  messages: any[];
  onSendMessage: (message: string, images?: string[], useInternetSearch?: boolean) => Promise<APIResponse[]>;
  onSelectResponse: (response: APIResponse, userMessage: string, images?: string[]) => void;
  isLoading: boolean;
  onToggleSidebar: () => void;
  onToggleMobileSidebar: () => void;
  onSaveConversationTurn: (turn: ConversationTurn) => void;
  modelSettings: ModelSettings;
  onTierUpgrade: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  onSendMessage,
  onSelectResponse,
  isLoading,
  onToggleSidebar,
  onToggleMobileSidebar,
  onSaveConversationTurn,
  modelSettings,
  onTierUpgrade
}) => {
  const { user, getCurrentTier, getUsageInfo } = useAuth();
  const [input, setInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [useInternetSearch, setUseInternetSearch] = useState(false);
  
  // CRITICAL: Separate state for AI generation session
  const [currentResponses, setCurrentResponses] = useState<APIResponse[]>([]);
  const [currentUserMessage, setCurrentUserMessage] = useState('');
  const [currentUserImages, setCurrentUserImages] = useState<string[]>([]);
  const [currentUseInternetSearch, setCurrentUseInternetSearch] = useState(false);
  const [waitingForSelection, setWaitingForSelection] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null); // Track current generation
  
  const [usageCheck, setUsageCheck] = useState<{ canUse: boolean; usage: number; limit: number }>({ canUse: true, usage: 0, limit: 50 });
  const [globalKeysAvailable, setGlobalKeysAvailable] = useState<Record<string, boolean>>({});
  const [internetSearchAvailable, setInternetSearchAvailable] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentTier = getCurrentTier();
  const { usage, limit } = getUsageInfo();

  useEffect(() => {
    if (user) {
      checkUsageLimit();
      checkGlobalKeysAvailability();
    }
  }, [user, messages.length]);

  const checkUsageLimit = async () => {
    const result = await tierService.checkUsageLimit();
    setUsageCheck(result);
  };

  const checkGlobalKeysAvailability = async () => {
    const providers = ['openai', 'gemini', 'deepseek', 'openrouter', 'serper'];
    const availability: Record<string, boolean> = {};
    
    for (const provider of providers) {
      try {
        const globalKey = await globalApiService.getGlobalApiKey(provider, currentTier);
        availability[provider] = !!globalKey && globalKey !== 'PLACEHOLDER_SERPER_KEY_UPDATE_IN_ADMIN';
      } catch (error) {
        availability[provider] = false;
      }
    }
    
    setGlobalKeysAvailable(availability);
    setInternetSearchAvailable(availability.serper);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentResponses, isGenerating]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target?.result as string;
          setImages(prev => [...prev, base64]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handlePaste = (event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    Array.from(items).forEach(item => {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const base64 = e.target?.result as string;
            setImages(prev => [...prev, base64]);
          };
          reader.readAsDataURL(file);
        }
      }
    });
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const getEnabledModelsCount = () => {
    const traditionalCount = [modelSettings.openai, modelSettings.gemini, modelSettings.deepseek]
      .filter(Boolean).length;
    const openRouterCount = Object.values(modelSettings.openrouter_models).filter(Boolean).length;
    return traditionalCount + openRouterCount;
  };

  const getTierLimits = () => {
    return tierService.getTierLimits(currentTier);
  };

  const getMaxAllowedModels = () => {
    const maxModels = getTierLimits().maxModelsPerComparison;
    return maxModels === -1 ? Infinity : maxModels; // Pro tier has unlimited models
  };

  // Reset generation state
  const resetGenerationState = () => {
    setIsGenerating(false);
    setWaitingForSelection(false);
    setCurrentResponses([]);
    setCurrentUserMessage('');
    setCurrentUserImages([]);
    setCurrentUseInternetSearch(false);
    setGenerationId(null);
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
  };

  const handleStopGeneration = () => {
    resetGenerationState();
  };

  const handleResetGeneration = () => {
    resetGenerationState();
  };

  const handleSkipSelection = () => {
    resetGenerationState();
  };

  const handleRetryGeneration = async () => {
    if (!currentUserMessage) return;
    
    // Reset state and start fresh generation
    setIsGenerating(true);
    setWaitingForSelection(false);
    
    // Create new generation ID and abort controller
    const newGenerationId = `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setGenerationId(newGenerationId);
    
    const controller = new AbortController();
    setAbortController(controller);
    
    setCurrentResponses([]);
    
    // Build conversation context from current messages + the user message we're retrying
    const contextMessages: Array<{role: 'user' | 'assistant', content: string}> = [];
    messages.forEach(msg => {
      contextMessages.push({ 
        role: msg.role, 
        content: msg.content 
      });
    });
    contextMessages.push({ role: 'user', content: currentUserMessage });

    // Get responses with real-time updates
    try {
      await aiService.getResponses(
        currentUserMessage, 
        contextMessages, 
        currentUserImages,
        (updatedResponses) => {
          // Check if generation was aborted or if this is an old generation
          if (controller.signal.aborted || generationId !== newGenerationId) {
            return;
          }
          
          setCurrentResponses([...updatedResponses]);
          
          // Check if all responses are complete
          const allComplete = updatedResponses.every(r => !r.loading);
          if (allComplete) {
            setIsGenerating(false);
            setWaitingForSelection(true);
            setAbortController(null);
          }
        },
        controller.signal,
        currentTier,
        currentUseInternetSearch
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Generation stopped by user');
      } else {
        console.error('Error getting responses:', error);
      }
      setIsGenerating(false);
      setAbortController(null);
    }
  };

  // CRITICAL: Completely rebuilt form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !user) return;

    // Check usage limits (Pro users have unlimited)
    if (!usageCheck.canUse) {
      onTierUpgrade();
      return;
    }

    const enabledCount = getEnabledModelsCount();
    const maxAllowed = getMaxAllowedModels();
    
    if (enabledCount === 0) {
      alert('Please enable at least one AI model in settings before sending a message.');
      return;
    }

    // Pro users can use unlimited models
    if (currentTier !== 'tier2' && enabledCount > maxAllowed) {
      alert(`Your ${getTierLimits().name} plan allows up to ${maxAllowed} models per comparison. Please disable some models or upgrade your plan.`);
      return;
    }

    const message = input.trim();
    const messageImages = [...images];
    const messageUseInternetSearch = useInternetSearch;
    
    // Clear input immediately
    setInput('');
    setImages([]);
    setUseInternetSearch(false);
    
    // Store current generation context
    setCurrentUserMessage(message);
    setCurrentUserImages(messageImages);
    setCurrentUseInternetSearch(messageUseInternetSearch);
    setWaitingForSelection(false);
    setIsGenerating(true);
    
    // Create new generation ID and abort controller
    const newGenerationId = `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setGenerationId(newGenerationId);
    
    const controller = new AbortController();
    setAbortController(controller);
    
    setCurrentResponses([]);

    try {
      // Build conversation context from existing messages only
      const contextMessages: Array<{role: 'user' | 'assistant', content: string}> = [];
      messages.forEach(msg => {
        contextMessages.push({ 
          role: msg.role, 
          content: msg.content 
        });
      });
      // Add the current message to context for AI generation
      contextMessages.push({ role: 'user', content: message });

      // Start real-time response generation with loading animations
      await aiService.getResponses(
        message, 
        contextMessages,
        messageImages,
        (updatedResponses) => {
          // Check if generation was aborted or if this is an old generation
          if (controller.signal.aborted || generationId !== newGenerationId) {
            return;
          }
          
          // CRITICAL: Update responses as they come in (real-time loading)
          setCurrentResponses([...updatedResponses]);
          
          // Check if all responses are complete
          const allComplete = updatedResponses.every(r => !r.loading);
          if (allComplete) {
            setIsGenerating(false);
            setWaitingForSelection(true);
            setAbortController(null);
          }
        },
        controller.signal,
        currentTier,
        messageUseInternetSearch
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Generation stopped by user');
      } else {
        console.error('Error getting responses:', error);
      }
      setIsGenerating(false);
      setAbortController(null);
    }
  };

  // CRITICAL: Response selection handler - this is where we add messages to the session
  const handleSelectResponse = async (selectedResponse: APIResponse) => {
    // CRITICAL: Now we add both the user message AND the selected response to the session
    // This prevents the duplicate issue
    onSelectResponse(selectedResponse, currentUserMessage, currentUserImages);
    
    // Reset generation state
    resetGenerationState();

    // Increment usage counter (Pro users don't increment)
    await tierService.incrementUsage();
    await checkUsageLimit(); // Refresh usage info
  };

  // Check if all current responses have errors
  const allResponsesHaveErrors = currentResponses.length > 0 && 
    currentResponses.every(r => !r.loading && r.error);

  const hasAnyGlobalKeyAccess = Object.values(globalKeysAvailable).some(Boolean);

  if (!user) {
    return (
      <div className="flex-1 flex flex-col h-full bg-gray-50 min-w-0">
        {/* Header with mobile menu for non-authenticated users */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center min-w-0">
          <button
            onClick={onToggleMobileSidebar}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors lg:hidden flex-shrink-0"
          >
            <Menu size={20} />
          </button>
          
          <button
            onClick={onToggleSidebar}
            className="hidden lg:block p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <Menu size={20} />
          </button>
          
          <Logo variant="text" size="md" className="ml-2 flex-shrink-0" />
        </div>

        <div className="flex-1 flex items-center justify-center bg-gray-50 p-4">
          <div className="text-center max-w-md">
            <Logo size="lg" className="mb-6 justify-center" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Welcome to ModelMix
            </h2>
            <p className="text-gray-600 mb-6">
              Mix and compare AI responses from multiple models. Track your preferences with personalized analytics.
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <div className="font-medium text-gray-900">🔒 Secure</div>
                <div className="text-gray-500">Your data is private</div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <div className="font-medium text-gray-900">📊 Analytics</div>
                <div className="text-gray-500">Track AI performance</div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <div className="font-medium text-gray-900">💾 Saved</div>
                <div className="text-gray-500">Conversations persist</div>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <div className="font-medium text-gray-900">🚀 Fast</div>
                <div className="text-gray-500">Compare 400+ AIs</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const showWelcome = messages.length === 0 && currentResponses.length === 0;
  const canSendMessage = !isLoading && !waitingForSelection && !isGenerating && usageCheck.canUse;
  const enabledCount = getEnabledModelsCount();
  const maxAllowed = getMaxAllowedModels();
  const tierLimits = getTierLimits();
  const isProUser = currentTier === 'tier2';

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 min-w-0">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center min-w-0">
        {/* Mobile menu button - always visible */}
        <button
          onClick={onToggleMobileSidebar}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors lg:hidden flex-shrink-0"
        >
          <Menu size={20} />
        </button>
        
        {/* Desktop sidebar toggle */}
        <button
          onClick={onToggleSidebar}
          className="hidden lg:block p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
        >
          <Menu size={20} />
        </button>
        
        <Logo variant="text" size="md" className="ml-2 flex-shrink-0" />
        <div className="ml-auto flex items-center space-x-2 sm:space-x-4 text-sm text-gray-500 min-w-0">
          {/* Tier indicator */}
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            {isProUser ? (
              <Crown size={16} className="text-yellow-500" />
            ) : hasAnyGlobalKeyAccess ? (
              <Gift size={16} className="text-green-500" />
            ) : (
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            )}
            <span className="hidden sm:inline">
              {isProUser ? 'Pro Plan' : hasAnyGlobalKeyAccess ? 'Free Trial' : 'Free Plan'}
            </span>
            <span className="sm:hidden text-xs">
              {isProUser ? 'Pro' : hasAnyGlobalKeyAccess ? 'Trial' : 'Free'}
            </span>
          </div>
          
          {/* Usage indicator */}
          <div className="flex items-center space-x-1 flex-shrink-0">
            <div className={`w-2 h-2 rounded-full ${usageCheck.canUse ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-xs">
              {isProUser ? (
                <div className="flex items-center space-x-1">
                  <Infinity size={12} />
                  <span className="hidden sm:inline">unlimited</span>
                </div>
              ) : (
                <span>{usage}/{limit}</span>
              )}
            </span>
          </div>
          
          {enabledCount > 0 && (
            <div className="flex items-center space-x-1 flex-shrink-0">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-xs">
                {enabledCount} model{enabledCount !== 1 ? 's' : ''}
                {isProUser && enabledCount > 3 && (
                  <Crown size={10} className="inline ml-1 text-yellow-600" />
                )}
              </span>
            </div>
          )}
          {messages.length > 0 && (
            <div className="hidden sm:flex items-center space-x-2">
              <MessageSquare size={16} />
              <span>{Math.ceil(messages.length / 2)} conversation{Math.ceil(messages.length / 2) !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-w-0">
        {showWelcome ? (
          <div className="flex items-center justify-center h-full p-4">
            <div className="text-center max-w-2xl">
              <Logo size="lg" className="mb-6 justify-center" />
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Start Mixing AI Models
              </h2>
              <p className="text-gray-600 mb-6">
                Ask a question, upload images, and compare AI responses from hundreds of different models. Continue natural conversations with full context.
                {internetSearchAvailable && (
                  <span className="block mt-2 text-blue-600 font-medium">
                    🌐 Internet search is available! Toggle it on to get real-time information.
                  </span>
                )}
              </p>
              
              {!usageCheck.canUse ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-center space-x-2 text-amber-700 mb-3">
                    <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">!</span>
                    </div>
                    <span className="font-medium">Monthly limit reached!</span>
                  </div>
                  <p className="text-sm text-amber-600 mb-3">
                    You've used all {limit} conversations for this month. Upgrade to Pro for unlimited conversations.
                  </p>
                  <button
                    onClick={onTierUpgrade}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                  >
                    <Crown size={16} />
                    <span>Upgrade to Pro</span>
                  </button>
                </div>
              ) : enabledCount === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-center space-x-2 text-amber-700">
                    <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">!</span>
                    </div>
                    <span className="font-medium">No AI models enabled! Please configure models in settings.</span>
                  </div>
                </div>
              ) : !isProUser && enabledCount > maxAllowed ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-center space-x-2 text-amber-700 mb-3">
                    <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">!</span>
                    </div>
                    <span className="font-medium">Too many models selected!</span>
                  </div>
                  <p className="text-sm text-amber-600 mb-3">
                    Your {tierLimits.name} plan allows up to {maxAllowed} models per comparison. You have {enabledCount} enabled.
                  </p>
                  <div className="flex justify-center space-x-2">
                    <button
                      onClick={() => {/* Open settings */}}
                      className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Adjust Settings
                    </button>
                    <button
                      onClick={onTierUpgrade}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 transition-colors"
                    >
                      <Crown size={14} />
                      <span>Upgrade for Unlimited</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-center space-x-2 text-green-700 mb-2">
                    <div className="w-5 h-5 rounded-full bg-green-400 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">✓</span>
                    </div>
                    <span className="font-medium">
                      {enabledCount} AI model{enabledCount !== 1 ? 's' : ''} ready for comparison!
                      {isProUser && enabledCount > 3 && (
                        <span className="ml-2 inline-flex items-center space-x-1 text-yellow-700">
                          <Crown size={14} />
                          <span className="text-xs">Pro Power</span>
                        </span>
                      )}
                    </span>
                  </div>
                  <p className="text-sm text-green-600">
                    {hasAnyGlobalKeyAccess && !isProUser 
                      ? 'Using free trial access - no API keys needed!'
                      : isProUser
                        ? 'Unlimited conversations and models with Pro plan!'
                        : 'Including traditional models and OpenRouter\'s extensive collection'
                    }
                    {internetSearchAvailable && (
                      <span className="block mt-1 text-blue-600">
                        🌐 Internet search available for real-time information!
                      </span>
                    )}
                  </p>
                  {hasAnyGlobalKeyAccess && !isProUser && (
                    <div className="mt-2 flex items-center justify-center space-x-1 text-xs text-green-600">
                      <Gift size={12} />
                      <span>Free trial powered by global API keys</span>
                    </div>
                  )}
                  {isProUser && (
                    <div className="mt-2 flex items-center justify-center space-x-1 text-xs text-yellow-600">
                      <Crown size={12} />
                      <span>Pro plan: unlimited everything!</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 max-w-7xl mx-auto min-w-0">
            {/* Display conversation messages */}
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            
            {/* CRITICAL: Only show current user message if we're in generation mode */}
            {currentUserMessage && (isGenerating || waitingForSelection) && (
              <div className="flex justify-end mb-6">
                <div className="max-w-3xl min-w-0">
                  <div className="px-4 py-3 rounded-2xl bg-emerald-600 text-white">
                    {currentUserImages && currentUserImages.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {currentUserImages.map((image, index) => (
                          <img
                            key={index}
                            src={image}
                            alt={`Uploaded image ${index + 1}`}
                            className="max-w-xs max-h-48 object-cover rounded-lg border border-white/20"
                          />
                        ))}
                      </div>
                    )}
                    {currentUseInternetSearch && (
                      <div className="mb-2 flex items-center space-x-2 text-emerald-200">
                        <Globe size={16} />
                        <span className="text-sm">Internet search enabled</span>
                      </div>
                    )}
                    <div className="leading-relaxed break-words">{currentUserMessage}</div>
                  </div>
                </div>
              </div>
            )}
            
            {/* CRITICAL: Show current comparison with REAL-TIME loading animations */}
            {currentResponses.length > 0 && (
              <div className="mb-8 min-w-0">
                <ComparisonView 
                  responses={currentResponses} 
                  onSelectResponse={handleSelectResponse}
                  showSelection={waitingForSelection && !isGenerating}
                />
                
                {isGenerating && (
                  <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 text-emerald-700 min-w-0">
                        <div className="flex space-x-1 flex-shrink-0">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <span className="font-medium min-w-0">
                          <span className="hidden sm:inline">
                            AI models are mixing responses{currentUseInternetSearch && ' with internet search'}... (responses appear as they complete)
                          </span>
                          <span className="sm:hidden">
                            AI models mixing{currentUseInternetSearch && ' + web'}...
                          </span>
                          {isProUser && enabledCount > 3 && (
                            <span className="ml-2 text-yellow-600">
                              <Crown size={14} className="inline" /> <span className="hidden sm:inline">Pro Power</span>
                            </span>
                          )}
                        </span>
                      </div>
                      <button
                        onClick={handleStopGeneration}
                        className="flex items-center space-x-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex-shrink-0"
                      >
                        <StopCircle size={16} />
                        <span className="hidden sm:inline">Stop Generation</span>
                        <span className="sm:hidden">Stop</span>
                      </button>
                    </div>
                  </div>
                )}
                
                {waitingForSelection && !isGenerating && !allResponsesHaveErrors && (
                  <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-center space-x-2 text-amber-700">
                      <div className="w-3 h-3 bg-amber-400 rounded-full animate-pulse flex-shrink-0"></div>
                      <span className="font-medium">Select the best response to continue the conversation</span>
                    </div>
                  </div>
                )}

                {/* Show error state with recovery options */}
                {allResponsesHaveErrors && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-red-700 min-w-0">
                        <div className="w-3 h-3 bg-red-400 rounded-full flex-shrink-0"></div>
                        <span className="font-medium">All AI models failed to generate responses</span>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <button
                          onClick={handleRetryGeneration}
                          className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          <RotateCcw size={14} />
                          <span>Retry</span>
                        </button>
                        <button
                          onClick={handleSkipSelection}
                          className="flex items-center space-x-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                        >
                          <SkipForward size={14} />
                          <span>Skip</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-red-600 mt-2">
                      You can retry the generation or skip this turn to continue with a new message.
                    </p>
                  </div>
                )}
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="bg-white border-t border-gray-200 p-4 min-w-0">
        <form onSubmit={handleSubmit} className="max-w-7xl mx-auto">
          {/* Image previews */}
          {images.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {images.map((image, index) => (
                <div key={index} className="relative">
                  <img
                    src={image}
                    alt={`Upload ${index + 1}`}
                    className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Internet Search Toggle */}
          {internetSearchAvailable && (
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setUseInternetSearch(!useInternetSearch)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg border transition-colors ${
                  useInternetSearch
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Globe size={16} />
                <span className="text-sm font-medium">
                  {useInternetSearch ? 'Internet Search ON' : 'Use Internet Search'}
                </span>
              </button>
              
              {useInternetSearch && (
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                  AI will search the web for current information
                </span>
              )}
            </div>
          )}
          
          <div className="flex space-x-3 min-w-0">
            <div className="flex-1 relative min-w-0">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPaste={handlePaste}
                placeholder={
                  !usageCheck.canUse
                    ? "Monthly limit reached - upgrade to continue..."
                    : enabledCount === 0
                      ? "Please enable AI models in settings first..."
                      : !isProUser && enabledCount > maxAllowed
                        ? `Too many models selected (max ${maxAllowed} for ${tierLimits.name} plan)...`
                        : isGenerating
                          ? "AI models are mixing responses..."
                          : waitingForSelection 
                            ? "Select a response above to continue..." 
                            : messages.length === 0
                              ? hasAnyGlobalKeyAccess && !isProUser
                                ? `Ask anything - free trial with ${enabledCount} AI models active!`
                                : isProUser
                                  ? `Ask anything - Pro plan with ${enabledCount} AI models ready!`
                                  : `Ask anything or upload images to mix ${enabledCount} AI responses...`
                              : "Continue the conversation..."
                }
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 min-w-0"
                disabled={!canSendMessage || enabledCount === 0 || (!isProUser && enabledCount > maxAllowed)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded hover:bg-gray-100 transition-colors"
                disabled={!canSendMessage || enabledCount === 0 || (!isProUser && enabledCount > maxAllowed)}
              >
                <Paperclip size={18} className="text-gray-400" />
              </button>
            </div>
            
            {/* Show reset button when there are current responses but user is stuck */}
            {(waitingForSelection || isGenerating) && (
              <button
                type="button"
                onClick={handleResetGeneration}
                className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2 flex-shrink-0"
                title="Reset and start over"
              >
                <RotateCcw size={18} />
                <span className="hidden sm:inline">Reset</span>
              </button>
            )}

            {isGenerating ? (
              <button
                type="button"
                onClick={handleStopGeneration}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2 flex-shrink-0"
              >
                <StopCircle size={18} />
                <span className="hidden sm:inline">Stop</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || !canSendMessage || enabledCount === 0 || (!isProUser && enabledCount > maxAllowed)}
                className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 flex-shrink-0"
              >
                <Send size={18} />
                <span className="hidden sm:inline">
                  {messages.length === 0 ? 'Mix' : 'Continue'}
                </span>
              </button>
            )}
          </div>
          
          {!usageCheck.canUse && (
            <div className="text-center mt-2">
              <p className="text-xs text-red-600 mb-2">
                ⚠️ Monthly limit reached ({usage}/{limit === -1 ? '∞' : limit} conversations used)
              </p>
              <button
                onClick={onTierUpgrade}
                className="inline-flex items-center space-x-1 text-xs bg-yellow-600 text-white px-3 py-1.5 rounded-lg hover:bg-yellow-700 transition-colors"
              >
                <Crown size={12} />
                <span>Upgrade to Pro for unlimited conversations</span>
              </button>
            </div>
          )}
          
          {enabledCount === 0 && usageCheck.canUse && (
            <p className="text-xs text-red-600 mt-2 text-center">
              ⚠️ No AI models enabled - please configure models in settings
            </p>
          )}

          {!isProUser && enabledCount > maxAllowed && usageCheck.canUse && (
            <div className="text-center mt-2">
              <p className="text-xs text-amber-600 mb-2">
                ⚠️ {enabledCount} models selected, but {tierLimits.name} plan allows max {maxAllowed}
              </p>
              <button
                onClick={onTierUpgrade}
                className="inline-flex items-center space-x-1 text-xs bg-yellow-600 text-white px-3 py-1.5 rounded-lg hover:bg-yellow-700 transition-colors"
              >
                <Crown size={12} />
                <span>Upgrade to Pro for unlimited models</span>
              </button>
            </div>
          )}
          
          {waitingForSelection && !isGenerating && enabledCount > 0 && !allResponsesHaveErrors && usageCheck.canUse && (
            <p className="text-xs text-amber-600 mt-2 text-center">
              💡 Click on your preferred response above to add it to the conversation context
            </p>
          )}

          {allResponsesHaveErrors && (
            <p className="text-xs text-red-600 mt-2 text-center">
              ⚠️ All models failed - use Retry to try again or Skip to continue with a new message
            </p>
          )}
          
          {isGenerating && enabledCount > 0 && usageCheck.canUse && (
            <p className="text-xs text-emerald-600 mt-2 text-center">
              🤖 Mixing responses from {enabledCount} AI model{enabledCount !== 1 ? 's' : ''}{currentUseInternetSearch && ' with internet search'} - click Stop to cancel generation
              {isProUser && enabledCount > 3 && (
                <span className="ml-2 text-yellow-600">
                  <Crown size={12} className="inline" /> Pro Power
                </span>
              )}
            </p>
          )}
          
          {enabledCount > 0 && (isProUser || enabledCount <= maxAllowed) && !isGenerating && !waitingForSelection && usageCheck.canUse && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              {hasAnyGlobalKeyAccess && !isProUser 
                ? `🎉 Free trial active • ${usage}/${limit} conversations used this month • Upload images for visual context${internetSearchAvailable ? ' • Toggle internet search for real-time info' : ''}`
                : isProUser
                  ? `👑 Pro plan active • Unlimited conversations • Upload images for visual context${internetSearchAvailable ? ' • Toggle internet search for real-time info' : ''}`
                  : `📎 Upload images or paste screenshots for visual context${internetSearchAvailable ? ' • Toggle internet search for real-time info' : ''} • ${usage}/${limit} conversations used this month`
              }
            </p>
          )}
        </form>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>
    </div>
  );
};
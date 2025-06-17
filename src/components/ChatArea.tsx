import React, { useState, useRef, useEffect } from 'react';
import { Send, Menu, MessageSquare, Image, X, Paperclip, StopCircle, RotateCcw, SkipForward, Crown } from 'lucide-react';
import { ComparisonView } from './ComparisonView';
import { MessageBubble } from './MessageBubble';
import { Logo } from './Logo';
import { APIResponse, ConversationTurn, ModelSettings } from '../types';
import { useAuth } from '../hooks/useAuth';
import { tierService } from '../services/tierService';
import { aiService } from '../services/aiService';

interface ChatAreaProps {
  messages: any[];
  onSendMessage: (message: string, images?: string[]) => Promise<APIResponse[]>;
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
  const [currentResponses, setCurrentResponses] = useState<APIResponse[]>([]);
  const [currentUserMessage, setCurrentUserMessage] = useState('');
  const [currentUserImages, setCurrentUserImages] = useState<string[]>([]);
  const [waitingForSelection, setWaitingForSelection] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [usageCheck, setUsageCheck] = useState<{ canUse: boolean; usage: number; limit: number }>({ canUse: true, usage: 0, limit: 50 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentTier = getCurrentTier();
  const { usage, limit } = getUsageInfo();

  useEffect(() => {
    if (user) {
      checkUsageLimit();
    }
  }, [user, messages.length]);

  const checkUsageLimit = async () => {
    const result = await tierService.checkUsageLimit();
    setUsageCheck(result);
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
    return getTierLimits().maxModelsPerComparison;
  };

  const handleStopGeneration = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    
    setIsGenerating(false);
    setWaitingForSelection(false);
    setCurrentResponses([]);
    setCurrentUserMessage('');
    setCurrentUserImages([]);
  };

  const handleResetGeneration = () => {
    setIsGenerating(false);
    setWaitingForSelection(false);
    setCurrentResponses([]);
    setCurrentUserMessage('');
    setCurrentUserImages([]);
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
  };

  const handleSkipSelection = () => {
    // Skip the current generation and allow user to continue
    setCurrentResponses([]);
    setCurrentUserMessage('');
    setCurrentUserImages([]);
    setWaitingForSelection(false);
    setIsGenerating(false);
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
  };

  const handleRetryGeneration = async () => {
    if (!currentUserMessage) return;
    
    // Reset state
    setIsGenerating(true);
    setWaitingForSelection(false);
    
    // Create new abort controller
    const controller = new AbortController();
    setAbortController(controller);
    
    setCurrentResponses([]);
    
    // Build conversation context
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
          // Check if generation was aborted
          if (controller.signal.aborted) {
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
        controller.signal
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Generation was intentionally stopped
        console.log('Generation stopped by user');
      } else {
        console.error('Error getting responses:', error);
      }
      setIsGenerating(false);
      setAbortController(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !user) return;

    // Check usage limits
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

    if (enabledCount > maxAllowed) {
      alert(`Your ${getTierLimits().name} plan allows up to ${maxAllowed} models per comparison. Please disable some models or upgrade your plan.`);
      return;
    }

    const message = input.trim();
    const messageImages = [...images];
    
    setInput('');
    setImages([]);
    setCurrentUserMessage(message);
    setCurrentUserImages(messageImages);
    setWaitingForSelection(false);
    setIsGenerating(true);
    
    // Create abort controller for this generation
    const controller = new AbortController();
    setAbortController(controller);
    
    setCurrentResponses([]);
    
    // Build conversation context
    const contextMessages: Array<{role: 'user' | 'assistant', content: string}> = [];
    messages.forEach(msg => {
      contextMessages.push({ 
        role: msg.role, 
        content: msg.content 
      });
    });
    contextMessages.push({ role: 'user', content: message });

    // Get responses with real-time updates
    try {
      await aiService.getResponses(
        message, 
        contextMessages, 
        messageImages,
        (updatedResponses) => {
          // Check if generation was aborted
          if (controller.signal.aborted) {
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
        controller.signal
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Generation was intentionally stopped
        console.log('Generation stopped by user');
      } else {
        console.error('Error getting responses:', error);
      }
      setIsGenerating(false);
      setAbortController(null);
    }
  };

  const handleSelectResponse = async (selectedResponse: APIResponse) => {
    onSelectResponse(selectedResponse, currentUserMessage, currentUserImages);
    setCurrentResponses([]);
    setCurrentUserMessage('');
    setCurrentUserImages([]);
    setWaitingForSelection(false);
    setIsGenerating(false);
    setAbortController(null);

    // Increment usage counter
    await tierService.incrementUsage();
    await checkUsageLimit(); // Refresh usage info
  };

  // Check if all current responses have errors
  const allResponsesHaveErrors = currentResponses.length > 0 && 
    currentResponses.every(r => !r.loading && r.error);

  if (!user) {
    return (
      <div className="flex-1 flex flex-col h-full bg-gray-50">
        {/* Header with mobile menu for non-authenticated users */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center">
          <button
            onClick={onToggleMobileSidebar}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors lg:hidden"
          >
            <Menu size={20} />
          </button>
          
          <button
            onClick={onToggleSidebar}
            className="hidden lg:block p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Menu size={20} />
          </button>
          
          <Logo variant="text" size="md" className="ml-2" />
        </div>

        <div className="flex-1 flex items-center justify-center bg-gray-50">
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

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center">
        {/* Mobile menu button - always visible */}
        <button
          onClick={onToggleMobileSidebar}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors lg:hidden"
        >
          <Menu size={20} />
        </button>
        
        {/* Desktop sidebar toggle */}
        <button
          onClick={onToggleSidebar}
          className="hidden lg:block p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Menu size={20} />
        </button>
        
        <Logo variant="text" size="md" className="ml-2" />
        <div className="ml-auto flex items-center space-x-4 text-sm text-gray-500">
          {/* Tier indicator */}
          <div className="flex items-center space-x-2">
            {currentTier === 'tier2' ? (
              <Crown size={16} className="text-yellow-500" />
            ) : (
              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            )}
            <span>{tierLimits.name} Plan</span>
          </div>
          
          {/* Usage indicator */}
          <div className="flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${usageCheck.canUse ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>{usage}/{limit} conversations</span>
          </div>
          
          {enabledCount > 0 && (
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>{enabledCount} model{enabledCount !== 1 ? 's' : ''} enabled</span>
            </div>
          )}
          {messages.length > 0 && (
            <div className="flex items-center space-x-2">
              <MessageSquare size={16} />
              <span>{Math.ceil(messages.length / 2)} conversation{Math.ceil(messages.length / 2) !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {showWelcome ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-2xl">
              <Logo size="lg" className="mb-6 justify-center" />
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Start Mixing AI Models
              </h2>
              <p className="text-gray-600 mb-6">
                Ask a question, upload images, and compare AI responses from hundreds of different models. Continue natural conversations with full context.
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
                    You've used all {limit} conversations for this month. Upgrade to Pro for more conversations.
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
              ) : enabledCount > maxAllowed ? (
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
                    {currentTier === 'tier1' && (
                      <button
                        onClick={onTierUpgrade}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 transition-colors"
                      >
                        <Crown size={14} />
                        <span>Upgrade</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-center space-x-2 text-green-700 mb-2">
                    <div className="w-5 h-5 rounded-full bg-green-400 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">✓</span>
                    </div>
                    <span className="font-medium">{enabledCount} AI models ready for comparison!</span>
                  </div>
                  <p className="text-sm text-green-600">
                    Including traditional models and OpenRouter's extensive collection
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 max-w-7xl mx-auto">
            {/* Display conversation messages */}
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            
            {/* Show current user message if we're waiting for responses */}
            {currentUserMessage && (isGenerating || waitingForSelection) && (
              <div className="flex justify-end mb-6">
                <div className="max-w-3xl">
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
                    <div className="leading-relaxed">{currentUserMessage}</div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Show current comparison if responses are available */}
            {currentResponses.length > 0 && (
              <div className="mb-8">
                <ComparisonView 
                  responses={currentResponses} 
                  onSelectResponse={handleSelectResponse}
                  showSelection={waitingForSelection && !isGenerating}
                />
                
                {isGenerating && (
                  <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 text-emerald-700">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <span className="font-medium">AI models are mixing responses... (responses appear as they complete)</span>
                      </div>
                      <button
                        onClick={handleStopGeneration}
                        className="flex items-center space-x-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
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
                      <div className="w-3 h-3 bg-amber-400 rounded-full animate-pulse"></div>
                      <span className="font-medium">Select the best response to continue the conversation</span>
                    </div>
                  </div>
                )}

                {/* Show error state with recovery options */}
                {allResponsesHaveErrors && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-red-700">
                        <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                        <span className="font-medium">All AI models failed to generate responses</span>
                      </div>
                      <div className="flex items-center space-x-2">
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
                          <span>Skip & Continue</span>
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

      <div className="bg-white border-t border-gray-200 p-4">
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
          
          <div className="flex space-x-3">
            <div className="flex-1 relative">
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
                      : enabledCount > maxAllowed
                        ? `Too many models selected (max ${maxAllowed} for ${tierLimits.name} plan)...`
                        : isGenerating
                          ? "AI models are mixing responses..."
                          : waitingForSelection 
                            ? "Select a response above to continue..." 
                            : messages.length === 0
                              ? `Ask anything or upload images to mix ${enabledCount} AI responses...`
                              : "Continue the conversation..."
                }
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                disabled={!canSendMessage || enabledCount === 0 || enabledCount > maxAllowed}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded hover:bg-gray-100 transition-colors"
                disabled={!canSendMessage || enabledCount === 0 || enabledCount > maxAllowed}
              >
                <Paperclip size={18} className="text-gray-400" />
              </button>
            </div>
            
            {/* Show reset button when there are current responses but user is stuck */}
            {(waitingForSelection || isGenerating) && (
              <button
                type="button"
                onClick={handleResetGeneration}
                className="px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2"
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
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
              >
                <StopCircle size={18} />
                <span className="hidden sm:inline">Stop</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || !canSendMessage || enabledCount === 0 || enabledCount > maxAllowed}
                className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
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
                ⚠️ Monthly limit reached ({usage}/{limit} conversations used)
              </p>
              <button
                onClick={onTierUpgrade}
                className="inline-flex items-center space-x-1 text-xs bg-yellow-600 text-white px-3 py-1.5 rounded-lg hover:bg-yellow-700 transition-colors"
              >
                <Crown size={12} />
                <span>Upgrade to Pro for 1,000 conversations/month</span>
              </button>
            </div>
          )}
          
          {enabledCount === 0 && usageCheck.canUse && (
            <p className="text-xs text-red-600 mt-2 text-center">
              ⚠️ No AI models enabled - please configure models in settings
            </p>
          )}

          {enabledCount > maxAllowed && usageCheck.canUse && (
            <div className="text-center mt-2">
              <p className="text-xs text-amber-600 mb-2">
                ⚠️ {enabledCount} models selected, but {tierLimits.name} plan allows max {maxAllowed}
              </p>
              {currentTier === 'tier1' && (
                <button
                  onClick={onTierUpgrade}
                  className="inline-flex items-center space-x-1 text-xs bg-yellow-600 text-white px-3 py-1.5 rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  <Crown size={12} />
                  <span>Upgrade to Pro for up to 10 models</span>
                </button>
              )}
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
              🤖 Mixing responses from {enabledCount} AI model{enabledCount !== 1 ? 's' : ''} - click Stop to cancel generation
            </p>
          )}
          
          {enabledCount > 0 && enabledCount <= maxAllowed && !isGenerating && !waitingForSelection && usageCheck.canUse && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              📎 Upload images or paste screenshots for visual context • {usage}/{limit} conversations used this month
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
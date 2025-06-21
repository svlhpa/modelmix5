import React, { useState, useRef, useEffect } from 'react';
import { Send, Menu, Upload, Globe, Zap, Crown, AlertTriangle, Paperclip, X } from 'lucide-react';
import { Message, APIResponse, ModelSettings } from '../types';
import { MessageBubble } from './MessageBubble';
import { ComparisonView } from './ComparisonView';
import { FileUpload } from './FileUpload';
import { TavusVideoChat } from './TavusVideoChat';
import { fileService, UploadedFile } from '../services/fileService';
import { useAuth } from '../hooks/useAuth';
import { tierService } from '../services/tierService';

interface ChatAreaProps {
  messages: Message[];
  onSendMessage: (message: string, images?: string[], useInternetSearch?: boolean, fileContext?: string) => Promise<APIResponse[]>;
  onSelectResponse: (response: APIResponse, userMessage: string, images?: string[], fileContext?: string) => void;
  isLoading: boolean;
  onToggleSidebar: () => void;
  onToggleMobileSidebar: () => void;
  onSaveConversationTurn: (turn: any) => void;
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
  const { user, getCurrentTier } = useAuth();
  const [input, setInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [useInternetSearch, setUseInternetSearch] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [currentResponses, setCurrentResponses] = useState<APIResponse[]>([]);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  
  // Tavus secret feature states
  const [showTavusChat, setShowTavusChat] = useState(false);
  const [tavusStep, setTavusStep] = useState<'name' | 'context' | 'ready'>('name');
  const [conversationName, setConversationName] = useState('');
  const [conversationContext, setConversationContext] = useState('');
  const [awaitingTavusInput, setAwaitingTavusInput] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentTier = getCurrentTier();
  const isProUser = currentTier === 'tier2';

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentResponses]);

  useEffect(() => {
    // Load uploaded files on component mount
    setUploadedFiles(fileService.getAllFiles());
    
    // Set up interval to refresh file list (to remove expired files)
    const interval = setInterval(() => {
      setUploadedFiles(fileService.getAllFiles());
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;
    if (!user) return;

    // Check for secret Tavus trigger (Pro users only)
    if (isProUser && input.trim() === '*I want to talk to someone') {
      setAwaitingTavusInput(true);
      setTavusStep('name');
      setInput('');
      
      // Add a system message asking for conversation name
      const systemMessage: Message = {
        id: `system-${Date.now()}`,
        content: 'Please provide a name for this conversation:',
        role: 'assistant',
        timestamp: new Date(),
        provider: 'System'
      };
      
      // We can't directly add to messages here, so we'll handle this in the UI
      return;
    }

    // Handle Tavus input steps
    if (awaitingTavusInput && isProUser) {
      if (tavusStep === 'name') {
        setConversationName(input.trim());
        setTavusStep('context');
        setInput('');
        return;
      } else if (tavusStep === 'context') {
        setConversationContext(input.trim());
        setTavusStep('ready');
        setInput('');
        setAwaitingTavusInput(false);
        setShowTavusChat(true);
        return;
      }
    }

    // Check usage limits for non-Pro users
    if (!isProUser) {
      const { canUse } = await tierService.checkUsageLimit();
      if (!canUse) {
        onTierUpgrade();
        return;
      }
    }

    const messageText = input.trim();
    const messageImages = [...images];
    
    // Get file context if files are uploaded
    const fileContext = uploadedFiles.length > 0 
      ? fileService.getFileContext(uploadedFiles.map(f => f.id))
      : undefined;

    setInput('');
    setImages([]);
    setCurrentResponses([]);

    // Create abort controller for this request
    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Increment usage for non-Pro users
      if (!isProUser) {
        await tierService.incrementUsage();
      }

      const responses = await onSendMessage(messageText, messageImages, useInternetSearch, fileContext);
      
      if (!controller.signal.aborted) {
        setCurrentResponses(responses);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error('Error sending message:', error);
        setCurrentResponses([]);
      }
    } finally {
      setAbortController(null);
    }
  };

  const handleResponseSelect = (response: APIResponse) => {
    const messageText = input.trim() || 'Previous message'; // Fallback text
    const messageImages = [...images];
    
    const fileContext = uploadedFiles.length > 0 
      ? fileService.getFileContext(uploadedFiles.map(f => f.id))
      : undefined;

    // Mark the selected response
    const updatedResponses = currentResponses.map(r => ({
      ...r,
      selected: r.provider === response.provider
    }));

    setCurrentResponses(updatedResponses);
    
    // Save the conversation turn with all responses
    const turn = {
      id: `turn-${Date.now()}`,
      userMessage: messageText,
      responses: updatedResponses,
      selectedResponse: response,
      timestamp: new Date(),
      images: messageImages.length > 0 ? messageImages : undefined
    };

    onSaveConversationTurn(turn);
    onSelectResponse(response, messageText, messageImages, fileContext);
    
    // Clear current responses after selection
    setCurrentResponses([]);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    files.forEach(file => {
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

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleFilesChange = (fileIds: string[]) => {
    // Update uploaded files list
    setUploadedFiles(fileService.getAllFiles().filter(f => fileIds.includes(f.id)));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleCancel = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setCurrentResponses([]);
  };

  const handleTavusClose = () => {
    setShowTavusChat(false);
    setTavusStep('name');
    setConversationName('');
    setConversationContext('');
    setAwaitingTavusInput(false);
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 p-4 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={onToggleMobileSidebar}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Menu size={20} className="text-gray-600" />
            </button>
            <button
              onClick={onToggleSidebar}
              className="hidden lg:block p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Menu size={20} className="text-gray-600" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900">ModelMix</h1>
          </div>
          
          <div className="flex items-center space-x-2">
            {!isProUser && (
              <button
                onClick={onTierUpgrade}
                className="flex items-center space-x-2 px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 transition-colors text-sm"
              >
                <Crown size={14} />
                <span className="hidden sm:inline">Upgrade to Pro</span>
              </button>
            )}
            {isProUser && (
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-lg text-sm">
                <Crown size={14} />
                <span className="hidden sm:inline">Pro Plan</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && currentResponses.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap size={32} className="text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Start Mixing AI Models</h3>
              <p className="text-gray-600 mb-4">
                Ask a question, upload images, and compare AI responses from hundreds of different models.
                Continue natural conversations with full context.
              </p>
              <div className="space-y-2 text-sm text-gray-500">
                <div className="flex items-center justify-center space-x-2">
                  <Globe size={16} className="text-blue-500" />
                  <span>Internet search is available! Toggle it on to get real-time information.</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <Upload size={16} className="text-purple-500" />
                  <span>Image generation is available! Ask the AI to "generate an image of..." or "draw...".</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {/* Show Tavus input prompts */}
        {awaitingTavusInput && isProUser && (
          <div className="flex justify-start mb-6">
            <div className="max-w-3xl">
              <div className="px-4 py-3 rounded-2xl bg-gray-100 text-gray-900 border border-gray-200">
                <div className="text-xs font-medium mb-2 opacity-70">System</div>
                <div>
                  {tavusStep === 'name' && 'Please provide a name for this conversation:'}
                  {tavusStep === 'context' && 'Please provide context for this conversation:'}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentResponses.length > 0 && (
          <ComparisonView
            responses={currentResponses}
            onSelectResponse={handleResponseSelect}
            showSelection={true}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* File Upload Area */}
      {showFileUpload && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <FileUpload
            onFilesChange={handleFilesChange}
            uploadedFiles={uploadedFiles}
          />
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4 bg-white">
        {/* Images Preview */}
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
                  onClick={() => removeImage(index)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center space-x-2 mb-3">
          <button
            onClick={() => setUseInternetSearch(!useInternetSearch)}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              useInternetSearch
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Globe size={14} />
            <span>Use Internet Search</span>
          </button>

          <button
            onClick={() => setShowFileUpload(!showFileUpload)}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              showFileUpload
                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Paperclip size={14} />
            <span>Upload Files</span>
            {uploadedFiles.length > 0 && (
              <span className="bg-purple-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {uploadedFiles.length}
              </span>
            )}
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex space-x-3">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                awaitingTavusInput && isProUser
                  ? tavusStep === 'name'
                    ? 'Enter conversation name...'
                    : 'Enter conversation context...'
                  : 'Ask anything - Pro plan with 4 AI models ready!'
              }
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              rows={1}
              style={{ minHeight: '48px', maxHeight: '120px' }}
              disabled={isLoading}
            />
            
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                title="Upload images"
              >
                <Upload size={16} />
              </button>
            </div>
          </div>

          {isLoading ? (
            <button
              type="button"
              onClick={handleCancel}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
            >
              <X size={16} />
              <span>Cancel</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || !user}
              className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <Send size={16} />
              <span className="hidden sm:inline">Send</span>
            </button>
          )}
        </form>

        {/* Usage Warning for Free Users */}
        {!isProUser && (
          <div className="mt-3 text-center">
            <p className="text-xs text-gray-500">
              🔥 Pro plan active • Unlimited conversations • Upload images/files for context • Toggle internet search for real-time info
            </p>
            <p className="text-xs text-gray-500 mt-1">
              🎨 Pro plan: unlimited everything!
            </p>
          </div>
        )}
      </div>

      {/* Tavus Video Chat Modal */}
      <TavusVideoChat
        isOpen={showTavusChat}
        onClose={handleTavusClose}
        conversationName={conversationName}
        conversationContext={conversationContext}
      />
    </div>
  );
};
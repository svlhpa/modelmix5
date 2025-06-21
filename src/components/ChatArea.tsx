import React, { useState, useRef, useEffect } from 'react';
import { Send, Menu, Upload, Globe, Crown, Video } from 'lucide-react';
import { Message, APIResponse, ModelSettings } from '../types';
import { MessageBubble } from './MessageBubble';
import { ComparisonView } from './ComparisonView';
import { FileUpload } from './FileUpload';
import { TavusSetupFlow } from './TavusSetupFlow';
import { TavusVideoChat } from './TavusVideoChat';
import { fileService, UploadedFile } from '../services/fileService';
import { useAuth } from '../hooks/useAuth';
import { tavusService } from '../services/tavusService';
import { globalApiService } from '../services/globalApiService';

interface ChatAreaProps {
  messages: Message[];
  onSendMessage: (content: string, images?: string[], useInternetSearch?: boolean, fileContext?: string) => Promise<APIResponse[]>;
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
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [responses, setResponses] = useState<APIResponse[]>([]);
  const [useInternetSearch, setUseInternetSearch] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showTavusSetup, setShowTavusSetup] = useState(false);
  const [showTavusChat, setShowTavusChat] = useState(false);
  const [tavusConversationName, setTavusConversationName] = useState('');
  const [tavusConversationalContext, setTavusConversationalContext] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const currentTier = getCurrentTier();
  const isProUser = currentTier === 'tier2';

  useEffect(() => {
    scrollToBottom();
  }, [messages, responses]);

  useEffect(() => {
    // Load uploaded files on component mount
    const files = fileService.getAllFiles();
    setUploadedFiles(files);
  }, []);

  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [input]);

  // Load Tavus API key on component mount
  useEffect(() => {
    loadTavusApiKey();
  }, []);

  const loadTavusApiKey = async () => {
    try {
      // Try to get global Tavus API key
      const globalKey = await globalApiService.getGlobalApiKey('tavus', currentTier);
      if (globalKey) {
        tavusService.setApiKey(globalKey);
      }
    } catch (error) {
      console.error('Failed to load Tavus API key:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    const files = fileIds.map(id => fileService.getFile(id)).filter(Boolean) as UploadedFile[];
    setUploadedFiles(files);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() && images.length === 0) return;

    // CRITICAL: Check for Tavus secret command for Pro users
    if (isProUser && input.trim() === '*I want to talk to someone*') {
      setInput('');
      setShowTavusSetup(true);
      return;
    }

    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    const messageContent = input.trim();
    const messageImages = [...images];
    const fileContext = uploadedFiles.length > 0 
      ? fileService.getFileContext(uploadedFiles.map(f => f.id))
      : undefined;

    // Clear input and images immediately
    setInput('');
    setImages([]);
    setUploadedFiles([]);
    setResponses([]);

    try {
      // Get responses with real-time updates
      const apiResponses = await onSendMessage(
        messageContent, 
        messageImages, 
        useInternetSearch,
        fileContext
      );

      // Set initial responses with loading states
      setResponses(apiResponses);

      // Save conversation turn with all responses for analytics
      const turn = {
        id: `turn-${Date.now()}`,
        userMessage: messageContent,
        responses: apiResponses,
        selectedResponse: undefined,
        timestamp: new Date(),
        images: messageImages.length > 0 ? messageImages : undefined
      };

      onSaveConversationTurn(turn);

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was cancelled');
      } else {
        console.error('Error sending message:', error);
      }
    }

    // Reset internet search toggle
    setUseInternetSearch(false);
  };

  const handleSelectResponse = (response: APIResponse) => {
    const messageContent = input.trim() || 'Previous message'; // Fallback if input is cleared
    const messageImages = [...images];
    const fileContext = uploadedFiles.length > 0 
      ? fileService.getFileContext(uploadedFiles.map(f => f.id))
      : undefined;

    // Mark the selected response
    const updatedResponses = responses.map(r => ({
      ...r,
      selected: r.provider === response.provider
    }));
    setResponses(updatedResponses);

    // Call the parent handler
    onSelectResponse(response, messageContent, messageImages, fileContext);
    
    // Clear responses after selection
    setTimeout(() => {
      setResponses([]);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const handleTavusSetupComplete = (conversationName: string, conversationalContext: string) => {
    setTavusConversationName(conversationName);
    setTavusConversationalContext(conversationalContext);
    setShowTavusSetup(false);
    setShowTavusChat(true);
  };

  const handleTavusChatClose = () => {
    setShowTavusChat(false);
    setTavusConversationName('');
    setTavusConversationalContext('');
  };

  const getEnabledModelsCount = () => {
    const traditionalModels = [
      modelSettings.openai,
      modelSettings.gemini,
      modelSettings.deepseek
    ].filter(Boolean).length;

    const openRouterModels = Object.values(modelSettings.openrouter_models).filter(Boolean).length;
    const imageModels = Object.values(modelSettings.image_models).filter(Boolean).length;

    return traditionalModels + openRouterModels + imageModels;
  };

  const enabledModelsCount = getEnabledModelsCount();

  return (
    <div className="flex-1 flex flex-col h-full bg-white">
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
            <div>
              <h1 className="text-xl font-semibold text-gray-900">ModelMix</h1>
              <p className="text-sm text-gray-500">
                {enabledModelsCount > 0 
                  ? `${enabledModelsCount} AI models ready to compare`
                  : 'Configure AI models in settings to start'
                }
              </p>
            </div>
          </div>
          
          {/* Pro User Badge */}
          {isProUser && (
            <div className="flex items-center space-x-2 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">
              <Crown size={14} />
              <span className="font-medium">Pro</span>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && responses.length === 0 && (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Welcome to ModelMix! 🚀
              </h3>
              <p className="text-gray-600 mb-6">
                Compare AI responses from multiple models to get the best insights. 
                {enabledModelsCount === 0 && ' Configure your AI models in settings to get started.'}
              </p>
              
              {/* Pro User Secret Feature Hint */}
              {isProUser && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center space-x-2 text-purple-800 mb-2">
                    <Crown size={16} />
                    <span className="font-medium">Pro Secret Feature</span>
                  </div>
                  <p className="text-sm text-purple-700">
                    💡 Try typing <code className="bg-purple-100 px-1 py-0.5 rounded">*I want to talk to someone*</code> to unlock AI video chat!
                  </p>
                </div>
              )}
              
              {enabledModelsCount === 0 ? (
                <button
                  onClick={() => {/* Open settings */}}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Configure AI Models
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500">Try asking something like:</p>
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-600">"Explain quantum computing"</p>
                    <p className="text-gray-600">"Write a creative story"</p>
                    <p className="text-gray-600">"Generate an image of a sunset"</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {responses.length > 0 && (
          <ComparisonView
            responses={responses}
            onSelectResponse={handleSelectResponse}
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
        {/* Image Previews */}
        {images.length > 0 && (
          <div className="flex space-x-2 mb-3 overflow-x-auto">
            {images.map((image, index) => (
              <div key={index} className="relative flex-shrink-0">
                <img
                  src={image}
                  alt={`Upload ${index + 1}`}
                  className="w-16 h-16 object-cover rounded-lg border border-gray-200"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* File Upload Previews */}
        {uploadedFiles.length > 0 && (
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-800 mb-2">
              📎 {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''} attached
            </p>
            <div className="space-y-1">
              {uploadedFiles.map((file) => (
                <div key={file.id} className="text-xs text-blue-700">
                  {file.name} ({fileService.formatFileSize(file.size)})
                </div>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Internet Search Toggle */}
          {useInternetSearch && (
            <div className="flex items-center space-x-2 text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
              <Globe size={16} />
              <span>Internet search enabled for real-time information</span>
            </div>
          )}

          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={
                  enabledModelsCount === 0 
                    ? "Configure AI models in settings to start chatting..."
                    : isProUser 
                      ? "Ask anything or try '*I want to talk to someone*' for video chat..."
                      : "Ask anything..."
                }
                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[50px] max-h-32"
                disabled={isLoading || enabledModelsCount === 0}
                rows={1}
              />
              
              {/* Action Buttons */}
              <div className="absolute right-2 top-2 flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setUseInternetSearch(!useInternetSearch)}
                  className={`p-1.5 rounded-md transition-colors ${
                    useInternetSearch
                      ? 'bg-blue-100 text-blue-600'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                  title="Toggle internet search"
                >
                  <Globe size={16} />
                </button>
                
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                  title="Upload images"
                >
                  <Upload size={16} />
                </button>
                
                <button
                  type="button"
                  onClick={() => setShowFileUpload(!showFileUpload)}
                  className={`p-1.5 rounded-md transition-colors ${
                    showFileUpload
                      ? 'bg-gray-100 text-gray-600'
                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                  }`}
                  title="Upload files"
                >
                  📎
                </button>
              </div>
            </div>
            
            <button
              type="submit"
              disabled={(!input.trim() && images.length === 0) || isLoading || enabledModelsCount === 0}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <Send size={16} />
              {isLoading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
            </button>
          </div>
        </form>

        {/* Pro Upgrade Prompt for Free Users */}
        {!isProUser && (
          <div className="mt-3 text-center">
            <button
              onClick={onTierUpgrade}
              className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
            >
              Upgrade to Pro for unlimited conversations and models →
            </button>
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Tavus Setup Flow */}
      <TavusSetupFlow
        isOpen={showTavusSetup}
        onClose={() => setShowTavusSetup(false)}
        onComplete={handleTavusSetupComplete}
      />

      {/* Tavus Video Chat */}
      <TavusVideoChat
        isOpen={showTavusChat}
        onClose={handleTavusChatClose}
        conversationName={tavusConversationName}
        conversationalContext={tavusConversationalContext}
      />
    </div>
  );
};
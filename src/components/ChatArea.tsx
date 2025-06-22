import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X, Menu, Globe, HelpCircle, Crown, Infinity, Image, Upload, FileText, Zap } from 'lucide-react';
import { Message, APIResponse, ModelSettings } from '../types';
import { MessageBubble } from './MessageBubble';
import { ComparisonView } from './ComparisonView';
import { fileService, UploadedFile } from '../services/fileService';
import { useAuth } from '../hooks/useAuth';

interface ChatAreaProps {
  messages: Message[];
  onSendMessage: (content: string, images?: string[], useInternetSearch?: boolean, fileContext?: string) => Promise<APIResponse[]>;
  onSelectResponse: (response: APIResponse) => void;
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
  const { getCurrentTier } = useAuth();
  const [input, setInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [useInternetSearch, setUseInternetSearch] = useState(false);
  const [currentResponses, setCurrentResponses] = useState<APIResponse[]>([]);
  const [showHelpTooltip, setShowHelpTooltip] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const currentTier = getCurrentTier();
  const isProUser = currentTier === 'tier2';

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentResponses]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && images.length === 0) return;

    const messageContent = input.trim();
    const messageImages = [...images];
    const shouldUseSearch = useInternetSearch;
    
    // Get file context
    const fileContext = uploadedFiles.length > 0 
      ? fileService.getFileContext(uploadedFiles.map(f => f.id))
      : undefined;

    setInput('');
    setImages([]);
    setUploadedFiles([]);
    setUseInternetSearch(false);
    setCurrentResponses([]);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      // Start streaming responses
      const responses = await onSendMessage(messageContent, messageImages, shouldUseSearch, fileContext);
      
      // Update with final responses
      setCurrentResponses(responses);
      
      // Save the conversation turn with all responses
      onSaveConversationTurn({
        id: `turn-${Date.now()}`,
        userMessage: messageContent,
        responses: responses,
        selectedResponse: null,
        timestamp: new Date(),
        images: messageImages.length > 0 ? messageImages : undefined
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was cancelled');
      } else {
        console.error('Error sending message:', error);
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleSelectResponse = (response: APIResponse) => {
    onSelectResponse(response);
    setCurrentResponses([]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Handle image files
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    const otherFiles = Array.from(files).filter(file => !file.type.startsWith('image/'));

    // Process images
    for (const file of imageFiles) {
      try {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            setImages(prev => [...prev, e.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error('Failed to read image file:', error);
      }
    }

    // Process other files
    for (const file of otherFiles) {
      try {
        const uploadedFile = await fileService.uploadFile(file);
        setUploadedFiles(prev => [...prev, uploadedFile]);
      } catch (error) {
        console.error('Failed to upload file:', error);
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveFile = (fileId: string) => {
    fileService.removeFile(fileId);
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const toggleHelpTooltip = () => {
    setShowHelpTooltip(!showHelpTooltip);
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 min-w-0">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-3 px-4 flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={onToggleMobileSidebar}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors lg:hidden"
          >
            <Menu size={20} className="text-gray-600" />
          </button>
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors hidden lg:block"
          >
            <Menu size={20} className="text-gray-600" />
          </button>
        </div>
        
        {/* Help Icon with Tooltip */}
        <div className="relative">
          <button
            onClick={toggleHelpTooltip}
            className="p-2 rounded-full hover:bg-gray-100 transition-all duration-200 hover:scale-110 transform"
            aria-label="Help"
          >
            <HelpCircle size={20} className="text-gray-600" />
          </button>
          
          {showHelpTooltip && (
            <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 p-4 text-sm animate-fadeInUp">
              <div className="flex justify-between items-center mb-3 border-b border-gray-100 pb-2">
                <h3 className="font-semibold text-gray-900">ModelMix Features</h3>
                <button 
                  onClick={toggleHelpTooltip}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-start space-x-2">
                  <div className="p-1 bg-blue-100 rounded-full mt-0.5">
                    <Zap size={14} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">AI Model Comparison</p>
                    <p className="text-gray-600">Compare responses from multiple AI models side by side</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-2">
                  <div className="p-1 bg-purple-100 rounded-full mt-0.5">
                    <Globe size={14} className="text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Internet Search</p>
                    <p className="text-gray-600">Enable internet search for up-to-date information</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-2">
                  <div className="p-1 bg-pink-100 rounded-full mt-0.5">
                    <Image size={14} className="text-pink-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Image Generation</p>
                    <p className="text-gray-600">Ask the AI to "generate an image of..." or "draw..."</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-2">
                  <div className="p-1 bg-amber-100 rounded-full mt-0.5">
                    <Upload size={14} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">File Upload</p>
                    <p className="text-gray-600">Upload images and documents for AI analysis</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-2">
                  <div className="p-1 bg-green-100 rounded-full mt-0.5">
                    <FileText size={14} className="text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Write-up Agent</p>
                    <p className="text-gray-600">Generate comprehensive documents with AI orchestration</p>
                  </div>
                </div>
                
                {isProUser ? (
                  <div className="flex items-start space-x-2">
                    <div className="p-1 bg-yellow-100 rounded-full mt-0.5">
                      <Infinity size={14} className="text-yellow-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Pro Plan Active</p>
                      <p className="text-gray-600">Unlimited conversations and models with priority access</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start space-x-2">
                    <div className="p-1 bg-yellow-100 rounded-full mt-0.5">
                      <Crown size={14} className="text-yellow-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Upgrade to Pro</p>
                      <p className="text-gray-600">Get unlimited conversations and models</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="mt-3 pt-2 border-t border-gray-100 text-xs text-gray-500">
                Click outside this box to close
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((message, index) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {currentResponses.length > 0 && (
          <ComparisonView 
            responses={currentResponses} 
            onSelectResponse={handleSelectResponse}
            showSelection={true}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4">
        {/* Uploaded Images Preview */}
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {images.map((image, index) => (
              <div key={index} className="relative group">
                <img
                  src={image}
                  alt={`Uploaded image ${index + 1}`}
                  className="w-16 h-16 object-cover rounded-lg border border-gray-300"
                />
                <button
                  onClick={() => handleRemoveImage(index)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Uploaded Files Preview */}
        {uploadedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="flex items-center bg-gray-100 rounded-lg px-3 py-2 text-sm">
                <FileText size={14} className="text-gray-600 mr-2" />
                <span className="truncate max-w-[150px]">{file.name}</span>
                <span className="text-xs text-gray-500 ml-2">
                  {fileService.formatFileSize(file.size)}
                </span>
                <button
                  onClick={() => handleRemoveFile(file.id)}
                  className="ml-2 text-gray-400 hover:text-red-500"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Feature Indicators */}
        <div className="flex flex-wrap gap-2 mb-3">
          {/* Internet Search Indicator */}
          <button
            onClick={() => setUseInternetSearch(!useInternetSearch)}
            className={`flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              useInternetSearch 
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title="Enable internet search for this message"
          >
            <Globe size={14} />
            <span>Internet Search</span>
            {useInternetSearch && <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>}
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex items-end space-x-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything... Type 'generate an image of...' for AI images"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '200px' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              multiple
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute right-3 bottom-3 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <Paperclip size={18} />
            </button>
          </div>
          <button
            type="submit"
            disabled={(!input.trim() && images.length === 0) || isLoading}
            className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};
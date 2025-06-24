import React, { useState, useRef, useEffect } from 'react';
import { Send, Menu, Image, Paperclip, Loader2, X, Sparkles, Globe, Volume2 } from 'lucide-react';
import { Message, APIResponse, ConversationTurn, ModelSettings } from '../types';
import { MessageBubble } from './MessageBubble';
import { ComparisonView } from './ComparisonView';
import { fileService, UploadedFile } from '../services/fileService';
import { VoiceChatButton } from './VoiceChatButton';

interface ChatAreaProps {
  messages: Message[];
  onSendMessage: (content: string, images?: string[], useInternetSearch?: boolean, fileContext?: string) => Promise<APIResponse[]>;
  onSelectResponse: (response: APIResponse, userMessage: string, images?: string[], fileContext?: string) => void;
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
  const [message, setMessage] = useState('');
  const [responses, setResponses] = useState<APIResponse[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [useInternetSearch, setUseInternetSearch] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, responses]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [message]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [abortController]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!message.trim() && uploadedImages.length === 0) return;
    
    // Create a new abort controller for this request
    const controller = new AbortController();
    setAbortController(controller);
    
    setIsGenerating(true);
    
    // Prepare file context if any
    let fileContext = '';
    if (uploadedFiles.length > 0) {
      fileContext = fileService.getFileContext(uploadedFiles.map(file => file.id));
    }
    
    try {
      // Get responses from all enabled models
      const allResponses = await onSendMessage(
        message, 
        uploadedImages,
        useInternetSearch,
        fileContext
      );
      
      // Update responses state
      setResponses(allResponses);
      
      // Create a conversation turn to track all responses
      const turn: ConversationTurn = {
        id: `turn-${Date.now()}`,
        userMessage: message,
        responses: allResponses,
        timestamp: new Date(),
        images: uploadedImages.length > 0 ? uploadedImages : undefined
      };
      
      // Save the turn for analytics
      onSaveConversationTurn(turn);
      
      // Reset input
      setMessage('');
      setUploadedImages([]);
      setUploadedFiles([]);
      setUseInternetSearch(false);
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsGenerating(false);
      setAbortController(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSelectResponse = (response: APIResponse) => {
    // Only allow selection if not already generating
    if (isGenerating) return;
    
    // Select this response
    onSelectResponse(response, message, uploadedImages);
    
    // Reset states
    setResponses([]);
    setMessage('');
    setUploadedImages([]);
    setUploadedFiles([]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    
    try {
      // Process each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Check if it's an image
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              setUploadedImages(prev => [...prev, e.target!.result as string]);
            }
          };
          reader.readAsDataURL(file);
        } else {
          // Process as a regular file
          const uploadedFile = await fileService.uploadFile(file);
          setUploadedFiles(prev => [...prev, uploadedFile]);
        }
      }
    } catch (error) {
      console.error('File upload error:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload file');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== id));
    fileService.removeFile(id);
  };

  const handleCancelGeneration = () => {
    if (abortController) {
      abortController.abort();
      setIsGenerating(false);
      setAbortController(null);
    }
  };

  const handleVoiceMessage = async (transcribedMessage: string) => {
    if (!transcribedMessage.trim()) return;
    
    setMessage(transcribedMessage);
    
    // Auto-send after a short delay
    setTimeout(() => {
      handleSendMessage();
    }, 500);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50 relative">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
        <button
          onClick={onToggleMobileSidebar}
          className="p-2 rounded-lg hover:bg-gray-100 lg:hidden"
        >
          <Menu size={20} className="text-gray-600" />
        </button>
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg hover:bg-gray-100 hidden lg:block"
        >
          <Menu size={20} className="text-gray-600" />
        </button>
        <h1 className="text-xl font-semibold text-gray-800">ModelMix</h1>
        <div className="w-10"></div> {/* Spacer for alignment */}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <Sparkles size={32} className="text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to ModelMix</h2>
            <p className="text-gray-600 max-w-md mb-8">
              Compare responses from multiple AI models to get the best insights. Ask a question to get started.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center space-x-2 mb-2 text-emerald-600">
                  <Sparkles size={18} />
                  <span className="font-medium">Compare AI Models</span>
                </div>
                <p className="text-sm text-gray-600">
                  See responses from multiple AI models side by side and choose the best one.
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center space-x-2 mb-2 text-blue-600">
                  <Globe size={18} />
                  <span className="font-medium">Internet Search</span>
                </div>
                <p className="text-sm text-gray-600">
                  Enable real-time internet search for up-to-date information.
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center space-x-2 mb-2 text-purple-600">
                  <Volume2 size={18} />
                  <span className="font-medium">Voice Conversations</span>
                </div>
                <p className="text-sm text-gray-600">
                  Talk to AI models using your voice and hear their responses.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {messages.map((message, index) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            
            {/* AI Response Comparison */}
            {responses.length > 0 && (
              <ComparisonView 
                responses={responses} 
                onSelectResponse={handleSelectResponse}
                showSelection={true}
              />
            )}
            
            {/* Loading Indicator */}
            {isGenerating && (
              <div className="flex justify-center my-4">
                <div className="bg-white rounded-full shadow-md px-4 py-2 flex items-center space-x-3">
                  <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm text-gray-700">Generating responses...</span>
                  <button
                    onClick={handleCancelGeneration}
                    className="ml-2 p-1 rounded-full hover:bg-gray-100"
                    title="Cancel"
                  >
                    <X size={16} className="text-gray-500" />
                  </button>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Uploaded Images Preview */}
          {uploadedImages.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {uploadedImages.map((image, index) => (
                <div key={index} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                  <img src={image} alt="Uploaded" className="w-full h-full object-cover" />
                  <button
                    onClick={() => handleRemoveImage(index)}
                    className="absolute top-0 right-0 bg-red-500 text-white rounded-bl-lg p-0.5"
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
                <div key={file.id} className="flex items-center bg-gray-100 rounded-lg px-3 py-1.5 text-sm">
                  <span className="truncate max-w-[150px]">{file.name}</span>
                  <span className="mx-1 text-gray-400">•</span>
                  <span className="text-gray-500">{fileService.formatFileSize(file.size)}</span>
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
          
          <div className="flex items-end space-x-2">
            <div className="flex-1 bg-white border border-gray-300 rounded-lg">
              <div className="flex items-center px-3 py-2 border-b border-gray-200">
                <div className="flex space-x-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isGenerating}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Attach files"
                  >
                    <Paperclip size={18} className="text-gray-500" />
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isGenerating}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    title="Upload image"
                  >
                    <Image size={18} className="text-gray-500" />
                  </button>
                  <button
                    onClick={() => setUseInternetSearch(!useInternetSearch)}
                    disabled={isGenerating}
                    className={`p-1.5 rounded-lg hover:bg-gray-100 transition-colors ${
                      useInternetSearch ? 'bg-blue-100 text-blue-600' : 'text-gray-500'
                    }`}
                    title="Enable internet search"
                  >
                    <Globe size={18} />
                  </button>
                </div>
                <div className="ml-auto flex items-center space-x-2">
                  <VoiceChatButton 
                    onSendMessage={handleVoiceMessage}
                    disabled={isGenerating}
                  />
                </div>
              </div>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="w-full px-3 py-2 focus:outline-none resize-none"
                rows={1}
                disabled={isGenerating}
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={(!message.trim() && uploadedImages.length === 0) || isGenerating}
              className="p-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Send size={20} />
              )}
            </button>
          </div>
          
          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            multiple
            accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/zip,application/x-zip-compressed"
            disabled={isUploading || isGenerating}
          />
          
          {/* Internet search indicator */}
          {useInternetSearch && (
            <div className="mt-2 text-xs text-blue-600 flex items-center">
              <Globe size={12} className="mr-1" />
              Internet search enabled - AI will search the web for current information
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
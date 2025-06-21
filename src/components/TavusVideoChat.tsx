import React, { useState, useEffect } from 'react';
import { X, Video, Loader2, AlertCircle, Phone, PhoneOff } from 'lucide-react';
import { tavusService } from '../services/tavusService';

interface TavusVideoChatProps {
  isOpen: boolean;
  onClose: () => void;
  conversationName: string;
  conversationContext: string;
}

export const TavusVideoChat: React.FC<TavusVideoChatProps> = ({
  isOpen,
  onClose,
  conversationName,
  conversationContext
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationUrl, setConversationUrl] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (isOpen && conversationName && conversationContext) {
      initializeConversation();
    }
  }, [isOpen, conversationName, conversationContext]);

  const initializeConversation = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await tavusService.createConversation(conversationName, conversationContext);
      setConversationUrl(response.conversation_url);
      setIsConnected(true);
    } catch (error) {
      console.error('Failed to create Tavus conversation:', error);
      setError(error instanceof Error ? error.message : 'Failed to start video chat');
    } finally {
      setLoading(false);
    }
  };

  const handleEndCall = () => {
    setIsConnected(false);
    setConversationUrl(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-white rounded-xl w-full h-full md:max-w-4xl md:w-full md:h-[80vh] flex flex-col overflow-hidden transform animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Video size={20} />
            </div>
            <div>
              <h3 className="font-semibold">{conversationName}</h3>
              <p className="text-sm text-purple-100">AI Video Conversation</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {isConnected && (
              <button
                onClick={handleEndCall}
                className="flex items-center space-x-2 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
              >
                <PhoneOff size={16} />
                <span>End Call</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center bg-gray-900">
          {loading && (
            <div className="text-center text-white">
              <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="text-xl font-semibold mb-2">Connecting to AI...</h3>
              <p className="text-gray-300">Setting up your video conversation</p>
            </div>
          )}

          {error && (
            <div className="text-center text-white max-w-md">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={32} className="text-red-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Connection Failed</h3>
              <p className="text-gray-300 mb-4">{error}</p>
              <button
                onClick={initializeConversation}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {conversationUrl && !loading && !error && (
            <div className="w-full h-full">
              <iframe
                src={conversationUrl}
                className="w-full h-full border-0"
                allow="camera; microphone; fullscreen"
                title="Tavus AI Video Chat"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        {isConnected && (
          <div className="bg-gray-800 text-white p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm">Connected to AI</span>
            </div>
            
            <div className="text-xs text-gray-400">
              Context: {conversationContext.slice(0, 50)}...
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
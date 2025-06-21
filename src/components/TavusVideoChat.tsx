import React, { useState, useEffect, useRef } from 'react';
import { X, Video, Mic, MicOff, VideoOff, Phone, PhoneOff, Loader2, AlertCircle, Crown, Volume2, VolumeX } from 'lucide-react';
import { tavusService, TavusConversation } from '../services/tavusService';

interface TavusVideoChatProps {
  isOpen: boolean;
  onClose: () => void;
  conversationName: string;
  conversationalContext: string;
}

export const TavusVideoChat: React.FC<TavusVideoChatProps> = ({
  isOpen,
  onClose,
  conversationName,
  conversationalContext
}) => {
  const [conversation, setConversation] = useState<TavusConversation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOff, setIsSpeakerOff] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (isOpen && !conversation) {
      initializeConversation();
    }
  }, [isOpen]);

  const initializeConversation = async () => {
    setLoading(true);
    setError(null);

    try {
      console.log('Creating Tavus conversation...');
      const newConversation = await tavusService.createConversation(
        conversationName,
        conversationalContext
      );
      
      console.log('Tavus conversation created:', newConversation);
      setConversation(newConversation);
      setIsConnected(true);
    } catch (error) {
      console.error('Failed to create Tavus conversation:', error);
      setError(error instanceof Error ? error.message : 'Failed to start video conversation');
    } finally {
      setLoading(false);
    }
  };

  const handleEndCall = async () => {
    if (conversation) {
      try {
        await tavusService.deleteConversation(conversation.conversation_id);
      } catch (error) {
        console.error('Failed to delete conversation:', error);
      }
    }
    setConversation(null);
    setIsConnected(false);
    onClose();
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    // In a real implementation, you'd send this to the Tavus iframe
    if (iframeRef.current) {
      iframeRef.current.contentWindow?.postMessage({
        type: 'toggle-mute',
        muted: !isMuted
      }, '*');
    }
  };

  const toggleVideo = () => {
    setIsVideoOff(!isVideoOff);
    // In a real implementation, you'd send this to the Tavus iframe
    if (iframeRef.current) {
      iframeRef.current.contentWindow?.postMessage({
        type: 'toggle-video',
        videoOff: !isVideoOff
      }, '*');
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOff(!isSpeakerOff);
    // In a real implementation, you'd send this to the Tavus iframe
    if (iframeRef.current) {
      iframeRef.current.contentWindow?.postMessage({
        type: 'toggle-speaker',
        speakerOff: !isSpeakerOff
      }, '*');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 animate-fadeIn">
      <div className="bg-white rounded-xl w-full h-full md:max-w-4xl md:w-full md:h-[80vh] flex flex-col overflow-hidden transform animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Video size={20} />
            </div>
            <div>
              <h3 className="font-semibold flex items-center space-x-2">
                <Crown size={16} className="text-yellow-300" />
                <span>AI Video Chat</span>
              </h3>
              <p className="text-sm text-purple-100">{conversationName}</p>
            </div>
          </div>
          <button
            onClick={handleEndCall}
            className="p-2 rounded-lg hover:bg-white/20 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Video Area */}
        <div className="flex-1 bg-gray-900 relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center text-white">
                <Loader2 size={48} className="animate-spin mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Connecting to AI Avatar...</h3>
                <p className="text-gray-300">Setting up your video conversation</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center text-white max-w-md mx-auto p-6">
                <AlertCircle size={48} className="text-red-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2 text-red-400">Connection Failed</h3>
                <p className="text-gray-300 mb-4">{error}</p>
                <div className="space-y-2">
                  <button
                    onClick={initializeConversation}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={onClose}
                    className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {conversation && !loading && !error && (
            <iframe
              ref={iframeRef}
              src={conversation.conversation_url}
              className="w-full h-full border-0"
              allow="camera; microphone; autoplay; encrypted-media; fullscreen"
              title="Tavus AI Video Chat"
            />
          )}

          {/* Connection Status */}
          {isConnected && !loading && !error && (
            <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm flex items-center space-x-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span>Connected</span>
            </div>
          )}

          {/* Conversation Context Display */}
          {conversationalContext && !loading && (
            <div className="absolute top-4 right-4 bg-black/50 text-white p-3 rounded-lg max-w-xs">
              <p className="text-xs font-medium mb-1">Context:</p>
              <p className="text-xs opacity-90">{conversationalContext}</p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="bg-gray-800 p-4 flex items-center justify-center space-x-4">
          <button
            onClick={toggleMute}
            className={`p-3 rounded-full transition-all duration-200 hover:scale-110 ${
              isMuted 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-gray-600 hover:bg-gray-700'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <MicOff size={20} className="text-white" />
            ) : (
              <Mic size={20} className="text-white" />
            )}
          </button>

          <button
            onClick={toggleVideo}
            className={`p-3 rounded-full transition-all duration-200 hover:scale-110 ${
              isVideoOff 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-gray-600 hover:bg-gray-700'
            }`}
            title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
          >
            {isVideoOff ? (
              <VideoOff size={20} className="text-white" />
            ) : (
              <Video size={20} className="text-white" />
            )}
          </button>

          <button
            onClick={toggleSpeaker}
            className={`p-3 rounded-full transition-all duration-200 hover:scale-110 ${
              isSpeakerOff 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-gray-600 hover:bg-gray-700'
            }`}
            title={isSpeakerOff ? 'Turn on speaker' : 'Turn off speaker'}
          >
            {isSpeakerOff ? (
              <VolumeX size={20} className="text-white" />
            ) : (
              <Volume2 size={20} className="text-white" />
            )}
          </button>

          <button
            onClick={handleEndCall}
            className="p-3 rounded-full bg-red-500 hover:bg-red-600 transition-all duration-200 hover:scale-110"
            title="End call"
          >
            <PhoneOff size={20} className="text-white" />
          </button>
        </div>

        {/* Footer Info */}
        <div className="bg-gray-100 px-4 py-2 text-center">
          <p className="text-xs text-gray-600">
            🎭 <strong>Pro Feature:</strong> AI Video Chat powered by Tavus • 
            Real-time conversation with AI avatar
          </p>
        </div>
      </div>
    </div>
  );
};
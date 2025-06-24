import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, Globe, ExternalLink, Download, Volume2, Pause } from 'lucide-react';
import { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Clean up audio URL when component unmounts
    return () => {
      if (message.audioUrl) {
        URL.revokeObjectURL(message.audioUrl);
      }
    };
  }, [message.audioUrl]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePlayPause = () => {
    if (!audioRef.current || !message.audioUrl) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error('Failed to play audio:', err));
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  // Simple markdown parser for basic formatting
  const parseMarkdown = (text: string) => {
    if (!text) return text;
    
    // Replace **bold** with <strong>
    let parsed = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Replace *italic* with <em>
    parsed = parsed.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Replace `code` with <code>
    parsed = parsed.replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>');
    
    // Replace line breaks with <br>
    parsed = parsed.replace(/\n/g, '<br>');
    
    return parsed;
  };

  const isUser = message.role === 'user';
  const hasInternetSearch = message.content.includes('=== CURRENT INTERNET SEARCH RESULTS ===');
  const isImageGeneration = message.isImageGeneration || message.generatedImages?.length > 0;
  const hasAudio = !!message.audioUrl;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6 animate-fadeInUp`}>
      <div className={`max-w-3xl min-w-0 ${isUser ? 'order-2' : 'order-1'}`}>
        <div
          className={`px-4 py-3 rounded-2xl transition-all duration-300 hover:shadow-md transform hover:scale-[1.02] ${
            isUser
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-900 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          {message.provider && (
            <div className="text-xs font-medium mb-2 opacity-70 animate-fadeInDown">
              {message.provider}
            </div>
          )}
          
          {/* Display images if present */}
          {message.images && message.images.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2 animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
              {message.images.map((image, index) => (
                <img
                  key={index}
                  src={image}
                  alt={`Uploaded image ${index + 1}`}
                  className="max-w-xs max-h-48 object-cover rounded-lg border border-white/20 hover:scale-105 transition-transform duration-300 cursor-pointer"
                  onClick={() => window.open(image, '_blank')}
                />
              ))}
            </div>
          )}

          {/* Internet search indicator */}
          {hasInternetSearch && (
            <div className="mb-2 flex items-center space-x-2 text-blue-200 animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
              <Globe size={16} className="animate-pulse" />
              <span className="text-sm">Internet search results included</span>
            </div>
          )}
          
          {/* Display generated images if present */}
          {isImageGeneration && message.generatedImages && message.generatedImages.length > 0 && (
            <div className="mb-3 flex flex-col items-center gap-2 animate-fadeInUp" style={{ animationDelay: '0.1s' }}>
              <img
                src={message.generatedImages[0]}
                alt="AI generated image"
                className="max-w-full max-h-64 object-contain rounded-lg border border-gray-200 hover:scale-105 transition-transform duration-300 cursor-pointer"
                onClick={() => window.open(message.generatedImages[0], '_blank')}
              />
              <div className="flex space-x-2 mt-2">
                <a 
                  href={message.generatedImages[0]}
                  download={`generated-image-${Date.now()}.jpg`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-xs bg-white text-gray-700 px-2 py-1 rounded-lg transition-colors hover:bg-gray-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download size={12} />
                  <span>Download</span>
                </a>
                <button
                  onClick={() => window.open(message.generatedImages[0], '_blank')}
                  className="flex items-center space-x-1 text-xs bg-white text-gray-700 px-2 py-1 rounded-lg transition-colors hover:bg-gray-100"
                >
                  <ExternalLink size={12} />
                  <span>Open</span>
                </button>
              </div>
            </div>
          )}
          
          <div 
            className="leading-relaxed break-words animate-fadeInUp"
            style={{ animationDelay: '0.3s' }}
            dangerouslySetInnerHTML={{ 
              __html: parseMarkdown(message.content) 
            }}
          />
          
          {!isUser && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200 animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
              <span className="text-xs text-gray-500">
                {message.timestamp.toLocaleTimeString()}
              </span>
              <div className="flex items-center space-x-2">
                {hasAudio && (
                  <button
                    onClick={handlePlayPause}
                    className="p-1 rounded hover:bg-gray-200 transition-all duration-200 hover:scale-110 transform"
                    title={isPlaying ? "Pause" : "Play response"}
                  >
                    {isPlaying ? (
                      <Pause size={14} className="text-purple-600" />
                    ) : (
                      <Volume2 size={14} className="text-gray-500" />
                    )}
                  </button>
                )}
                <button
                  onClick={handleCopy}
                  className="p-1 rounded hover:bg-gray-200 transition-all duration-200 hover:scale-110 transform"
                  title="Copy message"
                >
                  {copied ? (
                    <Check size={14} className="text-green-600 animate-bounceIn" />
                  ) : (
                    <Copy size={14} className="text-gray-500" />
                  )}
                </button>
              </div>
              
              {/* Hidden audio element */}
              {hasAudio && (
                <audio
                  ref={audioRef}
                  src={message.audioUrl}
                  onEnded={handleAudioEnded}
                  className="hidden"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
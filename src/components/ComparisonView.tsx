import React from 'react';
import { APIResponse } from '../types';
import { Copy, Check, AlertCircle, Zap, Bot, Sparkles, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';

interface ComparisonViewProps {
  responses: APIResponse[];
  onSelectResponse?: (response: APIResponse) => void;
  showSelection?: boolean;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({ 
  responses, 
  onSelectResponse,
  showSelection = false 
}) => {
  const [copiedIndex, setCopiedIndex] = React.useState<number | null>(null);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const handleCopy = async (content: string, index: number) => {
    await navigator.clipboard.writeText(content);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSelectResponse = (response: APIResponse) => {
    if (onSelectResponse && !response.loading && !response.error) {
      onSelectResponse(response);
    }
  };

  const scrollToIndex = (index: number) => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const cardWidth = window.innerWidth < 768 ? 280 : 320; // Smaller cards on mobile
      const scrollPosition = index * (cardWidth + 16); // 16px gap
      container.scrollTo({ left: scrollPosition, behavior: 'smooth' });
      setCurrentIndex(index);
    }
  };

  const scrollLeft = () => {
    const newIndex = Math.max(0, currentIndex - 1);
    scrollToIndex(newIndex);
  };

  const scrollRight = () => {
    const newIndex = Math.min(responses.length - 1, currentIndex + 1);
    scrollToIndex(newIndex);
  };

  // Handle scroll events to update current index
  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const cardWidth = window.innerWidth < 768 ? 280 : 320;
      const scrollLeft = container.scrollLeft;
      const newIndex = Math.round(scrollLeft / (cardWidth + 16));
      setCurrentIndex(Math.max(0, Math.min(newIndex, responses.length - 1)));
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [responses.length]);

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'openai':
        return '🤖';
      case 'open router':
        return '🔀';
      case 'gemini':
        return '💎';
      case 'deepseek':
        return '🔍';
      case 'deepseek r1':
        return '🧠';
      case 'mistral devstral':
        return '⚡';
      case 'gemma 3':
        return '🔷';
      case 'qwen 3':
        return '🌟';
      default:
        return '🤖';
    }
  };

  const getProviderColor = (provider: string, isSelected?: boolean) => {
    if (isSelected) {
      return 'border-emerald-400 bg-gradient-to-br from-emerald-100 to-emerald-200 ring-2 ring-emerald-300';
    }
    
    switch (provider.toLowerCase()) {
      case 'openai':
        return 'border-green-200 bg-gradient-to-br from-green-50 to-green-100';
      case 'open router':
        return 'border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100';
      case 'gemini':
        return 'border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100';
      case 'deepseek':
        return 'border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100';
      case 'deepseek r1':
        return 'border-red-200 bg-gradient-to-br from-red-50 to-red-100';
      case 'mistral devstral':
        return 'border-yellow-200 bg-gradient-to-br from-yellow-50 to-yellow-100';
      case 'gemma 3':
        return 'border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100';
      case 'qwen 3':
        return 'border-pink-200 bg-gradient-to-br from-pink-50 to-pink-100';
      default:
        return 'border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100';
    }
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

  const LoadingAnimation = ({ provider }: { provider: string }) => (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      <div className="relative mb-4">
        {/* Outer rotating ring */}
        <div className="w-12 h-12 border-4 border-gray-200 rounded-full animate-spin border-t-emerald-500"></div>
        {/* Inner pulsing dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
        </div>
      </div>
      
      <div className="text-center">
        <div className="flex items-center justify-center space-x-2 mb-2">
          <Bot size={16} className="text-emerald-600" />
          <span className="font-medium text-emerald-700 text-sm">AI is thinking...</span>
        </div>
        <p className="text-xs text-gray-600">
          {provider} is generating your response
        </p>
        
        {/* Animated dots */}
        <div className="flex justify-center space-x-1 mt-2">
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );

  if (responses.length === 0) return null;

  return (
    <div className="mb-6 min-w-0">
      <div className="flex items-center justify-between mb-4 px-4 md:px-0">
        <div className="flex items-center space-x-2 min-w-0">
          <Sparkles size={16} className="text-emerald-600 flex-shrink-0" />
          <h3 className="font-medium text-gray-900 text-sm md:text-base min-w-0">
            AI Responses ({responses.length} models)
          </h3>
          {showSelection && (
            <span className="text-xs text-gray-500 bg-emerald-50 px-2 py-1 rounded-full hidden sm:inline flex-shrink-0">
              Click to select best response
            </span>
          )}
        </div>
        
        {/* Navigation controls - only show on mobile when there are multiple responses */}
        {responses.length > 1 && (
          <div className="flex items-center space-x-2 md:hidden flex-shrink-0">
            <button
              onClick={scrollLeft}
              disabled={currentIndex === 0}
              className="p-1.5 rounded-lg bg-white border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 shadow-sm"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-gray-500 px-2 min-w-[3rem] text-center">
              {currentIndex + 1} / {responses.length}
            </span>
            <button
              onClick={scrollRight}
              disabled={currentIndex === responses.length - 1}
              className="p-1.5 rounded-lg bg-white border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 shadow-sm"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
      
      {/* Horizontal scrolling container - optimized for mobile */}
      <div className="relative min-w-0">
        <div 
          ref={scrollContainerRef}
          className="overflow-x-auto pb-4 scrollbar-hide"
          style={{ 
            scrollbarWidth: 'none', 
            msOverflowStyle: 'none',
            scrollSnapType: 'x mandatory'
          }}
        >
          <div className="flex space-x-4 px-4 md:px-0" style={{ width: 'max-content' }}>
            {responses.map((response, index) => (
              <div
                key={`${response.provider}-${index}`}
                className={`flex-shrink-0 border-2 rounded-xl shadow-sm transition-all hover:shadow-lg ${
                  showSelection && !response.loading && !response.error 
                    ? 'cursor-pointer hover:scale-105' 
                    : ''
                } ${getProviderColor(response.provider, response.selected)}`}
                style={{ 
                  minWidth: window.innerWidth < 768 ? '280px' : '320px',
                  maxWidth: window.innerWidth < 768 ? '280px' : '320px',
                  scrollSnapAlign: 'start'
                }}
                onClick={() => showSelection && handleSelectResponse(response)}
              >
                {/* Header */}
                <div className="flex items-center justify-between p-3 md:p-4 border-b border-white/50">
                  <div className="flex items-center space-x-2 md:space-x-3 min-w-0">
                    <span className="text-lg md:text-xl flex-shrink-0">{getProviderIcon(response.provider)}</span>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 text-xs md:text-sm truncate">{response.provider}</h3>
                      <div className="flex items-center space-x-1">
                        {response.loading && (
                          <>
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                            <span className="text-xs text-emerald-600 font-medium">Generating</span>
                          </>
                        )}
                        {!response.loading && !response.error && !response.selected && (
                          <>
                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                            <span className="text-xs text-green-600 font-medium">Complete</span>
                          </>
                        )}
                        {response.selected && (
                          <>
                            <CheckCircle size={12} className="text-green-600" />
                            <span className="text-xs text-green-600 font-medium">Selected</span>
                          </>
                        )}
                        {response.error && (
                          <>
                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                            <span className="text-xs text-red-600 font-medium">Error</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    {!response.loading && !response.error && response.content && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(response.content, index);
                        }}
                        className="p-1.5 rounded-lg hover:bg-white/50 transition-colors group"
                        title="Copy response"
                      >
                        {copiedIndex === index ? (
                          <Check size={14} className="text-green-600" />
                        ) : (
                          <Copy size={14} className="text-gray-500 group-hover:text-gray-700" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-3 md:p-4 min-h-[180px] md:min-h-[200px] max-h-[300px] md:max-h-[400px] overflow-y-auto">
                  {response.loading && <LoadingAnimation provider={response.provider} />}

                  {response.error && (
                    <div className="flex flex-col items-center justify-center py-6">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mb-3">
                        <AlertCircle size={20} className="text-red-500" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-red-700 mb-2 text-sm">Error occurred</p>
                        <p className="text-xs text-red-600 mb-3 break-words">{response.error}</p>
                        {response.error.includes('API key') && (
                          <p className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded-lg">
                            💡 Please check your API key in settings
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {!response.loading && !response.error && response.content && (
                    <div className="prose prose-sm max-w-none">
                      <div 
                        className="text-gray-800 text-xs md:text-sm leading-relaxed break-words"
                        dangerouslySetInnerHTML={{ 
                          __html: parseMarkdown(response.content) 
                        }}
                      />
                    </div>
                  )}

                  {showSelection && !response.loading && !response.error && response.content && (
                    <div className="mt-3 text-center">
                      <div className="text-xs text-gray-500 bg-white/50 px-2 py-1 rounded-full inline-block">
                        Tap to select this response
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Desktop navigation arrows - hidden on mobile */}
        <div className="hidden md:block">
          {currentIndex > 0 && (
            <button
              onClick={scrollLeft}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 p-2 bg-white rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 z-10"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          {currentIndex < responses.length - 1 && (
            <button
              onClick={scrollRight}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-white rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 z-10"
            >
              <ChevronRight size={20} />
            </button>
          )}
        </div>
      </div>
      
      {/* Scroll indicator dots - only show on mobile when there are multiple responses */}
      {responses.length > 1 && (
        <div className="flex justify-center mt-4 space-x-2 md:hidden">
          {responses.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollToIndex(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentIndex ? 'bg-emerald-500' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
import React, { useState } from 'react';
import { X, Crown, MessageCircle, Send, Sparkles, Video } from 'lucide-react';

interface TavusSetupFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (conversationName: string, conversationalContext: string) => void;
}

export const TavusSetupFlow: React.FC<TavusSetupFlowProps> = ({
  isOpen,
  onClose,
  onComplete
}) => {
  const [step, setStep] = useState<'name' | 'context'>('name');
  const [conversationName, setConversationName] = useState('');
  const [conversationalContext, setConversationalContext] = useState('');

  const handleNameSubmit = () => {
    if (conversationName.trim()) {
      setStep('context');
    }
  };

  const handleContextSubmit = () => {
    if (conversationalContext.trim()) {
      onComplete(conversationName.trim(), conversationalContext.trim());
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      action();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-xl max-w-md w-full p-6 transform animate-slideUp">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Video size={20} className="text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <Crown size={16} className="text-yellow-500" />
                <span>AI Video Chat Setup</span>
              </h3>
              <p className="text-sm text-gray-500">Configure your conversation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center space-x-2 mb-6">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step === 'name' ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-600'
          }`}>
            1
          </div>
          <div className={`flex-1 h-1 rounded ${
            step === 'context' ? 'bg-purple-600' : 'bg-gray-200'
          }`}></div>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step === 'context' ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            2
          </div>
        </div>

        {step === 'name' && (
          <div className="space-y-4 animate-fadeInUp">
            <div className="text-center mb-6">
              <Sparkles className="text-purple-600 mx-auto mb-3" size={32} />
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                What should we call this conversation?
              </h4>
              <p className="text-sm text-gray-600">
                Give your AI video chat a memorable name
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Conversation Name
              </label>
              <input
                type="text"
                value={conversationName}
                onChange={(e) => setConversationName(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, handleNameSubmit)}
                placeholder="e.g., Strategy Discussion, Creative Brainstorm..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                autoFocus
              />
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <p className="text-xs text-purple-700">
                💡 <strong>Tip:</strong> Choose a descriptive name that reflects the purpose of your conversation
              </p>
            </div>

            <button
              onClick={handleNameSubmit}
              disabled={!conversationName.trim()}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <span>Continue</span>
              <Send size={16} />
            </button>
          </div>
        )}

        {step === 'context' && (
          <div className="space-y-4 animate-fadeInUp">
            <div className="text-center mb-6">
              <MessageCircle className="text-purple-600 mx-auto mb-3" size={32} />
              <h4 className="text-lg font-medium text-gray-900 mb-2">
                Set the conversation context
              </h4>
              <p className="text-sm text-gray-600">
                Help the AI understand what you'd like to discuss
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Conversation Context
              </label>
              <textarea
                value={conversationalContext}
                onChange={(e) => setConversationalContext(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, handleContextSubmit)}
                placeholder="e.g., I want to discuss marketing strategies for my startup, brainstorm creative ideas for a project, or get advice on career decisions..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                autoFocus
              />
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <p className="text-xs text-purple-700">
                🎯 <strong>Tip:</strong> Be specific about your goals to get the most relevant conversation
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setStep('name')}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleContextSubmit}
                disabled={!conversationalContext.trim()}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Video size={16} />
                <span>Start Video Chat</span>
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <p className="text-xs text-yellow-700">
            👑 <strong>Pro Feature:</strong> AI Video Chat is exclusively available to Pro subscribers
          </p>
        </div>
      </div>
    </div>
  );
};
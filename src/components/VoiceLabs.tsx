import React, { useState } from 'react';
import { X, Mic, User, Headphones, Brain, Briefcase, ExternalLink, Maximize2, Minimize2 } from 'lucide-react';

interface VoiceLabsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface VoiceAgent {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  url: string;
  color: string;
}

const voiceAgents: VoiceAgent[] = [
  {
    id: 'general',
    name: 'General Agent',
    description: 'A versatile AI assistant for general conversations and questions',
    icon: User,
    url: 'https://elevenlabs.io/app/talk-to?agent_id=agent_01jyh0t0s5fz5rvc1zc6t9x4a7',
    color: 'from-blue-500 to-blue-600'
  },
  {
    id: 'tech-support',
    name: 'Tech Support Agent',
    description: 'Expert technical support for troubleshooting and IT assistance',
    icon: Headphones,
    url: 'https://elevenlabs.io/app/talk-to?agent_id=agent_01jyh15t97f12ag8j3vjk5fdr9',
    color: 'from-green-500 to-green-600'
  },
  {
    id: 'mindfulness',
    name: 'Mindfulness Coach',
    description: 'Guided meditation and mindfulness practices for mental wellness',
    icon: Brain,
    url: 'https://elevenlabs.io/app/talk-to?agent_id=agent_01jyh184r9fyxbxx44g6a20fb5',
    color: 'from-purple-500 to-purple-600'
  },
  {
    id: 'interview-coach',
    name: 'Job Interview Coach',
    description: 'Professional interview preparation and career guidance',
    icon: Briefcase,
    url: 'https://elevenlabs.io/app/talk-to?agent_id=agent_01jyh1a5p9f0jb7trhnacwfs76',
    color: 'from-orange-500 to-orange-600'
  }
];

export const VoiceLabs: React.FC<VoiceLabsProps> = ({ isOpen, onClose }) => {
  const [selectedAgent, setSelectedAgent] = useState<VoiceAgent | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!isOpen) return null;

  const handleAgentSelect = (agent: VoiceAgent) => {
    setSelectedAgent(agent);
  };

  const handleBackToAgents = () => {
    setSelectedAgent(null);
    setIsFullscreen(false);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Fullscreen mode
  if (isFullscreen && selectedAgent) {
    return (
      <div className="fixed inset-0 bg-black z-[60] flex flex-col">
        {/* Fullscreen header */}
        <div className="bg-gray-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <selectedAgent.icon size={20} className="text-white" />
            <span className="font-medium">{selectedAgent.name}</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
              title="Exit fullscreen"
            >
              <Minimize2 size={20} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
              title="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        {/* Fullscreen iframe */}
        <div className="flex-1">
          <iframe
            src={selectedAgent.url}
            className="w-full h-full border-0"
            allow="microphone; camera; autoplay; encrypted-media; fullscreen"
            title={selectedAgent.name}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className={`bg-white rounded-xl w-full p-6 max-h-[90vh] overflow-y-auto transform animate-slideUp ${
        selectedAgent ? 'max-w-6xl h-[90vh]' : 'max-w-4xl'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg animate-bounceIn">
              <Mic size={24} className="text-purple-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Voice Labs</h2>
              <p className="text-gray-500">
                {selectedAgent ? `Talking with ${selectedAgent.name}` : 'Choose an AI voice agent to start talking'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {selectedAgent && (
              <>
                <button
                  onClick={handleBackToAgents}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Back to Agents
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-all duration-200 hover:scale-110"
                  title="Fullscreen"
                >
                  <Maximize2 size={20} className="text-gray-500" />
                </button>
              </>
            )}
            <button
              onClick={selectedAgent ? handleBackToAgents : onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-all duration-200 hover:scale-110"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        {!selectedAgent ? (
          /* Agent Selection */
          <div className="space-y-6">
            {/* Info Section */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-purple-800 mb-4 flex items-center space-x-2">
                <Mic className="text-purple-600" size={20} />
                <span>AI Voice Agents</span>
              </h3>
              <p className="text-purple-700 mb-4">
                Experience natural voice conversations with specialized AI agents. Each agent is designed for specific use cases and powered by ElevenLabs' advanced voice technology.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-start space-x-3">
                  <div className="p-1 bg-purple-100 rounded-lg flex-shrink-0">
                    <Mic className="text-purple-600" size={14} />
                  </div>
                  <div>
                    <p className="font-medium text-purple-800">Natural Voice Interaction</p>
                    <p className="text-purple-700">Speak naturally and get real-time voice responses</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="p-1 bg-purple-100 rounded-lg flex-shrink-0">
                    <Brain className="text-purple-600" size={14} />
                  </div>
                  <div>
                    <p className="font-medium text-purple-800">Specialized Expertise</p>
                    <p className="text-purple-700">Each agent is trained for specific domains</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Agent Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {voiceAgents.map((agent, index) => (
                <div
                  key={agent.id}
                  className="group border-2 border-gray-200 rounded-xl p-6 hover:border-purple-300 hover:shadow-lg transition-all duration-300 cursor-pointer transform hover:scale-105 animate-fadeInUp"
                  style={{ animationDelay: `${index * 0.1}s` }}
                  onClick={() => handleAgentSelect(agent)}
                >
                  <div className="flex items-start space-x-4">
                    <div className={`p-3 rounded-xl bg-gradient-to-r ${agent.color} group-hover:scale-110 transition-transform duration-300`}>
                      <agent.icon size={24} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors">
                        {agent.name}
                      </h3>
                      <p className="text-gray-600 text-sm leading-relaxed mb-4">
                        {agent.description}
                      </p>
                      <div className="flex items-center space-x-2 text-purple-600 group-hover:text-purple-700 transition-colors">
                        <Mic size={14} />
                        <span className="text-sm font-medium">Start Voice Chat</span>
                        <ExternalLink size={12} className="opacity-60" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Info */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-gray-700">Powered by ElevenLabs</span>
              </div>
              <p className="text-xs text-gray-600">
                These voice agents use advanced AI technology for natural conversation. 
                Make sure your microphone is enabled for the best experience.
              </p>
            </div>
          </div>
        ) : (
          /* Agent Interface */
          <div className="space-y-4">
            {/* Agent Info */}
            <div className={`bg-gradient-to-r ${selectedAgent.color} text-white p-4 rounded-lg`}>
              <div className="flex items-center space-x-3">
                <selectedAgent.icon size={24} />
                <div>
                  <h3 className="font-semibold">{selectedAgent.name}</h3>
                  <p className="text-white/80 text-sm">{selectedAgent.description}</p>
                </div>
              </div>
            </div>

            {/* Voice Interface */}
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ height: '500px' }}>
              <iframe
                src={selectedAgent.url}
                className="w-full h-full border-0"
                allow="microphone; camera; autoplay; encrypted-media; fullscreen"
                title={selectedAgent.name}
              />
            </div>

            {/* Controls */}
            <div className="flex justify-between items-center text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Voice agent is active</span>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => window.open(selectedAgent.url, '_blank')}
                  className="flex items-center space-x-1 text-purple-600 hover:text-purple-700"
                >
                  <ExternalLink size={14} />
                  <span>Open in new tab</span>
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="flex items-center space-x-1 text-purple-600 hover:text-purple-700"
                >
                  <Maximize2 size={14} />
                  <span>Fullscreen</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
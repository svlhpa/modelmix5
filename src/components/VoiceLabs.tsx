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
    description: 'Your all-purpose AI assistant for everyday conversations and questions',
    icon: User,
    url: 'https://elevenlabs.io/app/talk-to?agent_id=agent_01jyh0t0s5fz5rvc1zc6t9x4a7',
    color: 'from-blue-500 to-blue-600'
  },
  {
    id: 'tech-support',
    name: 'Tech Support Agent',
    description: 'Expert technical assistance for troubleshooting and IT support',
    icon: Headphones,
    url: 'https://elevenlabs.io/app/talk-to?agent_id=agent_01jyh15t97f12ag8j3vjk5fdr9',
    color: 'from-green-500 to-green-600'
  },
  {
    id: 'mindfulness',
    name: 'Mindfulness Coach',
    description: 'Guided meditation, stress relief, and mental wellness support',
    icon: Brain,
    url: 'https://elevenlabs.io/app/talk-to?agent_id=agent_01jyh184r9fyxbxx44g6a20fb5',
    color: 'from-purple-500 to-purple-600'
  },
  {
    id: 'interview-coach',
    name: 'Job Interview Coach',
    description: 'Practice interviews and get career advice from an expert coach',
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
  if (selectedAgent && isFullscreen) {
    return (
      <div className="fixed inset-0 bg-black z-[60] flex flex-col">
        {/* Fullscreen header */}
        <div className="bg-gray-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <selectedAgent.icon size={20} className="text-blue-400" />
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
              onClick={handleBackToAgents}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
              title="Back to agents"
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
            allow="microphone; autoplay; encrypted-media; fullscreen"
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
            <div className="p-2 bg-gradient-to-r from-purple-100 to-blue-100 rounded-lg animate-bounceIn">
              <Mic size={24} className="text-purple-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Voice Labs</h2>
              <p className="text-gray-500">Choose an AI voice agent to start talking</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {selectedAgent && (
              <>
                <button
                  onClick={toggleFullscreen}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-all duration-200 hover:scale-110"
                  title="Fullscreen"
                >
                  <Maximize2 size={20} className="text-gray-500" />
                </button>
                <button
                  onClick={handleBackToAgents}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-all duration-200 hover:scale-110"
                  title="Back to agents"
                >
                  <User size={20} className="text-gray-500" />
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

        {!selectedAgent ? (
          /* Agent Selection */
          <div className="space-y-6">
            {/* Info Banner */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="p-1 bg-purple-100 rounded-lg flex-shrink-0">
                  <Mic className="text-purple-600" size={16} />
                </div>
                <div>
                  <h4 className="font-medium text-purple-800 mb-1">AI Voice Conversations</h4>
                  <p className="text-sm text-purple-700">
                    Select an AI voice agent below to start a natural conversation. Each agent is specialized for different types of interactions and support.
                  </p>
                </div>
              </div>
            </div>

            {/* Agent Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {voiceAgents.map((agent, index) => (
                <div
                  key={agent.id}
                  className="group relative bg-white border-2 border-gray-200 rounded-xl p-6 cursor-pointer transition-all duration-300 hover:border-purple-300 hover:shadow-lg transform hover:scale-105 animate-fadeInUp"
                  style={{ animationDelay: `${index * 0.1}s` }}
                  onClick={() => handleAgentSelect(agent)}
                >
                  {/* Agent Icon */}
                  <div className={`w-16 h-16 rounded-full bg-gradient-to-r ${agent.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <agent.icon size={32} className="text-white" />
                  </div>

                  {/* Agent Info */}
                  <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors">
                    {agent.name}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">
                    {agent.description}
                  </p>

                  {/* Action Button */}
                  <div className="flex items-center justify-between">
                    <button className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg group-hover:bg-purple-100 group-hover:text-purple-700 transition-all duration-200">
                      <Mic size={16} />
                      <span className="font-medium">Start Talking</span>
                    </button>
                    <ExternalLink size={16} className="text-gray-400 group-hover:text-purple-500 transition-colors" />
                  </div>

                  {/* Hover Effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-blue-500/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                </div>
              ))}
            </div>

            {/* Footer Info */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-800 mb-2">About Voice Labs</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Powered by ElevenLabs advanced voice AI technology</li>
                <li>• Natural, human-like conversations with specialized AI agents</li>
                <li>• Real-time voice interaction with instant responses</li>
                <li>• Each agent is trained for specific use cases and expertise</li>
                <li>• Secure and private conversations</li>
              </ul>
            </div>
          </div>
        ) : (
          /* Agent Interface */
          <div className="space-y-4">
            {/* Agent Header */}
            <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${selectedAgent.color} flex items-center justify-center`}>
                    <selectedAgent.icon size={24} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedAgent.name}</h3>
                    <p className="text-sm text-gray-600">{selectedAgent.description}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1 text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">Connected</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Voice Agent Interface */}
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9', minHeight: '500px' }}>
              <iframe
                src={selectedAgent.url}
                className="w-full h-full border-0"
                allow="microphone; autoplay; encrypted-media; fullscreen"
                title={selectedAgent.name}
              />
            </div>

            {/* Controls */}
            <div className="flex justify-between items-center text-sm text-gray-600">
              <span>🎤 Voice conversation is active</span>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => window.open(selectedAgent.url, '_blank')}
                  className="flex items-center space-x-1 text-blue-600 hover:text-blue-700"
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
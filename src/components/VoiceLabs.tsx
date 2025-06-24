import React, { useState, useEffect } from 'react';
import { X, Headphones, ExternalLink, Check, AlertCircle, Loader2, Volume2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface VoiceLabsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface VoiceAgent {
  id: string;
  name: string;
  description: string;
  agentUrl: string;
  imageUrl: string;
  category: string;
}

export const VoiceLabs: React.FC<VoiceLabsProps> = ({ isOpen, onClose }) => {
  const { user, getCurrentTier } = useAuth();
  const [activeAgentUrl, setActiveAgentUrl] = useState<string | null>(null);
  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const currentTier = getCurrentTier();
  const isProUser = currentTier === 'tier2';

  useEffect(() => {
    if (isOpen) {
      loadAgents();
    } else {
      setActiveAgentUrl(null);
      setIframeLoaded(false);
    }
  }, [isOpen]);

  const loadAgents = () => {
    setLoading(true);
    setError(null);
    
    // These are the Eleven Labs agents
    const availableAgents: VoiceAgent[] = [
      {
        id: 'general',
        name: 'General Assistant',
        description: 'A helpful AI assistant that can answer questions on a wide range of topics.',
        agentUrl: 'https://elevenlabs.io/app/talk-to?agent_id=agent_01jyh0t0s5fz5rvc1zc6t9x4a7',
        imageUrl: 'https://images.pexels.com/photos/7567434/pexels-photo-7567434.jpeg?auto=compress&cs=tinysrgb&w=300',
        category: 'General'
      },
      {
        id: 'tech-support',
        name: 'Tech Support Agent',
        description: 'Get help with technical issues and computer problems.',
        agentUrl: 'https://elevenlabs.io/app/talk-to?agent_id=agent_01jyh15t97f12ag8j3vjk5fdr9',
        imageUrl: 'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=300',
        category: 'Support'
      },
      {
        id: 'mindfulness',
        name: 'Mindfulness Coach',
        description: 'Guided meditation and mindfulness practices for stress reduction.',
        agentUrl: 'https://elevenlabs.io/app/talk-to?agent_id=agent_01jyh184r9fyxbxx44g6a20fb5',
        imageUrl: 'https://images.pexels.com/photos/3759661/pexels-photo-3759661.jpeg?auto=compress&cs=tinysrgb&w=300',
        category: 'Wellness'
      },
      {
        id: 'interview-coach',
        name: 'Job Interview Coach',
        description: 'Practice for job interviews with personalized feedback.',
        agentUrl: 'https://elevenlabs.io/app/talk-to?agent_id=agent_01jyh1a5p9f0jb7trhnacwfs76',
        imageUrl: 'https://images.pexels.com/photos/5668858/pexels-photo-5668858.jpeg?auto=compress&cs=tinysrgb&w=300',
        category: 'Career'
      }
    ];
    
    setAgents(availableAgents);
    setLoading(false);
  };

  const handleSelectAgent = (agentUrl: string) => {
    setActiveAgentUrl(agentUrl);
    setIframeLoaded(false);
  };

  const handleIframeLoad = () => {
    setIframeLoaded(true);
  };

  const getCategories = () => {
    const categories = new Set<string>();
    agents.forEach(agent => categories.add(agent.category));
    return ['All', ...Array.from(categories)];
  };

  const filteredAgents = selectedCategory === 'All' 
    ? agents 
    : agents.filter(agent => agent.category === selectedCategory);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden transform animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg animate-bounceIn">
                <Headphones size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Voice Labs</h2>
                <p className="text-indigo-100">Powered by Eleven Labs AI voice agents</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/20 transition-all duration-200 hover:scale-110"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar with Agents */}
          {!activeAgentUrl && (
            <div className="w-full p-6 overflow-y-auto">
              <div className="max-w-4xl mx-auto">
                {/* Category Filter */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Voice Agents</h3>
                    <div className="flex space-x-2">
                      {getCategories().map(category => (
                        <button
                          key={category}
                          onClick={() => setSelectedCategory(category)}
                          className={`px-3 py-1 rounded-full text-sm ${
                            selectedCategory === category
                              ? 'bg-indigo-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          } transition-colors`}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Agents Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredAgents.map(agent => (
                    <div
                      key={agent.id}
                      className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 hover:scale-105 transform bg-white"
                    >
                      <div className="h-40 overflow-hidden">
                        <img
                          src={agent.imageUrl}
                          alt={agent.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-gray-900">{agent.name}</h4>
                          <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full">
                            {agent.category}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">{agent.description}</p>
                        <button
                          onClick={() => handleSelectAgent(agent.agentUrl)}
                          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                          <Headphones size={16} />
                          <span>Start Conversation</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Info Section */}
                <div className="mt-8 bg-indigo-50 border border-indigo-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-indigo-900 mb-4 flex items-center">
                    <Volume2 size={20} className="mr-2" />
                    About Voice Labs
                  </h3>
                  <div className="text-sm text-indigo-700 space-y-2">
                    <p>Voice Labs provides access to Eleven Labs' interactive AI voice agents. These agents offer natural, conversational experiences with realistic voices.</p>
                    <p>You can speak to these agents using your microphone, and they'll respond with natural-sounding speech. The conversations are contextual and the agents remember what you've discussed.</p>
                    <p>To get started, simply select an agent and click "Start Conversation". Make sure to allow microphone access when prompted.</p>
                  </div>
                  <div className="mt-4 text-xs text-indigo-600">
                    Powered by Eleven Labs' state-of-the-art voice synthesis technology.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Agent Conversation View */}
          {activeAgentUrl && (
            <div className="w-full flex flex-col">
              {/* Agent Header */}
              <div className="bg-gray-50 border-b border-gray-200 p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => setActiveAgentUrl(null)}
                    className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    <X size={20} className="text-gray-600" />
                  </button>
                  <h3 className="font-medium text-gray-900">
                    {agents.find(a => a.agentUrl === activeAgentUrl)?.name || 'Voice Agent'}
                  </h3>
                </div>
                <div className="flex items-center space-x-2">
                  <a
                    href={activeAgentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-lg hover:bg-indigo-200 transition-colors"
                  >
                    <ExternalLink size={12} />
                    <span>Open in new tab</span>
                  </a>
                </div>
              </div>

              {/* Iframe Container */}
              <div className="flex-1 relative bg-black">
                {!iframeLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                    <div className="text-center">
                      <Loader2 size={40} className="text-indigo-600 animate-spin mx-auto mb-4" />
                      <p className="text-gray-700 font-medium">Loading voice agent...</p>
                      <p className="text-gray-500 text-sm mt-2">This may take a few moments</p>
                    </div>
                  </div>
                )}
                <iframe
                  src={activeAgentUrl}
                  className="w-full h-full border-0"
                  allow="microphone; camera; autoplay; encrypted-media"
                  onLoad={handleIframeLoad}
                  title="Eleven Labs Voice Agent"
                />
              </div>

              {/* Footer */}
              <div className="bg-gray-50 border-t border-gray-200 p-3 text-center">
                <p className="text-xs text-gray-500">
                  Voice agent powered by Eleven Labs. Allow microphone access for the best experience.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
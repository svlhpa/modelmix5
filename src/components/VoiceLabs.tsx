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
  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentTier = getCurrentTier();
  const isProUser = currentTier === 'tier2';

  useEffect(() => {
    if (isOpen) {
      loadAgents();
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

  const handleOpenExternalAgent = (agentUrl: string) => {
    window.open(agentUrl, '_blank', 'noopener,noreferrer');
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
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            {/* CSP Warning */}
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-amber-800 mb-1">External Voice Agents</h3>
                  <p className="text-sm text-amber-700">
                    Due to security restrictions, voice agents will open in a new browser tab. This provides the best experience with full access to all features.
                  </p>
                </div>
              </div>
            </div>

            {/* Category Filter */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Voice Agents</h3>
                <div className="flex flex-wrap gap-2">
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
                      onClick={() => handleOpenExternalAgent(agent.agentUrl)}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      <ExternalLink size={16} />
                      <span>Open Voice Agent</span>
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
                <p>To get started, simply select an agent and click "Open Voice Agent". Make sure to allow microphone access when prompted.</p>
              </div>
              <div className="mt-4 text-xs text-indigo-600">
                Powered by Eleven Labs' state-of-the-art voice synthesis technology.
              </div>
            </div>

            {/* Features List */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-green-100 rounded-full">
                    <Check size={16} className="text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">True Real-Time Conversation</h4>
                    <p className="text-sm text-gray-600">Low-latency voice interactions with natural back-and-forth flow.</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-green-100 rounded-full">
                    <Check size={16} className="text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">Interruption Capability</h4>
                    <p className="text-sm text-gray-600">Interrupt the AI mid-sentence, just like in human conversations.</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-green-100 rounded-full">
                    <Check size={16} className="text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">Specialized Agents</h4>
                    <p className="text-sm text-gray-600">Purpose-built agents with expertise in specific domains.</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-green-100 rounded-full">
                    <Check size={16} className="text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 mb-1">High-Quality Voices</h4>
                    <p className="text-sm text-gray-600">Premium voice synthesis with natural intonation and emotion.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
import React, { useState, useEffect } from 'react';
import { X, Bot, Zap, CheckCircle, AlertCircle, Loader2, Brain, Settings, RefreshCw, ArrowRight, Sparkles, Crown } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { globalApiService } from '../services/globalApiService';

interface AgentsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  icon: React.ReactNode;
  status: 'available' | 'unavailable';
}

export const Agents: React.FC<AgentsProps> = ({ isOpen, onClose }) => {
  const { user, getCurrentTier } = useAuth();
  const [loading, setLoading] = useState(true);
  const [picaosApiKey, setPicaosApiKey] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testingAgent, setTestingAgent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentTier = getCurrentTier();
  const isProUser = currentTier === 'tier2';

  useEffect(() => {
    if (isOpen) {
      loadAgents();
    }
  }, [isOpen]);

  const loadAgents = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Check if PicaOS API key is available
      const apiKey = await globalApiService.getGlobalApiKey('picaos', currentTier);
      setPicaosApiKey(apiKey);
      
      // Mock agents data - in a real implementation, you'd fetch this from PicaOS API
      const mockAgents: Agent[] = [
        {
          id: 'research-agent',
          name: 'Research Agent',
          description: 'Conducts comprehensive research on any topic with multiple sources and fact-checking',
          capabilities: ['Web search', 'Source verification', 'Citation generation', 'Fact-checking'],
          icon: <Brain size={24} className="text-blue-500" />,
          status: apiKey ? 'available' : 'unavailable'
        },
        {
          id: 'content-agent',
          name: 'Content Creation Agent',
          description: 'Creates high-quality content with multi-step refinement and quality assurance',
          capabilities: ['Multi-draft writing', 'Self-critique', 'SEO optimization', 'Style adaptation'],
          icon: <Sparkles size={24} className="text-purple-500" />,
          status: apiKey ? 'available' : 'unavailable'
        },
        {
          id: 'data-agent',
          name: 'Data Analysis Agent',
          description: 'Analyzes complex datasets with multiple specialized models working together',
          capabilities: ['Data cleaning', 'Statistical analysis', 'Visualization planning', 'Insight generation'],
          icon: <Zap size={24} className="text-green-500" />,
          status: apiKey ? 'available' : 'unavailable'
        }
      ];
      
      setAgents(mockAgents);
    } catch (error) {
      console.error('Failed to load agents:', error);
      setError('Failed to load agents. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setTestResult(null);
  };

  const handleTestAgent = async () => {
    if (!selectedAgent) return;
    
    setTestingAgent(true);
    setTestResult(null);
    
    try {
      // Mock agent test - in a real implementation, you'd call PicaOS API
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      if (picaosApiKey && picaosApiKey.length > 10) {
        setTestResult(`✅ ${selectedAgent.name} is connected and ready to use! The agent has been initialized with your PicaOS API key and is ready to handle tasks.`);
      } else {
        setTestResult(`❌ Connection failed. Please ensure a valid PicaOS API key is configured in the Admin Dashboard.`);
      }
    } catch (error) {
      setTestResult(`❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setTestingAgent(false);
    }
  };

  if (!isOpen) return null;

  // Pro-only check
  if (!isProUser) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
        <div className="bg-white rounded-xl max-w-md w-full p-6 text-center transform animate-slideUp">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Crown size={32} className="text-yellow-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Pro Feature</h2>
          <p className="text-gray-600 mb-6">
            PicaOS Agents are available exclusively to Pro tier users. Upgrade to Pro to access advanced AI orchestration capabilities.
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-xl max-w-6xl w-full h-[90vh] flex flex-col overflow-hidden transform animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg animate-bounceIn">
                <Bot size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">PicaOS Agents</h2>
                <p className="text-orange-100">Advanced AI orchestration with multi-agent workflows</p>
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

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Loader2 size={48} className="text-orange-500 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Loading PicaOS agents...</p>
              </div>
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center p-6">
              <div className="text-center max-w-md">
                <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">Connection Error</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <button
                  onClick={loadAgents}
                  className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 mx-auto"
                >
                  <RefreshCw size={16} />
                  <span>Retry</span>
                </button>
              </div>
            </div>
          ) : !picaosApiKey ? (
            <div className="h-full flex items-center justify-center p-6">
              <div className="text-center max-w-md">
                <Settings size={48} className="text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-900 mb-2">PicaOS API Key Required</h3>
                <p className="text-gray-600 mb-4">
                  To use PicaOS agents, an administrator needs to add a PicaOS API key in the Admin Dashboard.
                </p>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-left">
                  <p className="text-sm text-orange-700">
                    <strong>For Administrators:</strong> Go to Admin Dashboard → Global API Keys → Add a new key with provider "PicaOS".
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col md:flex-row">
              {/* Agents List */}
              <div className="w-full md:w-1/3 border-r border-gray-200 overflow-y-auto p-4">
                <div className="mb-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Available Agents</h3>
                  <p className="text-sm text-gray-500">
                    Select an agent to view details and test its capabilities
                  </p>
                </div>
                
                <div className="space-y-3">
                  {agents.map(agent => (
                    <div
                      key={agent.id}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                        selectedAgent?.id === agent.id
                          ? 'border-orange-300 bg-orange-50'
                          : 'border-gray-200 hover:border-orange-200'
                      }`}
                      onClick={() => handleSelectAgent(agent)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                          {agent.icon}
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{agent.name}</h4>
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              agent.status === 'available'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {agent.status === 'available' ? 'Available' : 'Unavailable'}
                            </span>
                            <span className="text-xs text-gray-500">Pro Only</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Agent Details */}
              <div className="flex-1 overflow-y-auto p-6">
                {selectedAgent ? (
                  <div className="space-y-6">
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-orange-100 rounded-lg">
                        {selectedAgent.icon}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">{selectedAgent.name}</h3>
                        <p className="text-gray-600">{selectedAgent.description}</p>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Capabilities</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {selectedAgent.capabilities.map((capability, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <CheckCircle size={16} className="text-green-500" />
                            <span className="text-sm text-gray-700">{capability}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <h4 className="font-medium text-orange-800 mb-3">How It Works</h4>
                      <p className="text-sm text-orange-700 mb-3">
                        {selectedAgent.name} uses PicaOS orchestration to coordinate multiple specialized AI models that work together to accomplish complex tasks. Each model handles a specific part of the process, with results passed between models automatically.
                      </p>
                      <div className="flex items-center space-x-2 text-xs text-orange-600">
                        <Brain size={14} />
                        <ArrowRight size={14} />
                        <Zap size={14} />
                        <ArrowRight size={14} />
                        <CheckCircle size={14} />
                        <span className="ml-2">Multi-step processing with specialized models</span>
                      </div>
                    </div>
                    
                    {/* Test Connection */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-gray-900">Test Connection</h4>
                        <button
                          onClick={handleTestAgent}
                          disabled={testingAgent || selectedAgent.status !== 'available'}
                          className="flex items-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {testingAgent ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
                              <span>Testing...</span>
                            </>
                          ) : (
                            <>
                              <Zap size={16} />
                              <span>Test Agent</span>
                            </>
                          )}
                        </button>
                      </div>
                      
                      {testResult && (
                        <div className={`p-4 rounded-lg ${
                          testResult.includes('✅')
                            ? 'bg-green-50 border border-green-200'
                            : 'bg-red-50 border border-red-200'
                        }`}>
                          <p className="text-sm">{testResult}</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Usage Examples */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3">Example Use Cases</h4>
                      <div className="space-y-2">
                        {selectedAgent.id === 'research-agent' && (
                          <>
                            <div className="p-3 bg-gray-50 rounded-lg text-sm">
                              "Research the latest advancements in quantum computing and provide a comprehensive report with verified sources"
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg text-sm">
                              "Compare and contrast three different approaches to renewable energy storage with pros and cons of each"
                            </div>
                          </>
                        )}
                        
                        {selectedAgent.id === 'content-agent' && (
                          <>
                            <div className="p-3 bg-gray-50 rounded-lg text-sm">
                              "Create a detailed blog post about sustainable gardening practices with SEO optimization for beginners"
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg text-sm">
                              "Write a technical white paper on blockchain security measures with multiple drafts and self-critique"
                            </div>
                          </>
                        )}
                        
                        {selectedAgent.id === 'data-agent' && (
                          <>
                            <div className="p-3 bg-gray-50 rounded-lg text-sm">
                              "Analyze this customer feedback dataset and identify key trends and actionable insights"
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg text-sm">
                              "Process this sales data to identify seasonal patterns and recommend inventory optimization strategies"
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center max-w-md">
                      <Bot size={48} className="text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Select an Agent</h3>
                      <p className="text-gray-500">
                        Choose an agent from the list to view details and test its capabilities
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
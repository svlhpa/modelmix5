import React, { useState, useEffect } from 'react';
import { X, Key, Save, Eye, EyeOff, ExternalLink, Settings, CheckSquare, Square, Search, Loader2, Zap, Crown, DollarSign } from 'lucide-react';
import { APISettings, ModelSettings } from '../types';
import { openRouterService, OpenRouterModel } from '../services/openRouterService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: APISettings, modelSettings: ModelSettings) => void;
  currentSettings: APISettings;
  currentModelSettings: ModelSettings;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentSettings,
  currentModelSettings
}) => {
  const [settings, setSettings] = useState<APISettings>(currentSettings);
  const [modelSettings, setModelSettings] = useState<ModelSettings>(currentModelSettings);
  const [showKeys, setShowKeys] = useState({
    openai: false,
    openrouter: false,
    gemini: false,
    deepseek: false
  });
  const [activeTab, setActiveTab] = useState<'api' | 'models'>('api');
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  useEffect(() => {
    setSettings(currentSettings);
    setModelSettings(currentModelSettings);
  }, [currentSettings, currentModelSettings]);

  useEffect(() => {
    if (isOpen && activeTab === 'models') {
      loadOpenRouterModels();
    }
  }, [isOpen, activeTab]);

  const loadOpenRouterModels = async () => {
    setLoadingModels(true);
    try {
      const models = await openRouterService.getAvailableModels();
      setOpenRouterModels(models);
    } catch (error) {
      console.error('Failed to load OpenRouter models:', error);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSave = () => {
    onSave(settings, modelSettings);
    onClose();
  };

  const toggleShowKey = (provider: keyof APISettings) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const toggleTraditionalModel = (model: 'openai' | 'gemini' | 'deepseek') => {
    setModelSettings(prev => ({ ...prev, [model]: !prev[model] }));
  };

  const toggleOpenRouterModel = (modelId: string) => {
    setModelSettings(prev => ({
      ...prev,
      openrouter_models: {
        ...prev.openrouter_models,
        [modelId]: !prev.openrouter_models[modelId]
      }
    }));
  };

  const apiProviders = [
    {
      key: 'openai' as keyof APISettings,
      name: 'OpenAI',
      placeholder: 'sk-...',
      description: 'GPT-4o model with vision support',
      docsUrl: 'https://platform.openai.com/api-keys',
      category: 'Primary Models'
    },
    {
      key: 'openrouter' as keyof APISettings,
      name: 'OpenRouter',
      placeholder: 'sk-or-...',
      description: 'Access to 400+ AI models including Claude, Llama, and free models',
      docsUrl: 'https://openrouter.ai/keys',
      category: 'Primary Models'
    },
    {
      key: 'gemini' as keyof APISettings,
      name: 'Google Gemini',
      placeholder: 'AI...',
      description: 'Gemini 1.5 Pro model with multimodal capabilities',
      docsUrl: 'https://makersuite.google.com/app/apikey',
      category: 'Primary Models'
    },
    {
      key: 'deepseek' as keyof APISettings,
      name: 'DeepSeek',
      placeholder: 'sk-...',
      description: 'DeepSeek Chat model for reasoning tasks',
      docsUrl: 'https://platform.deepseek.com/api_keys',
      category: 'Primary Models'
    }
  ];

  const traditionalModels = [
    { key: 'openai' as keyof ModelSettings, name: 'OpenAI GPT-4o', icon: '🤖', description: 'Latest GPT model with vision support' },
    { key: 'gemini' as keyof ModelSettings, name: 'Google Gemini 1.5 Pro', icon: '💎', description: 'Google\'s multimodal AI model' },
    { key: 'deepseek' as keyof ModelSettings, name: 'DeepSeek Chat', icon: '🔍', description: 'Advanced reasoning model' }
  ];

  // Filter and categorize OpenRouter models
  const filteredModels = openRouterModels.filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         model.id.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const modelCategories = openRouterService.getModelCategories(filteredModels);
  const categories = ['All', ...Object.keys(modelCategories)];

  const getDisplayedModels = () => {
    if (selectedCategory === 'All') {
      return filteredModels;
    }
    return modelCategories[selectedCategory] || [];
  };

  const getEnabledTraditionalCount = () => {
    return traditionalModels.filter(model => modelSettings[model.key]).length;
  };

  const getEnabledOpenRouterCount = () => {
    return Object.values(modelSettings.openrouter_models).filter(Boolean).length;
  };

  const getTotalEnabledCount = () => {
    return getEnabledTraditionalCount() + getEnabledOpenRouterCount();
  };

  const getModelIcon = (model: OpenRouterModel) => {
    const modelId = model.id.toLowerCase();
    const modelName = model.name.toLowerCase();
    
    if (modelId.includes('claude') || modelId.includes('anthropic')) return '🔮';
    if (modelId.includes('gpt') || modelId.includes('openai')) return '🤖';
    if (modelId.includes('gemini') || modelId.includes('google')) return '💎';
    if (modelId.includes('llama') || modelId.includes('meta')) return '🦙';
    if (modelId.includes('deepseek')) return '🔍';
    if (modelId.includes('mistral')) return '⚡';
    if (modelId.includes('qwen')) return '🌟';
    if (modelId.includes('gemma')) return '🔷';
    return '🤖';
  };

  const isFreeModel = (model: OpenRouterModel) => {
    return model.pricing.prompt === "0";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-6xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Key size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">AI Model Settings</h2>
              <p className="text-sm text-gray-500">Configure API keys and select models for comparison</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('api')}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md transition-colors ${
              activeTab === 'api' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Key size={16} />
            <span>API Keys</span>
          </button>
          <button
            onClick={() => setActiveTab('models')}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md transition-colors ${
              activeTab === 'models' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Settings size={16} />
            <span>Model Selection ({getTotalEnabledCount()} selected)</span>
          </button>
        </div>

        {activeTab === 'api' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {apiProviders.map((provider) => (
                <div key={provider.key} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">{provider.name}</h4>
                      <p className="text-sm text-gray-500">{provider.description}</p>
                    </div>
                    <a
                      href={provider.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm"
                    >
                      <span>Get Key</span>
                      <ExternalLink size={14} />
                    </a>
                  </div>
                  
                  <div className="relative">
                    <input
                      type={showKeys[provider.key] ? 'text' : 'password'}
                      value={settings[provider.key]}
                      onChange={(e) => setSettings({ ...settings, [provider.key]: e.target.value })}
                      placeholder={provider.placeholder}
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowKey(provider.key)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showKeys[provider.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <div className="w-5 h-5 rounded-full bg-green-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">💡</span>
                </div>
                <div>
                  <h4 className="font-medium text-green-800 mb-1">OpenRouter gives you access to 400+ AI models!</h4>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• <strong>Free models:</strong> DeepSeek R1, Llama, Gemma, Qwen, and more</li>
                    <li>• <strong>Premium models:</strong> Claude 3.5 Sonnet, GPT-4, Gemini Pro</li>
                    <li>• <strong>Specialized models:</strong> Coding, reasoning, creative writing</li>
                    <li>• Use one API key to access hundreds of different AI models</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Traditional Models */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Traditional API Models</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {traditionalModels.map((model) => {
                  const isEnabled = modelSettings[model.key];
                  const hasApiKey = settings[model.key as keyof APISettings]?.trim() !== '';
                  
                  return (
                    <div
                      key={model.key}
                      className={`border-2 rounded-lg p-4 transition-all cursor-pointer ${
                        isEnabled 
                          ? 'border-green-300 bg-green-50' 
                          : 'border-gray-200 bg-gray-50'
                      } ${!hasApiKey ? 'opacity-50' : 'hover:shadow-md'}`}
                      onClick={() => hasApiKey && toggleTraditionalModel(model.key as 'openai' | 'gemini' | 'deepseek')}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-2xl">{model.icon}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasApiKey) toggleTraditionalModel(model.key as 'openai' | 'gemini' | 'deepseek');
                            }}
                            className="p-1"
                            disabled={!hasApiKey}
                          >
                            {isEnabled ? (
                              <CheckSquare size={20} className="text-green-600" />
                            ) : (
                              <Square size={20} className="text-gray-400" />
                            )}
                          </button>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{model.name}</h4>
                          <p className="text-sm text-gray-600">{model.description}</p>
                          {!hasApiKey && (
                            <p className="text-xs text-red-600 mt-1">
                              ⚠️ API key required
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* OpenRouter Models */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  OpenRouter Models ({getEnabledOpenRouterCount()} selected)
                </h3>
                {!settings.openrouter && (
                  <p className="text-sm text-amber-600">⚠️ OpenRouter API key required</p>
                )}
              </div>

              {settings.openrouter ? (
                <>
                  {/* Search and Filter */}
                  <div className="flex flex-col sm:flex-row gap-4 mb-4">
                    <div className="relative flex-1">
                      <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search models..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {categories.map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <button
                      onClick={() => {
                        const freeModels = openRouterModels.filter(isFreeModel);
                        const newSettings = { ...modelSettings.openrouter_models };
                        freeModels.forEach(model => {
                          newSettings[model.id] = true;
                        });
                        setModelSettings(prev => ({ ...prev, openrouter_models: newSettings }));
                      }}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-1"
                    >
                      <Zap size={14} />
                      <span>Enable All Free Models</span>
                    </button>
                    <button
                      onClick={() => {
                        setModelSettings(prev => ({ ...prev, openrouter_models: {} }));
                      }}
                      className="px-3 py-1 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Clear All
                    </button>
                  </div>

                  {/* Models Grid */}
                  {loadingModels ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 size={32} className="animate-spin text-blue-600" />
                      <span className="ml-3 text-gray-600">Loading models...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                      {getDisplayedModels().map((model) => {
                        const isEnabled = modelSettings.openrouter_models[model.id] || false;
                        const isFree = isFreeModel(model);
                        
                        return (
                          <div
                            key={model.id}
                            className={`border-2 rounded-lg p-3 transition-all cursor-pointer ${
                              isEnabled 
                                ? 'border-green-300 bg-green-50' 
                                : 'border-gray-200 bg-white hover:shadow-md'
                            }`}
                            onClick={() => toggleOpenRouterModel(model.id)}
                          >
                            <div className="flex items-start space-x-3">
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">{getModelIcon(model)}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleOpenRouterModel(model.id);
                                  }}
                                  className="p-1"
                                >
                                  {isEnabled ? (
                                    <CheckSquare size={16} className="text-green-600" />
                                  ) : (
                                    <Square size={16} className="text-gray-400" />
                                  )}
                                </button>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-1">
                                  <h4 className="font-medium text-gray-900 text-sm truncate">{model.name}</h4>
                                  {isFree && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                      <Zap size={10} className="mr-1" />
                                      Free
                                    </span>
                                  )}
                                  {!isFree && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                      <Crown size={10} className="mr-1" />
                                      Premium
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-600 mb-2 line-clamp-2">{model.description}</p>
                                <div className="flex items-center justify-between text-xs text-gray-500">
                                  <span>{(model.context_length / 1000).toFixed(0)}k context</span>
                                  {!isFree && (
                                    <span className="flex items-center">
                                      <DollarSign size={10} />
                                      {parseFloat(model.pricing.prompt).toFixed(4)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-amber-700">
                    Configure your OpenRouter API key in the API Keys tab to access 400+ AI models.
                  </p>
                </div>
              )}
            </div>

            {getTotalEnabledCount() === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 text-amber-700">
                  <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">!</span>
                  </div>
                  <span className="font-medium">No models selected! Please select at least one model to enable comparisons.</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <div className="flex items-start space-x-2">
            <div className="w-5 h-5 rounded-full bg-blue-400 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-xs font-bold">🔒</span>
            </div>
            <div>
              <h4 className="font-medium text-blue-800 mb-1">Security Notice</h4>
              <p className="text-sm text-blue-700">
                API keys are stored securely in your account and never shared. 
                Keep your keys secure and don't share them with others.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Save size={16} />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
import React, { useState, useEffect } from 'react';
import { X, Key, Settings, Palette, Eye, EyeOff, Save, AlertTriangle, CheckCircle, Crown, Gift, Infinity, Globe, Volume2 } from 'lucide-react';
import { APISettings, ModelSettings } from '../types';
import { openRouterService, OpenRouterModel } from '../services/openRouterService';
import { imageRouterService, ImageModel } from '../services/imageRouterService';
import { useAuth } from '../hooks/useAuth';
import { globalApiService } from '../services/globalApiService';

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
  const { getCurrentTier } = useAuth();
  const [activeTab, setActiveTab] = useState<'api-keys' | 'text-models' | 'image-models'>('api-keys');
  const [settings, setSettings] = useState<APISettings>(currentSettings);
  const [modelSettings, setModelSettings] = useState<ModelSettings>(currentModelSettings);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModel[]>([]);
  const [imageModels, setImageModels] = useState<ImageModel[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [loading, setLoading] = useState(false);
  const [globalKeysAvailable, setGlobalKeysAvailable] = useState<Record<string, boolean>>({});

  const currentTier = getCurrentTier();
  const isProUser = currentTier === 'tier2';

  useEffect(() => {
    if (isOpen) {
      setSettings(currentSettings);
      setModelSettings(currentModelSettings);
      loadModels();
      checkGlobalKeysAvailability();
    }
  }, [isOpen, currentSettings, currentModelSettings]);

  const checkGlobalKeysAvailability = async () => {
    const providers = ['openai', 'gemini', 'deepseek', 'openrouter', 'imagerouter', 'elevenlabs', 'openai_whisper'];
    const availability: Record<string, boolean> = {};
    
    for (const provider of providers) {
      try {
        const globalKey = await globalApiService.getGlobalApiKey(provider, currentTier);
        availability[provider] = !!globalKey && globalKey !== 'PLACEHOLDER_SERPER_KEY_UPDATE_IN_ADMIN';
      } catch (error) {
        availability[provider] = false;
      }
    }
    
    setGlobalKeysAvailable(availability);
  };

  const loadModels = async () => {
    setLoading(true);
    try {
      const [orModels, imgModels] = await Promise.all([
        openRouterService.getAvailableModels(),
        imageRouterService.getAvailableModels()
      ]);
      setOpenRouterModels(orModels);
      setImageModels(imgModels);
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    onSave(settings, modelSettings);
    onClose();
  };

  const toggleShowKey = (provider: string) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const handleSettingChange = (provider: keyof APISettings, value: string) => {
    setSettings(prev => ({ ...prev, [provider]: value }));
  };

  const handleTraditionalModelToggle = (model: 'openai' | 'gemini' | 'deepseek') => {
    setModelSettings(prev => ({
      ...prev,
      [model]: !prev[model]
    }));
  };

  const handleOpenRouterModelToggle = (modelId: string) => {
    setModelSettings(prev => ({
      ...prev,
      openrouter_models: {
        ...prev.openrouter_models,
        [modelId]: !prev.openrouter_models[modelId]
      }
    }));
  };

  const handleImageModelToggle = (modelId: string) => {
    setModelSettings(prev => ({
      ...prev,
      image_models: {
        ...prev.image_models,
        [modelId]: !prev.image_models[modelId]
      }
    }));
  };

  const enableAllFreeModels = (type: 'openrouter' | 'image') => {
    if (type === 'openrouter') {
      const freeModels = openRouterModels.filter(model => openRouterService.isFreeModel(model));
      const updates: Record<string, boolean> = {};
      freeModels.forEach(model => {
        updates[model.id] = true;
      });
      setModelSettings(prev => ({
        ...prev,
        openrouter_models: { ...prev.openrouter_models, ...updates }
      }));
    } else if (type === 'image') {
      // CRITICAL: For free tier users without personal API key, only enable the 3 free models
      const hasPersonalImageKey = settings.imagerouter && settings.imagerouter.trim() !== '';
      const hasGlobalImageKey = globalKeysAvailable.imagerouter;
      
      let modelsToEnable: ImageModel[] = [];
      
      if (hasPersonalImageKey || isProUser) {
        // User has personal key or is Pro - can access all free models
        modelsToEnable = imageModels.filter(model => imageRouterService.isFreeModel(model));
      } else if (hasGlobalImageKey && !isProUser) {
        // Free tier user with global key access - only the 3 hardcoded free models
        const freeModelIds = [
          'stabilityai/sdxl-turbo:free',
          'black-forest-labs/FLUX-1-schnell:free', 
          'test/test'
        ];
        modelsToEnable = imageModels.filter(model => freeModelIds.includes(model.id));
      }
      
      const updates: Record<string, boolean> = {};
      modelsToEnable.forEach(model => {
        updates[model.id] = true;
      });
      setModelSettings(prev => ({
        ...prev,
        image_models: { ...prev.image_models, ...updates }
      }));
    }
  };

  const clearAllModels = (type: 'openrouter' | 'image') => {
    if (type === 'openrouter') {
      setModelSettings(prev => ({
        ...prev,
        openrouter_models: {}
      }));
    } else if (type === 'image') {
      setModelSettings(prev => ({
        ...prev,
        image_models: {}
      }));
    }
  };

  // CRITICAL: Filter image models based on user tier and API key availability
  const getAvailableImageModels = () => {
    const hasPersonalImageKey = settings.imagerouter && settings.imagerouter.trim() !== '';
    const hasGlobalImageKey = globalKeysAvailable.imagerouter;
    
    if (hasPersonalImageKey || isProUser) {
      // User has personal key or is Pro - can access all models
      return imageModels;
    } else if (hasGlobalImageKey && !isProUser) {
      // Free tier user with global key access - only the 3 hardcoded free models
      const freeModelIds = [
        'stabilityai/sdxl-turbo:free',
        'black-forest-labs/FLUX-1-schnell:free', 
        'test/test'
      ];
      return imageModels.filter(model => freeModelIds.includes(model.id));
    } else {
      // No access
      return [];
    }
  };

  // CRITICAL: Filter OpenRouter models based on user tier and API key availability
  const getAvailableOpenRouterModels = () => {
    const hasPersonalOpenRouterKey = settings.openrouter && settings.openrouter.trim() !== '';
    const hasGlobalOpenRouterKey = globalKeysAvailable.openrouter;
    
    if (hasPersonalOpenRouterKey || isProUser) {
      // User has personal key or is Pro - can access all models
      return openRouterModels;
    } else if (hasGlobalOpenRouterKey && !isProUser) {
      // Free tier user with global key access - only free models
      return openRouterModels.filter(model => openRouterService.isFreeModel(model));
    } else {
      // No access
      return [];
    }
  };

  const filteredImageModels = getAvailableImageModels().filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         model.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (selectedCategory === 'All') return matchesSearch;
    
    const categories = imageRouterService.getModelCategories(getAvailableImageModels());
    return categories[selectedCategory]?.some(m => m.id === model.id) && matchesSearch;
  });

  const filteredOpenRouterModels = getAvailableOpenRouterModels().filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         model.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (selectedCategory === 'All') return matchesSearch;
    
    const categories = openRouterService.getModelCategories(getAvailableOpenRouterModels());
    return categories[selectedCategory]?.some(m => m.id === model.id) && matchesSearch;
  });

  const getSelectedCount = (type: 'text' | 'openrouter' | 'image') => {
    if (type === 'text') {
      return [modelSettings.openai, modelSettings.gemini, modelSettings.deepseek].filter(Boolean).length;
    } else if (type === 'openrouter') {
      return Object.values(modelSettings.openrouter_models).filter(Boolean).length;
    } else if (type === 'image') {
      return Object.values(modelSettings.image_models).filter(Boolean).length;
    }
    return 0;
  };

  const getProviderStatus = (provider: keyof APISettings) => {
    const hasPersonalKey = settings[provider] && settings[provider].trim() !== '';
    const hasGlobalKey = globalKeysAvailable[provider];
    
    if (hasPersonalKey) {
      return { status: 'personal', icon: Key, color: 'text-blue-600', bg: 'bg-blue-50' };
    } else if (hasGlobalKey) {
      return { status: 'global', icon: Gift, color: 'text-green-600', bg: 'bg-green-50' };
    } else {
      return { status: 'none', icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' };
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-xl max-w-6xl w-full p-6 max-h-[90vh] overflow-y-auto transform animate-slideUp">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg animate-bounceIn">
              <Settings size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">AI Model Settings</h2>
              <p className="text-sm text-gray-500">Configure API keys and select models for comparison</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-all duration-200 hover:scale-110"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
          {[
            { id: 'api-keys', label: 'API Keys', icon: Key },
            { id: 'text-models', label: `Text Models (${getSelectedCount('text') + getSelectedCount('openrouter')} selected)`, icon: Settings },
            { id: 'image-models', label: `Image Models (${getSelectedCount('image')} selected)`, icon: Palette }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                activeTab === tab.id 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon size={16} />
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* API Keys Tab */}
        {activeTab === 'api-keys' && (
          <div className="space-y-6 animate-fadeInUp">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="p-1 bg-blue-100 rounded-lg flex-shrink-0">
                  <CheckCircle className="text-blue-600" size={16} />
                </div>
                <div>
                  <h4 className="font-medium text-blue-800 mb-1">API Key Priority</h4>
                  <p className="text-sm text-blue-700">
                    Personal API keys take priority over global keys. {isProUser ? 'As a Pro user, you have access to global keys as backup.' : 'Free trial users can access select models through global keys when available.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { key: 'openai' as const, name: 'OpenAI', placeholder: 'sk-...', description: 'For GPT-4o and DALL-E models' },
                { key: 'openrouter' as const, name: 'OpenRouter', placeholder: 'sk-or-...', description: 'Access to 400+ AI models' },
                { key: 'gemini' as const, name: 'Google Gemini', placeholder: 'AI...', description: 'For Gemini Pro models' },
                { key: 'deepseek' as const, name: 'DeepSeek', placeholder: 'sk-...', description: 'For DeepSeek Chat models' },
                { key: 'serper' as const, name: 'Serper (Internet Search)', placeholder: 'your-serper-key', description: 'For real-time web search' },
                { key: 'imagerouter' as const, name: 'Imagerouter (Image Generation)', placeholder: 'ir-...', description: 'For AI image generation models' },
                { key: 'elevenlabs' as const, name: 'Eleven Labs (Text-to-Speech)', placeholder: 'your-elevenlabs-key', description: 'For AI voice generation' },
                { key: 'openai_whisper' as const, name: 'OpenAI Whisper (Speech-to-Text)', placeholder: 'sk-...', description: 'For voice input transcription' }
              ].map((provider, index) => {
                const status = getProviderStatus(provider.key);
                return (
                  <div 
                    key={provider.key} 
                    className="space-y-3 animate-fadeInUp"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700">
                        {provider.name}
                      </label>
                      <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${status.bg}`}>
                        <status.icon size={12} className={status.color} />
                        <span className={status.color}>
                          {status.status === 'personal' ? 'Personal Key' : 
                           status.status === 'global' ? 'Global Available' : 'Not Available'}
                        </span>
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type={showKeys[provider.key] ? 'text' : 'password'}
                        value={settings[provider.key]}
                        onChange={(e) => handleSettingChange(provider.key, e.target.value)}
                        placeholder={provider.placeholder}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey(provider.key)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showKeys[provider.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">{provider.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Text Models Tab */}
        {activeTab === 'text-models' && (
          <div className="space-y-6 animate-fadeInUp">
            {/* Traditional Models */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Traditional Models</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { key: 'openai' as const, name: 'OpenAI GPT-4o', description: 'Advanced reasoning and multimodal capabilities', icon: '🤖' },
                  { key: 'gemini' as const, name: 'Google Gemini 1.5 Pro', description: 'Large context window and strong performance', icon: '💎' },
                  { key: 'deepseek' as const, name: 'DeepSeek Chat', description: 'Efficient and capable reasoning model', icon: '🔍' }
                ].map((model, index) => {
                  const status = getProviderStatus(model.key);
                  const isEnabled = modelSettings[model.key];
                  const canUse = status.status !== 'none';
                  
                  return (
                    <div
                      key={model.key}
                      className={`p-4 border-2 rounded-lg transition-all duration-200 hover:shadow-md animate-fadeInUp ${
                        isEnabled && canUse
                          ? 'border-blue-300 bg-blue-50'
                          : canUse
                            ? 'border-gray-200 bg-white hover:border-gray-300'
                            : 'border-gray-200 bg-gray-50 opacity-60'
                      }`}
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-xl">{model.icon}</span>
                          <div>
                            <h4 className="font-medium text-gray-900">{model.name}</h4>
                            <div className={`flex items-center space-x-1 mt-1 px-2 py-1 rounded-full text-xs ${status.bg}`}>
                              <status.icon size={10} className={status.color} />
                              <span className={status.color}>
                                {status.status === 'personal' ? 'Personal Key' : 
                                 status.status === 'global' ? 'Free Trial' : 'No Access'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => handleTraditionalModelToggle(model.key)}
                            disabled={!canUse}
                            className="sr-only"
                          />
                          <div className={`w-11 h-6 rounded-full transition-colors ${
                            isEnabled && canUse ? 'bg-blue-600' : 'bg-gray-300'
                          } ${!canUse ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                              isEnabled && canUse ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                          </div>
                        </label>
                      </div>
                      <p className="text-sm text-gray-600">{model.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* OpenRouter Models */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  OpenRouter Models ({Object.values(modelSettings.openrouter_models).filter(Boolean).length} selected)
                </h3>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => enableAllFreeModels('openrouter')}
                    className="flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                  >
                    <CheckCircle size={14} />
                    <span>Enable All Free Models</span>
                  </button>
                  <button
                    onClick={() => clearAllModels('openrouter')}
                    className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {getAvailableOpenRouterModels().length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <Key size={48} className="text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">OpenRouter Access Required</h3>
                  <p className="text-gray-500 mb-4">
                    {!isProUser 
                      ? 'Add your OpenRouter API key or upgrade to Pro for global key access'
                      : 'Add your OpenRouter API key to access 400+ AI models'
                    }
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex space-x-4 mb-4">
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Search models..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="All">All</option>
                      {Object.keys(openRouterService.getModelCategories(getAvailableOpenRouterModels())).map(category => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                    {filteredOpenRouterModels.map((model, index) => {
                      const isSelected = modelSettings.openrouter_models[model.id];
                      const isFree = openRouterService.isFreeModel(model);
                      
                      return (
                        <div
                          key={model.id}
                          className={`p-3 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md animate-fadeInUp ${
                            isSelected
                              ? 'border-purple-300 bg-purple-50'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                          style={{ animationDelay: `${index * 0.05}s` }}
                          onClick={() => handleOpenRouterModelToggle(model.id)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-gray-900 text-sm truncate">{model.name}</h4>
                              <div className="flex items-center space-x-2 mt-1">
                                {isFree && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    Free
                                  </span>
                                )}
                                <span className="text-xs text-gray-500">
                                  {model.context_length.toLocaleString()} tokens
                                </span>
                              </div>
                            </div>
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              isSelected ? 'border-purple-500 bg-purple-500' : 'border-gray-300'
                            }`}>
                              {isSelected && <CheckCircle size={12} className="text-white" />}
                            </div>
                          </div>
                          {model.description && (
                            <p className="text-xs text-gray-600 line-clamp-2">{model.description}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Image Models Tab */}
        {activeTab === 'image-models' && (
          <div className="space-y-6 animate-fadeInUp">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                Image Generation Models ({Object.values(modelSettings.image_models).filter(Boolean).length} selected)
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => enableAllFreeModels('image')}
                  className="flex items-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                >
                  <CheckCircle size={14} />
                  <span>Enable All Free Models</span>
                </button>
                <button
                  onClick={() => clearAllModels('image')}
                  className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Access Status */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="p-1 bg-amber-100 rounded-lg flex-shrink-0">
                  <AlertTriangle className="text-amber-600" size={16} />
                </div>
                <div>
                  <h4 className="font-medium text-amber-800 mb-1">Imagerouter API key required for image generation</h4>
                  <p className="text-sm text-amber-700">
                    {!settings.imagerouter && !globalKeysAvailable.imagerouter ? (
                      'Add your API key in the API Keys tab to enable AI image generation. Once configured, you can ask the AI to "generate an image of..." or "draw...".'
                    ) : !settings.imagerouter && globalKeysAvailable.imagerouter && !isProUser ? (
                      'You have access to free image models through global keys. Upgrade to Pro or add your own API key for access to all models.'
                    ) : !settings.imagerouter && globalKeysAvailable.imagerouter && isProUser ? (
                      'You have Pro access to all image models through global keys. Add your own API key for priority access.'
                    ) : (
                      'Image generation enabled! You can ask the AI to "generate an image of..." or "draw..." to create AI images.'
                    )}
                  </p>
                </div>
              </div>
            </div>

            {getAvailableImageModels().length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <Palette size={48} className="text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Image Generation Access Required</h3>
                <p className="text-gray-500 mb-4">
                  {!isProUser 
                    ? 'Add your Imagerouter API key or upgrade to Pro for global key access'
                    : 'Add your Imagerouter API key to access all image generation models'
                  }
                </p>
              </div>
            ) : (
              <>
                <div className="flex space-x-4 mb-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Search image models..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="All">All</option>
                    {Object.keys(imageRouterService.getModelCategories(getAvailableImageModels())).map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                  {filteredImageModels.map((model, index) => {
                    const isSelected = modelSettings.image_models[model.id];
                    const isFree = imageRouterService.isFreeModel(model);
                    const modelIcon = imageRouterService.getModelIcon(model);
                    
                    return (
                      <div
                        key={model.id}
                        className={`p-3 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md animate-fadeInUp ${
                          isSelected
                            ? 'border-purple-300 bg-purple-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                        style={{ animationDelay: `${index * 0.05}s` }}
                        onClick={() => handleImageModelToggle(model.id)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-start space-x-2 flex-1 min-w-0">
                            <span className="text-lg flex-shrink-0">{modelIcon}</span>
                            <div className="min-w-0">
                              <h4 className="font-medium text-gray-900 text-sm truncate">{model.name}</h4>
                              <div className="flex items-center space-x-2 mt-1">
                                {isFree && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    Free
                                  </span>
                                )}
                                {model.arena_score && (
                                  <span className="text-xs text-gray-500">
                                    Score: {model.arena_score}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            isSelected ? 'border-purple-500 bg-purple-500' : 'border-gray-300'
                          }`}>
                            {isSelected && <CheckCircle size={12} className="text-white" />}
                          </div>
                        </div>
                        {model.description && (
                          <p className="text-xs text-gray-600 line-clamp-2">{model.description}</p>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          Released: {new Date(model.release_date).toLocaleDateString()}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* How to Use Image Generation */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-medium text-purple-800 mb-3 flex items-center space-x-2">
                    <Palette size={16} />
                    <span>How to Use Image Generation</span>
                  </h4>
                  <div className="space-y-2 text-sm text-purple-700">
                    <div className="flex items-start space-x-2">
                      <span className="font-medium text-purple-800 flex-shrink-0">1</span>
                      <span>Configure your Imagerouter API key in the API Keys tab to enable image generation</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="font-medium text-purple-800 flex-shrink-0">2</span>
                      <span>Select image models to use</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="font-medium text-purple-800 flex-shrink-0">3</span>
                      <span>Ask for images in the chat</span>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="font-medium text-purple-800 flex-shrink-0">4</span>
                      <span>Compare and select your favorite</span>
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-purple-600">
                    💡 Try asking "Generate an image of..." or "Draw..." to create AI images
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 hover:scale-105 transform"
          >
            <Save size={16} />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
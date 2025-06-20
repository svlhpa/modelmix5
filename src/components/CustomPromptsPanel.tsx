import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Check, X, BookOpen, Zap, Search, Filter, ChevronDown, ChevronRight } from 'lucide-react';
import { CustomPrompt } from '../types';
import { customPromptsService } from '../services/customPromptsService';

interface CustomPromptsPanelProps {
  onPromptActivated?: (prompt: CustomPrompt | null) => void;
}

export const CustomPromptsPanel: React.FC<CustomPromptsPanelProps> = ({ onPromptActivated }) => {
  const [prompts, setPrompts] = useState<CustomPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'Custom'
  });

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      const loadedPrompts = await customPromptsService.loadCustomPrompts();
      setPrompts(loadedPrompts);
      
      // Auto-expand categories that have active prompts
      const newExpanded: Record<string, boolean> = {};
      const categories = customPromptsService.getPromptsByCategory(loadedPrompts);
      Object.entries(categories).forEach(([category, categoryPrompts]) => {
        newExpanded[category] = categoryPrompts.some(p => p.isActive);
      });
      setExpandedCategories(newExpanded);
    } catch (error) {
      console.error('Failed to load custom prompts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePrompt = async () => {
    if (!formData.title.trim() || !formData.content.trim()) return;

    try {
      await customPromptsService.createPrompt(
        formData.title.trim(),
        formData.content.trim(),
        formData.category
      );
      
      setFormData({ title: '', content: '', category: 'Custom' });
      setShowCreateForm(false);
      await loadPrompts();
    } catch (error) {
      console.error('Failed to create prompt:', error);
    }
  };

  const handleUpdatePrompt = async (id: string) => {
    if (!formData.title.trim() || !formData.content.trim()) return;

    try {
      await customPromptsService.updatePrompt(id, {
        title: formData.title.trim(),
        content: formData.content.trim(),
        category: formData.category
      });
      
      setEditingPrompt(null);
      setFormData({ title: '', content: '', category: 'Custom' });
      await loadPrompts();
    } catch (error) {
      console.error('Failed to update prompt:', error);
    }
  };

  const handleDeletePrompt = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return;

    try {
      await customPromptsService.deletePrompt(id);
      await loadPrompts();
    } catch (error) {
      console.error('Failed to delete prompt:', error);
    }
  };

  const handleActivatePrompt = async (prompt: CustomPrompt) => {
    try {
      const isCurrentlyActive = prompt.isActive;
      const newActiveId = isCurrentlyActive ? null : prompt.id;
      
      await customPromptsService.setActivePrompt(newActiveId);
      await loadPrompts();
      
      // Notify parent component
      if (onPromptActivated) {
        onPromptActivated(isCurrentlyActive ? null : prompt);
      }
    } catch (error) {
      console.error('Failed to activate prompt:', error);
    }
  };

  const startEditing = (prompt: CustomPrompt) => {
    setEditingPrompt(prompt.id);
    setFormData({
      title: prompt.title,
      content: prompt.content,
      category: prompt.category
    });
  };

  const cancelEditing = () => {
    setEditingPrompt(null);
    setFormData({ title: '', content: '', category: 'Custom' });
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Filter prompts based on search and category
  const filteredPrompts = prompts.filter(prompt => {
    const matchesSearch = prompt.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         prompt.content.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || prompt.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categorizedPrompts = customPromptsService.getPromptsByCategory(filteredPrompts);
  const categories = ['All', ...customPromptsService.getCategories(prompts)];
  const activePrompt = customPromptsService.getActivePrompt(prompts);

  if (loading) {
    return (
      <div className="p-3 text-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-emerald-500 rounded-full animate-spin mx-auto mb-2"></div>
        <p className="text-xs text-gray-500">Loading prompts...</p>
      </div>
    );
  }

  return (
    <div className="border-b border-gray-700 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-2">
        <div className="flex items-center space-x-2">
          <BookOpen size={16} className="text-emerald-400" />
          <span className="text-sm font-medium text-white">Custom Prompts</span>
          {activePrompt && (
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
          )}
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="p-1 rounded hover:bg-gray-700 transition-colors"
          title="Create new prompt"
        >
          <Plus size={14} className="text-gray-400 hover:text-white" />
        </button>
      </div>

      {/* Active Prompt Indicator */}
      {activePrompt && (
        <div className="mb-3 px-2">
          <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-lg p-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 min-w-0">
                <Zap size={12} className="text-emerald-400 flex-shrink-0" />
                <span className="text-xs font-medium text-emerald-300 truncate">
                  {activePrompt.title}
                </span>
              </div>
              <button
                onClick={() => handleActivatePrompt(activePrompt)}
                className="text-xs text-emerald-400 hover:text-emerald-300 flex-shrink-0"
                title="Deactivate prompt"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      {prompts.length > 0 && (
        <div className="mb-3 px-2 space-y-2">
          <div className="relative">
            <Search size={14} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search prompts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          
          {categories.length > 2 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-2 py-1.5 bg-gray-800 border border-gray-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="mb-3 px-2">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 space-y-2">
            <input
              type="text"
              placeholder="Prompt title..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <textarea
              placeholder="Prompt content..."
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={3}
              className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
            />
            <input
              type="text"
              placeholder="Category (e.g., Writing, Programming)"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-2 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-2 py-1 text-xs text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePrompt}
                disabled={!formData.title.trim() || !formData.content.trim()}
                className="px-2 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompts List */}
      <div className="max-h-64 overflow-y-auto">
        {Object.keys(categorizedPrompts).length === 0 ? (
          <div className="text-center py-4 px-2">
            {prompts.length === 0 && !searchTerm ? (
              <>
                <BookOpen size={24} className="text-gray-500 mx-auto mb-2" />
                <p className="text-xs text-gray-500 mb-2">No custom prompts yet</p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="text-xs text-emerald-400 hover:text-emerald-300 px-2 py-1 border border-emerald-800 rounded-lg hover:bg-emerald-900/30 transition-colors"
                >
                  Create your first prompt
                </button>
              </>
            ) : (
              <>
                <BookOpen size={24} className="text-gray-500 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No prompts found</p>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="text-xs text-emerald-400 hover:text-emerald-300 mt-1"
                  >
                    Clear search
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          Object.entries(categorizedPrompts).map(([category, categoryPrompts]) => (
            <div key={category} className="mb-2">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-2 py-1 text-xs font-medium text-gray-300 hover:text-white transition-colors"
              >
                <span>{category} ({categoryPrompts.length})</span>
                {expandedCategories[category] ? (
                  <ChevronDown size={12} />
                ) : (
                  <ChevronRight size={12} />
                )}
              </button>

              {/* Category Prompts */}
              {expandedCategories[category] && (
                <div className="space-y-1 ml-2">
                  {categoryPrompts.map((prompt) => (
                    <div
                      key={prompt.id}
                      className={`group p-2 rounded-lg transition-all ${
                        prompt.isActive
                          ? 'bg-emerald-900/30 border border-emerald-700/50'
                          : 'hover:bg-gray-800 border border-transparent'
                      }`}
                    >
                      {editingPrompt === prompt.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                          <textarea
                            value={formData.content}
                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                            rows={2}
                            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                          />
                          <input
                            type="text"
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                          <div className="flex justify-end space-x-1">
                            <button
                              onClick={cancelEditing}
                              className="p-1 text-gray-400 hover:text-white transition-colors"
                            >
                              <X size={12} />
                            </button>
                            <button
                              onClick={() => handleUpdatePrompt(prompt.id)}
                              className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors"
                            >
                              <Check size={12} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between">
                            <div 
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => handleActivatePrompt(prompt)}
                            >
                              <div className="flex items-center space-x-2 mb-1">
                                <h4 className="text-xs font-medium text-white truncate">
                                  {prompt.title}
                                </h4>
                                {prompt.isActive && (
                                  <Zap size={10} className="text-emerald-400 flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                                {prompt.content}
                              </p>
                            </div>
                            
                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditing(prompt);
                                }}
                                className="p-1 text-gray-400 hover:text-white transition-colors"
                                title="Edit prompt"
                              >
                                <Edit3 size={10} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePrompt(prompt.id);
                                }}
                                className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                                title="Delete prompt"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Help Text */}
      <div className="mt-3 px-2">
        <p className="text-xs text-gray-500 leading-relaxed">
          💡 Click a prompt to activate it for your current chat. Active prompts guide AI responses.
        </p>
      </div>
    </div>
  );
};
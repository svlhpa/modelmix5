import React, { useState, useEffect } from 'react';
import { X, Shield, Users, BarChart3, Settings, Key, Eye, EyeOff, Save, Plus, Trash2, ToggleLeft, ToggleRight, RefreshCw, Crown, Activity, TrendingUp, Globe, Image, Video, Youtube, ExternalLink, CheckCircle, Cpu } from 'lucide-react';
import { adminService } from '../services/adminService';
import { globalApiService } from '../services/globalApiService';
import { adminSettingsService } from '../services/adminSettingsService';
import { UserTier } from '../types';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'user' | 'superadmin';
  current_tier: UserTier;
  monthly_conversations: number;
  last_reset_date: string;
  created_at: string;
  updated_at: string;
}

interface GlobalApiKey {
  id: string;
  provider: string;
  api_key: string;
  tier_access: string[];
  is_active: boolean;
  usage_limit: number | null;
  current_usage: number;
  last_reset_date: string;
  created_at: string;
  updated_at: string;
}

interface UserStats {
  totalUsers: number;
  totalSessions: number;
  totalConversations: number;
  activeUsersLast30Days: number;
  tier1Users: number;
  tier2Users: number;
}

interface GlobalProviderStats {
  provider: string;
  total_responses: number;
  total_selections: number;
  selection_rate: number;
  error_rate: number;
  unique_users: number;
  last_used: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'global-keys' | 'analytics' | 'settings'>('overview');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [globalKeys, setGlobalKeys] = useState<GlobalApiKey[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [providerStats, setProviderStats] = useState<GlobalProviderStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [newKeyForm, setNewKeyForm] = useState({
    provider: '',
    api_key: '',
    tier_access: ['tier1', 'tier2'] as string[],
    usage_limit: null as number | null
  });
  const [showNewKeyForm, setShowNewKeyForm] = useState(false);

  // Admin Settings State
  const [getStartedVideoUrl, setGetStartedVideoUrl] = useState('');
  const [picaosApiKey, setPicaosApiKey] = useState('');
  const [videoStats, setVideoStats] = useState({
    totalUsers: 0,
    usersWhoWatchedCurrent: 0,
    usersWhoHaventWatched: 0,
    currentVideoUrl: ''
  });
  const [savingVideo, setSavingVideo] = useState(false);
  const [videoSaved, setVideoSaved] = useState(false);
  const [savingPicaosKey, setSavingPicaosKey] = useState(false);
  const [picaosKeySaved, setPicaosKeySaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const usersData = await adminService.getAllUsers();
        setUsers(usersData);
      } else if (activeTab === 'global-keys') {
        const keysData = await globalApiService.getAllGlobalApiKeys();
        setGlobalKeys(keysData);
      } else if (activeTab === 'overview') {
        const statsData = await adminService.getSystemStats();
        setStats(statsData);
      } else if (activeTab === 'analytics') {
        const analyticsData = await adminService.getGlobalProviderStats();
        setProviderStats(analyticsData);
      } else if (activeTab === 'settings') {
        await loadAdminSettings();
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAdminSettings = async () => {
    try {
      const [videoUrl, stats, picaosKey] = await Promise.all([
        adminSettingsService.getGetStartedVideoUrl(),
        adminSettingsService.getVideoViewStats(),
        adminSettingsService.getPicaosApiKey()
      ]);
      
      setGetStartedVideoUrl(videoUrl);
      setVideoStats(stats);
      setPicaosApiKey(picaosKey || '');
    } catch (error) {
      console.error('Failed to load admin settings:', error);
    }
  };

  const handleUpdateUserRole = async (userId: string, role: 'user' | 'superadmin') => {
    try {
      await adminService.updateUserRole(userId, role);
      await loadData();
    } catch (error) {
      console.error('Failed to update user role:', error);
    }
  };

  const handleUpdateUserTier = async (userId: string, tier: UserTier) => {
    try {
      await adminService.updateUserTier(userId, tier);
      await loadData();
    } catch (error) {
      console.error('Failed to update user tier:', error);
    }
  };

  const handleResetUserUsage = async (userId: string) => {
    try {
      await adminService.resetUserUsage(userId);
      await loadData();
    } catch (error) {
      console.error('Failed to reset user usage:', error);
    }
  };

  const handleCreateGlobalKey = async () => {
    try {
      await globalApiService.createGlobalApiKey({
        provider: newKeyForm.provider,
        api_key: newKeyForm.api_key,
        tier_access: newKeyForm.tier_access,
        is_active: true,
        usage_limit: newKeyForm.usage_limit
      });
      setNewKeyForm({
        provider: '',
        api_key: '',
        tier_access: ['tier1', 'tier2'],
        usage_limit: null
      });
      setShowNewKeyForm(false);
      await loadData();
    } catch (error) {
      console.error('Failed to create global API key:', error);
    }
  };

  const handleToggleGlobalKey = async (id: string, isActive: boolean) => {
    try {
      await globalApiService.toggleGlobalApiKey(id, !isActive);
      await loadData();
    } catch (error) {
      console.error('Failed to toggle global API key:', error);
    }
  };

  const handleResetGlobalUsage = async (id: string) => {
    try {
      await globalApiService.resetGlobalUsage(id);
      await loadData();
    } catch (error) {
      console.error('Failed to reset global usage:', error);
    }
  };

  const handleDeleteGlobalKey = async (id: string) => {
    if (confirm('Are you sure you want to delete this global API key?')) {
      try {
        await globalApiService.deleteGlobalApiKey(id);
        await loadData();
      } catch (error) {
        console.error('Failed to delete global API key:', error);
      }
    }
  };

  const handleSaveVideoUrl = async () => {
    if (!getStartedVideoUrl.trim()) return;

    setSavingVideo(true);
    setVideoSaved(false);
    
    try {
      await adminSettingsService.updateGetStartedVideoUrl(getStartedVideoUrl.trim());
      await loadAdminSettings(); // Reload stats
      setVideoSaved(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => setVideoSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save video URL:', error);
    } finally {
      setSavingVideo(false);
    }
  };

  const handleSavePicaosApiKey = async () => {
    if (!picaosApiKey.trim()) return;

    setSavingPicaosKey(true);
    setPicaosKeySaved(false);
    
    try {
      await adminSettingsService.updatePicaosApiKey(picaosApiKey.trim());
      setPicaosKeySaved(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => setPicaosKeySaved(false), 3000);
    } catch (error) {
      console.error('Failed to save PicaOS API key:', error);
    } finally {
      setSavingPicaosKey(false);
    }
  };

  const toggleShowKey = (keyId: string) => {
    setShowKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const getProviderIcon = (provider: string) => {
    return globalApiService.getProviderIcon(provider);
  };

  const getProviderDisplayName = (provider: string) => {
    const names: Record<string, string> = {
      openai: 'OpenAI',
      openrouter: 'OpenRouter',
      gemini: 'Google Gemini',
      deepseek: 'DeepSeek',
      serper: 'Serper (Internet Search)',
      imagerouter: 'Imagerouter (Image Generation)',
      tavus: 'Tavus (AI Video Calls)',
      picaos: 'PicaOS (AI Orchestration)'
    };
    return names[provider] || provider;
  };

  const getTierDisplayName = (tier: string) => {
    return globalApiService.getTierDisplayName(tier);
  };

  const getUsagePercentage = (current: number, limit: number | null) => {
    return globalApiService.getUsagePercentage(current, limit);
  };

  const getUsageColor = (percentage: number) => {
    return globalApiService.getUsageColor(percentage);
  };

  const getUsageBarColor = (percentage: number) => {
    return globalApiService.getUsageBarColor(percentage);
  };

  const extractYouTubeVideoId = (url: string): string | null => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const isValidYouTubeUrl = (url: string): boolean => {
    return extractYouTubeVideoId(url) !== null;
  };

  const isValidPicaosApiKey = (key: string): boolean => {
    return /^sk_test_\d+_[A-Za-z0-9_-]{80,}$/.test(key) || 
           /^sk_live_\d+_[A-Za-z0-9_-]{80,}$/.test(key);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-7xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Shield size={20} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Admin Dashboard</h2>
              <p className="text-sm text-gray-500">Manage users, global API keys, and system settings</p>
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
            onClick={() => setActiveTab('overview')}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md transition-colors ${
              activeTab === 'overview' 
                ? 'bg-white text-red-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 size={16} />
            <span>Overview</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md transition-colors ${
              activeTab === 'users' 
                ? 'bg-white text-red-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users size={16} />
            <span>Users</span>
          </button>
          <button
            onClick={() => setActiveTab('global-keys')}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md transition-colors ${
              activeTab === 'global-keys' 
                ? 'bg-white text-red-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Key size={16} />
            <span>Global API Keys</span>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md transition-colors ${
              activeTab === 'analytics' 
                ? 'bg-white text-red-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Activity size={16} />
            <span>Analytics</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md transition-colors ${
              activeTab === 'settings' 
                ? 'bg-white text-red-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Settings size={16} />
            <span>Settings</span>
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-red-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500">Loading admin data...</p>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && stats && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-3">
                      <Users className="text-blue-600" size={24} />
                      <div>
                        <p className="text-sm text-blue-600 font-medium">Total Users</p>
                        <p className="text-2xl font-bold text-blue-900">{stats.totalUsers}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center space-x-3">
                      <BarChart3 className="text-green-600" size={24} />
                      <div>
                        <p className="text-sm text-green-600 font-medium">Total Conversations</p>
                        <p className="text-2xl font-bold text-green-900">{stats.totalConversations}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                    <div className="flex items-center space-x-3">
                      <TrendingUp className="text-purple-600" size={24} />
                      <div>
                        <p className="text-sm text-purple-600 font-medium">Active Users (30d)</p>
                        <p className="text-2xl font-bold text-purple-900">{stats.activeUsersLast30Days}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-3">User Tier Distribution</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Free Tier</span>
                        <span className="font-medium">{stats.tier1Users}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Pro Tier</span>
                        <span className="font-medium">{stats.tier2Users}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900 mb-3">System Health</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Total Sessions</span>
                        <span className="font-medium">{stats.totalSessions}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Avg Conversations/User</span>
                        <span className="font-medium">
                          {stats.totalUsers > 0 ? (stats.totalConversations / stats.totalUsers).toFixed(1) : '0'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full border border-gray-200 rounded-lg">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">User</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Role</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Tier</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Usage</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Joined</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div>
                              <div className="font-medium text-gray-900">{user.full_name || 'No name'}</div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={user.role}
                              onChange={(e) => handleUpdateUserRole(user.id, e.target.value as 'user' | 'superadmin')}
                              className="text-sm border border-gray-300 rounded px-2 py-1"
                            >
                              <option value="user">User</option>
                              <option value="superadmin">Superadmin</option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={user.current_tier}
                              onChange={(e) => handleUpdateUserTier(user.id, e.target.value as UserTier)}
                              className="text-sm border border-gray-300 rounded px-2 py-1"
                            >
                              <option value="tier1">Free</option>
                              <option value="tier2">Pro</option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm">{user.monthly_conversations}</span>
                              <button
                                onClick={() => handleResetUserUsage(user.id)}
                                className="p-1 text-gray-400 hover:text-gray-600"
                                title="Reset usage"
                              >
                                <RefreshCw size={14} />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-2">
                              {user.role === 'superadmin' && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  <Shield size={10} className="mr-1" />
                                  Admin
                                </span>
                              )}
                              {user.current_tier === 'tier2' && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                  <Crown size={10} className="mr-1" />
                                  Pro
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Global API Keys Tab */}
            {activeTab === 'global-keys' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Global API Keys</h3>
                  <button
                    onClick={() => setShowNewKeyForm(true)}
                    className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Plus size={16} />
                    <span>Add API Key</span>
                  </button>
                </div>

                {showNewKeyForm && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-4">Add New Global API Key</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
                        <select
                          value={newKeyForm.provider}
                          onChange={(e) => setNewKeyForm({ ...newKeyForm, provider: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        >
                          <option value="">Select Provider</option>
                          <option value="openai">OpenAI</option>
                          <option value="openrouter">OpenRouter</option>
                          <option value="gemini">Google Gemini</option>
                          <option value="deepseek">DeepSeek</option>
                          <option value="serper">Serper (Internet Search)</option>
                          <option value="imagerouter">Imagerouter (Image Generation)</option>
                          <option value="tavus">Tavus (AI Video Calls)</option>
                          <option value="picaos">PicaOS (AI Orchestration)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                        <input
                          type="password"
                          value={newKeyForm.api_key}
                          onChange={(e) => setNewKeyForm({ ...newKeyForm, api_key: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                          placeholder="Enter API key"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Tier Access</label>
                        <div className="space-y-2">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={newKeyForm.tier_access.includes('tier1')}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewKeyForm({ ...newKeyForm, tier_access: [...newKeyForm.tier_access, 'tier1'] });
                                } else {
                                  setNewKeyForm({ ...newKeyForm, tier_access: newKeyForm.tier_access.filter(t => t !== 'tier1') });
                                }
                              }}
                              className="mr-2"
                            />
                            <span className="text-sm">Free Tier</span>
                          </label>
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={newKeyForm.tier_access.includes('tier2')}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewKeyForm({ ...newKeyForm, tier_access: [...newKeyForm.tier_access, 'tier2'] });
                                } else {
                                  setNewKeyForm({ ...newKeyForm, tier_access: newKeyForm.tier_access.filter(t => t !== 'tier2') });
                                }
                              }}
                              className="mr-2"
                            />
                            <span className="text-sm">Pro Tier</span>
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Usage Limit (optional)</label>
                        <input
                          type="number"
                          value={newKeyForm.usage_limit || ''}
                          onChange={(e) => setNewKeyForm({ ...newKeyForm, usage_limit: e.target.value ? parseInt(e.target.value) : null })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                          placeholder="Leave empty for unlimited"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end space-x-3 mt-4">
                      <button
                        onClick={() => setShowNewKeyForm(false)}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateGlobalKey}
                        disabled={!newKeyForm.provider || !newKeyForm.api_key}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Add Key
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {globalKeys.map((key) => {
                    const usagePercentage = getUsagePercentage(key.current_usage, key.usage_limit);
                    return (
                      <div key={key.id} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            <span className="text-2xl">{getProviderIcon(key.provider)}</span>
                            <div>
                              <h4 className="font-medium text-gray-900">{getProviderDisplayName(key.provider)}</h4>
                              <div className="flex items-center space-x-2 text-sm text-gray-500">
                                <span>Access: {key.tier_access.map(getTierDisplayName).join(', ')}</span>
                                {key.provider === 'serper' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    <Globe size={10} className="mr-1" />
                                    Internet Search
                                  </span>
                                )}
                                {key.provider === 'imagerouter' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                    <Image size={10} className="mr-1" />
                                    Image Generation
                                  </span>
                                )}
                                {key.provider === 'tavus' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    <Video size={10} className="mr-1" />
                                    AI Video Calls
                                  </span>
                                )}
                                {key.provider === 'picaos' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                    <Cpu size={10} className="mr-1" />
                                    AI Orchestration
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleToggleGlobalKey(key.id, key.is_active)}
                              className={`p-2 rounded-lg transition-colors ${
                                key.is_active 
                                  ? 'text-green-600 hover:bg-green-50' 
                                  : 'text-gray-400 hover:bg-gray-50'
                              }`}
                              title={key.is_active ? 'Disable key' : 'Enable key'}
                            >
                              {key.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                            </button>
                            <button
                              onClick={() => handleResetGlobalUsage(key.id)}
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                              title="Reset usage"
                            >
                              <RefreshCw size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteGlobalKey(key.id)}
                              className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete key"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                            <div className="relative">
                              <input
                                type={showKeys[key.id] ? 'text' : 'password'}
                                value={key.api_key}
                                readOnly
                                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                              />
                              <button
                                onClick={() => toggleShowKey(key.id)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                {showKeys[key.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Usage</label>
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Current</span>
                                <span className={`font-medium ${getUsageColor(usagePercentage)}`}>
                                  {key.current_usage} / {key.usage_limit || '∞'}
                                </span>
                              </div>
                              {key.usage_limit && (
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className={`h-2 rounded-full transition-all duration-300 ${getUsageBarColor(usagePercentage)}`}
                                    style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                            <div className="space-y-1">
                              <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                key.is_active 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {key.is_active ? 'Active' : 'Inactive'}
                              </div>
                              <div className="text-xs text-gray-500">
                                Last reset: {new Date(key.last_reset_date).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {globalKeys.length === 0 && (
                  <div className="text-center py-12">
                    <Key size={48} className="text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Global API Keys</h3>
                    <p className="text-gray-500 mb-4">Add global API keys to enable free trial access for users</p>
                  </div>
                )}
              </div>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900">Global Provider Analytics</h3>
                
                {providerStats.length > 0 ? (
                  <div className="space-y-4">
                    {providerStats.map((stat, index) => (
                      <div key={stat.provider} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <span className="text-2xl">{getProviderIcon(stat.provider)}</span>
                            <div>
                              <h4 className="font-medium text-gray-900">{stat.provider}</h4>
                              <p className="text-sm text-gray-500">
                                {stat.unique_users} unique users • Last used: {new Date(stat.last_used).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-gray-900">{stat.selection_rate.toFixed(1)}%</div>
                            <div className="text-sm text-gray-500">Selection Rate</div>
                          </div>
                        </div>
                        
                        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                          <div>
                            <div className="text-lg font-semibold text-gray-900">{stat.total_responses}</div>
                            <div className="text-xs text-gray-500">Total Responses</div>
                          </div>
                          <div>
                            <div className="text-lg font-semibold text-gray-900">{stat.total_selections}</div>
                            <div className="text-xs text-gray-500">Selections</div>
                          </div>
                          <div>
                            <div className="text-lg font-semibold text-gray-900">{stat.error_rate.toFixed(1)}%</div>
                            <div className="text-xs text-gray-500">Error Rate</div>
                          </div>
                        </div>
                        
                        <div className="mt-3">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="h-2 bg-blue-500 rounded-full transition-all duration-500"
                              style={{ width: `${stat.selection_rate}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <BarChart3 size={48} className="text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Analytics Data</h3>
                    <p className="text-gray-500">Analytics will appear here once users start using the platform</p>
                  </div>
                )}
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900">Admin Settings</h3>
                
                {/* Get Started Video Settings */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <Youtube className="text-red-600" size={24} />
                    <div>
                      <h4 className="font-medium text-gray-900">Get Started Video</h4>
                      <p className="text-sm text-gray-500">YouTube video shown to new users when they first sign up</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">YouTube URL</label>
                      <div className="flex space-x-3">
                        <input
                          type="url"
                          value={getStartedVideoUrl}
                          onChange={(e) => setGetStartedVideoUrl(e.target.value)}
                          placeholder="https://youtu.be/..."
                          className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${
                            getStartedVideoUrl && !isValidYouTubeUrl(getStartedVideoUrl)
                              ? 'border-red-300 bg-red-50'
                              : 'border-gray-300'
                          }`}
                        />
                        <button
                          onClick={handleSaveVideoUrl}
                          disabled={!getStartedVideoUrl.trim() || !isValidYouTubeUrl(getStartedVideoUrl) || savingVideo}
                          className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {savingVideo ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <Save size={16} />
                              <span>Save</span>
                            </>
                          )}
                        </button>
                      </div>
                      
                      {getStartedVideoUrl && !isValidYouTubeUrl(getStartedVideoUrl) && (
                        <p className="text-sm text-red-600 mt-1">Please enter a valid YouTube URL</p>
                      )}
                      
                      {videoSaved && (
                        <div className="flex items-center space-x-2 text-green-600 mt-2 animate-fadeIn">
                          <CheckCircle size={16} />
                          <span className="text-sm">Video URL saved successfully!</span>
                        </div>
                      )}
                    </div>

                    {/* Video Preview */}
                    {getStartedVideoUrl && isValidYouTubeUrl(getStartedVideoUrl) && (
                      <div className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-medium text-gray-900">Video Preview</h5>
                          <button
                            onClick={() => window.open(getStartedVideoUrl, '_blank')}
                            className="flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700"
                          >
                            <ExternalLink size={14} />
                            <span>Open in YouTube</span>
                          </button>
                        </div>
                        <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                          <iframe
                            src={`https://www.youtube.com/embed/${extractYouTubeVideoId(getStartedVideoUrl)}?rel=0&modestbranding=1`}
                            className="w-full h-full"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            title="Get Started Video Preview"
                          />
                        </div>
                      </div>
                    )}

                    {/* Video Statistics */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h5 className="font-medium text-gray-900 mb-3">Video Statistics</h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900">{videoStats.totalUsers}</div>
                          <div className="text-sm text-gray-500">Total Users</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">{videoStats.usersWhoWatchedCurrent}</div>
                          <div className="text-sm text-gray-500">Watched Current Video</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600">{videoStats.usersWhoHaventWatched}</div>
                          <div className="text-sm text-gray-500">Haven't Watched</div>
                        </div>
                      </div>
                      
                      {videoStats.totalUsers > 0 && (
                        <div className="mt-4">
                          <div className="flex justify-between text-sm mb-1">
                            <span>Watch Rate</span>
                            <span>{((videoStats.usersWhoWatchedCurrent / videoStats.totalUsers) * 100).toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="h-2 bg-green-500 rounded-full transition-all duration-300"
                              style={{ width: `${(videoStats.usersWhoWatchedCurrent / videoStats.totalUsers) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h5 className="font-medium text-blue-800 mb-2">How it works</h5>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>• When users sign up for the first time, they'll see this video in a popup</li>
                        <li>• Once they watch it (or skip it), they won't see it again</li>
                        <li>• If you change the video URL, all users will see the new video once</li>
                        <li>• The system tracks which users have seen which videos</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* PicaOS API Key Settings */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <Cpu className="text-indigo-600" size={24} />
                    <div>
                      <h4 className="font-medium text-gray-900">PicaOS API Key</h4>
                      <p className="text-sm text-gray-500">Configure PicaOS AI orchestration for Pro users</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">PicaOS API Key</label>
                      <div className="flex space-x-3">
                        <div className="relative flex-1">
                          <input
                            type={showKeys['picaos'] ? 'text' : 'password'}
                            value={picaosApiKey}
                            onChange={(e) => setPicaosApiKey(e.target.value)}
                            placeholder="sk_test_1_..."
                            className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                              picaosApiKey && !isValidPicaosApiKey(picaosApiKey)
                                ? 'border-red-300 bg-red-50'
                                : 'border-gray-300'
                            }`}
                          />
                          <button
                            onClick={() => setShowKeys(prev => ({ ...prev, picaos: !prev.picaos }))}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showKeys['picaos'] ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        <button
                          onClick={handleSavePicaosApiKey}
                          disabled={!picaosApiKey.trim() || !isValidPicaosApiKey(picaosApiKey) || savingPicaosKey}
                          className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {savingPicaosKey ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <Save size={16} />
                              <span>Save</span>
                            </>
                          )}
                        </button>
                      </div>
                      
                      {picaosApiKey && !isValidPicaosApiKey(picaosApiKey) && (
                        <p className="text-sm text-red-600 mt-1">Please enter a valid PicaOS API key (starts with sk_test_1_ or sk_live_1_)</p>
                      )}
                      
                      {picaosKeySaved && (
                        <div className="flex items-center space-x-2 text-green-600 mt-2 animate-fadeIn">
                          <CheckCircle size={16} />
                          <span className="text-sm">PicaOS API key saved successfully!</span>
                        </div>
                      )}
                    </div>

                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                      <h5 className="font-medium text-indigo-800 mb-2">About PicaOS</h5>
                      <p className="text-sm text-indigo-700 mb-3">
                        PicaOS is an advanced AI orchestration system that intelligently coordinates multiple AI models to produce higher quality content. It's used in the Write-up Agent feature for Pro users.
                      </p>
                      <ul className="text-sm text-indigo-700 space-y-1">
                        <li>• Only Pro users can access PicaOS orchestration</li>
                        <li>• PicaOS API key is stored securely and used for all Pro users</li>
                        <li>• Enables advanced document generation with multi-model orchestration</li>
                        <li>• Provides better quality control and content coherence</li>
                      </ul>
                    </div>

                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-start space-x-2">
                        <Crown className="text-yellow-600 mt-0.5" size={16} />
                        <div>
                          <h5 className="font-medium text-yellow-800 mb-1">Pro User Feature</h5>
                          <p className="text-sm text-yellow-700">
                            PicaOS orchestration is only available to Pro tier users. Free tier users will automatically fall back to the legacy writing method.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
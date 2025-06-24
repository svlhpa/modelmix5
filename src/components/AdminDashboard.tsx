import React, { useState, useEffect } from 'react';
import { X, Users, BarChart3, Key, Settings, Shield, Crown, Trash2, RotateCcw, Plus, Eye, EyeOff, Save, AlertCircle, CheckCircle, TrendingUp, Activity, Clock, Globe, Video, Palette, Mic, Bot, Volume2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { adminService } from '../services/adminService';
import { globalApiService } from '../services/globalApiService';
import { adminSettingsService } from '../services/adminSettingsService';
import { UserTier } from '../types';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserWithSubscription {
  id: string;
  email: string;
  full_name: string | null;
  role: 'user' | 'superadmin';
  current_tier: UserTier;
  monthly_conversations: number;
  last_reset_date: string;
  created_at: string;
  updated_at: string;
  subscription?: {
    id: string;
    tier: UserTier;
    status: string;
    started_at: string;
    expires_at: string | null;
  } | null;
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

interface AdminSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose }) => {
  const { user, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'analytics' | 'global-keys' | 'settings'>('overview');
  const [users, setUsers] = useState<UserWithSubscription[]>([]);
  const [stats, setStats] = useState<UserStats>({
    totalUsers: 0,
    totalSessions: 0,
    totalConversations: 0,
    activeUsersLast30Days: 0,
    tier1Users: 0,
    tier2Users: 0,
  });
  const [globalStats, setGlobalStats] = useState<GlobalProviderStats[]>([]);
  const [globalApiKeys, setGlobalApiKeys] = useState<GlobalApiKey[]>([]);
  const [adminSettings, setAdminSettings] = useState<AdminSetting[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  
  // New API Key form
  const [showNewKeyForm, setShowNewKeyForm] = useState(false);
  const [newKeyData, setNewKeyData] = useState({
    provider: '',
    api_key: '',
    tier_access: ['tier1', 'tier2'] as string[],
    usage_limit: ''
  });

  // Settings editing
  const [editingSettings, setEditingSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && isSuperAdmin()) {
      loadData();
    }
  }, [isOpen, activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      switch (activeTab) {
        case 'overview':
          const [statsData, globalStatsData] = await Promise.all([
            adminService.getSystemStats(),
            adminService.getGlobalProviderStats()
          ]);
          setStats(statsData);
          setGlobalStats(globalStatsData);
          break;
        case 'users':
          const usersData = await adminService.getAllUsers();
          setUsers(usersData);
          break;
        case 'analytics':
          const analyticsData = await adminService.getGlobalProviderStats();
          setGlobalStats(analyticsData);
          break;
        case 'global-keys':
          const keysData = await globalApiService.getAllGlobalApiKeys();
          setGlobalApiKeys(keysData);
          break;
        case 'settings':
          const settingsData = await adminSettingsService.getAllSettings();
          setAdminSettings(settingsData);
          break;
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleUserRoleUpdate = async (userId: string, newRole: 'user' | 'superadmin') => {
    try {
      await adminService.updateUserRole(userId, newRole);
      await loadData();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update user role');
    }
  };

  const handleUserTierUpdate = async (userId: string, newTier: UserTier) => {
    try {
      await adminService.updateUserTier(userId, newTier);
      await loadData();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update user tier');
    }
  };

  const handleResetUserUsage = async (userId: string) => {
    try {
      await adminService.resetUserUsage(userId);
      await loadData();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to reset user usage');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }
    
    try {
      await adminService.deleteUser(userId);
      await loadData();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete user');
    }
  };

  const handleCreateGlobalApiKey = async () => {
    if (!newKeyData.provider || !newKeyData.api_key) {
      setError('Provider and API key are required');
      return;
    }

    try {
      await globalApiService.createGlobalApiKey({
        provider: newKeyData.provider,
        api_key: newKeyData.api_key,
        tier_access: newKeyData.tier_access,
        is_active: true,
        usage_limit: newKeyData.usage_limit ? parseInt(newKeyData.usage_limit) : null
      });
      
      setShowNewKeyForm(false);
      setNewKeyData({
        provider: '',
        api_key: '',
        tier_access: ['tier1', 'tier2'],
        usage_limit: ''
      });
      await loadData();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create API key');
    }
  };

  const handleToggleApiKey = async (id: string, isActive: boolean) => {
    try {
      await globalApiService.toggleGlobalApiKey(id, isActive);
      await loadData();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to toggle API key');
    }
  };

  const handleResetUsage = async (id: string) => {
    try {
      await globalApiService.resetGlobalUsage(id);
      await loadData();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to reset usage');
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) {
      return;
    }
    
    try {
      await globalApiService.deleteGlobalApiKey(id);
      await loadData();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete API key');
    }
  };

  const handleUpdateSetting = async (key: string, value: string) => {
    try {
      await adminSettingsService.updateSetting(key, value);
      setEditingSettings(prev => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
      await loadData();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update setting');
    }
  };

  const getProviderIcon = (provider: string) => {
    const icons: Record<string, React.ReactNode> = {
      openai: <Bot size={16} className="text-green-600" />,
      openrouter: <RotateCcw size={16} className="text-purple-600" />,
      gemini: <Palette size={16} className="text-blue-600" />,
      deepseek: <Activity size={16} className="text-orange-600" />,
      serper: <Globe size={16} className="text-teal-600" />,
      imagerouter: <Palette size={16} className="text-pink-600" />,
      tavus: <Video size={16} className="text-red-600" />,
      picaos: <Bot size={16} className="text-indigo-600" />,
      elevenlabs: <Volume2 size={16} className="text-purple-600" />
    };
    return icons[provider] || <Key size={16} className="text-gray-600" />;
  };

  if (!isOpen || !isSuperAdmin()) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-xl max-w-7xl w-full h-[90vh] flex flex-col overflow-hidden transform animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg animate-bounceIn">
                <Shield size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Admin Dashboard</h2>
                <p className="text-red-100">System administration and management</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/20 transition-all duration-200 hover:scale-110"
            >
              <X size={24} />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 mt-4 bg-white/10 p-1 rounded-lg">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'users', label: 'Users', icon: Users },
              { id: 'analytics', label: 'Analytics', icon: TrendingUp },
              { id: 'global-keys', label: 'Global API Keys', icon: Key },
              { id: 'settings', label: 'Settings', icon: Settings }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all duration-200 ${
                  activeTab === tab.id 
                    ? 'bg-white text-red-600 shadow-sm transform scale-105' 
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <tab.icon size={16} />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg animate-shakeX">
              <div className="flex items-center space-x-2 text-red-700">
                <AlertCircle size={16} />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-red-200 border-t-red-600 rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6 animate-fadeInUp">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
                      <div className="flex items-center space-x-3">
                        <Users className="text-blue-600" size={24} />
                        <div>
                          <p className="text-sm text-blue-600 font-medium">Total Users</p>
                          <p className="text-2xl font-bold text-blue-900">{stats.totalUsers}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
                      <div className="flex items-center space-x-3">
                        <Activity className="text-green-600" size={24} />
                        <div>
                          <p className="text-sm text-green-600 font-medium">Total Conversations</p>
                          <p className="text-2xl font-bold text-green-900">{stats.totalConversations}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200">
                      <div className="flex items-center space-x-3">
                        <Clock className="text-purple-600" size={24} />
                        <div>
                          <p className="text-sm text-purple-600 font-medium">Active Users (30d)</p>
                          <p className="text-2xl font-bold text-purple-900">{stats.activeUsersLast30Days}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-lg border border-gray-200">
                      <div className="flex items-center space-x-3">
                        <Users className="text-gray-600" size={24} />
                        <div>
                          <p className="text-sm text-gray-600 font-medium">Free Users</p>
                          <p className="text-2xl font-bold text-gray-900">{stats.tier1Users}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 p-6 rounded-lg border border-yellow-200">
                      <div className="flex items-center space-x-3">
                        <Crown className="text-yellow-600" size={24} />
                        <div>
                          <p className="text-sm text-yellow-600 font-medium">Pro Users</p>
                          <p className="text-2xl font-bold text-yellow-900">{stats.tier2Users}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 p-6 rounded-lg border border-indigo-200">
                      <div className="flex items-center space-x-3">
                        <BarChart3 className="text-indigo-600" size={24} />
                        <div>
                          <p className="text-sm text-indigo-600 font-medium">Total Sessions</p>
                          <p className="text-2xl font-bold text-indigo-900">{stats.totalSessions}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Top Providers */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Top AI Providers</h3>
                    <div className="space-y-3">
                      {globalStats.slice(0, 5).map((provider, index) => (
                        <div key={provider.provider} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              index === 0 ? 'bg-yellow-100 text-yellow-600' :
                              index === 1 ? 'bg-gray-100 text-gray-600' :
                              'bg-orange-100 text-orange-600'
                            }`}>
                              {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                            </div>
                            {getProviderIcon(provider.provider)}
                            <span className="font-medium">{globalApiService.getProviderDisplayName(provider.provider)}</span>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">{provider.total_responses}</div>
                            <div className="text-xs text-gray-500">responses</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Users Tab */}
              {activeTab === 'users' && (
                <div className="space-y-6 animate-fadeInUp">
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="p-4 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usage</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {users.map((user) => (
                            <tr key={user.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div>
                                  <div className="font-medium text-gray-900">{user.email}</div>
                                  <div className="text-sm text-gray-500">{user.full_name || 'No name'}</div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <select
                                  value={user.role}
                                  onChange={(e) => handleUserRoleUpdate(user.id, e.target.value as 'user' | 'superadmin')}
                                  className="text-sm border border-gray-300 rounded px-2 py-1"
                                >
                                  <option value="user">User</option>
                                  <option value="superadmin">Superadmin</option>
                                </select>
                              </td>
                              <td className="px-4 py-3">
                                <select
                                  value={user.current_tier}
                                  onChange={(e) => handleUserTierUpdate(user.id, e.target.value as UserTier)}
                                  className="text-sm border border-gray-300 rounded px-2 py-1"
                                >
                                  <option value="tier1">Free</option>
                                  <option value="tier2">Pro</option>
                                </select>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm">{user.monthly_conversations} conversations</span>
                                  <button
                                    onClick={() => handleResetUserUsage(user.id)}
                                    className="p-1 rounded hover:bg-gray-200"
                                    title="Reset usage"
                                  >
                                    <RotateCcw size={14} className="text-gray-500" />
                                  </button>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="p-1 rounded hover:bg-red-100 text-red-600"
                                  title="Delete user"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Analytics Tab */}
              {activeTab === 'analytics' && (
                <div className="space-y-6 animate-fadeInUp">
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="p-4 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900">Provider Performance</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Responses</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Selections</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Selection Rate</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Error Rate</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unique Users</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Used</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {globalStats.map((provider) => (
                            <tr key={provider.provider} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="flex items-center space-x-2">
                                  {getProviderIcon(provider.provider)}
                                  <span className="font-medium text-gray-900">{globalApiService.getProviderDisplayName(provider.provider)}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-gray-900">{provider.total_responses}</td>
                              <td className="px-4 py-3 text-gray-900">{provider.total_selections}</td>
                              <td className="px-4 py-3 text-gray-900">{provider.selection_rate.toFixed(1)}%</td>
                              <td className="px-4 py-3 text-gray-900">{(provider.error_rate * 100).toFixed(1)}%</td>
                              <td className="px-4 py-3 text-gray-900">{provider.unique_users}</td>
                              <td className="px-4 py-3 text-gray-500 text-sm">{new Date(provider.last_used).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Global API Keys Tab */}
              {activeTab === 'global-keys' && (
                <div className="space-y-6 animate-fadeInUp">
                  {/* Add New Key Form */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Global API Key</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Provider
                        </label>
                        <select
                          value={newKeyData.provider}
                          onChange={(e) => setNewKeyData({ ...newKeyData, provider: e.target.value })}
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
                          <option value="elevenlabs">Eleven Labs (Text-to-Speech)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          API Key
                        </label>
                        <input
                          type="text"
                          value={newKeyData.api_key}
                          onChange={(e) => setNewKeyData({ ...newKeyData, api_key: e.target.value })}
                          placeholder="Enter API key"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Tier Access
                        </label>
                        <div className="space-y-2">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={newKeyData.tier_access.includes('tier1')}
                              onChange={(e) => {
                                const newTiers = e.target.checked 
                                  ? [...newKeyData.tier_access, 'tier1'] 
                                  : newKeyData.tier_access.filter(t => t !== 'tier1');
                                setNewKeyData({ ...newKeyData, tier_access: newTiers });
                              }}
                              className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                            />
                            <span className="text-sm text-gray-700">Free Tier (tier1)</span>
                          </label>
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={newKeyData.tier_access.includes('tier2')}
                              onChange={(e) => {
                                const newTiers = e.target.checked 
                                  ? [...newKeyData.tier_access, 'tier2'] 
                                  : newKeyData.tier_access.filter(t => t !== 'tier2');
                                setNewKeyData({ ...newKeyData, tier_access: newTiers });
                              }}
                              className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                            />
                            <span className="text-sm text-gray-700">Pro Tier (tier2)</span>
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Usage Limit (optional)
                        </label>
                        <input
                          type="number"
                          value={newKeyData.usage_limit}
                          onChange={(e) => setNewKeyData({ ...newKeyData, usage_limit: e.target.value })}
                          placeholder="Leave empty for unlimited"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end space-x-3">
                      <button
                        onClick={() => {
                          setNewKeyData({
                            provider: '',
                            api_key: '',
                            tier_access: ['tier1', 'tier2'],
                            usage_limit: ''
                          });
                        }}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        Clear
                      </button>
                      <button
                        onClick={handleCreateGlobalApiKey}
                        disabled={!newKeyData.provider || !newKeyData.api_key}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Add API Key
                      </button>
                    </div>
                  </div>

                  {/* Existing Keys */}
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="p-4 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900">Global API Keys</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">API Key</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tier Access</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usage</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {globalApiKeys.map((key) => (
                            <tr key={key.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <div className="flex items-center space-x-2">
                                  {getProviderIcon(key.provider)}
                                  <span className="font-medium text-gray-900">{globalApiService.getProviderDisplayName(key.provider)}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center space-x-2">
                                  <span className="font-mono text-sm text-gray-900">
                                    {showApiKey[key.id] ? key.api_key : '••••••••••••••••••••••••••'}
                                  </span>
                                  <button
                                    onClick={() => setShowApiKey(prev => ({ ...prev, [key.id]: !prev[key.id] }))}
                                    className="p-1 rounded hover:bg-gray-200"
                                  >
                                    {showApiKey[key.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                                  </button>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex space-x-1">
                                  {key.tier_access.includes('tier1') && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                      Free
                                    </span>
                                  )}
                                  {key.tier_access.includes('tier2') && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                      Pro
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center space-x-2">
                                  <div className="flex-1">
                                    <div className="text-sm text-gray-900">
                                      {key.current_usage} / {key.usage_limit || '∞'}
                                    </div>
                                    {key.usage_limit && (
                                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                                        <div 
                                          className={`h-1.5 rounded-full ${globalApiService.getUsageBarColor(globalApiService.getUsagePercentage(key.current_usage, key.usage_limit))}`}
                                          style={{ width: `${Math.min((key.current_usage / key.usage_limit) * 100, 100)}%` }}
                                        ></div>
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => handleResetUsage(key.id)}
                                    className="p-1 rounded hover:bg-gray-200"
                                    title="Reset usage"
                                  >
                                    <RotateCcw size={14} className="text-gray-500" />
                                  </button>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center space-x-2">
                                  <div className={`w-2 h-2 rounded-full ${key.is_active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                  <span className="text-sm text-gray-900">{key.is_active ? 'Active' : 'Inactive'}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => handleToggleApiKey(key.id, !key.is_active)}
                                    className={`p-1 rounded ${key.is_active ? 'hover:bg-red-100 text-red-600' : 'hover:bg-green-100 text-green-600'}`}
                                    title={key.is_active ? 'Deactivate' : 'Activate'}
                                  >
                                    {key.is_active ? <X size={16} /> : <CheckCircle size={16} />}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteApiKey(key.id)}
                                    className="p-1 rounded hover:bg-red-100 text-red-600"
                                    title="Delete"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Settings Tab */}
              {activeTab === 'settings' && (
                <div className="space-y-6 animate-fadeInUp">
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="p-4 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900">System Settings</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Setting</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {adminSettings.map((setting) => (
                            <tr key={setting.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <span className="font-medium text-gray-900">{setting.setting_key}</span>
                              </td>
                              <td className="px-4 py-3">
                                {editingSettings[setting.id] !== undefined ? (
                                  <input
                                    type="text"
                                    value={editingSettings[setting.id]}
                                    onChange={(e) => setEditingSettings({ ...editingSettings, [setting.id]: e.target.value })}
                                    className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-red-500"
                                  />
                                ) : (
                                  <span className="text-gray-900">{setting.setting_value}</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-gray-500">{setting.description || 'No description'}</span>
                              </td>
                              <td className="px-4 py-3">
                                {editingSettings[setting.id] !== undefined ? (
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={() => handleUpdateSetting(setting.setting_key, editingSettings[setting.id])}
                                      className="p-1 rounded hover:bg-green-100 text-green-600"
                                      title="Save"
                                    >
                                      <Save size={16} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        const updated = { ...editingSettings };
                                        delete updated[setting.id];
                                        setEditingSettings(updated);
                                      }}
                                      className="p-1 rounded hover:bg-red-100 text-red-600"
                                      title="Cancel"
                                    >
                                      <X size={16} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setEditingSettings({ ...editingSettings, [setting.id]: setting.setting_value })}
                                    className="p-1 rounded hover:bg-blue-100 text-blue-600"
                                    title="Edit"
                                  >
                                    <Edit size={16} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
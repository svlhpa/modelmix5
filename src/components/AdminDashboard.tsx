import React, { useState, useEffect } from 'react';
import { X, Users, Key, BarChart3, Settings, Shield, Plus, Edit, Trash2, Save, AlertCircle, CheckCircle, Crown, TrendingUp, Activity, Clock, RefreshCw, Eye, EyeOff, Globe, Zap, Palette, Mic, Video, FileText, Volume2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { adminService } from '../services/adminService';
import { globalApiService } from '../services/globalApiService';
import { adminSettingsService } from '../services/adminSettingsService';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserWithSubscription {
  id: string;
  email: string;
  full_name: string | null;
  role: 'user' | 'superadmin';
  current_tier: 'tier1' | 'tier2';
  monthly_conversations: number;
  last_reset_date: string;
  created_at: string;
  updated_at: string;
  subscription?: {
    id: string;
    tier: 'tier1' | 'tier2';
    status: 'active' | 'cancelled' | 'expired';
    started_at: string;
    expires_at: string | null;
  };
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
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'global-api-keys' | 'analytics' | 'agents' | 'settings'>('overview');
  const [users, setUsers] = useState<UserWithSubscription[]>([]);
  const [globalApiKeys, setGlobalApiKeys] = useState<GlobalApiKey[]>([]);
  const [stats, setStats] = useState<UserStats>({
    totalUsers: 0,
    totalSessions: 0,
    totalConversations: 0,
    activeUsersLast30Days: 0,
    tier1Users: 0,
    tier2Users: 0
  });
  const [providerStats, setProviderStats] = useState<GlobalProviderStats[]>([]);
  const [adminSettings, setAdminSettings] = useState<AdminSetting[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Global API Key form state
  const [showAddApiKey, setShowAddApiKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState({
    provider: '',
    api_key: '',
    tier_access: ['tier1', 'tier2'] as string[],
    is_active: true,
    usage_limit: null as number | null
  });
  const [editingApiKey, setEditingApiKey] = useState<string | null>(null);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});

  // Settings form state
  const [editingSettings, setEditingSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen && user && isSuperAdmin()) {
      loadData();
    }
  }, [isOpen, user, activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      switch (activeTab) {
        case 'overview':
          const [statsData, providerStatsData] = await Promise.all([
            adminService.getSystemStats(),
            adminService.getGlobalProviderStats()
          ]);
          setStats(statsData);
          setProviderStats(providerStatsData);
          break;
        case 'users':
          const usersData = await adminService.getAllUsers();
          setUsers(usersData);
          break;
        case 'global-api-keys':
          const apiKeysData = await globalApiService.getAllGlobalApiKeys();
          setGlobalApiKeys(apiKeysData);
          break;
        case 'analytics':
          const analyticsData = await adminService.getGlobalProviderStats();
          setProviderStats(analyticsData);
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

  const handleAddApiKey = async () => {
    if (!newApiKey.provider || !newApiKey.api_key) {
      setError('Provider and API key are required');
      return;
    }

    try {
      await globalApiService.createGlobalApiKey(newApiKey);
      setSuccess('API key added successfully');
      setShowAddApiKey(false);
      setNewApiKey({
        provider: '',
        api_key: '',
        tier_access: ['tier1', 'tier2'],
        is_active: true,
        usage_limit: null
      });
      loadData();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to add API key');
    }
  };

  const handleToggleApiKey = async (id: string, isActive: boolean) => {
    try {
      await globalApiService.toggleGlobalApiKey(id, isActive);
      setSuccess(`API key ${isActive ? 'activated' : 'deactivated'} successfully`);
      loadData();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to toggle API key');
    }
  };

  const handleResetUsage = async (id: string) => {
    try {
      await globalApiService.resetGlobalUsage(id);
      setSuccess('Usage reset successfully');
      loadData();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to reset usage');
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;

    try {
      await globalApiService.deleteGlobalApiKey(id);
      setSuccess('API key deleted successfully');
      loadData();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete API key');
    }
  };

  const handleUpdateUserRole = async (userId: string, role: 'user' | 'superadmin') => {
    try {
      await adminService.updateUserRole(userId, role);
      setSuccess('User role updated successfully');
      loadData();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update user role');
    }
  };

  const handleUpdateUserTier = async (userId: string, tier: 'tier1' | 'tier2') => {
    try {
      await adminService.updateUserTier(userId, tier);
      setSuccess('User tier updated successfully');
      loadData();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update user tier');
    }
  };

  const handleResetUserUsage = async (userId: string) => {
    try {
      await adminService.resetUserUsage(userId);
      setSuccess('User usage reset successfully');
      loadData();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to reset user usage');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

    try {
      await adminService.deleteUser(userId);
      setSuccess('User deleted successfully');
      loadData();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete user');
    }
  };

  const handleUpdateSetting = async (key: string, value: string) => {
    try {
      await adminSettingsService.updateSetting(key, value, adminSettings.find(s => s.setting_key === key)?.description);
      setSuccess('Setting updated successfully');
      setEditingSettings(prev => ({ ...prev, [key]: '' }));
      loadData();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update setting');
    }
  };

  const toggleShowApiKey = (id: string) => {
    setShowApiKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (!isOpen || !user || !isSuperAdmin()) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden transform animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg animate-bounceIn">
                <Shield size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Admin Dashboard</h2>
                <p className="text-red-100">Manage users, global API keys, and system settings</p>
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

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'global-api-keys', label: 'Global API Keys', icon: Key },
            { id: 'analytics', label: 'Analytics', icon: TrendingUp },
            { id: 'agents', label: 'Agents', icon: Shield },
            { id: 'settings', label: 'Settings', icon: Settings }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-6 py-4 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-red-500 text-red-600 bg-white'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <tab.icon size={18} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Error/Success Messages */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700 animate-shakeX">
              <AlertCircle size={20} />
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto">
                <X size={16} />
              </button>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2 text-green-700 animate-fadeInUp">
              <CheckCircle size={20} />
              <span>{success}</span>
              <button onClick={() => setSuccess(null)} className="ml-auto">
                <X size={16} />
              </button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-red-200 border-t-red-600 rounded-full animate-spin"></div>
            </div>
          )}

          {/* Overview Tab */}
          {activeTab === 'overview' && !loading && (
            <div className="space-y-6 animate-fadeInUp">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
                  <div className="flex items-center space-x-3">
                    <Users className="text-blue-600" size={32} />
                    <div>
                      <p className="text-sm text-blue-600 font-medium">Total Users</p>
                      <p className="text-3xl font-bold text-blue-900">{stats.totalUsers}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
                  <div className="flex items-center space-x-3">
                    <Activity className="text-green-600" size={32} />
                    <div>
                      <p className="text-sm text-green-600 font-medium">Total Conversations</p>
                      <p className="text-3xl font-bold text-green-900">{stats.totalConversations}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200">
                  <div className="flex items-center space-x-3">
                    <Clock className="text-purple-600" size={32} />
                    <div>
                      <p className="text-sm text-purple-600 font-medium">Active Users (30d)</p>
                      <p className="text-3xl font-bold text-purple-900">{stats.activeUsersLast30Days}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-lg border border-gray-200">
                  <div className="flex items-center space-x-3">
                    <Users className="text-gray-600" size={32} />
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Free Users</p>
                      <p className="text-3xl font-bold text-gray-900">{stats.tier1Users}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 p-6 rounded-lg border border-yellow-200">
                  <div className="flex items-center space-x-3">
                    <Crown className="text-yellow-600" size={32} />
                    <div>
                      <p className="text-sm text-yellow-600 font-medium">Pro Users</p>
                      <p className="text-3xl font-bold text-yellow-900">{stats.tier2Users}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 p-6 rounded-lg border border-indigo-200">
                  <div className="flex items-center space-x-3">
                    <BarChart3 className="text-indigo-600" size={32} />
                    <div>
                      <p className="text-sm text-indigo-600 font-medium">Total Sessions</p>
                      <p className="text-3xl font-bold text-indigo-900">{stats.totalSessions}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Providers */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top AI Providers</h3>
                <div className="space-y-3">
                  {providerStats.slice(0, 5).map((provider, index) => (
                    <div key={provider.provider} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${
                          index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-500'
                        }`}>
                          {index + 1}
                        </div>
                        <span className="font-medium">{provider.provider}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{provider.total_responses}</div>
                        <div className="text-sm text-gray-500">responses</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && !loading && (
            <div className="space-y-6 animate-fadeInUp">
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tier</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">{user.email}</div>
                              <div className="text-sm text-gray-500">{user.full_name || 'No name'}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={user.role}
                              onChange={(e) => handleUpdateUserRole(user.id, e.target.value as 'user' | 'superadmin')}
                              className="text-sm border border-gray-300 rounded px-2 py-1"
                            >
                              <option value="user">User</option>
                              <option value="superadmin">Superadmin</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <select
                              value={user.current_tier}
                              onChange={(e) => handleUpdateUserTier(user.id, e.target.value as 'tier1' | 'tier2')}
                              className="text-sm border border-gray-300 rounded px-2 py-1"
                            >
                              <option value="tier1">Free</option>
                              <option value="tier2">Pro</option>
                            </select>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{user.monthly_conversations} conversations</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            <button
                              onClick={() => handleResetUserUsage(user.id)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Reset Usage
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
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

          {/* Global API Keys Tab */}
          {activeTab === 'global-api-keys' && !loading && (
            <div className="space-y-6 animate-fadeInUp">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Global API Keys</h3>
                <button
                  onClick={() => setShowAddApiKey(true)}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Plus size={16} />
                  <span>Add API Key</span>
                </button>
              </div>

              {/* Add API Key Form */}
              {showAddApiKey && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Add New Global API Key</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
                      <select
                        value={newApiKey.provider}
                        onChange={(e) => setNewApiKey({ ...newApiKey, provider: e.target.value })}
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
                      <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                      <input
                        type="password"
                        value={newApiKey.api_key}
                        onChange={(e) => setNewApiKey({ ...newApiKey, api_key: e.target.value })}
                        placeholder="Enter API key"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Usage Limit (optional)</label>
                      <input
                        type="number"
                        value={newApiKey.usage_limit || ''}
                        onChange={(e) => setNewApiKey({ ...newApiKey, usage_limit: e.target.value ? parseInt(e.target.value) : null })}
                        placeholder="Leave empty for unlimited"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tier Access</label>
                      <div className="space-y-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={newApiKey.tier_access.includes('tier1')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewApiKey({ ...newApiKey, tier_access: [...newApiKey.tier_access, 'tier1'] });
                              } else {
                                setNewApiKey({ ...newApiKey, tier_access: newApiKey.tier_access.filter(t => t !== 'tier1') });
                              }
                            }}
                            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Free Tier</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={newApiKey.tier_access.includes('tier2')}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewApiKey({ ...newApiKey, tier_access: [...newApiKey.tier_access, 'tier2'] });
                              } else {
                                setNewApiKey({ ...newApiKey, tier_access: newApiKey.tier_access.filter(t => t !== 'tier2') });
                              }
                            }}
                            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Pro Tier</span>
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-3 mt-6">
                    <button
                      onClick={() => setShowAddApiKey(false)}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddApiKey}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Add Key
                    </button>
                  </div>
                </div>
              )}

              {/* API Keys List */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">API Key</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {globalApiKeys.map((apiKey) => (
                        <tr key={apiKey.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">{globalApiService.getProviderIcon(apiKey.provider)}</span>
                              <span className="font-medium">{globalApiService.getProviderDisplayName(apiKey.provider)}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono text-sm">
                                {showApiKeys[apiKey.id] ? apiKey.api_key : '••••••••••••••••'}
                              </span>
                              <button
                                onClick={() => toggleShowApiKey(apiKey.id)}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                {showApiKeys[apiKey.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm">
                              <div>{apiKey.current_usage} / {apiKey.usage_limit || '∞'}</div>
                              <div className="text-gray-500">
                                {apiKey.usage_limit && (
                                  <div className="w-20 bg-gray-200 rounded-full h-2 mt-1">
                                    <div
                                      className={`h-2 rounded-full ${globalApiService.getUsageBarColor(globalApiService.getUsagePercentage(apiKey.current_usage, apiKey.usage_limit))}`}
                                      style={{ width: `${Math.min(globalApiService.getUsagePercentage(apiKey.current_usage, apiKey.usage_limit), 100)}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleToggleApiKey(apiKey.id, !apiKey.is_active)}
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                apiKey.is_active
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {apiKey.is_active ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            <button
                              onClick={() => handleResetUsage(apiKey.id)}
                              className="text-blue-600 hover:text-blue-900"
                              title="Reset Usage"
                            >
                              <RefreshCw size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteApiKey(apiKey.id)}
                              className="text-red-600 hover:text-red-900"
                              title="Delete"
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
          {activeTab === 'analytics' && !loading && (
            <div className="space-y-6 animate-fadeInUp">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Global Provider Performance</h3>
                <div className="space-y-4">
                  {providerStats.map((provider, index) => (
                    <div key={provider.provider} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${
                          index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-500'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{provider.provider}</div>
                          <div className="text-sm text-gray-500">{provider.unique_users} unique users</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{provider.total_responses} responses</div>
                        <div className="text-sm text-gray-500">{provider.selection_rate.toFixed(1)}% selection rate</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Agents Tab */}
          {activeTab === 'agents' && !loading && (
            <div className="space-y-6 animate-fadeInUp">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Agents</h3>
                <p className="text-gray-600">Agent management features coming soon...</p>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && !loading && (
            <div className="space-y-6 animate-fadeInUp">
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">System Settings</h3>
                <div className="space-y-4">
                  {adminSettings.map((setting) => (
                    <div key={setting.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-medium text-gray-900">{setting.setting_key}</h4>
                          {setting.description && (
                            <p className="text-sm text-gray-500">{setting.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => setEditingSettings(prev => ({ ...prev, [setting.setting_key]: setting.setting_value }))}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit size={16} />
                        </button>
                      </div>
                      {editingSettings[setting.setting_key] !== undefined ? (
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            value={editingSettings[setting.setting_key]}
                            onChange={(e) => setEditingSettings(prev => ({ ...prev, [setting.setting_key]: e.target.value }))}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                          <button
                            onClick={() => handleUpdateSetting(setting.setting_key, editingSettings[setting.setting_key])}
                            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            <Save size={16} />
                          </button>
                          <button
                            onClick={() => setEditingSettings(prev => ({ ...prev, [setting.setting_key]: undefined }))}
                            className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-700 font-mono bg-gray-50 p-2 rounded">
                          {setting.setting_value || '(empty)'}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
import React, { useState, useEffect } from 'react';
import { X, Users, MessageSquare, BarChart3, Activity, Shield, Trash2, Crown, User, Calendar, TrendingUp, AlertTriangle, Search, Filter, RefreshCw, Trophy, Target, Zap, Brain, PieChart, LineChart, Award, Star, RotateCcw, Edit3, Save, Key, Plus, Eye, EyeOff, ToggleLeft as Toggle, Settings } from 'lucide-react';
import { adminService } from '../services/adminService';
import { globalApiService } from '../services/globalApiService';
import { tierService } from '../services/tierService';
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
  subscription?: any;
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

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'analytics' | 'api-keys' | 'logs'>('overview');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [globalProviderStats, setGlobalProviderStats] = useState<GlobalProviderStats[]>([]);
  const [modelComparison, setModelComparison] = useState<any>(null);
  const [globalApiKeys, setGlobalApiKeys] = useState<GlobalApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'superadmin'>('all');
  const [tierFilter, setTierFilter] = useState<'all' | 'tier1' | 'tier2'>('all');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [showAddApiKey, setShowAddApiKey] = useState(false);
  const [newApiKey, setNewApiKey] = useState({
    provider: '',
    api_key: '',
    tier_access: [] as string[],
    is_active: true,
    usage_limit: null as number | null
  });

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const promises = [
        adminService.getAllUsers(),
        adminService.getSystemStats()
      ];

      if (activeTab === 'analytics') {
        promises.push(
          adminService.getGlobalProviderStats(),
          adminService.getModelComparisonData()
        );
      }

      if (activeTab === 'api-keys') {
        promises.push(globalApiService.getAllGlobalApiKeys());
      }

      const results = await Promise.all(promises);
      
      setUsers(results[0]);
      setStats(results[1]);
      
      if (activeTab === 'analytics' && results.length > 2) {
        setGlobalProviderStats(results[2] as GlobalProviderStats[]);
        setModelComparison(results[3]);
      }

      if (activeTab === 'api-keys' && results.length > 2) {
        setGlobalApiKeys(results[2] as GlobalApiKey[]);
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: 'user' | 'superadmin') => {
    try {
      await adminService.updateUserRole(userId, newRole);
      await loadData(); // Refresh data
    } catch (error) {
      console.error('Failed to update user role:', error);
    }
  };

  const handleUpdateUserTier = async (userId: string, newTier: UserTier) => {
    try {
      await adminService.updateUserTier(userId, newTier);
      await loadData(); // Refresh data
      setEditingUser(null);
    } catch (error) {
      console.error('Failed to update user tier:', error);
    }
  };

  const handleResetUserUsage = async (userId: string) => {
    if (confirm('Are you sure you want to reset this user\'s monthly usage counter?')) {
      try {
        await adminService.resetUserUsage(userId);
        await loadData(); // Refresh data
      } catch (error) {
        console.error('Failed to reset user usage:', error);
      }
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      try {
        await adminService.deleteUser(userId);
        await loadData(); // Refresh data
      } catch (error) {
        console.error('Failed to delete user:', error);
      }
    }
  };

  // Global API Key handlers
  const handleAddApiKey = async () => {
    try {
      await globalApiService.createGlobalApiKey(newApiKey);
      setNewApiKey({
        provider: '',
        api_key: '',
        tier_access: [],
        is_active: true,
        usage_limit: null
      });
      setShowAddApiKey(false);
      await loadData();
    } catch (error) {
      console.error('Failed to add API key:', error);
    }
  };

  const handleToggleApiKey = async (id: string, isActive: boolean) => {
    try {
      await globalApiService.toggleGlobalApiKey(id, isActive);
      await loadData();
    } catch (error) {
      console.error('Failed to toggle API key:', error);
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    if (confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      try {
        await globalApiService.deleteGlobalApiKey(id);
        await loadData();
      } catch (error) {
        console.error('Failed to delete API key:', error);
      }
    }
  };

  const handleResetApiUsage = async (id: string) => {
    if (confirm('Are you sure you want to reset the usage counter for this API key?')) {
      try {
        await globalApiService.resetGlobalUsage(id);
        await loadData();
      } catch (error) {
        console.error('Failed to reset API usage:', error);
      }
    }
  };

  const toggleShowApiKey = (keyId: string) => {
    setShowApiKeys(prev => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'openai':
      case 'openai gpt-4o':
        return '🤖';
      case 'open router':
      case 'openrouter':
        return '🔀';
      case 'google gemini 1.5 pro':
      case 'gemini':
        return '💎';
      case 'deepseek':
      case 'deepseek chat':
        return '🔍';
      case 'deepseek r1':
        return '🧠';
      case 'claude':
      case 'anthropic':
        return '🔮';
      case 'llama':
      case 'meta':
        return '🦙';
      default:
        return '🤖';
    }
  };

  const getProviderColor = (provider: string, index: number) => {
    const colors = [
      'from-emerald-50 to-emerald-100 border-emerald-200',
      'from-blue-50 to-blue-100 border-blue-200',
      'from-purple-50 to-purple-100 border-purple-200',
      'from-orange-50 to-orange-100 border-orange-200',
      'from-pink-50 to-pink-100 border-pink-200',
      'from-indigo-50 to-indigo-100 border-indigo-200',
      'from-yellow-50 to-yellow-100 border-yellow-200',
      'from-red-50 to-red-100 border-red-200',
    ];
    return colors[index % colors.length];
  };

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="text-yellow-500" size={20} />;
      case 1:
        return <Award className="text-gray-400" size={20} />;
      case 2:
        return <Star className="text-amber-600" size={20} />;
      default:
        return <div className="w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center text-white text-xs font-bold">{index + 1}</div>;
    }
  };

  const getTierIcon = (tier: UserTier) => {
    switch (tier) {
      case 'tier1':
        return <Zap size={16} className="text-gray-600" />;
      case 'tier2':
        return <Crown size={16} className="text-yellow-600" />;
      default:
        return <Zap size={16} className="text-gray-600" />;
    }
  };

  const getTierColor = (tier: UserTier) => {
    switch (tier) {
      case 'tier1':
        return 'bg-gray-100 text-gray-800';
      case 'tier2':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getUsageColor = (usage: number, limit: number) => {
    const percentage = (usage / limit) * 100;
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-orange-600';
    if (percentage >= 50) return 'text-yellow-600';
    return 'text-green-600';
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesTier = tierFilter === 'all' || user.current_tier === tierFilter;
    return matchesSearch && matchesRole && matchesTier;
  });

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
              <h2 className="text-xl font-semibold text-gray-900">SuperAdmin Dashboard</h2>
              <p className="text-sm text-gray-500">Manage users, tiers, API keys, and monitor system activity</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw size={16} className={`text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'users', label: 'Users & Tiers', icon: Users },
            { id: 'api-keys', label: 'Global API Keys', icon: Key },
            { id: 'analytics', label: 'AI Analytics', icon: Brain },
            { id: 'logs', label: 'Activity Logs', icon: Activity }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md transition-colors ${
                activeTab === tab.id 
                  ? 'bg-white text-red-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center space-x-3">
                    <Users className="text-blue-600" size={24} />
                    <div>
                      <p className="text-sm text-blue-600 font-medium">Total Users</p>
                      <p className="text-2xl font-bold text-blue-900">{stats.totalUsers}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center space-x-3">
                    <Zap className="text-gray-600" size={24} />
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Free Users</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.tier1Users}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 p-4 rounded-lg border border-yellow-200">
                  <div className="flex items-center space-x-3">
                    <Crown className="text-yellow-600" size={24} />
                    <div>
                      <p className="text-sm text-yellow-600 font-medium">Pro Users</p>
                      <p className="text-2xl font-bold text-yellow-900">{stats.tier2Users}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center space-x-3">
                    <MessageSquare className="text-green-600" size={24} />
                    <div>
                      <p className="text-sm text-green-600 font-medium">Chat Sessions</p>
                      <p className="text-2xl font-bold text-green-900">{stats.totalSessions}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                  <div className="flex items-center space-x-3">
                    <BarChart3 className="text-purple-600" size={24} />
                    <div>
                      <p className="text-sm text-purple-600 font-medium">Conversations</p>
                      <p className="text-2xl font-bold text-purple-900">{stats.totalConversations}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
                  <div className="flex items-center space-x-3">
                    <Activity className="text-orange-600" size={24} />
                    <div>
                      <p className="text-sm text-orange-600 font-medium">Active (30d)</p>
                      <p className="text-2xl font-bold text-orange-900">{stats.activeUsersLast30Days}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tier Distribution Chart */}
            {stats && (
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">User Tier Distribution</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Zap size={16} className="text-gray-600" />
                        <span className="text-sm font-medium">Free Tier</span>
                      </div>
                      <span className="text-sm text-gray-600">{stats.tier1Users} users</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gray-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${(stats.tier1Users / stats.totalUsers) * 100}%` }}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Crown size={16} className="text-yellow-600" />
                        <span className="text-sm font-medium">Pro Tier</span>
                      </div>
                      <span className="text-sm text-gray-600">{stats.tier2Users} users</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-yellow-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${(stats.tier2Users / stats.totalUsers) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-gray-900 mb-2">
                        {stats.totalUsers > 0 ? ((stats.tier2Users / stats.totalUsers) * 100).toFixed(1) : 0}%
                      </div>
                      <div className="text-sm text-gray-600">Conversion Rate to Pro</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="font-medium text-amber-800 mb-1">SuperAdmin Access</h4>
                  <p className="text-sm text-amber-700">
                    You have full administrative access to all user data, conversations, tier management, global API keys, and system settings. 
                    All actions are logged for security and audit purposes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users by email or name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="all">All Roles</option>
                <option value="user">Users</option>
                <option value="superadmin">SuperAdmins</option>
              </select>
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="all">All Tiers</option>
                <option value="tier1">Free Tier</option>
                <option value="tier2">Pro Tier</option>
              </select>
            </div>

            {/* Users Table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tier</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map((user) => {
                      const tierLimits = tierService.getTierLimits(user.current_tier);
                      const usagePercentage = (user.monthly_conversations / tierLimits.monthlyConversations) * 100;
                      
                      return (
                        <tr key={user.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4">
                            <div className="flex items-center space-x-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                user.role === 'superadmin' ? 'bg-red-100' : 'bg-gray-100'
                              }`}>
                                {user.role === 'superadmin' ? (
                                  <Shield size={16} className="text-red-600" />
                                ) : (
                                  <User size={16} className="text-gray-600" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{user.full_name || 'No name'}</p>
                                <p className="text-sm text-gray-500">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <select
                              value={user.role}
                              onChange={(e) => handleUpdateUserRole(user.id, e.target.value as 'user' | 'superadmin')}
                              className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                              <option value="user">User</option>
                              <option value="superadmin">SuperAdmin</option>
                            </select>
                          </td>
                          <td className="px-4 py-4">
                            {editingUser === user.id ? (
                              <div className="flex items-center space-x-2">
                                <select
                                  defaultValue={user.current_tier}
                                  onChange={(e) => handleUpdateUserTier(user.id, e.target.value as UserTier)}
                                  className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-500"
                                >
                                  <option value="tier1">Free Tier</option>
                                  <option value="tier2">Pro Tier</option>
                                </select>
                                <button
                                  onClick={() => setEditingUser(null)}
                                  className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                  title="Cancel"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getTierColor(user.current_tier)}`}>
                                  {getTierIcon(user.current_tier)}
                                  <span>{tierLimits.name}</span>
                                </span>
                                <button
                                  onClick={() => setEditingUser(user.id)}
                                  className="p-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                  title="Edit Tier"
                                >
                                  <Edit3 size={14} />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <div className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span className={getUsageColor(user.monthly_conversations, tierLimits.monthlyConversations)}>
                                  {user.monthly_conversations} / {tierLimits.monthlyConversations}
                                </span>
                                <span className="text-gray-500">{usagePercentage.toFixed(0)}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5">
                                <div
                                  className={`h-1.5 rounded-full transition-all ${
                                    usagePercentage >= 90 ? 'bg-red-500' :
                                    usagePercentage >= 75 ? 'bg-orange-500' :
                                    usagePercentage >= 50 ? 'bg-yellow-500' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-500">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleResetUserUsage(user.id)}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Reset Usage"
                              >
                                <RotateCcw size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete User"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {filteredUsers.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Users size={48} className="mx-auto mb-4 opacity-50" />
                <p>No users found matching your criteria</p>
              </div>
            )}
          </div>
        )}

        {/* Global API Keys Tab */}
        {activeTab === 'api-keys' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Global API Key Management</h3>
                <p className="text-sm text-gray-500">Configure API keys that are shared across users based on their tier</p>
              </div>
              <button
                onClick={() => setShowAddApiKey(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={16} />
                <span>Add API Key</span>
              </button>
            </div>

            {/* Add API Key Form */}
            {showAddApiKey && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Add New Global API Key</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Provider</label>
                    <select
                      value={newApiKey.provider}
                      onChange={(e) => setNewApiKey({ ...newApiKey, provider: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Provider</option>
                      <option value="openai">OpenAI</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="deepseek">DeepSeek</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                    <input
                      type="password"
                      value={newApiKey.api_key}
                      onChange={(e) => setNewApiKey({ ...newApiKey, api_key: e.target.value })}
                      placeholder="Enter API key..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tier Access</label>
                    <div className="space-y-2">
                      {['tier1', 'tier2'].map(tier => (
                        <label key={tier} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={newApiKey.tier_access.includes(tier)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewApiKey({ ...newApiKey, tier_access: [...newApiKey.tier_access, tier] });
                              } else {
                                setNewApiKey({ ...newApiKey, tier_access: newApiKey.tier_access.filter(t => t !== tier) });
                              }
                            }}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">
                            {globalApiService.getTierDisplayName(tier)} Tier
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Usage Limit (optional)</label>
                    <input
                      type="number"
                      value={newApiKey.usage_limit || ''}
                      onChange={(e) => setNewApiKey({ ...newApiKey, usage_limit: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="Leave empty for unlimited"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                
                <div className="flex items-center justify-end space-x-3 mt-6">
                  <button
                    onClick={() => {
                      setShowAddApiKey(false);
                      setNewApiKey({
                        provider: '',
                        api_key: '',
                        tier_access: [],
                        is_active: true,
                        usage_limit: null
                      });
                    }}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddApiKey}
                    disabled={!newApiKey.provider || !newApiKey.api_key || newApiKey.tier_access.length === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Add API Key
                  </button>
                </div>
              </div>
            )}

            {/* API Keys List */}
            <div className="space-y-4">
              {globalApiKeys.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <Key size={48} className="text-gray-300 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">No Global API Keys</h4>
                  <p className="text-gray-500 mb-4">Add global API keys to provide centralized access to AI models</p>
                  <button
                    onClick={() => setShowAddApiKey(true)}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={16} />
                    <span>Add Your First API Key</span>
                  </button>
                </div>
              ) : (
                globalApiKeys.map((apiKey) => {
                  const usagePercentage = globalApiService.getUsagePercentage(apiKey.current_usage, apiKey.usage_limit);
                  
                  return (
                    <div key={apiKey.id} className="bg-white border border-gray-200 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{globalApiService.getProviderIcon(apiKey.provider)}</span>
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900">
                              {globalApiService.getProviderDisplayName(apiKey.provider)}
                            </h4>
                            <div className="flex items-center space-x-2">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                apiKey.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {apiKey.is_active ? 'Active' : 'Inactive'}
                              </span>
                              <span className="text-sm text-gray-500">
                                Access: {apiKey.tier_access.map(tier => globalApiService.getTierDisplayName(tier)).join(', ')}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => toggleShowApiKey(apiKey.id)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            title={showApiKeys[apiKey.id] ? 'Hide API Key' : 'Show API Key'}
                          >
                            {showApiKeys[apiKey.id] ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                          <button
                            onClick={() => handleToggleApiKey(apiKey.id, !apiKey.is_active)}
                            className={`p-2 rounded transition-colors ${
                              apiKey.is_active 
                                ? 'text-red-600 hover:bg-red-50' 
                                : 'text-green-600 hover:bg-green-50'
                            }`}
                            title={apiKey.is_active ? 'Deactivate' : 'Activate'}
                          >
                            <Settings size={16} />
                          </button>
                          <button
                            onClick={() => handleResetApiUsage(apiKey.id)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Reset Usage"
                          >
                            <RotateCcw size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteApiKey(apiKey.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete API Key"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      
                      {/* API Key Display */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                        <div className="flex items-center space-x-2">
                          <input
                            type={showApiKeys[apiKey.id] ? 'text' : 'password'}
                            value={apiKey.api_key}
                            readOnly
                            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono"
                          />
                        </div>
                      </div>
                      
                      {/* Usage Information */}
                      {apiKey.usage_limit && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Monthly Usage</span>
                            <span className={globalApiService.getUsageColor(usagePercentage)}>
                              {apiKey.current_usage} / {apiKey.usage_limit}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${globalApiService.getUsageBarColor(usagePercentage)}`}
                              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-4 text-xs text-gray-500">
                        Created: {new Date(apiKey.created_at).toLocaleDateString()} • 
                        Last Reset: {new Date(apiKey.last_reset_date).toLocaleDateString()}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <Key className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="font-medium text-blue-800 mb-1">Global API Key Benefits</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Centralized API key management for all users</li>
                    <li>• Tier-based access control (Free vs Pro users)</li>
                    <li>• Usage monitoring and limits per provider</li>
                    <li>• Fallback to user's personal API keys if global keys are unavailable</li>
                    <li>• Cost control and usage analytics across the platform</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-500">Loading AI analytics...</p>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                {modelComparison && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 p-4 rounded-lg border border-emerald-200">
                      <div className="flex items-center space-x-3">
                        <Brain className="text-emerald-600" size={24} />
                        <div>
                          <p className="text-sm text-emerald-600 font-medium">Active AI Models</p>
                          <p className="text-2xl font-bold text-emerald-900">{modelComparison.totalModels}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                      <div className="flex items-center space-x-3">
                        <Target className="text-blue-600" size={24} />
                        <div>
                          <p className="text-sm text-blue-600 font-medium">Total Responses</p>
                          <p className="text-2xl font-bold text-blue-900">{modelComparison.totalResponses.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                      <div className="flex items-center space-x-3">
                        <Zap className="text-purple-600" size={24} />
                        <div>
                          <p className="text-sm text-purple-600 font-medium">Avg Selection Rate</p>
                          <p className="text-2xl font-bold text-purple-900">{modelComparison.averageSelectionRate.toFixed(1)}%</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
                      <div className="flex items-center space-x-3">
                        <Trophy className="text-orange-600" size={24} />
                        <div>
                          <p className="text-sm text-orange-600 font-medium">Top Performer</p>
                          <p className="text-lg font-bold text-orange-900 truncate">
                            {modelComparison.bestPerformingModel?.provider || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Global AI Model Rankings */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <Trophy className="text-yellow-500" size={20} />
                    <span>Global AI Model Performance Rankings</span>
                  </h3>
                  
                  {globalProviderStats.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                      <Brain size={48} className="text-gray-300 mx-auto mb-4" />
                      <h4 className="text-lg font-medium text-gray-900 mb-2">No Analytics Data Yet</h4>
                      <p className="text-gray-500">AI model analytics will appear here once users start conversations</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {globalProviderStats.map((stat, index) => (
                        <div
                          key={stat.provider}
                          className={`p-4 rounded-xl border-2 transition-all bg-gradient-to-r ${getProviderColor(stat.provider, index)} ${
                            index === 0 ? 'ring-2 ring-yellow-300 shadow-lg' : 'shadow-sm'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              {getRankIcon(index)}
                              <div className="flex items-center space-x-3">
                                <span className="text-2xl">{getProviderIcon(stat.provider)}</span>
                                <div>
                                  <h4 className="font-semibold text-gray-900 text-sm md:text-base">{stat.provider}</h4>
                                  <p className="text-xs text-gray-600">
                                    {stat.total_responses.toLocaleString()} responses • {stat.unique_users} users
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-6">
                              <div className="text-center">
                                <p className="text-xl md:text-2xl font-bold text-gray-900">{stat.selection_rate.toFixed(1)}%</p>
                                <p className="text-xs text-gray-500">Selection Rate</p>
                              </div>
                              
                              <div className="text-center">
                                <p className="text-lg font-semibold text-gray-700">{stat.total_selections.toLocaleString()}</p>
                                <p className="text-xs text-gray-500">Selections</p>
                              </div>
                              
                              {stat.error_rate > 0 && (
                                <div className="text-center">
                                  <div className="flex items-center space-x-1">
                                    <AlertTriangle size={14} className="text-red-500" />
                                    <p className="text-sm font-medium text-red-600">{stat.error_rate.toFixed(1)}%</p>
                                  </div>
                                  <p className="text-xs text-gray-500">Error Rate</p>
                                </div>
                              )}
                              
                              <div className="text-center">
                                <p className="text-sm text-gray-600">{new Date(stat.last_used).toLocaleDateString()}</p>
                                <p className="text-xs text-gray-500">Last Used</p>
                              </div>
                            </div>
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="mt-3">
                            <div className="w-full bg-white/50 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full transition-all duration-500 ${
                                  index === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                                  index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-600' :
                                  index === 2 ? 'bg-gradient-to-r from-amber-400 to-amber-600' :
                                  'bg-gradient-to-r from-blue-400 to-blue-600'
                                }`}
                                style={{ width: `${Math.max(stat.selection_rate, 2)}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Additional Analytics Insights */}
                {globalProviderStats.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-800 mb-3 flex items-center space-x-2">
                        <PieChart size={16} />
                        <span>Usage Distribution</span>
                      </h4>
                      <div className="space-y-2">
                        {globalProviderStats.slice(0, 5).map((stat, index) => {
                          const percentage = (stat.total_responses / globalProviderStats.reduce((sum, s) => sum + s.total_responses, 0)) * 100;
                          return (
                            <div key={stat.provider} className="flex items-center justify-between">
                              <span className="text-sm text-blue-700 truncate">{stat.provider}</span>
                              <span className="text-sm font-medium text-blue-900">{percentage.toFixed(1)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-medium text-green-800 mb-3 flex items-center space-x-2">
                        <LineChart size={16} />
                        <span>Performance Insights</span>
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-green-700">Models with 50%+ selection rate:</span>
                          <span className="font-medium text-green-900">
                            {globalProviderStats.filter(s => s.selection_rate >= 50).length}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-700">Most reliable (lowest errors):</span>
                          <span className="font-medium text-green-900 truncate">
                            {globalProviderStats.sort((a, b) => a.error_rate - b.error_rate)[0]?.provider || 'N/A'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-green-700">Most popular (by usage):</span>
                          <span className="font-medium text-green-900 truncate">
                            {globalProviderStats[0]?.provider || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Activity Logs Tab */}
        {activeTab === 'logs' && (
          <div className="text-center py-12">
            <Activity size={48} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Activity Logs</h3>
            <p className="text-gray-500">Admin activity logging coming soon...</p>
          </div>
        )}
      </div>
    </div>
  );
};
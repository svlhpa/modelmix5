import React, { useState, useEffect } from 'react';
import { 
  X, Users, MessageSquare, BarChart3, Activity, Shield, 
  Trash2, Crown, User, Calendar, TrendingUp, AlertTriangle,
  Search, Filter, RefreshCw, Trophy, Target, Zap, Brain,
  PieChart, LineChart, Award, Star
} from 'lucide-react';
import { adminService } from '../services/adminService';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'user' | 'superadmin';
  created_at: string;
  updated_at: string;
}

interface UserStats {
  totalUsers: number;
  totalSessions: number;
  totalConversations: number;
  activeUsersLast30Days: number;
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

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  isOpen,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'analytics' | 'logs'>('overview');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [globalProviderStats, setGlobalProviderStats] = useState<GlobalProviderStats[]>([]);
  const [modelComparison, setModelComparison] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'superadmin'>('all');

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

      const results = await Promise.all(promises);
      
      setUsers(results[0]);
      setStats(results[1]);
      
      if (activeTab === 'analytics' && results.length > 2) {
        setGlobalProviderStats(results[2] as GlobalProviderStats[]);
        setModelComparison(results[3]);
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

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
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
              <p className="text-sm text-gray-500">Manage users and monitor system activity</p>
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
            { id: 'users', label: 'Users', icon: Users },
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                      <p className="text-sm text-orange-600 font-medium">Active Users (30d)</p>
                      <p className="text-2xl font-bold text-orange-900">{stats.activeUsersLast30Days}</p>
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
                    You have full administrative access to all user data, conversations, and system settings. 
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
            </div>

            {/* Users Table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              user.role === 'superadmin' ? 'bg-red-100' : 'bg-gray-100'
                            }`}>
                              {user.role === 'superadmin' ? (
                                <Crown size={16} className="text-red-600" />
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
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.role === 'superadmin' 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {user.role === 'superadmin' ? 'SuperAdmin' : 'User'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center space-x-2">
                            <select
                              value={user.role}
                              onChange={(e) => handleUpdateUserRole(user.id, e.target.value as 'user' | 'superadmin')}
                              className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-500"
                            >
                              <option value="user">User</option>
                              <option value="superadmin">SuperAdmin</option>
                            </select>
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
                    ))}
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
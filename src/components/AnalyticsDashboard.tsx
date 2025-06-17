import React from 'react';
import { X, Trophy, TrendingUp, Activity, Clock, AlertTriangle, BarChart3 } from 'lucide-react';
import { analyticsService } from '../services/analyticsService';
import { ProviderStats } from '../types';
import { useAuth } from '../hooks/useAuth';

interface AnalyticsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  isOpen,
  onClose
}) => {
  const { user } = useAuth();
  const [stats, setStats] = React.useState<ProviderStats[]>([]);
  const [topPerformer, setTopPerformer] = React.useState<ProviderStats | null>(null);
  const [totalConversations, setTotalConversations] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && user) {
      loadAnalytics();
    }
  }, [isOpen, user]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const [providerStats, top, total] = await Promise.all([
        analyticsService.getProviderStats(),
        analyticsService.getTopPerformer(),
        analyticsService.getTotalConversations()
      ]);
      
      setStats(providerStats);
      setTopPerformer(top);
      setTotalConversations(total);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'openai':
        return '🤖';
      case 'open router':
        return '🔀';
      case 'gemini':
        return '💎';
      case 'deepseek':
        return '🔍';
      default:
        return '🤖';
    }
  };

  const getProviderColor = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'openai':
        return 'bg-green-100 border-green-200 text-green-800';
      case 'open router':
        return 'bg-purple-100 border-purple-200 text-purple-800';
      case 'gemini':
        return 'bg-blue-100 border-blue-200 text-blue-800';
      case 'deepseek':
        return 'bg-orange-100 border-orange-200 text-orange-800';
      default:
        return 'bg-gray-100 border-gray-200 text-gray-800';
    }
  };

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="text-yellow-500" size={20} />;
      case 1:
        return <div className="w-5 h-5 bg-gray-400 rounded-full flex items-center justify-center text-white text-xs font-bold">2</div>;
      case 2:
        return <div className="w-5 h-5 bg-amber-600 rounded-full flex items-center justify-center text-white text-xs font-bold">3</div>;
      default:
        return <div className="w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center text-white text-xs font-bold">{index + 1}</div>;
    }
  };

  const handleClearAnalytics = async () => {
    if (confirm('Are you sure you want to clear all analytics data? This cannot be undone.')) {
      try {
        await analyticsService.clearAnalytics();
        setStats([]);
        setTopPerformer(null);
        setTotalConversations(0);
      } catch (error) {
        console.error('Failed to clear analytics:', error);
      }
    }
  };

  if (!isOpen) return null;

  if (!user) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-md w-full p-6">
          <div className="text-center">
            <BarChart3 size={48} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Sign In Required</h3>
            <p className="text-gray-500 mb-4">Please sign in to view your personalized analytics</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <BarChart3 size={20} className="text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">AI Performance Analytics</h2>
              <p className="text-sm text-gray-500">Track which AI providers perform best in your conversations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500">Loading your analytics...</p>
          </div>
        ) : stats.length === 0 ? (
          <div className="text-center py-12">
            <Activity size={48} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Yet</h3>
            <p className="text-gray-500">Start conversations and select responses to see analytics</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-3">
                  <TrendingUp className="text-blue-600" size={24} />
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Total Conversations</p>
                    <p className="text-2xl font-bold text-blue-900">{totalConversations}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
                <div className="flex items-center space-x-3">
                  <Trophy className="text-green-600" size={24} />
                  <div>
                    <p className="text-sm text-green-600 font-medium">Top Performer</p>
                    <p className="text-lg font-bold text-green-900">
                      {topPerformer ? `${topPerformer.provider} (${topPerformer.selectionRate.toFixed(1)}%)` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                <div className="flex items-center space-x-3">
                  <Activity className="text-purple-600" size={24} />
                  <div>
                    <p className="text-sm text-purple-600 font-medium">Active Providers</p>
                    <p className="text-2xl font-bold text-purple-900">{stats.length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Provider Rankings */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Provider Performance Rankings</h3>
              <div className="space-y-3">
                {stats.map((stat, index) => (
                  <div
                    key={stat.provider}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      index === 0 ? 'ring-2 ring-yellow-300 bg-gradient-to-r from-yellow-50 to-yellow-100' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        {getRankIcon(index)}
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{getProviderIcon(stat.provider)}</span>
                          <div>
                            <h4 className="font-semibold text-gray-900">{stat.provider}</h4>
                            <p className="text-sm text-gray-500">
                              {stat.totalSelections} selections out of {stat.totalResponses} responses
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-6">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-gray-900">{stat.selectionRate.toFixed(1)}%</p>
                          <p className="text-xs text-gray-500">Selection Rate</p>
                        </div>
                        
                        <div className="text-center">
                          <p className="text-lg font-semibold text-gray-700">{stat.totalResponses}</p>
                          <p className="text-xs text-gray-500">Total Responses</p>
                        </div>
                        
                        {stat.errorRate > 0 && (
                          <div className="text-center">
                            <div className="flex items-center space-x-1">
                              <AlertTriangle size={14} className="text-red-500" />
                              <p className="text-sm font-medium text-red-600">{(stat.errorRate * 100).toFixed(1)}%</p>
                            </div>
                            <p className="text-xs text-gray-500">Error Rate</p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            index === 0 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                            index === 1 ? 'bg-gradient-to-r from-gray-400 to-gray-600' :
                            index === 2 ? 'bg-gradient-to-r from-amber-400 to-amber-600' :
                            'bg-gradient-to-r from-blue-400 to-blue-600'
                          }`}
                          style={{ width: `${stat.selectionRate}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Clear Data Button */}
            <div className="pt-4 border-t border-gray-200">
              <button
                onClick={handleClearAnalytics}
                className="text-sm text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
              >
                Clear Analytics Data
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
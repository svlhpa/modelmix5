import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { ProviderStats } from '../types';

const { width } = Dimensions.get('window');

export default function AnalyticsScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<ProviderStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadAnalytics();
      } else {
        router.replace('/auth');
      }
    });
  }, []);

  const loadAnalytics = async () => {
    try {
      const { data, error } = await supabase
        .from('provider_analytics')
        .select('*')
        .order('selection_rate', { ascending: false });

      if (error) throw error;

      const analyticsData = data.map(analytics => ({
        provider: analytics.provider,
        totalSelections: analytics.total_selections,
        totalResponses: analytics.total_responses,
        selectionRate: analytics.selection_rate,
        avgResponseTime: 0,
        errorRate: analytics.total_responses > 0 ? (analytics.error_count / analytics.total_responses) * 100 : 0,
        lastUsed: new Date(analytics.last_used),
      }));

      setStats(analyticsData);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'openai':
      case 'openai gpt-4o':
        return 'logo-openai';
      case 'open router':
      case 'openrouter':
        return 'shuffle-outline';
      case 'gemini':
      case 'google gemini':
        return 'diamond-outline';
      case 'deepseek':
      case 'deepseek chat':
        return 'search-outline';
      default:
        return 'chatbubble-outline';
    }
  };

  const getProviderColor = (index: number) => {
    const colors = ['#059669', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];
    return colors[index % colors.length];
  };

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return 'trophy';
      case 1:
        return 'medal';
      case 2:
        return 'ribbon';
      default:
        return 'star-outline';
    }
  };

  const totalConversations = stats.reduce((total, stat) => Math.max(total, stat.totalResponses), 0);
  const topPerformer = stats.length > 0 ? stats[0] : null;

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#059669', '#047857']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerButton}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Analytics</Text>

          <View style={styles.headerButton} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.loadingState}>
            <Ionicons name="analytics-outline" size={64} color="#d1d5db" />
            <Text style={styles.loadingText}>Loading analytics...</Text>
          </View>
        ) : stats.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="bar-chart-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyStateTitle}>No Data Yet</Text>
            <Text style={styles.emptyStateText}>
              Start conversations and select responses to see analytics
            </Text>
          </View>
        ) : (
          <>
            {/* Summary Cards */}
            <View style={styles.summaryContainer}>
              <View style={styles.summaryCard}>
                <LinearGradient
                  colors={['#3b82f6', '#1d4ed8']}
                  style={styles.summaryGradient}
                >
                  <Ionicons name="chatbubbles" size={24} color="white" />
                  <Text style={styles.summaryValue}>{totalConversations}</Text>
                  <Text style={styles.summaryLabel}>Total Conversations</Text>
                </LinearGradient>
              </View>

              <View style={styles.summaryCard}>
                <LinearGradient
                  colors={['#059669', '#047857']}
                  style={styles.summaryGradient}
                >
                  <Ionicons name="trophy" size={24} color="white" />
                  <Text style={styles.summaryValue}>
                    {topPerformer ? `${topPerformer.selectionRate.toFixed(1)}%` : 'N/A'}
                  </Text>
                  <Text style={styles.summaryLabel}>Top Performer</Text>
                </LinearGradient>
              </View>

              <View style={styles.summaryCard}>
                <LinearGradient
                  colors={['#8b5cf6', '#7c3aed']}
                  style={styles.summaryGradient}
                >
                  <Ionicons name="pulse" size={24} color="white" />
                  <Text style={styles.summaryValue}>{stats.length}</Text>
                  <Text style={styles.summaryLabel}>Active Models</Text>
                </LinearGradient>
              </View>
            </View>

            {/* Provider Rankings */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Provider Performance</Text>
              
              {stats.map((stat, index) => (
                <View key={stat.provider} style={styles.providerCard}>
                  <View style={styles.providerHeader}>
                    <View style={styles.providerInfo}>
                      <View style={[styles.rankBadge, { backgroundColor: getProviderColor(index) }]}>
                        <Ionicons
                          name={getRankIcon(index)}
                          size={16}
                          color="white"
                        />
                      </View>
                      
                      <View style={styles.providerIcon}>
                        <Ionicons
                          name={getProviderIcon(stat.provider) as any}
                          size={24}
                          color={getProviderColor(index)}
                        />
                      </View>
                      
                      <View style={styles.providerDetails}>
                        <Text style={styles.providerName}>{stat.provider}</Text>
                        <Text style={styles.providerSubtext}>
                          {stat.totalSelections} selections • {stat.totalResponses} responses
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.performanceScore}>
                      <Text style={[styles.scoreValue, { color: getProviderColor(index) }]}>
                        {stat.selectionRate.toFixed(1)}%
                      </Text>
                      <Text style={styles.scoreLabel}>Selection Rate</Text>
                    </View>
                  </View>
                  
                  {/* Progress Bar */}
                  <View style={styles.progressContainer}>
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressBar,
                          {
                            width: `${stat.selectionRate}%`,
                            backgroundColor: getProviderColor(index),
                          },
                        ]}
                      />
                    </View>
                  </View>
                  
                  {/* Stats Row */}
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{stat.totalResponses}</Text>
                      <Text style={styles.statLabel}>Responses</Text>
                    </View>
                    
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{stat.totalSelections}</Text>
                      <Text style={styles.statLabel}>Selected</Text>
                    </View>
                    
                    {stat.errorRate > 0 && (
                      <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: '#ef4444' }]}>
                          {stat.errorRate.toFixed(1)}%
                        </Text>
                        <Text style={styles.statLabel}>Error Rate</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>

            {/* Insights */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Insights</Text>
              <View style={styles.insightCard}>
                <Ionicons name="bulb" size={24} color="#f59e0b" />
                <View style={styles.insightContent}>
                  <Text style={styles.insightTitle}>Performance Insights</Text>
                  <Text style={styles.insightText}>
                    {topPerformer
                      ? `${topPerformer.provider} is your top-performing AI model with a ${topPerformer.selectionRate.toFixed(1)}% selection rate.`
                      : 'Start using different AI models to see performance insights.'}
                  </Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    padding: 8,
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  summaryContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryGradient: {
    padding: 16,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  providerCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  providerIcon: {
    marginRight: 12,
  },
  providerDetails: {
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  providerSubtext: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  performanceScore: {
    alignItems: 'flex-end',
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scoreLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  statLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  insightContent: {
    marginLeft: 12,
    flex: 1,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  insightText: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 18,
  },
});
import { ConversationTurn, ProviderStats } from '../types';
import { databaseService } from './databaseService';

class AnalyticsService {
  async saveConversationTurn(sessionId: string, turn: ConversationTurn) {
    try {
      await databaseService.saveConversationTurn(sessionId, turn);
    } catch (error) {
      console.error('Failed to save conversation turn to database:', error);
      // Fallback to localStorage for backwards compatibility
      this.saveToLocalStorage(turn);
    }
  }

  private saveToLocalStorage(turn: ConversationTurn) {
    const STORAGE_KEY = 'ai-chatbot-analytics';
    const analytics = this.loadFromLocalStorage();
    
    // Update provider stats
    turn.responses.forEach(response => {
      const providerKey = response.provider.toLowerCase().replace(' ', '_');
      
      if (!analytics[providerKey]) {
        analytics[providerKey] = {
          provider: response.provider,
          totalSelections: 0,
          totalResponses: 0,
          selectionRate: 0,
          avgResponseTime: 0,
          errorRate: 0,
          lastUsed: new Date()
        };
      }

      const stats = analytics[providerKey];
      stats.totalResponses++;
      stats.lastUsed = turn.timestamp;

      if (response.selected) {
        stats.totalSelections++;
      }

      if (response.error) {
        stats.errorRate = ((stats.errorRate * (stats.totalResponses - 1)) + 1) / stats.totalResponses;
      }

      stats.selectionRate = (stats.totalSelections / stats.totalResponses) * 100;
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(analytics));
  }

  private loadFromLocalStorage(): Record<string, ProviderStats> {
    const STORAGE_KEY = 'ai-chatbot-analytics';
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  }

  async getProviderStats(): Promise<ProviderStats[]> {
    try {
      return await databaseService.loadProviderAnalytics();
    } catch (error) {
      console.error('Failed to load analytics from database:', error);
      // Fallback to localStorage
      const analytics = this.loadFromLocalStorage();
      return Object.values(analytics).sort((a, b) => b.selectionRate - a.selectionRate);
    }
  }

  async getTopPerformer(): Promise<ProviderStats | null> {
    const stats = await this.getProviderStats();
    return stats.length > 0 ? stats[0] : null;
  }

  async getTotalConversations(): Promise<number> {
    const stats = await this.getProviderStats();
    return stats.reduce((total, stat) => Math.max(total, stat.totalResponses), 0);
  }

  async clearAnalytics() {
    try {
      await databaseService.clearAnalytics();
    } catch (error) {
      console.error('Failed to clear analytics from database:', error);
    }
    // Also clear localStorage
    localStorage.removeItem('ai-chatbot-analytics');
  }
}

export const analyticsService = new AnalyticsService();
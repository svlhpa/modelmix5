import { supabase } from '../lib/supabase';

interface CreateDebateParams {
  topic: string;
  ai1Model: string;
  ai2Model: string;
  userId: string;
}

interface DebateSession {
  id: string;
  topic: string;
  ai1Model: string;
  ai2Model: string;
  ai1Position: string;
  ai2Position: string;
  status: 'setup' | 'opening' | 'debate' | 'closing' | 'finished' | 'winner_declared';
  currentTurn: 'ai1' | 'ai2';
  messages: any[];
  votes: { ai1: number; ai2: number };
  userVote?: 'ai1' | 'ai2';
  winner?: 'ai1' | 'ai2' | 'tie';
  winnerDeclaredBy?: 'user' | 'votes';
  winnerReason?: string;
  createdAt: Date;
  turnCount: number;
  round?: number;
  isPublic?: boolean;
  shareUrl?: string;
}

interface DebateStats {
  totalDebates: number;
  modelWins: { [model: string]: number };
  topTopics: string[];
  userParticipation: number;
}

class DebateService {
  async createDebate(params: CreateDebateParams): Promise<DebateSession> {
    // Generate opposing positions for the topic
    const positions = this.generatePositions(params.topic);
    
    const debate: DebateSession = {
      id: `debate-${Date.now()}`,
      topic: params.topic,
      ai1Model: params.ai1Model,
      ai2Model: params.ai2Model,
      ai1Position: positions.position1,
      ai2Position: positions.position2,
      status: 'setup',
      currentTurn: 'ai1',
      messages: [],
      votes: { ai1: 0, ai2: 0 },
      createdAt: new Date(),
      turnCount: 0,
      round: 1,
      isPublic: false
    };

    // Save to localStorage for demo purposes
    this.saveDebateToStorage(debate);
    
    return debate;
  }

  async updateDebate(debate: DebateSession): Promise<void> {
    this.saveDebateToStorage(debate);
  }

  async getDebateStats(): Promise<DebateStats> {
    const debates = this.getDebatesFromStorage();
    
    // Calculate real stats from stored debates
    const totalDebates = debates.length;
    const modelWins: { [model: string]: number } = {};
    const topicsSet = new Set<string>();
    let userParticipation = 0;

    debates.forEach(debate => {
      topicsSet.add(debate.topic);
      
      // Count user participation
      const userMessages = debate.messages.filter(msg => msg.speaker === 'user');
      if (userMessages.length > 0) {
        userParticipation++;
      }
      
      // Count wins - only count declared winners
      if (debate.winner && debate.winner !== 'tie' && debate.winnerDeclaredBy === 'user') {
        const winningModel = debate.winner === 'ai1' ? debate.ai1Model : debate.ai2Model;
        modelWins[winningModel] = (modelWins[winningModel] || 0) + 1;
      }
    });

    return {
      totalDebates,
      modelWins,
      topTopics: Array.from(topicsSet).slice(0, 5),
      userParticipation
    };
  }

  async getPublicDebate(shareId: string): Promise<DebateSession | null> {
    const debates = this.getDebatesFromStorage();
    return debates.find(debate => 
      debate.isPublic && 
      debate.shareUrl?.includes(shareId)
    ) || null;
  }

  async getDebateHistory(): Promise<DebateSession[]> {
    return this.getDebatesFromStorage()
      .filter(debate => debate.status === 'winner_declared')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10); // Return last 10 completed debates
  }

  private generatePositions(topic: string): { position1: string; position2: string } {
    // More sophisticated position generation
    const topicLower = topic.toLowerCase();
    
    if (topicLower.includes('should we') || topicLower.includes('should')) {
      return {
        position1: "Pro - Supporting this proposal",
        position2: "Con - Opposing this proposal"
      };
    } else if (topicLower.includes('is') && topicLower.includes('?')) {
      return {
        position1: "Pro - Arguing YES",
        position2: "Con - Arguing NO"
      };
    } else if (topicLower.includes('better') || topicLower.includes('vs')) {
      const parts = topic.split(/\s+(?:better than|vs\.?|versus)\s+/i);
      if (parts.length === 2) {
        return {
          position1: `Pro - Supporting ${parts[0].trim()}`,
          position2: `Con - Supporting ${parts[1].trim()}`
        };
      }
    }
    
    // Default positions
    return {
      position1: "Pro - Supporting the affirmative",
      position2: "Con - Opposing the affirmative"
    };
  }

  private saveDebateToStorage(debate: DebateSession): void {
    const debates = this.getDebatesFromStorage();
    const existingIndex = debates.findIndex(d => d.id === debate.id);
    
    if (existingIndex >= 0) {
      debates[existingIndex] = debate;
    } else {
      debates.push(debate);
    }
    
    // Keep only last 100 debates to prevent storage bloat
    if (debates.length > 100) {
      debates.splice(0, debates.length - 100);
    }
    
    localStorage.setItem('ai-debates', JSON.stringify(debates));
  }

  private getDebatesFromStorage(): DebateSession[] {
    try {
      const stored = localStorage.getItem('ai-debates');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load debates from storage:', error);
      return [];
    }
  }
}

export const debateService = new DebateService();
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
  status: 'setup' | 'opening' | 'debate' | 'closing' | 'finished';
  currentTurn: 'ai1' | 'ai2';
  messages: any[];
  votes: { ai1: number; ai2: number };
  userVote?: 'ai1' | 'ai2';
  winner?: 'ai1' | 'ai2' | 'tie';
  createdAt: Date;
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
      createdAt: new Date()
    };

    // In a real implementation, you would save this to the database
    // For now, we'll store it in localStorage for demo purposes
    this.saveDebateToStorage(debate);
    
    return debate;
  }

  async updateDebate(debate: DebateSession): Promise<void> {
    this.saveDebateToStorage(debate);
  }

  async getDebateStats(): Promise<DebateStats> {
    // In a real implementation, this would query the database
    // For demo purposes, return mock data
    return {
      totalDebates: 42,
      modelWins: {
        'openai': 15,
        'gemini': 12,
        'deepseek': 10,
        'claude': 5
      },
      topTopics: [
        "Is AI a threat to humanity?",
        "Should we colonize Mars?",
        "Is remote work better?",
        "Should we ban social media?",
        "Is cryptocurrency the future?"
      ],
      userParticipation: 128
    };
  }

  private generatePositions(topic: string): { position1: string; position2: string } {
    // Simple position generation based on topic keywords
    const isQuestion = topic.includes('?');
    
    if (isQuestion) {
      return {
        position1: "Pro - Supporting the affirmative",
        position2: "Con - Opposing the affirmative"
      };
    } else {
      return {
        position1: "Pro - Supporting this position",
        position2: "Con - Challenging this position"
      };
    }
  }

  private saveDebateToStorage(debate: DebateSession): void {
    const debates = this.getDebatesFromStorage();
    const existingIndex = debates.findIndex(d => d.id === debate.id);
    
    if (existingIndex >= 0) {
      debates[existingIndex] = debate;
    } else {
      debates.push(debate);
    }
    
    localStorage.setItem('ai-debates', JSON.stringify(debates));
  }

  private getDebatesFromStorage(): DebateSession[] {
    const stored = localStorage.getItem('ai-debates');
    return stored ? JSON.parse(stored) : [];
  }
}

export const debateService = new DebateService();
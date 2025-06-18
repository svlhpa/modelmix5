import { supabase } from '../lib/supabase';
import { Message } from '../types';

interface MemoryEntry {
  id: string;
  user_id: string;
  session_id: string;
  key: string;
  value: string;
  context: string;
  importance: number; // 1-10 scale
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

interface ConversationSummary {
  id: string;
  session_id: string;
  summary: string;
  key_points: string[];
  participants: string[];
  topics: string[];
  created_at: string;
}

class MemoryService {
  // Extract important information from conversations
  async extractMemoryFromMessages(sessionId: string, messages: Message[]): Promise<void> {
    if (messages.length < 2) return; // Need at least user + AI message

    try {
      // Extract key information patterns
      const memories = this.extractKeyInformation(messages);
      
      // Save memories to database
      for (const memory of memories) {
        await this.saveMemory(sessionId, memory);
      }

      // Create conversation summary if session is long enough
      if (messages.length >= 10) {
        await this.createConversationSummary(sessionId, messages);
      }
    } catch (error) {
      console.error('Failed to extract memory:', error);
    }
  }

  private extractKeyInformation(messages: Message[]): Array<{
    key: string;
    value: string;
    context: string;
    importance: number;
  }> {
    const memories: Array<{
      key: string;
      value: string;
      context: string;
      importance: number;
    }> = [];

    // Extract user preferences and information
    messages.forEach((message, index) => {
      if (message.role === 'user') {
        const content = message.content.toLowerCase();
        
        // Extract personal information
        if (content.includes('my name is') || content.includes("i'm ") || content.includes("i am ")) {
          const nameMatch = content.match(/(?:my name is|i'm|i am)\s+([a-zA-Z]+)/);
          if (nameMatch) {
            memories.push({
              key: 'user_name',
              value: nameMatch[1],
              context: `User introduced themselves: "${message.content}"`,
              importance: 9
            });
          }
        }

        // Extract preferences
        if (content.includes('i prefer') || content.includes('i like') || content.includes('i love')) {
          const preferenceMatch = content.match(/i (?:prefer|like|love)\s+(.+?)(?:\.|$|,)/);
          if (preferenceMatch) {
            memories.push({
              key: 'user_preference',
              value: preferenceMatch[1],
              context: `User preference: "${message.content}"`,
              importance: 7
            });
          }
        }

        // Extract goals and objectives
        if (content.includes('i want to') || content.includes('i need to') || content.includes('my goal')) {
          const goalMatch = content.match(/(?:i want to|i need to|my goal is)\s+(.+?)(?:\.|$|,)/);
          if (goalMatch) {
            memories.push({
              key: 'user_goal',
              value: goalMatch[1],
              context: `User goal: "${message.content}"`,
              importance: 8
            });
          }
        }

        // Extract work/profession information
        if (content.includes('i work') || content.includes('i am a') || content.includes('my job')) {
          const workMatch = content.match(/(?:i work as|i am a|my job is)\s+(.+?)(?:\.|$|,)/);
          if (workMatch) {
            memories.push({
              key: 'user_profession',
              value: workMatch[1],
              context: `User profession: "${message.content}"`,
              importance: 8
            });
          }
        }

        // Extract important topics discussed
        const topics = this.extractTopics(message.content);
        topics.forEach(topic => {
          memories.push({
            key: 'discussed_topic',
            value: topic,
            context: `Topic discussed: "${message.content.substring(0, 100)}..."`,
            importance: 5
          });
        });
      }
    });

    return memories;
  }

  private extractTopics(content: string): string[] {
    const topics: string[] = [];
    const topicKeywords = [
      'programming', 'coding', 'development', 'javascript', 'python', 'react', 'ai', 'machine learning',
      'business', 'marketing', 'design', 'writing', 'education', 'health', 'fitness', 'travel',
      'cooking', 'music', 'art', 'science', 'technology', 'finance', 'investment'
    ];

    const contentLower = content.toLowerCase();
    topicKeywords.forEach(keyword => {
      if (contentLower.includes(keyword)) {
        topics.push(keyword);
      }
    });

    return topics;
  }

  private async saveMemory(sessionId: string, memory: {
    key: string;
    value: string;
    context: string;
    importance: number;
  }): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if similar memory already exists
    const { data: existing } = await supabase
      .from('user_memories')
      .select('*')
      .eq('user_id', user.id)
      .eq('key', memory.key)
      .eq('value', memory.value)
      .maybeSingle();

    if (existing) {
      // Update existing memory with new context
      await supabase
        .from('user_memories')
        .update({
          context: memory.context,
          importance: Math.max(existing.importance, memory.importance),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      // Create new memory
      await supabase
        .from('user_memories')
        .insert({
          user_id: user.id,
          session_id: sessionId,
          key: memory.key,
          value: memory.value,
          context: memory.context,
          importance: memory.importance
        });
    }
  }

  private async createConversationSummary(sessionId: string, messages: Message[]): Promise<void> {
    try {
      // Check if summary already exists
      const { data: existing } = await supabase
        .from('conversation_summaries')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (existing) return; // Summary already exists

      // Create summary
      const summary = this.generateSummary(messages);
      const keyPoints = this.extractKeyPoints(messages);
      const topics = this.extractAllTopics(messages);

      await supabase
        .from('conversation_summaries')
        .insert({
          session_id: sessionId,
          summary: summary,
          key_points: keyPoints,
          participants: ['user', 'ai'],
          topics: topics
        });
    } catch (error) {
      console.error('Failed to create conversation summary:', error);
    }
  }

  private generateSummary(messages: Message[]): string {
    const userMessages = messages.filter(m => m.role === 'user');
    const mainTopics = this.extractAllTopics(messages);
    
    if (userMessages.length === 0) return 'No user messages found.';
    
    const firstMessage = userMessages[0].content.substring(0, 100);
    const topicsText = mainTopics.length > 0 ? ` Topics discussed: ${mainTopics.join(', ')}.` : '';
    
    return `Conversation started with: "${firstMessage}...".${topicsText} Total exchanges: ${Math.ceil(messages.length / 2)}.`;
  }

  private extractKeyPoints(messages: Message[]): string[] {
    const keyPoints: string[] = [];
    
    messages.forEach(message => {
      if (message.role === 'user') {
        // Extract questions
        if (message.content.includes('?')) {
          const questions = message.content.split('?').filter(q => q.trim().length > 10);
          questions.forEach(q => keyPoints.push(`Question: ${q.trim()}?`));
        }
        
        // Extract statements of intent
        if (message.content.toLowerCase().includes('i want') || 
            message.content.toLowerCase().includes('i need') ||
            message.content.toLowerCase().includes('help me')) {
          keyPoints.push(`Request: ${message.content.substring(0, 100)}...`);
        }
      }
    });

    return keyPoints.slice(0, 10); // Limit to 10 key points
  }

  private extractAllTopics(messages: Message[]): string[] {
    const allTopics = new Set<string>();
    
    messages.forEach(message => {
      const topics = this.extractTopics(message.content);
      topics.forEach(topic => allTopics.add(topic));
    });

    return Array.from(allTopics);
  }

  // Retrieve relevant memories for context
  async getRelevantMemories(sessionId: string, currentMessage: string): Promise<MemoryEntry[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    try {
      // Get memories from current session
      const { data: sessionMemories } = await supabase
        .from('user_memories')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .order('importance', { ascending: false })
        .limit(5);

      // Get important memories from other sessions
      const { data: globalMemories } = await supabase
        .from('user_memories')
        .select('*')
        .eq('user_id', user.id)
        .neq('session_id', sessionId)
        .gte('importance', 7)
        .order('importance', { ascending: false })
        .limit(10);

      // Combine and filter relevant memories
      const allMemories = [...(sessionMemories || []), ...(globalMemories || [])];
      
      // Filter memories relevant to current message
      const relevantMemories = allMemories.filter(memory => {
        const messageLower = currentMessage.toLowerCase();
        const valueLower = memory.value.toLowerCase();
        const keyLower = memory.key.toLowerCase();
        
        return messageLower.includes(valueLower) || 
               messageLower.includes(keyLower) ||
               this.isContextuallyRelevant(memory, currentMessage);
      });

      return relevantMemories.slice(0, 8); // Limit to most relevant
    } catch (error) {
      console.error('Failed to get relevant memories:', error);
      return [];
    }
  }

  private isContextuallyRelevant(memory: MemoryEntry, currentMessage: string): boolean {
    // Simple contextual relevance check
    const messageWords = currentMessage.toLowerCase().split(' ');
    const memoryWords = memory.value.toLowerCase().split(' ');
    
    // Check for word overlap
    const overlap = messageWords.filter(word => 
      word.length > 3 && memoryWords.some(mWord => mWord.includes(word) || word.includes(mWord))
    );
    
    return overlap.length > 0;
  }

  // Get conversation summary
  async getConversationSummary(sessionId: string): Promise<ConversationSummary | null> {
    try {
      const { data, error } = await supabase
        .from('conversation_summaries')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to get conversation summary:', error);
      return null;
    }
  }

  // Format memories for AI context
  formatMemoriesForContext(memories: MemoryEntry[]): string {
    if (memories.length === 0) return '';

    const memoryGroups = {
      user_info: memories.filter(m => ['user_name', 'user_profession'].includes(m.key)),
      preferences: memories.filter(m => m.key === 'user_preference'),
      goals: memories.filter(m => m.key === 'user_goal'),
      topics: memories.filter(m => m.key === 'discussed_topic')
    };

    let contextString = '\n=== CONVERSATION MEMORY ===\n';

    if (memoryGroups.user_info.length > 0) {
      contextString += '\nUser Information:\n';
      memoryGroups.user_info.forEach(memory => {
        contextString += `- ${memory.key.replace('user_', '').replace('_', ' ')}: ${memory.value}\n`;
      });
    }

    if (memoryGroups.preferences.length > 0) {
      contextString += '\nUser Preferences:\n';
      memoryGroups.preferences.forEach(memory => {
        contextString += `- ${memory.value}\n`;
      });
    }

    if (memoryGroups.goals.length > 0) {
      contextString += '\nUser Goals:\n';
      memoryGroups.goals.forEach(memory => {
        contextString += `- ${memory.value}\n`;
      });
    }

    if (memoryGroups.topics.length > 0) {
      const uniqueTopics = [...new Set(memoryGroups.topics.map(m => m.value))];
      contextString += `\nPreviously Discussed Topics: ${uniqueTopics.join(', ')}\n`;
    }

    contextString += '\n=== END MEMORY ===\n\n';
    contextString += 'Use this information to provide more personalized and contextually relevant responses. Reference past conversations when appropriate.\n\n';

    return contextString;
  }

  // Clean up old memories
  async cleanupOldMemories(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // Delete low importance memories older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      await supabase
        .from('user_memories')
        .delete()
        .eq('user_id', user.id)
        .lt('importance', 5)
        .lt('created_at', thirtyDaysAgo.toISOString());

      // Delete expired memories
      await supabase
        .from('user_memories')
        .delete()
        .eq('user_id', user.id)
        .not('expires_at', 'is', null)
        .lt('expires_at', new Date().toISOString());
    } catch (error) {
      console.error('Failed to cleanup old memories:', error);
    }
  }

  // Get user's memory statistics
  async getMemoryStats(): Promise<{
    totalMemories: number;
    memoriesByType: Record<string, number>;
    averageImportance: number;
  }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { totalMemories: 0, memoriesByType: {}, averageImportance: 0 };

    try {
      const { data: memories } = await supabase
        .from('user_memories')
        .select('key, importance')
        .eq('user_id', user.id);

      if (!memories) return { totalMemories: 0, memoriesByType: {}, averageImportance: 0 };

      const memoriesByType: Record<string, number> = {};
      let totalImportance = 0;

      memories.forEach(memory => {
        memoriesByType[memory.key] = (memoriesByType[memory.key] || 0) + 1;
        totalImportance += memory.importance;
      });

      return {
        totalMemories: memories.length,
        memoriesByType,
        averageImportance: memories.length > 0 ? totalImportance / memories.length : 0
      };
    } catch (error) {
      console.error('Failed to get memory stats:', error);
      return { totalMemories: 0, memoriesByType: {}, averageImportance: 0 };
    }
  }
}

export const memoryService = new MemoryService();
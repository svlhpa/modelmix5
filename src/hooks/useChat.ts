import { useState, useCallback, useEffect } from 'react';
import { Message, APIResponse, ChatSession, ConversationTurn } from '../types';
import { aiService } from '../services/aiService';
import { databaseService } from '../services/databaseService';
import { analyticsService } from '../services/analyticsService';
import { useAuth } from './useAuth';

export const useChat = () => {
  const { user, getCurrentTier } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const currentSession = sessions.find(s => s.id === currentSessionId);

  // Load sessions when user is authenticated
  useEffect(() => {
    if (user && !hasInitialized) {
      loadSessions();
      setHasInitialized(true);
    } else if (!user) {
      setSessions([]);
      setCurrentSessionId(null);
      setHasInitialized(false);
    }
  }, [user, hasInitialized]);

  // Reload current session when switching sessions
  useEffect(() => {
    if (currentSessionId && user) {
      loadSessionMessages(currentSessionId);
    }
  }, [currentSessionId, user]);

  const loadSessions = async () => {
    try {
      const loadedSessions = await databaseService.loadChatSessions();
      setSessions(loadedSessions);
      
      // Auto-select the first session if available
      if (loadedSessions.length > 0) {
        setCurrentSessionId(loadedSessions[0].id);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const loadSessionMessages = async (sessionId: string) => {
    try {
      const messages = await databaseService.loadSessionMessages(sessionId);
      setSessions(prev => prev.map(session => 
        session.id === sessionId 
          ? { ...session, messages }
          : session
      ));
    } catch (error) {
      console.error('Failed to load session messages:', error);
    }
  };

  const createNewSession = useCallback(async () => {
    if (!user) return null;

    try {
      const sessionId = await databaseService.createChatSession('New Chat');
      const newSession: ChatSession = {
        id: sessionId,
        title: 'New Chat',
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(sessionId);
      return sessionId;
    } catch (error) {
      console.error('Failed to create session:', error);
      return null;
    }
  }, [user]);

  // Core message sending function - completely rebuilt
  const sendMessage = useCallback(async (content: string, images: string[] = []): Promise<APIResponse[]> => {
    if (!user) {
      const newSessionId = await createNewSession();
      if (!newSessionId) return [];
    }

    if (!currentSessionId) return [];

    // Get the current session state
    const session = sessions.find(s => s.id === currentSessionId);
    if (!session) return [];

    // Create user message
    const userMessage: Message = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content,
      role: 'user',
      timestamp: new Date(),
      images: images.length > 0 ? images : undefined
    };

    // CRITICAL: Build conversation context from CURRENT session state BEFORE adding new message
    const conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = [];
    
    // Add all existing messages from the session to context
    session.messages.forEach(msg => {
      conversationHistory.push({ 
        role: msg.role, 
        content: msg.content 
      });
    });
    
    // Add the new user message to context
    conversationHistory.push({ role: 'user', content });

    // Update session state with user message immediately
    const updatedSession = {
      ...session,
      messages: [...session.messages, userMessage],
      title: session.messages.length === 0 ? content.slice(0, 30) + (content.length > 30 ? '...' : '') : session.title,
      updatedAt: new Date()
    };

    setSessions(prev => prev.map(s => 
      s.id === currentSessionId ? updatedSession : s
    ));

    // Update session title in database if it's the first message
    if (session.messages.length === 0) {
      try {
        const title = content.slice(0, 30) + (content.length > 30 ? '...' : '');
        await databaseService.updateChatSession(currentSessionId, title);
      } catch (error) {
        console.error('Failed to update session title:', error);
      }
    }

    setIsLoading(true);

    try {
      // Get user's current tier for API key selection
      const userTier = getCurrentTier();

      // Get responses using the complete conversation history
      const responses = await aiService.getResponses(
        content, 
        conversationHistory, // This now includes ALL previous messages + current message
        images, 
        undefined, // onResponseUpdate callback handled in ChatArea
        undefined, // signal handled in ChatArea
        userTier
      );
      
      return responses;
    } catch (error) {
      console.error('Error sending message:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [currentSessionId, createNewSession, user, sessions, getCurrentTier]);

  // Response selection function - rebuilt for proper state management
  const selectResponse = useCallback(async (selectedResponse: APIResponse, userMessage: string, images: string[] = []) => {
    if (!currentSessionId) return;

    // Create the AI response message
    const aiMessage: Message = {
      id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content: selectedResponse.content,
      role: 'assistant',
      timestamp: new Date(),
      provider: selectedResponse.provider
    };

    // Update the session with the AI response
    setSessions(prev => prev.map(session => 
      session.id === currentSessionId
        ? { 
            ...session, 
            messages: [...session.messages, aiMessage],
            updatedAt: new Date()
          }
        : session
    ));

    // Save the conversation turn to database
    const turn: ConversationTurn = {
      id: `turn-${Date.now()}`,
      userMessage,
      responses: [selectedResponse],
      selectedResponse,
      timestamp: new Date(),
      images: images.length > 0 ? images : undefined
    };

    try {
      await databaseService.saveConversationTurn(currentSessionId, turn);
      await analyticsService.saveConversationTurn(currentSessionId, turn);
    } catch (error) {
      console.error('Failed to save conversation turn:', error);
    }
  }, [currentSessionId]);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      await databaseService.deleteChatSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        const remainingSessions = sessions.filter(s => s.id !== sessionId);
        setCurrentSessionId(remainingSessions.length > 0 ? remainingSessions[0].id : null);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  }, [currentSessionId, sessions]);

  const saveConversationTurn = useCallback(async (turn: ConversationTurn) => {
    if (!currentSessionId) return;
    
    try {
      await analyticsService.saveConversationTurn(currentSessionId, turn);
    } catch (error) {
      console.error('Failed to save conversation turn:', error);
    }
  }, [currentSessionId]);

  return {
    sessions,
    currentSession,
    currentSessionId,
    isLoading,
    createNewSession,
    setCurrentSessionId,
    sendMessage,
    selectResponse,
    deleteSession,
    saveConversationTurn
  };
};
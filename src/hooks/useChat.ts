import { useState, useCallback, useEffect } from 'react';
import { Message, APIResponse, ChatSession, ConversationTurn } from '../types';
import { aiService } from '../services/aiService';
import { databaseService } from '../services/databaseService';
import { analyticsService } from '../services/analyticsService';
import { memoryService } from '../services/memoryService';
import { useAuth } from './useAuth';

export const useChat = () => {
  const { user, getCurrentTier } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId);

  // Initialize sessions when user is authenticated
  useEffect(() => {
    if (user && !hasInitialized) {
      loadSessions();
      setHasInitialized(true);
    } else if (!user) {
      // Clear everything when user logs out
      setSessions([]);
      setCurrentSessionId(null);
      setHasInitialized(false);
      setLoadingSessionId(null);
    }
  }, [user, hasInitialized]);

  // Load session messages when switching sessions
  useEffect(() => {
    if (currentSessionId && user && currentSessionId !== loadingSessionId) {
      loadSessionMessages(currentSessionId);
    }
  }, [currentSessionId, user, loadingSessionId]);

  const loadSessions = async () => {
    try {
      const loadedSessions = await databaseService.loadChatSessions();
      setSessions(loadedSessions);
      
      // Auto-select the first session if available and no session is currently selected
      if (loadedSessions.length > 0 && !currentSessionId) {
        setCurrentSessionId(loadedSessions[0].id);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const loadSessionMessages = async (sessionId: string) => {
    // Prevent loading the same session multiple times
    if (loadingSessionId === sessionId) {
      return;
    }

    setLoadingSessionId(sessionId);
    
    try {
      const messages = await databaseService.loadSessionMessages(sessionId);
      
      // Only update if this is still the current session
      if (sessionId === currentSessionId) {
        setSessions(prev => prev.map(session => 
          session.id === sessionId 
            ? { ...session, messages }
            : session
        ));

        // Extract memory from loaded messages
        if (messages.length > 0) {
          await memoryService.extractMemoryFromMessages(sessionId, messages);
        }
      }
    } catch (error) {
      console.error('Failed to load session messages:', error);
    } finally {
      setLoadingSessionId(null);
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

  const sendMessage = useCallback(async (content: string, images: string[] = [], useInternetSearch: boolean = false): Promise<APIResponse[]> => {
    if (!user) {
      const newSessionId = await createNewSession();
      if (!newSessionId) return [];
    }

    if (!currentSessionId) return [];

    // Get the current session state
    const session = sessions.find(s => s.id === currentSessionId);
    if (!session) return [];

    // Build conversation context from current session state
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

    // Update session title in database if it's the first message
    if (session.messages.length === 0) {
      try {
        const title = content.slice(0, 30) + (content.length > 30 ? '...' : '');
        await databaseService.updateChatSession(currentSessionId, title);
        
        // Update local session title
        setSessions(prev => prev.map(s => 
          s.id === currentSessionId 
            ? { ...s, title }
            : s
        ));
      } catch (error) {
        console.error('Failed to update session title:', error);
      }
    }

    setIsLoading(true);

    try {
      // Get user's current tier for API key selection
      const userTier = getCurrentTier();

      // Get responses from AI service with memory integration
      const responses = await aiService.getResponses(
        content, 
        conversationHistory,
        images, 
        undefined, // onResponseUpdate callback handled in ChatArea
        undefined, // signal handled in ChatArea
        userTier,
        useInternetSearch,
        currentSessionId // Pass session ID for memory context
      );
      
      return responses;
    } catch (error) {
      console.error('Error sending message:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [currentSessionId, createNewSession, user, sessions, getCurrentTier]);

  const selectResponse = useCallback(async (selectedResponse: APIResponse, userMessage: string, images: string[] = []) => {
    if (!currentSessionId) return;

    // Create the user message
    const userMessageObj: Message = {
      id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content: userMessage,
      role: 'user',
      timestamp: new Date(),
      images: images.length > 0 ? images : undefined,
    };

    // Create the AI response message
    const aiMessage: Message = {
      id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content: selectedResponse.content,
      role: 'assistant',
      timestamp: new Date(),
      provider: selectedResponse.provider,
    };

    // Add both messages to the session at once
    setSessions(prev => prev.map(session => 
      session.id === currentSessionId
        ? { 
            ...session, 
            messages: [...session.messages, userMessageObj, aiMessage],
            title: session.messages.length === 0 ? userMessage.slice(0, 30) + (userMessage.length > 30 ? '...' : '') : session.title,
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

      // Extract memory from the new conversation turn
      const newMessages = [userMessageObj, aiMessage];
      await memoryService.extractMemoryFromMessages(currentSessionId, newMessages);
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

  // Safe session switching that prevents race conditions
  const switchToSession = useCallback((sessionId: string) => {
    if (sessionId !== currentSessionId && sessionId !== loadingSessionId) {
      setCurrentSessionId(sessionId);
    }
  }, [currentSessionId, loadingSessionId]);

  return {
    sessions,
    currentSession,
    currentSessionId,
    isLoading,
    createNewSession,
    setCurrentSessionId: switchToSession,
    sendMessage,
    selectResponse,
    deleteSession,
    saveConversationTurn
  };
};
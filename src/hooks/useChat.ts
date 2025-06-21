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

  // CRITICAL: Load session messages only when session changes and prevent duplicates
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

  // CRITICAL: Completely rebuilt message loading to prevent duplicates
  const loadSessionMessages = async (sessionId: string) => {
    try {
      const messages = await databaseService.loadSessionMessages(sessionId);
      
      // CRITICAL: Replace messages completely and only for the specific session
      setSessions(prev => prev.map(session => 
        session.id === sessionId 
          ? { ...session, messages } // Replace with fresh messages from database
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
        messages: [], // Start with empty messages
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

  // CRITICAL: Simplified sendMessage - only returns responses, doesn't modify session
  const sendMessage = useCallback(async (content: string, images: string[] = [], useInternetSearch: boolean = false, fileContext?: string): Promise<APIResponse[]> => {
    if (!user) {
      const newSessionId = await createNewSession();
      if (!newSessionId) return [];
    }

    if (!currentSessionId) return [];

    // Get the current session state
    const session = sessions.find(s => s.id === currentSessionId);
    if (!session) return [];

    // CRITICAL: Build conversation context from CURRENT session state
    const conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = [];
    
    // Add all existing messages from the session to context
    session.messages.forEach(msg => {
      conversationHistory.push({ 
        role: msg.role, 
        content: msg.content 
      });
    });
    
    // Add the new user message with file context to context
    let messageWithContext = content;
    if (fileContext) {
      messageWithContext += fileContext;
    }
    conversationHistory.push({ role: 'user', content: messageWithContext });

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

      // CRITICAL: Just return the responses - don't modify session state here
      // The ChatArea component will handle the real-time updates
      const responses = await aiService.getResponses(
        content, 
        conversationHistory,
        images, 
        undefined, // onResponseUpdate callback handled in ChatArea
        undefined, // signal handled in ChatArea
        userTier,
        useInternetSearch
      );
      
      return responses;
    } catch (error) {
      console.error('Error sending message:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [currentSessionId, createNewSession, user, sessions, getCurrentTier]);

  // CRITICAL: Response selection function - this is where we add messages to the session
  const selectResponse = useCallback(async (selectedResponse: APIResponse, userMessage: string, images: string[] = [], fileContext?: string) => {
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
      generatedImages: selectedResponse.generatedImages,
      isImageGeneration: selectedResponse.isImageGeneration,
    };

    // CRITICAL: Add BOTH messages to the session at once
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

    // CRITICAL: Save the conversation turn to database with ALL responses for proper analytics
    const turn: ConversationTurn = {
      id: `turn-${Date.now()}`,
      userMessage,
      responses: [], // This will be populated by the ChatArea component
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

  // CRITICAL: Updated to save conversation turn with ALL responses for analytics
  const saveConversationTurn = useCallback(async (turn: ConversationTurn) => {
    if (!currentSessionId) return;
    
    try {
      await databaseService.saveConversationTurn(currentSessionId, turn);
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
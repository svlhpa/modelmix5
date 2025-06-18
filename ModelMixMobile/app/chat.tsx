import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { ChatSession, Message, APIResponse } from '../types';

const { width } = Dimensions.get('window');

export default function ChatScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [responses, setResponses] = useState<APIResponse[]>([]);
  const [showResponses, setShowResponses] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Check authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadSessions();
      } else {
        router.replace('/auth');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        loadSessions();
      } else {
        router.replace('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const sessionsData = data.map(session => ({
        id: session.id,
        title: session.title,
        messages: [],
        createdAt: new Date(session.created_at),
        updatedAt: new Date(session.updated_at),
      }));

      setSessions(sessionsData);
      
      if (sessionsData.length > 0) {
        setCurrentSession(sessionsData[0]);
        loadMessages(sessionsData[0].id);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  const loadMessages = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('conversation_turns')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const messages: Message[] = [];
      data.forEach((turn) => {
        messages.push({
          id: `user-${turn.id}`,
          content: turn.user_message,
          role: 'user',
          timestamp: new Date(turn.created_at),
          images: turn.user_images ? JSON.parse(turn.user_images) : undefined,
        });

        if (turn.selected_response && turn.selected_provider) {
          messages.push({
            id: `ai-${turn.id}`,
            content: turn.selected_response,
            role: 'assistant',
            timestamp: new Date(turn.created_at),
            provider: turn.selected_provider,
          });
        }
      });

      setCurrentSession(prev => prev ? { ...prev, messages } : null);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const createNewSession = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          title: 'New Chat',
        })
        .select()
        .single();

      if (error) throw error;

      const newSession: ChatSession = {
        id: data.id,
        title: data.title,
        messages: [],
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };

      setSessions(prev => [newSession, ...prev]);
      setCurrentSession(newSession);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Error creating session:', error);
      Alert.alert('Error', 'Failed to create new chat session');
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !currentSession || loading) return;

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Simulate AI responses (in a real app, you'd call your AI service)
      const mockResponses: APIResponse[] = [
        {
          provider: 'OpenAI GPT-4o',
          content: `This is a mock response from OpenAI for: "${message}"`,
          loading: false,
        },
        {
          provider: 'Google Gemini',
          content: `This is a mock response from Gemini for: "${message}"`,
          loading: false,
        },
        {
          provider: 'DeepSeek Chat',
          content: `This is a mock response from DeepSeek for: "${message}"`,
          loading: false,
        },
      ];

      setResponses(mockResponses);
      setShowResponses(true);
      setMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const selectResponse = async (selectedResponse: APIResponse) => {
    if (!currentSession) return;

    try {
      // Save conversation turn
      const { error } = await supabase
        .from('conversation_turns')
        .insert({
          session_id: currentSession.id,
          user_message: message,
          selected_provider: selectedResponse.provider,
          selected_response: selectedResponse.content,
        });

      if (error) throw error;

      // Add messages to current session
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        content: message,
        role: 'user',
        timestamp: new Date(),
      };

      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        content: selectedResponse.content,
        role: 'assistant',
        timestamp: new Date(),
        provider: selectedResponse.provider,
      };

      setCurrentSession(prev => prev ? {
        ...prev,
        messages: [...prev.messages, userMessage, aiMessage]
      } : null);

      setShowResponses(false);
      setResponses([]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error selecting response:', error);
      Alert.alert('Error', 'Failed to save response');
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      // Handle image upload
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

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
            onPress={() => router.push('/')}
            style={styles.headerButton}
          >
            <Ionicons name="home-outline" size={24} color="white" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>
              {currentSession?.title || 'ModelMix'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {currentSession?.messages.length ? 
                `${Math.ceil(currentSession.messages.length / 2)} conversations` : 
                'Start a new conversation'
              }
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={createNewSession}
              style={styles.headerButton}
            >
              <Ionicons name="add" size={24} color="white" />
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => router.push('/settings')}
              style={styles.headerButton}
            >
              <Ionicons name="settings-outline" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Messages */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.chatContainer}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {currentSession?.messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={64} color="#d1d5db" />
              <Text style={styles.emptyStateTitle}>Start a Conversation</Text>
              <Text style={styles.emptyStateText}>
                Ask a question and compare AI responses from multiple models
              </Text>
            </View>
          ) : (
            currentSession?.messages.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.messageContainer,
                  msg.role === 'user' ? styles.userMessage : styles.aiMessage,
                ]}
              >
                <View
                  style={[
                    styles.messageBubble,
                    msg.role === 'user' ? styles.userBubble : styles.aiBubble,
                  ]}
                >
                  {msg.provider && (
                    <Text style={styles.providerText}>{msg.provider}</Text>
                  )}
                  <Text
                    style={[
                      styles.messageText,
                      msg.role === 'user' ? styles.userText : styles.aiText,
                    ]}
                  >
                    {msg.content}
                  </Text>
                  <Text
                    style={[
                      styles.timestampText,
                      msg.role === 'user' ? styles.userTimestamp : styles.aiTimestamp,
                    ]}
                  >
                    {msg.timestamp.toLocaleTimeString()}
                  </Text>
                </View>
              </View>
            ))
          )}

          {/* Response Selection */}
          {showResponses && (
            <View style={styles.responsesContainer}>
              <Text style={styles.responsesTitle}>Choose the best response:</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.responsesScroll}
              >
                {responses.map((response, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.responseCard}
                    onPress={() => selectResponse(response)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.responseProvider}>{response.provider}</Text>
                    <Text style={styles.responseContent} numberOfLines={4}>
                      {response.content}
                    </Text>
                    <View style={styles.responseFooter}>
                      <Text style={styles.selectText}>Tap to select</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TouchableOpacity
              onPress={pickImage}
              style={styles.attachButton}
              disabled={loading}
            >
              <Ionicons name="attach" size={20} color="#6b7280" />
            </TouchableOpacity>

            <TextInput
              style={styles.textInput}
              placeholder="Ask anything..."
              placeholderTextColor="#9ca3af"
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={1000}
              editable={!loading && !showResponses}
            />

            <TouchableOpacity
              onPress={sendMessage}
              style={[
                styles.sendButton,
                (!message.trim() || loading || showResponses) && styles.sendButtonDisabled,
              ]}
              disabled={!message.trim() || loading || showResponses}
            >
              <LinearGradient
                colors={['#059669', '#047857']}
                style={styles.sendButtonGradient}
              >
                {loading ? (
                  <Ionicons name="hourglass-outline" size={20} color="white" />
                ) : (
                  <Ionicons name="send" size={20} color="white" />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
  },
  chatContainer: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 100,
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
  messageContainer: {
    marginBottom: 16,
  },
  userMessage: {
    alignItems: 'flex-end',
  },
  aiMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#059669',
  },
  aiBubble: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  providerText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: 'white',
  },
  aiText: {
    color: '#374151',
  },
  timestampText: {
    fontSize: 11,
    marginTop: 4,
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  aiTimestamp: {
    color: '#9ca3af',
  },
  responsesContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  responsesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 12,
  },
  responsesScroll: {
    paddingRight: 16,
  },
  responseCard: {
    width: width * 0.7,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  responseProvider: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 8,
  },
  responseContent: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    flex: 1,
  },
  responseFooter: {
    marginTop: 12,
    alignItems: 'center',
  },
  selectText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  inputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  attachButton: {
    padding: 8,
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    marginLeft: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonGradient: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
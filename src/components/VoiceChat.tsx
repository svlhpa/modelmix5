import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, MicOff, Volume2, VolumeX, Settings, Play, Pause, Save, Trash2, RefreshCw, CheckCircle, AlertCircle, Loader2, Crown, Sliders, Headphones, Wand2, MessageCircle, Send, User, Bot } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { elevenLabsService, ElevenLabsVoice, TTSRequest } from '../services/elevenLabsService';
import { whisperService } from '../services/whisperService';
import { VoiceChatSettings } from '../types';

interface VoiceChatProps {
  isOpen: boolean;
  onClose: () => void;
}

interface VoiceChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  audioUrl?: string;
}

export const VoiceChat: React.FC<VoiceChatProps> = ({ isOpen, onClose }) => {
  const { user, getCurrentTier } = useAuth();
  const [activeTab, setActiveTab] = useState<'chat' | 'settings'>('chat');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<VoiceChatMessage[]>([]);
  const [availableVoices, setAvailableVoices] = useState<ElevenLabsVoice[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [isTTSAvailable, setIsTTSAvailable] = useState(false);
  const [isSTTAvailable, setIsSTTAvailable] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Voice chat settings
  const [settings, setSettings] = useState<VoiceChatSettings>({
    voiceId: 'pNInz6obpgDQGcFmaJgB', // Default voice (Adam)
    voiceName: 'Adam',
    rolePlayPrompt: 'You are a helpful AI assistant named Adam. You speak in a friendly, conversational manner and keep responses concise.',
    autoPlayTTS: true,
    sttLanguage: 'en',
    voiceStability: 0.5,
    voiceSimilarity: 0.75,
    voiceStyle: 0,
    useSpeakerBoost: true
  });

  const currentTier = getCurrentTier();
  const isProUser = currentTier === 'tier2';

  // Check if services are available
  useEffect(() => {
    if (isOpen) {
      checkServiceAvailability();
      loadVoices();
    } else {
      // Clean up audio when modal closes
      if (currentAudio) {
        currentAudio.pause();
        setCurrentAudio(null);
      }
      
      // Clean up any ongoing recording
      if (mediaRecorder && isRecording) {
        stopRecording();
      }
    }
  }, [isOpen]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const checkServiceAvailability = async () => {
    try {
      const [ttsAvailable, sttAvailable] = await Promise.all([
        elevenLabsService.isAvailable(currentTier),
        whisperService.isAvailable(currentTier)
      ]);
      
      setIsTTSAvailable(ttsAvailable);
      setIsSTTAvailable(sttAvailable);
      
      if (!ttsAvailable && !sttAvailable) {
        setError('Voice services are not available. Please configure API keys in settings or contact support.');
      } else if (!ttsAvailable) {
        setError('Text-to-speech is not available. Please configure Eleven Labs API key in settings.');
      } else if (!sttAvailable) {
        setError('Speech-to-text is not available. Please configure OpenAI API key in settings.');
      } else {
        setError(null);
      }
    } catch (error) {
      console.error('Failed to check service availability:', error);
      setError('Failed to check voice service availability. Please try again.');
    }
  };

  const loadVoices = async () => {
    setIsLoadingVoices(true);
    try {
      // Try to load voices from API
      const voices = await elevenLabsService.getVoices(currentTier);
      setAvailableVoices(voices);
      
      // If no voices found, use default voices
      if (!voices || voices.length === 0) {
        const defaultVoices = elevenLabsService.getDefaultVoices().map(v => ({
          voice_id: v.id,
          name: v.name,
          category: 'default'
        }));
        setAvailableVoices(defaultVoices);
      }
    } catch (error) {
      console.error('Failed to load voices:', error);
      // Fall back to default voices
      const defaultVoices = elevenLabsService.getDefaultVoices().map(v => ({
        voice_id: v.id,
        name: v.name,
        category: 'default'
      }));
      setAvailableVoices(defaultVoices);
    } finally {
      setIsLoadingVoices(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        setAudioChunks(chunks);
        
        // Process the recording
        await processRecording(audioBlob);
      };
      
      recorder.start();
      setIsRecording(true);
      setMediaRecorder(recorder);
      setError(null);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setError('Failed to access microphone. Please check your browser permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      
      // Stop all audio tracks
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  };

  const processRecording = async (audioBlob: Blob) => {
    setIsProcessing(true);
    try {
      // Transcribe audio
      const text = await whisperService.transcribeAudio(audioBlob, settings.sttLanguage, currentTier);
      setTranscript(text);
      
      if (text.trim()) {
        // Add user message
        const userMessage: VoiceChatMessage = {
          id: `user-${Date.now()}`,
          role: 'user',
          content: text,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, userMessage]);
        
        // Generate AI response
        await generateAIResponse(text);
      }
    } catch (error) {
      console.error('Failed to process recording:', error);
      setError(error instanceof Error ? error.message : 'Failed to process recording');
    } finally {
      setIsProcessing(false);
    }
  };

  const generateAIResponse = async (userMessage: string) => {
    setIsProcessing(true);
    try {
      // Simulate AI response (in a real app, you'd call your AI service)
      const aiResponseText = await simulateAIResponse(userMessage, settings.rolePlayPrompt);
      
      // Generate speech for AI response
      const ttsRequest: TTSRequest = {
        text: aiResponseText,
        voice_id: settings.voiceId,
        voice_settings: {
          stability: settings.voiceStability,
          similarity_boost: settings.voiceSimilarity,
          style: settings.voiceStyle,
          use_speaker_boost: settings.useSpeakerBoost
        }
      };
      
      const audioBlob = await elevenLabsService.textToSpeech(ttsRequest, currentTier);
      const audioUrl = elevenLabsService.createAudioUrl(audioBlob);
      
      // Add AI message with audio
      const aiMessage: VoiceChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: aiResponseText,
        timestamp: new Date(),
        audioUrl
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
      // Auto-play if enabled
      if (settings.autoPlayTTS) {
        playAudio(audioUrl);
      }
    } catch (error) {
      console.error('Failed to generate AI response:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate AI response');
    } finally {
      setIsProcessing(false);
    }
  };

  const playAudio = (url: string) => {
    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    
    // Create and play new audio
    const audio = new Audio(url);
    audio.onplay = () => setIsPlaying(true);
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => {
      setIsPlaying(false);
      setError('Failed to play audio');
    };
    
    audio.play();
    setCurrentAudio(audio);
  };

  const stopAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const handleVoiceChange = (voiceId: string) => {
    const selectedVoice = availableVoices.find(v => v.voice_id === voiceId);
    if (selectedVoice) {
      setSettings({
        ...settings,
        voiceId,
        voiceName: selectedVoice.name
      });
    }
  };

  const clearConversation = () => {
    if (confirm('Are you sure you want to clear the conversation?')) {
      setMessages([]);
      // Clean up audio URLs
      messages.forEach(msg => {
        if (msg.audioUrl) {
          elevenLabsService.revokeAudioUrl(msg.audioUrl);
        }
      });
    }
  };

  const simulateAIResponse = async (userMessage: string, rolePlayPrompt: string): Promise<string> => {
    // In a real implementation, you would call your AI service here
    // For now, we'll simulate a response based on the user message and role play prompt
    
    // Wait a bit to simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simple response generation based on user message
    if (userMessage.toLowerCase().includes('hello') || userMessage.toLowerCase().includes('hi')) {
      return "Hello there! How can I assist you today?";
    } else if (userMessage.toLowerCase().includes('how are you')) {
      return "I'm doing well, thank you for asking! How about you?";
    } else if (userMessage.toLowerCase().includes('weather')) {
      return "I don't have real-time weather data, but I'd be happy to chat about other topics!";
    } else if (userMessage.toLowerCase().includes('name')) {
      return `My name is ${settings.voiceName}. I'm an AI assistant powered by Eleven Labs voice technology.`;
    } else if (userMessage.toLowerCase().includes('voice')) {
      return `I'm currently using the ${settings.voiceName} voice from Eleven Labs. Do you like how it sounds?`;
    } else if (userMessage.toLowerCase().includes('help')) {
      return "I'm here to help! You can ask me questions, have a conversation, or just chat about whatever's on your mind.";
    } else {
      return `Thanks for your message. I'm here to assist you with any questions or topics you'd like to discuss. What would you like to talk about next?`;
    }
  };

  if (!isOpen) return null;

  // Pro-only check
  if (!isProUser) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
        <div className="bg-white rounded-xl max-w-md w-full p-6 text-center transform animate-slideUp">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Crown size={32} className="text-yellow-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Pro Feature</h2>
          <p className="text-gray-600 mb-6">
            Voice Chat is available exclusively to Pro tier users. Upgrade to Pro to access real-time voice conversations with AI.
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-xl max-w-4xl w-full h-[90vh] flex flex-col overflow-hidden transform animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg animate-bounceIn">
                <Volume2 size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Voice Chat</h2>
                <p className="text-purple-100">Real-time voice conversations with AI</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/20 transition-all duration-200 hover:scale-110"
            >
              <X size={24} />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex space-x-1 mt-4 bg-white/10 p-1 rounded-lg">
            {[
              { id: 'chat', label: 'Voice Chat', icon: MessageCircle },
              { id: 'settings', label: 'Voice Settings', icon: Sliders }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md transition-all duration-200 ${
                  activeTab === tab.id 
                    ? 'bg-white text-purple-600 shadow-sm transform scale-105' 
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <tab.icon size={16} />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div className="h-full flex flex-col">
              {/* Voice Assistant Info */}
              <div className="bg-purple-50 border-b border-purple-200 p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <Volume2 size={20} className="text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-purple-900">{settings.voiceName}</h3>
                    <p className="text-sm text-purple-600">
                      {isTTSAvailable && isSTTAvailable 
                        ? 'Voice chat ready' 
                        : 'Some voice features unavailable'}
                    </p>
                  </div>
                  <div className="ml-auto flex items-center space-x-2">
                    {isPlaying ? (
                      <button
                        onClick={stopAudio}
                        className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors"
                        title="Stop audio"
                      >
                        <Pause size={16} />
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          const lastAiMessage = [...messages].reverse().find(m => m.role === 'assistant' && m.audioUrl);
                          if (lastAiMessage?.audioUrl) {
                            playAudio(lastAiMessage.audioUrl);
                          }
                        }}
                        disabled={!messages.some(m => m.role === 'assistant' && m.audioUrl)}
                        className="p-2 bg-purple-100 text-purple-600 rounded-full hover:bg-purple-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Play last response"
                      >
                        <Play size={16} />
                      </button>
                    )}
                    <button
                      onClick={clearConversation}
                      className="p-2 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
                      title="Clear conversation"
                      disabled={messages.length === 0}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                      <Volume2 size={32} className="text-purple-600" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Start a Voice Conversation</h3>
                    <p className="text-gray-500 max-w-md mb-6">
                      Click the microphone button below to start speaking. Your voice will be transcribed and the AI will respond with voice.
                    </p>
                    <div className="flex items-center justify-center space-x-2 text-sm text-purple-600 bg-purple-50 px-4 py-2 rounded-lg">
                      <Headphones size={16} />
                      <span>For the best experience, use headphones</span>
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-3/4 rounded-lg p-4 ${
                          message.role === 'user' 
                            ? 'bg-purple-100 text-purple-900' 
                            : 'bg-indigo-100 text-indigo-900'
                        }`}>
                          <div className="flex items-center space-x-2 mb-2">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/50">
                              {message.role === 'user' ? (
                                <User size={16} className="text-purple-600" />
                              ) : (
                                <Bot size={16} className="text-indigo-600" />
                              )}
                            </div>
                            <span className="font-medium">
                              {message.role === 'user' ? 'You' : settings.voiceName}
                            </span>
                            <span className="text-xs opacity-70">
                              {message.timestamp.toLocaleTimeString()}
                            </span>
                            {message.role === 'assistant' && message.audioUrl && (
                              <button
                                onClick={() => playAudio(message.audioUrl!)}
                                className="p-1 rounded-full bg-white/50 hover:bg-white/80 transition-colors"
                                title="Play audio"
                              >
                                <Play size={12} className="text-indigo-600" />
                              </button>
                            )}
                          </div>
                          <p className="text-sm">{message.content}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Error Message */}
              {error && (
                <div className="px-4 py-2 bg-red-50 border-t border-red-200">
                  <div className="flex items-center space-x-2 text-red-600 text-sm">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {/* Voice Input */}
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    {isRecording ? (
                      <div className="flex items-center space-x-2 text-red-600 animate-pulse">
                        <span>Recording...</span>
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    ) : isProcessing ? (
                      <div className="flex items-center space-x-2 text-purple-600">
                        <Loader2 size={16} className="animate-spin" />
                        <span>Processing...</span>
                      </div>
                    ) : (
                      <span>Click the microphone to start speaking</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-3">
                    {transcript && !isRecording && !isProcessing && (
                      <div className="text-sm text-gray-700 bg-white px-3 py-2 rounded-lg border border-gray-200 max-w-md truncate">
                        {transcript}
                      </div>
                    )}
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={isProcessing || !isSTTAvailable}
                      className={`p-4 rounded-full ${
                        isRecording
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-purple-600 text-white hover:bg-purple-700'
                      } transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="h-full overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto space-y-8">
                {/* Voice Selection */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <Volume2 size={20} className="text-purple-600" />
                    <span>Voice Selection</span>
                  </h3>
                  
                  {isLoadingVoices ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 size={24} className="text-purple-600 animate-spin" />
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {availableVoices.map((voice) => (
                          <div
                            key={voice.voice_id}
                            className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                              settings.voiceId === voice.voice_id
                                ? 'border-purple-300 bg-purple-50'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                            onClick={() => handleVoiceChange(voice.voice_id)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                                  <Volume2 size={16} className="text-purple-600" />
                                </div>
                                <div>
                                  <h4 className="font-medium text-gray-900">{voice.name}</h4>
                                  <span className="text-xs text-gray-500">{voice.category || 'Standard'}</span>
                                </div>
                              </div>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                settings.voiceId === voice.voice_id
                                  ? 'border-purple-500 bg-purple-500'
                                  : 'border-gray-300'
                              }`}>
                                {settings.voiceId === voice.voice_id && (
                                  <CheckCircle size={12} className="text-white" />
                                )}
                              </div>
                            </div>
                            {voice.preview_url && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const audio = new Audio(voice.preview_url);
                                  audio.play();
                                }}
                                className="text-xs flex items-center space-x-1 text-purple-600 hover:text-purple-700"
                              >
                                <Play size={12} />
                                <span>Preview voice</span>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      
                      <button
                        onClick={loadVoices}
                        className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <RefreshCw size={16} />
                        <span>Refresh Voices</span>
                      </button>
                    </>
                  )}
                </div>

                {/* Voice Parameters */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <Sliders size={20} className="text-purple-600" />
                    <span>Voice Parameters</span>
                  </h3>
                  
                  <div className="space-y-6">
                    {/* Stability */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">Stability: {settings.voiceStability.toFixed(2)}</label>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={settings.voiceStability}
                        onChange={(e) => setSettings({ ...settings, voiceStability: parseFloat(e.target.value) })}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>More Variable</span>
                        <span>More Stable</span>
                      </div>
                    </div>
                    
                    {/* Similarity */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">Similarity Boost: {settings.voiceSimilarity.toFixed(2)}</label>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={settings.voiceSimilarity}
                        onChange={(e) => setSettings({ ...settings, voiceSimilarity: parseFloat(e.target.value) })}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>More Unique</span>
                        <span>More Similar</span>
                      </div>
                    </div>
                    
                    {/* Style */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">Style: {settings.voiceStyle.toFixed(2)}</label>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={settings.voiceStyle}
                        onChange={(e) => setSettings({ ...settings, voiceStyle: parseFloat(e.target.value) })}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Less Style</span>
                        <span>More Style</span>
                      </div>
                    </div>
                    
                    {/* Speaker Boost */}
                    <div>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={settings.useSpeakerBoost}
                          onChange={(e) => setSettings({ ...settings, useSpeakerBoost: e.target.checked })}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Use Speaker Boost</span>
                      </label>
                      <p className="text-xs text-gray-500 mt-1 ml-6">
                        Enhances voice clarity and removes background noise
                      </p>
                    </div>
                  </div>
                </div>

                {/* Role Play Prompt */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <Wand2 size={20} className="text-purple-600" />
                    <span>AI Personality</span>
                  </h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Role Play Prompt
                      </label>
                      <textarea
                        value={settings.rolePlayPrompt}
                        onChange={(e) => setSettings({ ...settings, rolePlayPrompt: e.target.value })}
                        placeholder="Describe how the AI should behave and respond..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                        rows={4}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        This prompt guides how the AI responds to you in the voice conversation
                      </p>
                    </div>
                    
                    <div>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={settings.autoPlayTTS}
                          onChange={(e) => setSettings({ ...settings, autoPlayTTS: e.target.checked })}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="text-sm text-gray-700">Auto-play AI responses</span>
                      </label>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Speech-to-Text Language
                      </label>
                      <select
                        value={settings.sttLanguage}
                        onChange={(e) => setSettings({ ...settings, sttLanguage: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        {whisperService.getSupportedLanguages().map(lang => (
                          <option key={lang.code} value={lang.code}>{lang.name}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Select the language you'll be speaking in
                      </p>
                    </div>
                  </div>
                </div>

                {/* Service Status */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Status</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Volume2 size={20} className="text-purple-600" />
                        <span className="font-medium">Text-to-Speech</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {isTTSAvailable ? (
                          <>
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-green-600">Available</span>
                          </>
                        ) : (
                          <>
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            <span className="text-sm text-red-600">Unavailable</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Mic size={20} className="text-purple-600" />
                        <span className="font-medium">Speech-to-Text</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {isSTTAvailable ? (
                          <>
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-green-600">Available</span>
                          </>
                        ) : (
                          <>
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            <span className="text-sm text-red-600">Unavailable</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-500 bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="flex items-center space-x-2 text-blue-700 mb-2">
                        <InfoIcon size={16} />
                        <span className="font-medium">Voice Chat Information</span>
                      </p>
                      <ul className="space-y-1 text-blue-600 pl-6 list-disc">
                        <li>Voice chat requires both Text-to-Speech and Speech-to-Text services</li>
                        <li>Uses Eleven Labs for voice generation</li>
                        <li>Uses OpenAI Whisper for speech recognition</li>
                        <li>Configure API keys in Settings if services are unavailable</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// InfoIcon component
const InfoIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4" />
    <path d="M12 8h.01" />
  </svg>
);
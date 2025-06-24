import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, MicOff, Volume2, VolumeX, Play, Pause, Settings, Loader2, AlertCircle, CheckCircle, Sparkles, Headphones } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { elevenLabsService, ElevenLabsVoice } from '../services/elevenLabsService';
import { whisperService } from '../services/whisperService';
import { aiService } from '../services/aiService';
import { VoiceChatSettings } from '../types';

interface VoiceChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VoiceChat: React.FC<VoiceChatProps> = ({ isOpen, onClose }) => {
  const { user, getCurrentTier } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<VoiceChatSettings>({
    voiceId: 'pNInz6obpgDQGcFmaJgB', // Default voice (Adam)
    voiceName: 'Adam',
    rolePlayPrompt: 'You are a helpful AI assistant. Keep your responses concise and conversational.',
    autoPlayTTS: true,
    sttLanguage: 'en',
    voiceStability: 0.5,
    voiceSimilarity: 0.75,
    voiceStyle: 0,
    useSpeakerBoost: true
  });
  const [showSettings, setShowSettings] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const currentTier = getCurrentTier();
  const isProUser = currentTier === 'tier2';

  useEffect(() => {
    if (isOpen) {
      loadVoices();
    } else {
      // Clean up when modal closes
      stopRecording();
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
    }
    
    return () => {
      // Clean up on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [isOpen]);

  useEffect(() => {
    // Auto-play audio when available and setting is enabled
    if (audioUrl && settings.autoPlayTTS && audioRef.current) {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => console.error('Failed to auto-play audio:', err));
    }
  }, [audioUrl, settings.autoPlayTTS]);

  const loadVoices = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // For Pro users, fetch actual voices from Eleven Labs
      if (isProUser) {
        const availableVoices = await elevenLabsService.getVoices(currentTier);
        setVoices(availableVoices);
      } else {
        // For free users, use default voices
        const defaultVoices = elevenLabsService.getDefaultVoices().map(v => ({
          voice_id: v.id,
          name: v.name,
          category: 'default',
          description: v.description
        }));
        setVoices(defaultVoices);
      }
    } catch (error) {
      console.error('Failed to load voices:', error);
      setError('Failed to load voices. Please try again later.');
      
      // Fallback to default voices
      const defaultVoices = elevenLabsService.getDefaultVoices().map(v => ({
        voice_id: v.id,
        name: v.name,
        category: 'default',
        description: v.description
      }));
      setVoices(defaultVoices);
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    setError(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = handleRecordingStop;
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setError('Failed to access microphone. Please check your browser permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Stop all audio tracks
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleRecordingStop = async () => {
    if (audioChunksRef.current.length === 0) return;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      // Transcribe audio
      abortControllerRef.current = new AbortController();
      const transcribedText = await whisperService.transcribeAudio(
        audioBlob,
        { language: settings.sttLanguage },
        currentTier,
        abortControllerRef.current.signal
      );
      
      setTranscript(transcribedText);
      
      if (transcribedText.trim()) {
        // Add user message to conversation history
        const updatedHistory = [
          ...conversationHistory,
          { role: 'user', content: transcribedText }
        ];
        setConversationHistory(updatedHistory);
        
        // Generate AI response
        const systemPrompt = settings.rolePlayPrompt || 'You are a helpful AI assistant. Keep your responses concise and conversational.';
        const messages = [
          { role: 'system' as const, content: systemPrompt },
          ...updatedHistory
        ];
        
        // Use OpenAI for response generation
        const response = await aiService.callOpenAI(messages, [], abortControllerRef.current.signal, currentTier);
        setAiResponse(response);
        
        // Add AI response to conversation history
        setConversationHistory([
          ...updatedHistory,
          { role: 'assistant', content: response }
        ]);
        
        // Generate speech from AI response
        const audioBlob = await elevenLabsService.textToSpeech(
          {
            text: response,
            voice_id: settings.voiceId,
            voice_settings: {
              stability: settings.voiceStability,
              similarity_boost: settings.voiceSimilarity,
              style: settings.voiceStyle,
              use_speaker_boost: settings.useSpeakerBoost
            }
          },
          currentTier,
          abortControllerRef.current.signal
        );
        
        // Create audio URL
        if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
        }
        
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Voice chat operation aborted');
        return;
      }
      
      console.error('Voice chat error:', error);
      setError(error instanceof Error ? error.message : 'An error occurred during voice processing');
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current || !audioUrl) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(err => {
          console.error('Failed to play audio:', err);
          setError('Failed to play audio. Please try again.');
        });
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const handleCancel = () => {
    if (isRecording) {
      stopRecording();
    }
    
    if (isProcessing && abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsProcessing(false);
    }
    
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    
    setTranscript('');
    setAiResponse('');
  };

  const handleVoiceChange = (voiceId: string) => {
    const selectedVoice = voices.find(v => v.voice_id === voiceId);
    if (selectedVoice) {
      setSettings({
        ...settings,
        voiceId,
        voiceName: selectedVoice.name
      });
    }
  };

  const handleSettingsChange = (key: keyof VoiceChatSettings, value: any) => {
    setSettings({
      ...settings,
      [key]: value
    });
  };

  const handleClearConversation = () => {
    setConversationHistory([]);
    setTranscript('');
    setAiResponse('');
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-xl max-w-4xl w-full h-[90vh] flex flex-col overflow-hidden transform animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg animate-bounceIn">
                <Headphones size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Voice Chat</h2>
                <p className="text-purple-100">Have a conversation with AI using your voice</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-lg hover:bg-white/20 transition-all duration-200 hover:scale-110"
                title="Settings"
              >
                <Settings size={20} />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/20 transition-all duration-200 hover:scale-110"
              >
                <X size={24} />
              </button>
            </div>
          </div>
          
          {/* Voice Selection (Quick Access) */}
          {!showSettings && (
            <div className="mt-4 flex items-center space-x-3">
              <div className="text-sm text-white/80">Voice:</div>
              <select
                value={settings.voiceId}
                onChange={(e) => handleVoiceChange(e.target.value)}
                className="bg-white/20 border border-white/30 text-white rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                disabled={loading || isProcessing}
              >
                {voices.map((voice) => (
                  <option key={voice.voice_id} value={voice.voice_id}>
                    {voice.name}
                  </option>
                ))}
              </select>
              
              <div className="ml-auto flex items-center space-x-2">
                <button
                  onClick={handleClearConversation}
                  className="bg-white/20 hover:bg-white/30 text-white text-sm px-3 py-1 rounded-lg transition-colors"
                  disabled={conversationHistory.length === 0 || isProcessing}
                >
                  Clear Conversation
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {showSettings ? (
            <div className="h-full p-6 overflow-y-auto">
              <div className="max-w-3xl mx-auto space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Voice Chat Settings</h3>
                
                {/* Voice Selection */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    AI Voice
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {voices.map((voice) => (
                      <div
                        key={voice.voice_id}
                        className={`p-3 border-2 rounded-lg cursor-pointer transition-all duration-200 hover:shadow-md ${
                          settings.voiceId === voice.voice_id
                            ? 'border-purple-300 bg-purple-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                        onClick={() => handleVoiceChange(voice.voice_id)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-medium text-gray-900">{voice.name}</div>
                          <div className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">
                            {voice.category || 'Default'}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500">{voice.description || 'No description available'}</p>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Role Play Prompt */}
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700">
                    Role Play Prompt
                  </label>
                  <textarea
                    value={settings.rolePlayPrompt}
                    onChange={(e) => handleSettingsChange('rolePlayPrompt', e.target.value)}
                    placeholder="Describe how the AI should respond..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={3}
                  />
                  <p className="text-xs text-gray-500">
                    This prompt guides how the AI responds to you. Be specific about personality, tone, and style.
                  </p>
                </div>
                
                {/* Voice Settings */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Voice Settings</h4>
                  
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Stability: {settings.voiceStability.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={settings.voiceStability}
                      onChange={(e) => handleSettingsChange('voiceStability', parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <p className="text-xs text-gray-500">
                      Higher values make the voice more stable and consistent, lower values make it more expressive.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Similarity Boost: {settings.voiceSimilarity.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={settings.voiceSimilarity}
                      onChange={(e) => handleSettingsChange('voiceSimilarity', parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <p className="text-xs text-gray-500">
                      Higher values make the voice sound more like the original voice sample.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Style: {settings.voiceStyle.toFixed(1)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={settings.voiceStyle}
                      onChange={(e) => handleSettingsChange('voiceStyle', parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <p className="text-xs text-gray-500">
                      Controls the style of the voice. Higher values add more style.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={settings.useSpeakerBoost}
                        onChange={(e) => handleSettingsChange('useSpeakerBoost', e.target.checked)}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700">Use Speaker Boost</span>
                    </label>
                    <p className="text-xs text-gray-500 ml-6">
                      Enhances voice clarity and reduces background noise.
                    </p>
                  </div>
                </div>
                
                {/* Other Settings */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Other Settings</h4>
                  
                  <div className="space-y-3">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={settings.autoPlayTTS}
                        onChange={(e) => handleSettingsChange('autoPlayTTS', e.target.checked)}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <span className="text-sm text-gray-700">Auto-play AI responses</span>
                    </label>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Speech-to-Text Language
                    </label>
                    <select
                      value={settings.sttLanguage}
                      onChange={(e) => handleSettingsChange('sttLanguage', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="it">Italian</option>
                      <option value="pt">Portuguese</option>
                      <option value="ja">Japanese</option>
                      <option value="zh">Chinese</option>
                      <option value="ko">Korean</option>
                      <option value="ru">Russian</option>
                    </select>
                  </div>
                </div>
                
                {/* Pro Features Notice */}
                {!isProUser && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 text-yellow-800 mb-2">
                      <Crown size={16} />
                      <span className="font-medium">Pro Features</span>
                    </div>
                    <p className="text-sm text-yellow-700">
                      Upgrade to Pro for access to all premium voices, unlimited voice chat sessions, and advanced voice customization options.
                    </p>
                  </div>
                )}
                
                {/* Save Button */}
                <div className="pt-4 flex justify-end">
                  <button
                    onClick={() => setShowSettings(false)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Save Settings
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              {/* Conversation Area */}
              <div className="flex-1 p-6 overflow-y-auto bg-gray-50">
                {conversationHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                      <Headphones size={32} className="text-purple-600" />
                    </div>
                    <h3 className="text-xl font-medium text-gray-900 mb-2">Start a Voice Conversation</h3>
                    <p className="text-gray-600 max-w-md mb-6">
                      Click the microphone button below to start speaking. Your voice will be transcribed and the AI will respond with voice.
                    </p>
                    <div className="flex items-center justify-center space-x-4">
                      <div className="flex items-center space-x-2 bg-purple-100 px-3 py-2 rounded-lg">
                        <Mic size={16} className="text-purple-600" />
                        <span className="text-sm text-purple-700">Speak</span>
                      </div>
                      <div className="text-gray-400">→</div>
                      <div className="flex items-center space-x-2 bg-blue-100 px-3 py-2 rounded-lg">
                        <Sparkles size={16} className="text-blue-600" />
                        <span className="text-sm text-blue-700">AI Processes</span>
                      </div>
                      <div className="text-gray-400">→</div>
                      <div className="flex items-center space-x-2 bg-green-100 px-3 py-2 rounded-lg">
                        <Volume2 size={16} className="text-green-600" />
                        <span className="text-sm text-green-700">Listen</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {conversationHistory.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-4 ${
                            message.role === 'user'
                              ? 'bg-purple-600 text-white'
                              : 'bg-white border border-gray-200 text-gray-800'
                          }`}
                        >
                          <div className="text-sm mb-1 opacity-75">
                            {message.role === 'user' ? 'You' : settings.voiceName}
                          </div>
                          <div>{message.content}</div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Processing Indicator */}
                    {isProcessing && (
                      <div className="flex justify-center">
                        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                          <div className="flex items-center space-x-3">
                            <Loader2 size={20} className="text-purple-600 animate-spin" />
                            <span className="text-gray-700">Processing your voice...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Audio Player */}
              {audioUrl && (
                <div className="bg-gray-100 border-t border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={handlePlayPause}
                        className="p-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors"
                      >
                        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                      </button>
                      <div className="text-sm text-gray-700">
                        {isPlaying ? 'Playing response...' : 'AI response ready'}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      Voice: {settings.voiceName}
                    </div>
                  </div>
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    onEnded={handleAudioEnded}
                    className="hidden"
                  />
                </div>
              )}
              
              {/* Controls */}
              <div className="bg-white border-t border-gray-200 p-6">
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center space-x-2 text-red-700">
                      <AlertCircle size={16} />
                      <span className="text-sm">{error}</span>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-center space-x-4">
                  {isRecording ? (
                    <button
                      onClick={stopRecording}
                      className="p-6 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center"
                    >
                      <MicOff size={32} />
                    </button>
                  ) : (
                    <button
                      onClick={startRecording}
                      disabled={isProcessing}
                      className="p-6 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Mic size={32} />
                    </button>
                  )}
                </div>
                
                <div className="mt-4 text-center text-sm text-gray-500">
                  {isRecording ? (
                    <div className="flex items-center justify-center space-x-2 text-red-600">
                      <span className="inline-block w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                      <span>Recording... Click to stop</span>
                    </div>
                  ) : isProcessing ? (
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 size={14} className="animate-spin" />
                      <span>Processing your voice...</span>
                    </div>
                  ) : (
                    <span>Click the microphone to start speaking</span>
                  )}
                </div>
                
                {(isRecording || isProcessing) && (
                  <div className="mt-3 text-center">
                    <button
                      onClick={handleCancel}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                
                {transcript && (
                  <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">Transcript:</div>
                    <div className="text-sm text-gray-700">{transcript}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
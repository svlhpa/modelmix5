import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff, Settings, Loader2, AlertCircle, CheckCircle, Waves, Activity, Clock, User, Bot } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { voiceLabsService } from '../services/voiceLabsService';

interface VoiceLabsProps {
  isOpen: boolean;
  onClose: () => void;
}

type CallState = 'idle' | 'connecting' | 'connected' | 'speaking' | 'listening' | 'ai-responding' | 'error' | 'ended';

interface VoiceSettings {
  elevenLabsApiKey: string;
  voiceId: string;
  model: string;
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
}

export const VoiceLabs: React.FC<VoiceLabsProps> = ({ isOpen, onClose }) => {
  const { user, getCurrentTier } = useAuth();
  const [callState, setCallState] = useState<CallState>('idle');
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('excellent');
  const [latency, setLatency] = useState(0);
  const [conversationTime, setConversationTime] = useState(0);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    elevenLabsApiKey: '',
    voiceId: 'pNInz6obpgDQGcFmaJgB', // Default Adam voice
    model: 'eleven_turbo_v2_5',
    stability: 0.5,
    similarityBoost: 0.8,
    style: 0.0,
    useSpeakerBoost: true
  });

  // Refs for audio and WebSocket
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const conversationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const latencyTimerRef = useRef<number>(0);

  const currentTier = getCurrentTier();
  const isProUser = currentTier === 'tier2';

  useEffect(() => {
    if (isOpen) {
      // Load saved settings
      const savedSettings = localStorage.getItem('voice-labs-settings');
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          setVoiceSettings(prev => ({ ...prev, ...parsed }));
        } catch (error) {
          console.error('Failed to parse saved settings:', error);
        }
      }
    }

    return () => {
      if (conversationTimerRef.current) {
        clearInterval(conversationTimerRef.current);
      }
      cleanup();
    };
  }, [isOpen]);

  const cleanup = useCallback(() => {
    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Close WebSocket
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Clear timers
    if (conversationTimerRef.current) {
      clearInterval(conversationTimerRef.current);
      conversationTimerRef.current = null;
    }

    // Reset state
    setCallState('idle');
    setConversationTime(0);
    setCurrentTranscript('');
    setAiResponse('');
    setLatency(0);
    audioQueueRef.current = [];
    isPlayingRef.current = false;
  }, []);

  const initializeAudioContext = async () => {
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      setError('Failed to initialize audio system');
      return false;
    }
  };

  const requestMicrophoneAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        }
      });

      mediaStreamRef.current = stream;
      return true;
    } catch (error) {
      console.error('Failed to access microphone:', error);
      setError('Microphone access denied. Please allow microphone access and try again.');
      return false;
    }
  };

  const connectWebSocket = async () => {
    return new Promise<boolean>((resolve) => {
      try {
        // In a real implementation, this would connect to your WebSocket server
        // For now, we'll simulate the connection
        const ws = new WebSocket('wss://echo.websocket.org/'); // Demo WebSocket
        
        ws.onopen = () => {
          console.log('WebSocket connected');
          websocketRef.current = ws;
          resolve(true);
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setError('Failed to connect to voice service');
          resolve(false);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          if (callState === 'connected' || callState === 'speaking' || callState === 'listening') {
            setCallState('ended');
          }
        };

        // Timeout after 10 seconds
        setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            ws.close();
            resolve(false);
          }
        }, 10000);

      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        resolve(false);
      }
    });
  };

  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'transcript':
        setCurrentTranscript(data.text);
        if (data.is_final) {
          setCallState('ai-responding');
        }
        break;
      case 'ai_response':
        setAiResponse(data.text);
        break;
      case 'audio_chunk':
        // Handle incoming TTS audio
        playAudioChunk(data.audio);
        break;
      case 'latency':
        setLatency(data.latency);
        break;
      case 'error':
        setError(data.message);
        setCallState('error');
        break;
    }
  };

  const playAudioChunk = async (audioData: string) => {
    if (!audioContextRef.current || !isAudioEnabled) return;

    try {
      // Convert base64 audio to ArrayBuffer
      const binaryString = atob(audioData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Decode audio data
      const audioBuffer = await audioContextRef.current.decodeAudioData(bytes.buffer);
      
      // Add to queue
      audioQueueRef.current.push(audioBuffer);
      
      // Start playing if not already playing
      if (!isPlayingRef.current) {
        playNextAudioChunk();
      }
    } catch (error) {
      console.error('Failed to play audio chunk:', error);
    }
  };

  const playNextAudioChunk = () => {
    if (!audioContextRef.current || audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      if (callState === 'ai-responding') {
        setCallState('listening');
      }
      return;
    }

    isPlayingRef.current = true;
    const audioBuffer = audioQueueRef.current.shift()!;
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    
    source.onended = () => {
      playNextAudioChunk();
    };
    
    source.start();
  };

  const startCall = async () => {
    if (!user) {
      setError('Please sign in to use Voice Labs');
      return;
    }

    if (!voiceSettings.elevenLabsApiKey) {
      setError('Please configure your ElevenLabs API key in settings');
      setShowSettings(true);
      return;
    }

    setError(null);
    setCallState('connecting');

    try {
      // Initialize audio context
      const audioInitialized = await initializeAudioContext();
      if (!audioInitialized) return;

      // Request microphone access
      const micAccess = await requestMicrophoneAccess();
      if (!micAccess) return;

      // Connect WebSocket
      const wsConnected = await connectWebSocket();
      if (!wsConnected) return;

      // Start conversation timer
      conversationTimerRef.current = setInterval(() => {
        setConversationTime(prev => prev + 1);
      }, 1000);

      setCallState('connected');
      setLatency(Math.random() * 100 + 50); // Simulate initial latency

      // Start audio processing
      startAudioProcessing();

    } catch (error) {
      console.error('Failed to start call:', error);
      setError('Failed to start voice call');
      setCallState('error');
      cleanup();
    }
  };

  const startAudioProcessing = () => {
    if (!mediaStreamRef.current || !audioContextRef.current) return;

    try {
      const source = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (event) => {
        if (isMuted || callState !== 'connected' && callState !== 'listening' && callState !== 'speaking') return;

        const inputData = event.inputBuffer.getChannelData(0);
        
        // Calculate audio level for visual feedback
        const audioLevel = Math.sqrt(inputData.reduce((sum, sample) => sum + sample * sample, 0) / inputData.length);
        
        if (audioLevel > 0.01) { // Voice activity threshold
          setCallState('speaking');
          
          // Send audio data to WebSocket (in real implementation)
          if (websocketRef.current && websocketRef.current.readyState === WebSocket.OPEN) {
            // Convert audio data to base64 and send
            const audioData = Array.from(inputData);
            websocketRef.current.send(JSON.stringify({
              type: 'audio_data',
              data: audioData,
              timestamp: Date.now()
            }));
          }
        } else if (callState === 'speaking') {
          // Silence detected, switch to listening
          setTimeout(() => {
            if (callState === 'speaking') {
              setCallState('listening');
            }
          }, 500);
        }
      };

      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

    } catch (error) {
      console.error('Failed to start audio processing:', error);
      setError('Failed to start audio processing');
    }
  };

  const endCall = () => {
    setCallState('ended');
    cleanup();
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
    }
  };

  const toggleAudio = () => {
    setIsAudioEnabled(!isAudioEnabled);
  };

  const saveSettings = () => {
    localStorage.setItem('voice-labs-settings', JSON.stringify(voiceSettings));
    setShowSettings(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getConnectionQualityColor = () => {
    switch (connectionQuality) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-yellow-600';
      case 'poor': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getCallStateDisplay = () => {
    switch (callState) {
      case 'idle': return 'Ready to start';
      case 'connecting': return 'Connecting...';
      case 'connected': return 'Connected - Start speaking';
      case 'speaking': return 'You are speaking';
      case 'listening': return 'AI is listening';
      case 'ai-responding': return 'AI is responding';
      case 'error': return 'Error occurred';
      case 'ended': return 'Call ended';
      default: return 'Unknown state';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden transform animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg animate-bounceIn">
                <Waves size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Voice Labs</h2>
                <p className="text-emerald-100">Real-time AI voice conversations</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-lg hover:bg-white/20 transition-all duration-200 hover:scale-110"
                disabled={callState === 'connecting' || callState === 'connected' || callState === 'speaking' || callState === 'listening' || callState === 'ai-responding'}
              >
                <Settings size={20} />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/20 transition-all duration-200 hover:scale-110"
                disabled={callState === 'connecting'}
              >
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Status Bar */}
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Activity size={16} className={getConnectionQualityColor()} />
                <span className="text-emerald-200">
                  {connectionQuality === 'excellent' ? 'Excellent' : 
                   connectionQuality === 'good' ? 'Good' : 'Poor'} Connection
                </span>
              </div>
              {latency > 0 && (
                <div className="flex items-center space-x-2">
                  <Clock size={16} />
                  <span className="text-emerald-200">{latency.toFixed(0)}ms latency</span>
                </div>
              )}
              {conversationTime > 0 && (
                <div className="flex items-center space-x-2">
                  <Clock size={16} />
                  <span className="text-emerald-200">{formatTime(conversationTime)}</span>
                </div>
              )}
            </div>
            <div className="text-emerald-200">
              {getCallStateDisplay()}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Call Interface */}
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-gray-50 to-gray-100">
            {/* Visual Feedback */}
            <div className="relative mb-8">
              <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
                callState === 'speaking' ? 'bg-blue-500 animate-pulse' :
                callState === 'ai-responding' ? 'bg-emerald-500 animate-pulse' :
                callState === 'listening' ? 'bg-gray-400' :
                callState === 'connected' ? 'bg-green-500' :
                'bg-gray-300'
              }`}>
                {callState === 'speaking' ? (
                  <User size={48} className="text-white" />
                ) : callState === 'ai-responding' ? (
                  <Bot size={48} className="text-white" />
                ) : (
                  <Mic size={48} className="text-white" />
                )}
              </div>
              
              {/* Animated rings for speaking states */}
              {(callState === 'speaking' || callState === 'ai-responding') && (
                <>
                  <div className="absolute inset-0 rounded-full border-4 border-current opacity-30 animate-ping"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-current opacity-20 animate-ping" style={{ animationDelay: '0.5s' }}></div>
                </>
              )}
            </div>

            {/* Transcript Display */}
            <div className="w-full max-w-2xl space-y-4">
              {currentTranscript && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 animate-fadeInUp">
                  <div className="flex items-center space-x-2 mb-2">
                    <User size={16} className="text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">You said:</span>
                  </div>
                  <p className="text-gray-800">{currentTranscript}</p>
                </div>
              )}

              {aiResponse && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 animate-fadeInUp">
                  <div className="flex items-center space-x-2 mb-2">
                    <Bot size={16} className="text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-800">AI responded:</span>
                  </div>
                  <p className="text-gray-800">{aiResponse}</p>
                </div>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2 text-red-700 animate-shakeX">
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="bg-white border-t border-gray-200 p-6">
            <div className="flex items-center justify-center space-x-6">
              {/* Mute Button */}
              <button
                onClick={toggleMute}
                disabled={callState === 'idle' || callState === 'connecting' || callState === 'ended'}
                className={`p-4 rounded-full transition-all duration-200 hover:scale-110 transform ${
                  isMuted ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
              </button>

              {/* Main Call Button */}
              {callState === 'idle' || callState === 'ended' || callState === 'error' ? (
                <button
                  onClick={startCall}
                  disabled={!user}
                  className="p-6 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-all duration-200 hover:scale-110 transform disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Phone size={32} />
                </button>
              ) : callState === 'connecting' ? (
                <div className="p-6 bg-gray-400 text-white rounded-full">
                  <Loader2 size={32} className="animate-spin" />
                </div>
              ) : (
                <button
                  onClick={endCall}
                  className="p-6 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all duration-200 hover:scale-110 transform"
                >
                  <PhoneOff size={32} />
                </button>
              )}

              {/* Audio Toggle Button */}
              <button
                onClick={toggleAudio}
                disabled={callState === 'idle' || callState === 'connecting' || callState === 'ended'}
                className={`p-4 rounded-full transition-all duration-200 hover:scale-110 transform ${
                  !isAudioEnabled ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isAudioEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
              </button>
            </div>

            <div className="text-center mt-4 text-sm text-gray-500">
              {callState === 'idle' ? 'Click the phone button to start a voice call' :
               callState === 'connecting' ? 'Establishing secure connection...' :
               callState === 'connected' ? 'Connected! Start speaking to the AI' :
               callState === 'speaking' ? 'AI is listening to you...' :
               callState === 'listening' ? 'AI is processing your message...' :
               callState === 'ai-responding' ? 'AI is responding...' :
               callState === 'error' ? 'An error occurred. Please try again.' :
               'Call ended. Click the phone button to start a new call'}
            </div>
          </div>
        </div>

        {/* Settings Modal */}
        {showSettings && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
            <div className="bg-white rounded-xl max-w-md w-full p-6 animate-fadeInUp">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Voice Settings</h3>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ElevenLabs API Key
                  </label>
                  <input
                    type="password"
                    value={voiceSettings.elevenLabsApiKey}
                    onChange={(e) => setVoiceSettings({ ...voiceSettings, elevenLabsApiKey: e.target.value })}
                    placeholder="Enter your ElevenLabs API key"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Required for voice synthesis and speech recognition
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Voice
                  </label>
                  <select
                    value={voiceSettings.voiceId}
                    onChange={(e) => setVoiceSettings({ ...voiceSettings, voiceId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="pNInz6obpgDQGcFmaJgB">Adam (Male)</option>
                    <option value="21m00Tcm4TlvDq8ikWAM">Rachel (Female)</option>
                    <option value="AZnzlk1XvdvUeBnXmlld">Domi (Female)</option>
                    <option value="MF3mGyEYCl7XYWbV9V6O">Elli (Female)</option>
                    <option value="TxGEqnHWrfWFTfGW9XjX">Josh (Male)</option>
                    <option value="VR6AewLTigWG4xSOukaG">Arnold (Male)</option>
                    <option value="yoZ06aMxZJJ28mfd3POQ">Bella (Female)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Model
                  </label>
                  <select
                    value={voiceSettings.model}
                    onChange={(e) => setVoiceSettings({ ...voiceSettings, model: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="eleven_turbo_v2_5">Eleven Turbo v2.5 (Fastest)</option>
                    <option value="eleven_multilingual_v2">Eleven Multilingual v2 (Best quality)</option>
                    <option value="eleven_monolingual_v1">Eleven Monolingual v1 (English only)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stability: {voiceSettings.stability.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={voiceSettings.stability}
                    onChange={(e) => setVoiceSettings({ ...voiceSettings, stability: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Less stable</span>
                    <span>More stable</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Similarity Boost: {voiceSettings.similarityBoost.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={voiceSettings.similarityBoost}
                    onChange={(e) => setVoiceSettings({ ...voiceSettings, similarityBoost: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>More variation</span>
                    <span>More similar</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Style: {voiceSettings.style.toFixed(1)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={voiceSettings.style}
                    onChange={(e) => setVoiceSettings({ ...voiceSettings, style: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Less style</span>
                    <span>More style</span>
                  </div>
                </div>

                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={voiceSettings.useSpeakerBoost}
                      onChange={(e) => setVoiceSettings({ ...voiceSettings, useSpeakerBoost: e.target.checked })}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-gray-700">Enable speaker boost</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSettings}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
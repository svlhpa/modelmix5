import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff, Activity, Loader2, AlertCircle, Settings, Zap, RefreshCw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { voiceLabsService } from '../services/voiceLabsService';

interface VoiceLabsProps {
  isOpen: boolean;
  onClose: () => void;
}

type CallState = 'idle' | 'connecting' | 'connected' | 'speaking' | 'listening' | 'ai-responding' | 'error' | 'disconnected';

interface VoiceSettings {
  voice: string;
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
}

export const VoiceLabs: React.FC<VoiceLabsProps> = ({ isOpen, onClose }) => {
  const { user, getCurrentTier } = useAuth();
  const [callState, setCallState] = useState<CallState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('excellent');
  const [latency, setLatency] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [isElevenLabsAvailable, setIsElevenLabsAvailable] = useState(false);
  
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    voice: 'rachel',
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0.0,
    useSpeakerBoost: true
  });

  // Refs for audio and WebSocket
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const pingIntervalRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 3;

  const currentTier = getCurrentTier();

  useEffect(() => {
    if (isOpen) {
      checkElevenLabsAvailability();
      initializeAudioContext();
    } else {
      cleanup();
    }

    return () => cleanup();
  }, [isOpen]);

  const checkElevenLabsAvailability = async () => {
    try {
      const isAvailable = await voiceLabsService.isElevenLabsAvailable(currentTier);
      setIsElevenLabsAvailable(isAvailable);
    } catch (error) {
      console.error('Failed to check ElevenLabs availability:', error);
      setIsElevenLabsAvailable(false);
    }
  };

  const initializeAudioContext = async () => {
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioElementRef.current = new Audio();
      audioElementRef.current.autoplay = true;
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      setError('Failed to initialize audio system. Please ensure your browser supports the Web Audio API.');
    }
  };

  const cleanup = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    
    setCallState('idle');
    setTranscript('');
    setAiResponse('');
    setError(null);
    reconnectAttemptsRef.current = 0;
  };

  const startCall = async () => {
    if (!user) {
      setError('Please sign in to use Voice Labs');
      return;
    }

    setCallState('connecting');
    setError(null);

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      mediaStreamRef.current = stream;

      // Initialize WebSocket connection
      await initializeWebSocket();
      
      // Set up audio processing
      await setupAudioProcessing(stream);
      
      // Start ping interval to keep connection alive
      pingIntervalRef.current = setInterval(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        }
      }, 30000) as unknown as number;
      
      setCallState('connected');
    } catch (error) {
      console.error('Failed to start call:', error);
      setError(error instanceof Error ? error.message : 'Failed to start voice call');
      setCallState('error');
    }
  };

  const initializeWebSocket = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        // Use direct WebSocket connection to Supabase Edge Function
        const wsUrl = voiceLabsService.getWebSocketUrl();
        console.log('Connecting to WebSocket:', wsUrl);
        
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log('WebSocket connected');
          
          // Send initialization message
          ws.send(JSON.stringify({
            type: 'init',
            userTier: currentTier,
            voiceSettings: voiceSettings
          }));
          
          wsRef.current = ws;
          resolve();
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            handleWebSocketMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          
          // Try HTTP fallback if WebSocket fails
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current++;
            console.log(`WebSocket connection failed. Attempt ${reconnectAttemptsRef.current} of ${maxReconnectAttempts}`);
            
            // Close the failed connection
            try {
              ws.close();
            } catch (e) {
              // Ignore errors when closing already failed connection
            }
            
            // Wait before retrying
            setTimeout(() => {
              initializeWebSocket()
                .then(resolve)
                .catch(reject);
            }, 1000 * reconnectAttemptsRef.current);
          } else {
            reject(new Error('Failed to connect to voice service'));
          }
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          if (callState !== 'idle') {
            setCallState('disconnected');
          }
        };
        
        // Set timeout for connection
        setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            ws.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);
      } catch (error) {
        reject(error);
      }
    });
  };

  const setupAudioProcessing = async (stream: MediaStream) => {
    if (!audioContextRef.current) return;

    const source = audioContextRef.current.createMediaStreamSource(stream);
    const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
    
    processor.onaudioprocess = (event) => {
      if (isMuted || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
      
      const inputBuffer = event.inputBuffer;
      const inputData = inputBuffer.getChannelData(0);
      
      // Check if there's actual audio (not just silence)
      const audioLevel = Math.sqrt(inputData.reduce((sum, sample) => sum + sample * sample, 0) / inputData.length);
      
      // Only send audio if it's above a certain threshold
      if (audioLevel > 0.005) {
        // Convert to 16-bit PCM
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        }
        
        // Send audio data to WebSocket
        wsRef.current.send(JSON.stringify({
          type: 'audio',
          data: Array.from(pcmData)
        }));
        
        // Update speaking state
        if (callState === 'connected' || callState === 'listening') {
          setCallState('speaking');
        }
      } else if (audioLevel <= 0.005 && callState === 'speaking') {
        setCallState('listening');
      }
    };
    
    source.connect(processor);
    processor.connect(audioContextRef.current.destination);
    processorRef.current = processor;
  };

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'connection_status':
        console.log('Connection status:', message.status);
        if (message.status === 'ready') {
          setCallState('connected');
        }
        break;
        
      case 'transcript':
        setTranscript(message.text);
        if (message.isFinal) {
          setCallState('ai-responding');
        }
        break;
        
      case 'ai_response':
        setAiResponse(message.text);
        break;
        
      case 'audio':
        if (!isAudioMuted) {
          playAudioChunk(message.data);
        }
        break;
        
      case 'latency':
        setLatency(message.latency);
        setConnectionQuality(
          message.latency < 150 ? 'excellent' : 
          message.latency < 300 ? 'good' : 'poor'
        );
        break;
        
      case 'error':
        setError(message.message);
        setCallState('error');
        break;
        
      case 'ai_finished':
        setCallState('connected');
        break;
        
      case 'pong':
        // Update latency based on ping-pong
        if (message.timestamp) {
          const pingLatency = Date.now() - message.timestamp;
          setLatency(pingLatency);
          setConnectionQuality(
            pingLatency < 150 ? 'excellent' : 
            pingLatency < 300 ? 'good' : 'poor'
          );
        }
        break;
    }
  };

  const playAudioChunk = async (audioData: number[]) => {
    if (!audioContextRef.current || isAudioMuted) return;
    
    try {
      const audioBuffer = new ArrayBuffer(audioData.length * 2);
      const view = new DataView(audioBuffer);
      
      for (let i = 0; i < audioData.length; i++) {
        view.setInt16(i * 2, audioData[i], true);
      }
      
      audioQueueRef.current.push(audioBuffer);
      
      if (!isPlayingRef.current) {
        playNextAudioChunk();
      }
    } catch (error) {
      console.error('Failed to play audio chunk:', error);
    }
  };

  const playNextAudioChunk = async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }
    
    isPlayingRef.current = true;
    const audioBuffer = audioQueueRef.current.shift()!;
    
    try {
      if (audioContextRef.current) {
        const decodedBuffer = await audioContextRef.current.decodeAudioData(audioBuffer.slice(0));
        const source = audioContextRef.current.createBufferSource();
        source.buffer = decodedBuffer;
        source.connect(audioContextRef.current.destination);
        
        source.onended = () => {
          playNextAudioChunk();
        };
        
        source.start();
      }
    } catch (error) {
      console.error('Failed to play audio:', error);
      playNextAudioChunk();
    }
  };

  const endCall = () => {
    cleanup();
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'mute',
        muted: !isMuted
      }));
    }
  };

  const toggleAudioMute = () => {
    setIsAudioMuted(!isAudioMuted);
    audioQueueRef.current = []; // Clear audio queue when muting
  };

  const updateVoiceSettings = (newSettings: Partial<VoiceSettings>) => {
    const updatedSettings = { ...voiceSettings, ...newSettings };
    setVoiceSettings(updatedSettings);
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'update_voice_settings',
        voiceSettings: updatedSettings
      }));
    }
  };

  const retryConnection = () => {
    cleanup();
    setTimeout(() => {
      startCall();
    }, 1000);
  };

  const getStateDisplay = () => {
    switch (callState) {
      case 'idle': return { text: 'Ready to start', color: 'text-gray-600', icon: Phone };
      case 'connecting': return { text: 'Connecting...', color: 'text-blue-600', icon: Loader2 };
      case 'connected': return { text: 'Connected', color: 'text-green-600', icon: Activity };
      case 'speaking': return { text: 'You\'re speaking', color: 'text-blue-600', icon: Mic };
      case 'listening': return { text: 'Listening...', color: 'text-purple-600', icon: Activity };
      case 'ai-responding': return { text: 'AI is responding', color: 'text-orange-600', icon: Zap };
      case 'error': return { text: 'Error occurred', color: 'text-red-600', icon: AlertCircle };
      case 'disconnected': return { text: 'Disconnected', color: 'text-gray-600', icon: PhoneOff };
      default: return { text: 'Unknown', color: 'text-gray-600', icon: Activity };
    }
  };

  const stateDisplay = getStateDisplay();
  const StateIcon = stateDisplay.icon;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden transform animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg animate-bounceIn">
                <Volume2 size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Voice Labs</h2>
                <p className="text-emerald-100">Real-time AI voice conversation</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-lg hover:bg-white/20 transition-all duration-200 hover:scale-110"
                title="Voice Settings"
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

          {/* Connection Status */}
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <StateIcon size={20} className={`${stateDisplay.color} ${callState === 'connecting' ? 'animate-spin' : ''}`} />
              <span className={`font-medium ${stateDisplay.color}`}>{stateDisplay.text}</span>
            </div>
            
            {callState !== 'idle' && callState !== 'error' && (
              <div className="flex items-center space-x-4 text-sm text-emerald-200">
                <div className="flex items-center space-x-1">
                  <div className={`w-2 h-2 rounded-full ${
                    connectionQuality === 'excellent' ? 'bg-green-400' :
                    connectionQuality === 'good' ? 'bg-yellow-400' : 'bg-red-400'
                  }`} />
                  <span>{latency}ms</span>
                </div>
                <span>•</span>
                <span className="capitalize">{connectionQuality} quality</span>
              </div>
            )}
          </div>
        </div>

        {/* Voice Settings Panel */}
        {showSettings && (
          <div className="bg-gray-50 border-b border-gray-200 p-4">
            <h3 className="font-medium text-gray-900 mb-4">Voice Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Voice</label>
                <select
                  value={voiceSettings.voice}
                  onChange={(e) => updateVoiceSettings({ voice: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="rachel">Rachel (Calm, Professional)</option>
                  <option value="drew">Drew (Warm, Friendly)</option>
                  <option value="clyde">Clyde (Confident, Clear)</option>
                  <option value="paul">Paul (Deep, Authoritative)</option>
                  <option value="domi">Domi (Energetic, Young)</option>
                  <option value="dave">Dave (Conversational, Natural)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stability: {voiceSettings.stability.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={voiceSettings.stability}
                  onChange={(e) => updateVoiceSettings({ stability: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Similarity Boost: {voiceSettings.similarityBoost.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={voiceSettings.similarityBoost}
                  onChange={(e) => updateVoiceSettings({ similarityBoost: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Style: {voiceSettings.style.toFixed(2)}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={voiceSettings.style}
                  onChange={(e) => updateVoiceSettings({ style: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>
            </div>
            
            <div className="mt-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={voiceSettings.useSpeakerBoost}
                  onChange={(e) => updateVoiceSettings({ useSpeakerBoost: e.target.checked })}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-700">Use Speaker Boost (enhances clarity)</span>
              </label>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Conversation Display */}
          <div className="flex-1 p-6 space-y-6 overflow-y-auto">
            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 animate-shakeX">
                <div className="flex items-center space-x-2 text-red-700">
                  <AlertCircle size={20} />
                  <div className="flex-1">
                    <p className="font-medium">Failed to connect to voice service</p>
                    <p className="text-sm">{error}</p>
                  </div>
                </div>
                
                {callState === 'error' && (
                  <button
                    onClick={retryConnection}
                    className="mt-3 flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                  >
                    <RefreshCw size={16} />
                    <span>Retry Connection</span>
                  </button>
                )}
              </div>
            )}

            {/* Transcript Display */}
            {transcript && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 animate-fadeInUp">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Mic size={16} className="text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-blue-800 mb-1">You said:</h4>
                    <p className="text-blue-700">{transcript}</p>
                  </div>
                </div>
              </div>
            )}

            {/* AI Response Display */}
            {aiResponse && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 animate-fadeInUp">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <Zap size={16} className="text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-emerald-800 mb-1">AI Response:</h4>
                    <p className="text-emerald-700">{aiResponse}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Getting Started Instructions */}
            {callState === 'idle' && (
              <div className="text-center py-12 animate-fadeInUp">
                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Volume2 size={32} className="text-emerald-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Start Your Voice Conversation</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Experience real-time AI conversation with ultra-low latency. Just click start and begin speaking naturally.
                </p>
                
                {!isElevenLabsAvailable && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 max-w-md mx-auto">
                    <div className="flex items-start space-x-2 text-yellow-700">
                      <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">ElevenLabs API Key Required</p>
                        <p className="text-sm">Please ask your administrator to configure an ElevenLabs API key in the Supabase global_api_keys table for full functionality.</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto text-sm text-gray-600">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-bold">1</span>
                    </div>
                    <span>Click Start Call</span>
                  </div>
                  <div className="flex flex-col items-center space-y-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-bold">2</span>
                    </div>
                    <span>Speak Naturally</span>
                  </div>
                  <div className="flex flex-col items-center space-y-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-bold">3</span>
                    </div>
                    <span>AI Responds</span>
                  </div>
                </div>
              </div>
            )}

            {/* Connection Status Display */}
            {callState === 'connecting' && (
              <div className="text-center py-12 animate-fadeInUp">
                <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-6"></div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Connecting...</h3>
                <p className="text-gray-600">
                  Establishing secure connection to voice servers
                </p>
              </div>
            )}
            
            {/* Disconnected Status */}
            {callState === 'disconnected' && (
              <div className="text-center py-12 animate-fadeInUp">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <PhoneOff size={32} className="text-gray-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Call Disconnected</h3>
                <p className="text-gray-600 mb-6">
                  Your voice call has ended or was disconnected.
                </p>
                <button
                  onClick={startCall}
                  className="flex items-center justify-center space-x-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all duration-200 mx-auto"
                >
                  <Phone size={20} />
                  <span>Start New Call</span>
                </button>
              </div>
            )}
          </div>

          {/* Call Controls */}
          <div className="bg-gray-50 border-t border-gray-200 p-6">
            <div className="flex items-center justify-center space-x-6">
              {callState === 'idle' ? (
                <button
                  onClick={startCall}
                  className="flex items-center justify-center space-x-2 px-6 py-3 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-all duration-200 hover:scale-105 transform shadow-lg"
                >
                  <Phone size={20} />
                  <span className="font-medium">Start Call</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={toggleMute}
                    className={`p-4 rounded-full ${
                      isMuted ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
                    } hover:scale-110 transition-all duration-200`}
                    title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                    disabled={callState === 'connecting' || callState === 'error'}
                  >
                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                  </button>
                  
                  <button
                    onClick={toggleAudioMute}
                    className={`p-4 rounded-full ${
                      isAudioMuted ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
                    } hover:scale-110 transition-all duration-200`}
                    title={isAudioMuted ? 'Unmute Speaker' : 'Mute Speaker'}
                    disabled={callState === 'connecting' || callState === 'error'}
                  >
                    {isAudioMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                  </button>
                  
                  <button
                    onClick={endCall}
                    className="p-4 rounded-full bg-red-600 text-white hover:bg-red-700 hover:scale-110 transition-all duration-200"
                    title="End Call"
                    disabled={callState === 'connecting'}
                  >
                    <PhoneOff size={24} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
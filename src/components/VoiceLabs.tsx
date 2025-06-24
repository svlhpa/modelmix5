import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff, Settings, Loader2, AlertCircle, CheckCircle, Waves, Activity, Clock, User, Bot } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { globalApiService } from '../services/globalApiService';
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
    model: 'eleven_turbo_v2',
    stability: 0.5,
    similarityBoost: 0.8,
    style: 0.0,
    useSpeakerBoost: true
  });
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcripts, setTranscripts] = useState<{text: string, isUser: boolean}[]>([]);

  // Refs for audio and WebSocket
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const audioBufferSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const conversationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const simulationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioDataRef = useRef<Uint8Array | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioBufferRef = useRef<Float32Array[]>([]);
  const lastVoiceActivityRef = useRef<number>(0);

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
      
      // Check for global ElevenLabs API key
      checkGlobalApiKey();
    }

    return () => {
      if (conversationTimerRef.current) {
        clearInterval(conversationTimerRef.current);
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      cleanup();
    };
  }, [isOpen]);

  const checkGlobalApiKey = async () => {
    try {
      const globalKey = await globalApiService.getGlobalApiKey('elevenlabs', currentTier);
      if (globalKey && !voiceSettings.elevenLabsApiKey) {
        setVoiceSettings(prev => ({ ...prev, elevenLabsApiKey: globalKey }));
      }
    } catch (error) {
      console.error('Failed to get global ElevenLabs API key:', error);
    }
  };

  const cleanup = useCallback(() => {
    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Disconnect audio nodes
    if (audioSourceRef.current) {
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }

    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }

    if (audioAnalyserRef.current) {
      audioAnalyserRef.current.disconnect();
      audioAnalyserRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }

    // Clear timers
    if (conversationTimerRef.current) {
      clearInterval(conversationTimerRef.current);
      conversationTimerRef.current = null;
    }

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Reset state
    setCallState('idle');
    setConversationTime(0);
    setCurrentTranscript('');
    setAiResponse('');
    setLatency(0);
    setAudioLevel(0);
    setIsProcessingAudio(false);
    
    // Clear audio buffer
    audioBufferRef.current = [];
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
      setError('Failed to initialize audio system. Please ensure your browser supports the Web Audio API.');
      return false;
    }
  };

  const requestMicrophoneAccess = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
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

  const startAudioProcessing = () => {
    if (!mediaStreamRef.current || !audioContextRef.current) return;

    try {
      // Create audio source from microphone stream
      audioSourceRef.current = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
      
      // Create analyser for visualizing audio levels
      audioAnalyserRef.current = audioContextRef.current.createAnalyser();
      audioAnalyserRef.current.fftSize = 256;
      const bufferLength = audioAnalyserRef.current.frequencyBinCount;
      audioDataRef.current = new Uint8Array(bufferLength);
      
      // Connect source to analyser
      audioSourceRef.current.connect(audioAnalyserRef.current);
      
      // Use AudioWorkletNode if supported, otherwise fall back to ScriptProcessorNode
      if (audioContextRef.current.audioWorklet) {
        // Modern approach with AudioWorklet
        setupAudioWorklet();
      } else {
        // Fallback to deprecated ScriptProcessorNode
        setupScriptProcessor();
      }
      
      // Start audio visualization
      visualizeAudio();
      
    } catch (error) {
      console.error('Failed to start audio processing:', error);
      setError('Failed to process audio. Please try again.');
    }
  };

  const setupAudioWorklet = async () => {
    if (!audioContextRef.current || !audioAnalyserRef.current) return;
    
    try {
      // Create a simple processor worklet
      const workletCode = `
        class VoiceProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.lastLevel = 0;
          }
          
          process(inputs, outputs, parameters) {
            const input = inputs[0];
            if (input.length > 0) {
              const samples = input[0];
              
              // Calculate RMS level
              let sum = 0;
              for (let i = 0; i < samples.length; i++) {
                sum += samples[i] * samples[i];
              }
              const rms = Math.sqrt(sum / samples.length);
              
              // Send level to main thread
              if (Math.abs(rms - this.lastLevel) > 0.01) {
                this.port.postMessage({ level: rms });
                this.lastLevel = rms;
              }
              
              // Send audio data for processing
              this.port.postMessage({ audioData: samples });
            }
            return true;
          }
        }
        
        registerProcessor('voice-processor', VoiceProcessor);
      `;
      
      // Create a blob URL for the worklet code
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      
      // Load the worklet
      await audioContextRef.current.audioWorklet.addModule(workletUrl);
      
      // Create the worklet node
      audioWorkletNodeRef.current = new AudioWorkletNode(audioContextRef.current, 'voice-processor');
      
      // Connect the worklet
      audioAnalyserRef.current.connect(audioWorkletNodeRef.current);
      audioWorkletNodeRef.current.connect(audioContextRef.current.destination);
      
      // Handle messages from the worklet
      audioWorkletNodeRef.current.port.onmessage = (event) => {
        if (event.data.level !== undefined) {
          const normalizedLevel = Math.min(1, event.data.level * 5);
          setAudioLevel(normalizedLevel);
          
          // Voice activity detection
          handleVoiceActivity(normalizedLevel);
        }
        
        if (event.data.audioData) {
          // Store audio data for processing
          audioBufferRef.current.push(new Float32Array(event.data.audioData));
          
          // Limit buffer size
          if (audioBufferRef.current.length > 50) {
            // Process audio in batches
            processAudioBuffer();
          }
        }
      };
      
      // Clean up the blob URL
      URL.revokeObjectURL(workletUrl);
      
    } catch (error) {
      console.error('Failed to setup AudioWorklet:', error);
      // Fall back to ScriptProcessorNode
      setupScriptProcessor();
    }
  };

  const setupScriptProcessor = () => {
    if (!audioContextRef.current || !audioAnalyserRef.current) return;
    
    // Create script processor for audio processing
    const scriptProcessor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
    
    // Connect analyser to processor
    audioAnalyserRef.current.connect(scriptProcessor);
    
    // Connect processor to destination (required for ScriptProcessorNode to work)
    scriptProcessor.connect(audioContextRef.current.destination);
    
    // Process audio data
    scriptProcessor.onaudioprocess = (event) => {
      if (isMuted || callState === 'ended' || callState === 'error') return;
      
      // Get audio data
      const inputData = event.inputBuffer.getChannelData(0);
      
      // Calculate audio level (RMS)
      const rms = Math.sqrt(inputData.reduce((sum, sample) => sum + sample * sample, 0) / inputData.length);
      const normalizedLevel = Math.min(1, rms * 5); // Amplify for better visualization
      setAudioLevel(normalizedLevel);
      
      // Voice activity detection
      handleVoiceActivity(normalizedLevel);
      
      // Store audio data for processing
      audioBufferRef.current.push(new Float32Array(inputData));
      
      // Limit buffer size
      if (audioBufferRef.current.length > 50) {
        // Process audio in batches
        processAudioBuffer();
      }
    };
  };

  const handleVoiceActivity = (level: number) => {
    const now = Date.now();
    const voiceThreshold = 0.05;
    
    // Detect speech
    if (level > voiceThreshold && callState === 'connected') {
      setCallState('speaking');
      lastVoiceActivityRef.current = now;
      
      // Clear silence timeout if it exists
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
    } else if (level <= voiceThreshold && callState === 'speaking' && (now - lastVoiceActivityRef.current) > 300) {
      // Set silence timeout
      if (!silenceTimeoutRef.current) {
        silenceTimeoutRef.current = setTimeout(() => {
          if (callState === 'speaking') {
            setCallState('listening');
            
            // Simulate AI response after a short delay
            simulateAiResponse();
          }
          silenceTimeoutRef.current = null;
        }, 1500); // 1.5 seconds of silence to trigger listening state
      }
    }
  };

  const processAudioBuffer = () => {
    if (audioBufferRef.current.length === 0 || isProcessingAudio) return;
    
    setIsProcessingAudio(true);
    
    // In a real implementation, we would send this audio data to a speech recognition service
    // For now, we'll simulate speech recognition with random transcripts
    
    // Simulate processing delay
    setTimeout(() => {
      // Generate partial transcript
      const partialTranscript = getRandomTranscript();
      setCurrentTranscript(partialTranscript);
      
      // Clear processed buffers
      audioBufferRef.current = [];
      
      setIsProcessingAudio(false);
    }, 500);
  };

  const visualizeAudio = () => {
    if (!audioAnalyserRef.current || !audioDataRef.current) return;
    
    const updateVisualization = () => {
      if (!audioAnalyserRef.current || !audioDataRef.current) return;
      
      // Get frequency data
      audioAnalyserRef.current.getByteFrequencyData(audioDataRef.current);
      
      // Calculate average level
      const average = audioDataRef.current.reduce((sum, value) => sum + value, 0) / audioDataRef.current.length;
      const normalizedLevel = average / 256;
      
      // Update audio level state (throttled to reduce renders)
      if (Math.abs(normalizedLevel - audioLevel) > 0.05) {
        setAudioLevel(normalizedLevel);
      }
      
      // Continue animation loop
      animationFrameRef.current = requestAnimationFrame(updateVisualization);
    };
    
    // Start animation loop
    animationFrameRef.current = requestAnimationFrame(updateVisualization);
  };

  const simulateAiResponse = () => {
    // Save the user's transcript
    const userTranscript = currentTranscript;
    if (userTranscript) {
      setTranscripts(prev => [...prev, { text: userTranscript, isUser: true }]);
    }
    
    // Simulate AI thinking
    setCallState('ai-responding');
    
    // Simulate AI response delay
    setTimeout(() => {
      const aiResponseText = getRandomAiResponse(userTranscript);
      setAiResponse(aiResponseText);
      
      // Add AI response to transcripts
      setTranscripts(prev => [...prev, { text: aiResponseText, isUser: false }]);
      
      // Simulate TTS audio playing
      setTimeout(() => {
        // Return to connected state after response
        setCallState('connected');
        
        // Clear current transcript for next interaction
        setCurrentTranscript('');
      }, 3000);
    }, 1500);
  };

  const getRandomTranscript = () => {
    const transcripts = [
      "Hello, can you hear me?",
      "I'd like to know more about voice technology.",
      "What can you tell me about AI voice synthesis?",
      "How does speech recognition work?",
      "Tell me about the features of this application.",
      "What's the weather like today?",
      "Can you recommend a good book to read?",
      "How are you doing today?",
      "What's the latest news in AI technology?",
      "Tell me a joke."
    ];
    
    return transcripts[Math.floor(Math.random() * transcripts.length)];
  };

  const getRandomAiResponse = (userTranscript: string) => {
    const responses: Record<string, string[]> = {
      "Hello, can you hear me?": [
        "Yes, I can hear you clearly! How can I help you today?",
        "Hello! I'm hearing you perfectly. What can I assist you with?",
        "Hi there! The audio connection is excellent. What would you like to talk about?"
      ],
      "I'd like to know more about voice technology.": [
        "Voice technology has advanced significantly in recent years. Modern systems use deep learning for both speech recognition and synthesis, enabling more natural-sounding interactions.",
        "Voice technology encompasses speech recognition, natural language processing, and speech synthesis. Companies like ElevenLabs are pushing the boundaries with ultra-realistic voice synthesis.",
        "Voice technology is transforming how we interact with devices. The latest advancements include real-time voice cloning, emotion detection, and multilingual capabilities."
      ],
      "default": [
        "I'm here to help with any questions you might have. Feel free to ask about anything!",
        "That's an interesting topic. I'd be happy to discuss it further or answer any specific questions.",
        "Thanks for sharing that. Is there anything specific you'd like to know or discuss?",
        "I understand. Is there anything else you'd like to talk about today?",
        "I'm processing what you've said. Could you provide more details so I can give you a better response?"
      ]
    };
    
    // Find matching response or use default
    const matchingResponses = responses[userTranscript] || responses.default;
    return matchingResponses[Math.floor(Math.random() * matchingResponses.length)];
  };

  const startCall = async () => {
    if (!user) {
      setError('Please sign in to use Voice Labs');
      return;
    }

    // Check for API key
    const hasApiKey = voiceSettings.elevenLabsApiKey.trim() !== '';
    if (!hasApiKey) {
      try {
        // Try to get global API key
        const globalKey = await globalApiService.getGlobalApiKey('elevenlabs', currentTier);
        if (globalKey) {
          setVoiceSettings(prev => ({ ...prev, elevenLabsApiKey: globalKey }));
        } else {
          setError('No ElevenLabs API key available. Please add your API key in settings or contact support.');
          setShowSettings(true);
          return;
        }
      } catch (error) {
        setError('Failed to access ElevenLabs API key. Please add your API key in settings.');
        setShowSettings(true);
        return;
      }
    }

    setError(null);
    setCallState('connecting');
    setTranscripts([]);

    try {
      // Initialize audio context
      const audioInitialized = await initializeAudioContext();
      if (!audioInitialized) {
        setCallState('error');
        return;
      }

      // Request microphone access
      const micAccess = await requestMicrophoneAccess();
      if (!micAccess) {
        setCallState('error');
        return;
      }

      // Start conversation timer
      conversationTimerRef.current = setInterval(() => {
        setConversationTime(prev => prev + 1);
      }, 1000);

      // Simulate connection quality and latency
      simulateConnectionQuality();

      // Start audio processing
      startAudioProcessing();

      // Successfully connected
      setCallState('connected');
      
      // Add welcome message
      setTimeout(() => {
        const welcomeMessage = "Hi there! I'm your AI voice assistant. How can I help you today?";
        setAiResponse(welcomeMessage);
        setTranscripts([{ text: welcomeMessage, isUser: false }]);
      }, 1000);

    } catch (error) {
      console.error('Failed to start call:', error);
      setError('Failed to start voice call. Please try again.');
      setCallState('error');
      cleanup();
    }
  };

  const simulateConnectionQuality = () => {
    // Simulate random connection quality changes
    simulationIntervalRef.current = setInterval(() => {
      // Random latency between 50-200ms
      const newLatency = Math.floor(Math.random() * 150) + 50;
      setLatency(newLatency);
      
      // Set connection quality based on latency
      if (newLatency < 80) {
        setConnectionQuality('excellent');
      } else if (newLatency < 150) {
        setConnectionQuality('good');
      } else {
        setConnectionQuality('poor');
      }
    }, 5000);
  };

  const endCall = () => {
    setCallState('ended');
    cleanup();
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
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
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg animate-bounceIn">
                <Waves size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Voice Labs</h2>
                <p className="text-purple-100">Real-time AI voice conversations</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-lg hover:bg-white/20 transition-all duration-200 hover:scale-110"
                disabled={callState === 'connecting'}
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
                <span className="text-purple-200">
                  {connectionQuality === 'excellent' ? 'Excellent' : 
                   connectionQuality === 'good' ? 'Good' : 'Poor'} Connection
                </span>
              </div>
              {latency > 0 && (
                <div className="flex items-center space-x-2">
                  <Clock size={16} />
                  <span className="text-purple-200">{latency.toFixed(0)}ms latency</span>
                </div>
              )}
              {conversationTime > 0 && (
                <div className="flex items-center space-x-2">
                  <Clock size={16} />
                  <span className="text-purple-200">{formatTime(conversationTime)}</span>
                </div>
              )}
            </div>
            <div className="text-purple-200">
              {getCallStateDisplay()}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Call Interface */}
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-gray-50 to-gray-100 overflow-y-auto">
            {/* Visual Feedback */}
            <div className="relative mb-8">
              <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
                callState === 'speaking' ? 'bg-blue-500' :
                callState === 'ai-responding' ? 'bg-purple-500' :
                callState === 'listening' ? 'bg-gray-400' :
                callState === 'connected' ? 'bg-green-500' :
                callState === 'error' ? 'bg-red-500' :
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
              
              {/* Audio level visualization */}
              {callState === 'speaking' && (
                <div className="absolute -inset-4 flex items-center justify-center">
                  <div className="w-40 h-40 rounded-full border-4 border-blue-300 opacity-20"></div>
                  <div 
                    className="absolute inset-0 rounded-full border-4 border-blue-400 opacity-40 transition-transform duration-100"
                    style={{ transform: `scale(${1 + audioLevel})` }}
                  ></div>
                </div>
              )}
            </div>

            {/* Transcript Display */}
            <div className="w-full max-w-2xl space-y-4">
              {/* Current transcript (what user is saying now) */}
              {currentTranscript && callState === 'speaking' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 animate-fadeInUp">
                  <div className="flex items-center space-x-2 mb-2">
                    <User size={16} className="text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">You're saying:</span>
                  </div>
                  <p className="text-gray-800">{currentTranscript}</p>
                </div>
              )}

              {/* Current AI response */}
              {aiResponse && callState === 'ai-responding' && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 animate-fadeInUp">
                  <div className="flex items-center space-x-2 mb-2">
                    <Bot size={16} className="text-purple-600" />
                    <span className="text-sm font-medium text-purple-800">AI is saying:</span>
                  </div>
                  <p className="text-gray-800">{aiResponse}</p>
                </div>
              )}

              {/* Conversation history */}
              {transcripts.length > 0 && (
                <div className="mt-8 space-y-4">
                  <h3 className="text-sm font-medium text-gray-500">Conversation History</h3>
                  {transcripts.map((transcript, index) => (
                    <div 
                      key={index}
                      className={`p-4 rounded-lg ${
                        transcript.isUser 
                          ? 'bg-blue-50 border border-blue-200' 
                          : 'bg-purple-50 border border-purple-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2 mb-2">
                        {transcript.isUser ? (
                          <>
                            <User size={16} className="text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">You:</span>
                          </>
                        ) : (
                          <>
                            <Bot size={16} className="text-purple-600" />
                            <span className="text-sm font-medium text-purple-800">AI:</span>
                          </>
                        )}
                      </div>
                      <p className="text-gray-800">{transcript.text}</p>
                    </div>
                  ))}
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
                disabled={callState === 'idle' || callState === 'connecting' || callState === 'ended' || callState === 'error'}
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
                  className="p-6 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-all duration-200 hover:scale-110 transform disabled:opacity-50 disabled:cursor-not-allowed"
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
                disabled={callState === 'idle' || callState === 'connecting' || callState === 'ended' || callState === 'error'}
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {voiceSettings.elevenLabsApiKey ? 'Using personal API key' : 'Using global API key'}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Voice
                  </label>
                  <select
                    value={voiceSettings.voiceId}
                    onChange={(e) => setVoiceSettings({ ...voiceSettings, voiceId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="eleven_turbo_v2">Eleven Turbo v2 (Fastest)</option>
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
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
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
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
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
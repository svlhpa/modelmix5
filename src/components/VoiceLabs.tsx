import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, MicOff, Volume2, VolumeX, Phone, PhoneOff, Activity, Loader2, AlertCircle, Settings, Zap, RefreshCw, Key } from 'lucide-react';
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
  const [directApiKey, setDirectApiKey] = useState('');
  const [useDirectApiKey, setUseDirectApiKey] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    voice: 'rachel',
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0.0,
    useSpeakerBoost: true
  });

  // Refs for audio
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const isRecordingRef = useRef(false);

  const currentTier = getCurrentTier();

  useEffect(() => {
    if (isOpen) {
      initializeAudioContext();
    } else {
      cleanup();
    }

    return () => cleanup();
  }, [isOpen]);

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
    if (mediaRecorderRef.current && isRecordingRef.current) {
      mediaRecorderRef.current.stop();
      isRecordingRef.current = false;
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setCallState('idle');
    setTranscript('');
    setAiResponse('');
    setError(null);
    audioChunksRef.current = [];
  };

  const startCall = async () => {
    if (!useDirectApiKey && !directApiKey) {
      setError('Please provide an ElevenLabs API key for testing');
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

      // Set up MediaRecorder for recording audio
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      // Clear previous audio chunks
      audioChunksRef.current = [];
      
      // Set up event handlers
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && !isMuted) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length === 0 || isMuted) {
          setCallState('connected');
          return;
        }
        
        setCallState('ai-responding');
        setIsProcessing(true);
        
        try {
          // Create audio blob from chunks
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          // Clear chunks for next recording
          audioChunksRef.current = [];
          
          // Transcribe audio using ElevenLabs
          const transcription = await transcribeAudio(audioBlob);
          setTranscript(transcription);
          
          // Generate AI response
          const response = await generateAiResponse(transcription);
          setAiResponse(response);
          
          // Convert response to speech
          await textToSpeech(response);
          
          // Reset state
          setCallState('connected');
        } catch (error) {
          console.error('Error processing audio:', error);
          setError(error instanceof Error ? error.message : 'Failed to process audio');
          setCallState('error');
        } finally {
          setIsProcessing(false);
        }
      };
      
      // Start recording
      mediaRecorder.start();
      isRecordingRef.current = true;
      
      // Set connection quality (simulated)
      setLatency(Math.floor(Math.random() * 100) + 50);
      setConnectionQuality(
        latency < 100 ? 'excellent' : 
        latency < 200 ? 'good' : 'poor'
      );
      
      setCallState('connected');
    } catch (error) {
      console.error('Failed to start call:', error);
      setError(error instanceof Error ? error.message : 'Failed to start voice call');
      setCallState('error');
    }
  };

  const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
    try {
      // For demo purposes, we'll simulate transcription
      // In a real implementation, you would call the ElevenLabs API
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate a random transcript for demo
      const mockTranscripts = [
        "Hello, how can you help me today?",
        "Tell me about voice technology.",
        "What features does this voice lab have?",
        "Can you explain how this works?",
        "I'm interested in learning more about AI voice assistants.",
        "How does ElevenLabs compare to other voice technologies?",
        "What's the latency like for real-time voice conversations?",
        "Can I customize the voice settings?",
        "Tell me about the different voices available.",
        "How secure is this voice conversation?"
      ];
      
      return mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)];
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw new Error('Failed to transcribe audio');
    }
  };

  const generateAiResponse = async (transcript: string): Promise<string> => {
    try {
      // For demo purposes, we'll generate a contextual response
      // In a real implementation, you would call an LLM API
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate a contextual response based on the transcript
      const responses: Record<string, string[]> = {
        "hello": [
          "Hello there! How can I assist you today?",
          "Hi! Welcome to Voice Labs. What would you like to talk about?",
          "Greetings! I'm your AI voice assistant. How may I help you?"
        ],
        "help": [
          "I'd be happy to help! Voice Labs allows you to have real-time conversations with AI. You can ask questions, get information, or just chat.",
          "I can help with a variety of topics. Just speak naturally and I'll respond. You can also adjust my voice settings using the settings button.",
          "Voice Labs is designed for natural conversations. You can speak to me about almost anything, and I'll do my best to provide helpful responses."
        ],
        "voice": [
          "Voice technology has advanced significantly in recent years. ElevenLabs provides some of the most natural-sounding AI voices available today, with low latency and high quality.",
          "Modern voice AI combines several technologies: speech recognition to understand what you're saying, natural language processing to generate responses, and text-to-speech to convert those responses into audio.",
          "Voice interfaces are becoming increasingly important as they provide a more natural way for humans to interact with technology. They're particularly valuable for accessibility and for situations where hands-free interaction is necessary."
        ],
        "work": [
          "This system works by capturing your voice through your microphone, converting it to text, generating an AI response, and then converting that response back to speech. All in near real-time!",
          "Behind the scenes, we're using speech recognition to understand what you're saying, an AI language model to generate responses, and text-to-speech technology to speak back to you.",
          "The process involves several steps: first, your audio is captured and sent to a speech recognition service. Then, the transcribed text is processed by an AI to generate a response. Finally, that response is converted back to speech using a text-to-speech service."
        ],
        "features": [
          "Voice Labs offers several features including real-time conversation, adjustable voice settings, and high-quality voice synthesis. You can customize the voice, stability, and other parameters to get the sound you prefer.",
          "You can adjust various voice settings like stability, similarity boost, and style to customize how I sound. There's also a speaker boost option that enhances clarity.",
          "The main feature is real-time voice conversation with minimal latency. You can also customize my voice characteristics through the settings panel."
        ],
        "elevenlabs": [
          "ElevenLabs provides state-of-the-art AI voice technology with some of the most natural-sounding voices available. Their technology allows for real-time voice synthesis with adjustable parameters for customization.",
          "ElevenLabs offers high-quality text-to-speech with very natural-sounding voices. Their technology allows for adjustments to stability, similarity boost, and style to get the exact voice characteristics you want.",
          "ElevenLabs is known for their realistic AI voices and low-latency speech synthesis. They offer a range of voices and customization options to suit different needs and preferences."
        ]
      };
      
      // Find matching keywords in the transcript
      let matchedResponse = "I'm not sure how to respond to that. Could you try asking something else?";
      
      for (const [keyword, responseOptions] of Object.entries(responses)) {
        if (transcript.toLowerCase().includes(keyword)) {
          matchedResponse = responseOptions[Math.floor(Math.random() * responseOptions.length)];
          break;
        }
      }
      
      return matchedResponse;
    } catch (error) {
      console.error('Error generating AI response:', error);
      throw new Error('Failed to generate AI response');
    }
  };

  const textToSpeech = async (text: string): Promise<void> => {
    if (isAudioMuted) return;
    
    try {
      // For demo purposes, we'll simulate text-to-speech
      // In a real implementation, you would call the ElevenLabs API
      
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In a real implementation, you would:
      // 1. Call ElevenLabs API with the text and voice settings
      // 2. Get back audio data
      // 3. Play the audio
      
      // For demo, we'll use the browser's built-in speech synthesis
      if ('speechSynthesis' in window) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        // Create a new utterance
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Set properties
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        // Get available voices
        const voices = window.speechSynthesis.getVoices();
        
        // Try to find a female voice for consistency with ElevenLabs defaults
        const femaleVoice = voices.find(voice => 
          voice.name.includes('female') || 
          voice.name.includes('woman') || 
          voice.name.includes('girl') ||
          voice.name.toLowerCase().includes('samantha') ||
          voice.name.toLowerCase().includes('victoria')
        );
        
        if (femaleVoice) {
          utterance.voice = femaleVoice;
        }
        
        // Speak the text
        window.speechSynthesis.speak(utterance);
      } else {
        console.warn('Speech synthesis not supported in this browser');
      }
    } catch (error) {
      console.error('Error converting text to speech:', error);
      throw new Error('Failed to convert text to speech');
    }
  };

  const endCall = () => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      mediaRecorderRef.current.stop();
      isRecordingRef.current = false;
    }
    
    cleanup();
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleAudioMute = () => {
    setIsAudioMuted(!isAudioMuted);
    
    // Stop any ongoing speech synthesis
    if (!isAudioMuted && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const updateVoiceSettings = (newSettings: Partial<VoiceSettings>) => {
    setVoiceSettings(prev => ({ ...prev, ...newSettings }));
  };

  const retryConnection = () => {
    cleanup();
    setTimeout(() => {
      startCall();
    }, 1000);
  };

  const handleRecordSample = () => {
    if (callState !== 'connected' || isProcessing) return;
    
    if (mediaRecorderRef.current && isRecordingRef.current) {
      // Stop current recording to process it
      mediaRecorderRef.current.stop();
      isRecordingRef.current = false;
      
      // Start a new recording after processing
      setTimeout(() => {
        if (mediaRecorderRef.current && callState === 'connected') {
          mediaRecorderRef.current.start();
          isRecordingRef.current = true;
        }
      }, 100);
    }
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

        {/* Direct API Key Input */}
        <div className="bg-yellow-50 border-b border-yellow-200 p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Key size={16} className="text-yellow-600" />
            <h3 className="font-medium text-yellow-800">ElevenLabs API Key</h3>
          </div>
          <div className="flex space-x-2">
            <input
              type="password"
              value={directApiKey}
              onChange={(e) => setDirectApiKey(e.target.value)}
              placeholder="Enter your ElevenLabs API key"
              className="flex-1 px-3 py-2 border border-yellow-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-white"
            />
            <label className="flex items-center space-x-2 px-3 py-2 bg-white border border-yellow-300 rounded-lg">
              <input
                type="checkbox"
                checked={useDirectApiKey}
                onChange={(e) => setUseDirectApiKey(e.target.checked)}
                className="rounded border-yellow-400 text-yellow-600 focus:ring-yellow-500"
              />
              <span className="text-sm text-yellow-700">Use this key</span>
            </label>
          </div>
          <p className="text-xs text-yellow-600 mt-1">
            Enter your ElevenLabs API key to enable voice conversation. Get a key at <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="underline">elevenlabs.io</a>
          </p>
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
                    <p className="font-medium">Error</p>
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
                  Experience AI voice conversation with your browser's speech synthesis. Enter your ElevenLabs API key above for testing.
                </p>
                
                {!directApiKey && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 max-w-md mx-auto">
                    <div className="flex items-start space-x-2 text-yellow-700">
                      <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium">API Key Required</p>
                        <p className="text-sm">Please enter your ElevenLabs API key above and check "Use this key" to enable voice conversation.</p>
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
                  Setting up your voice conversation
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
                  Your voice call has ended.
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
                  disabled={!directApiKey || !useDirectApiKey}
                  className="flex items-center justify-center space-x-2 px-6 py-3 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-all duration-200 hover:scale-105 transform shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
                  
                  {callState === 'connected' && (
                    <button
                      onClick={handleRecordSample}
                      disabled={isProcessing}
                      className="p-4 rounded-full bg-blue-600 text-white hover:bg-blue-700 hover:scale-110 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Record Sample"
                    >
                      <Mic size={24} />
                    </button>
                  )}
                  
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
            
            {callState === 'connected' && (
              <div className="text-center mt-4 text-sm text-gray-500">
                <p>Click the microphone button to record a sample and get a response</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
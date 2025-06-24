import React, { useState, useEffect, useRef } from 'react';
import { X, Volume2, Mic, Play, Pause, Loader2, CheckCircle, AlertCircle, User, MessageCircle, Send, Download, Headphones, Settings, Save, StopCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { elevenLabsService } from '../services/elevenLabsService';
import RecordRTC from 'recordrtc';
import { io, Socket } from 'socket.io-client';

interface AIVoiceChatProps {
  isOpen: boolean;
  onClose: () => void;
}

interface VoiceAgent {
  id: string;
  name: string;
  description: string;
  voiceId: string;
  avatar: string;
  personality: string;
}

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: Date;
  audioUrl?: string;
  isLoading?: boolean;
  error?: string;
}

export const AIVoiceChat: React.FC<AIVoiceChatProps> = ({ isOpen, onClose }) => {
  const { user, getCurrentTier } = useAuth();
  const [activeAgent, setActiveAgent] = useState<VoiceAgent | null>(null);
  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [voiceSettings, setVoiceSettings] = useState({
    stability: 0.5,
    clarity: 0.75,
    style: 0.5
  });
  const [showSettings, setShowSettings] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isStreamingResponse, setIsStreamingResponse] = useState(false);
  const [currentResponseText, setCurrentResponseText] = useState('');
  
  // Refs for real-time voice chat
  const socketRef = useRef<Socket | null>(null);
  const recorderRef = useRef<RecordRTC | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isInterruptingRef = useRef<boolean>(false);

  const currentTier = getCurrentTier();
  const isProUser = currentTier === 'tier2';

  useEffect(() => {
    if (isOpen) {
      loadAgents();
      // Reset state when modal opens
      setMessages([]);
      setUserInput('');
      setError(null);
    }
    
    return () => {
      // Clean up when modal closes
      disconnectSocket();
      stopRecording();
      stopAudio();
    };
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadAgents = async () => {
    try {
      // In a real implementation, these would come from an API
      const availableAgents: VoiceAgent[] = [
        {
          id: 'support-agent',
          name: 'Alexis',
          description: 'A dedicated support agent who is always ready to resolve any issues.',
          voiceId: 'pNInz6obpgDQGcFmaJgB',
          avatar: 'https://images.pexels.com/photos/5876695/pexels-photo-5876695.jpeg?auto=compress&cs=tinysrgb&w=150',
          personality: 'Helpful, patient, and knowledgeable'
        },
        {
          id: 'mindfulness-coach',
          name: 'Joe',
          description: 'A mindfulness coach who helps you find calm and clarity.',
          voiceId: 'ErXwobaYiN019PkySvjV',
          avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150',
          personality: 'Calm, insightful, and encouraging'
        },
        {
          id: 'sales-agent',
          name: 'Harper',
          description: 'A sales agent who showcases how ElevenLabs can transform your business.',
          voiceId: 'jBpfuIE2acCO8z3wKNLl',
          avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150',
          personality: 'Enthusiastic, knowledgeable, and persuasive'
        },
        {
          id: 'wizard',
          name: 'Calum',
          description: 'A mysterious wizard who offers ancient wisdom to aid you on your journey.',
          voiceId: 'XrExE9yKIg1WjnnlVkGX',
          avatar: 'https://images.pexels.com/photos/2379005/pexels-photo-2379005.jpeg?auto=compress&cs=tinysrgb&w=150',
          personality: 'Wise, mysterious, and philosophical'
        }
      ];
      
      setAgents(availableAgents);
      
      // Set default agent
      if (availableAgents.length > 0 && !activeAgent) {
        setActiveAgent(availableAgents[0]);
      }
    } catch (error) {
      console.error('Failed to load voice agents:', error);
      setError('Failed to load voice agents. Please try again later.');
    }
  };

  const connectSocket = async () => {
    if (!activeAgent) return;
    
    try {
      setIsConnecting(true);
      
      // In a real implementation, this would connect to a WebSocket server
      // For demo purposes, we'll simulate a connection
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulate successful connection
      setIsConnected(true);
      setIsConnecting(false);
      
      // Add welcome message from the agent
      const welcomeMessages: Record<string, string> = {
        'support-agent': "Hi there! I'm Alexis, your dedicated support agent. How can I help you today?",
        'mindfulness-coach': "Hello, I'm Joe. I'm here to help you find calm and clarity in your day. How are you feeling right now?",
        'sales-agent': "Hi! I'm Harper. I'd love to show you how our voice technology can transform your business. What are you interested in learning about?",
        'wizard': "Greetings, traveler. I am Calum, keeper of ancient wisdom. What guidance do you seek on your journey?"
      };
      
      const welcomeMessage = welcomeMessages[activeAgent.id] || `Hello, I'm ${activeAgent.name}. How can I assist you today?`;
      
      // Generate a welcome message with audio
      handleAgentResponse(welcomeMessage);
      
    } catch (error) {
      console.error('Failed to connect to voice chat server:', error);
      setError('Failed to connect to voice chat server. Please try again later.');
      setIsConnecting(false);
    }
  };

  const disconnectSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsConnected(false);
  };

  const handleSelectAgent = (agent: VoiceAgent) => {
    // Disconnect from current agent if connected
    if (isConnected) {
      disconnectSocket();
    }
    
    setActiveAgent(agent);
    setMessages([]);
    
    // Connect to the new agent
    connectSocket();
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || !activeAgent || isProcessing) return;
    
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      content: userInput,
      sender: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    
    // Add loading message from agent
    const loadingMessage: ChatMessage = {
      id: `agent-${Date.now()}`,
      content: '',
      sender: 'agent',
      timestamp: new Date(),
      isLoading: true
    };
    
    setMessages(prev => [...prev, loadingMessage]);
    
    try {
      // In a real implementation, this would call the Eleven Labs API
      await generateAgentResponse(userInput);
    } catch (error) {
      console.error('Error generating response:', error);
      
      // Update the loading message with error
      setMessages(prev => prev.map(msg => 
        msg.isLoading ? {
          ...msg,
          isLoading: false,
          error: 'Failed to generate response. Please try again.'
        } : msg
      ));
    }
  };

  const generateAgentResponse = async (userMessage: string) => {
    if (!activeAgent) return;
    
    setIsProcessing(true);
    setIsStreamingResponse(true);
    setCurrentResponseText('');
    
    try {
      // Simulate streaming response
      const responses = {
        'support-agent': [
          "I understand your concern. Let me help you resolve this issue.",
          "That's a great question. Here's what you need to know...",
          "I'm here to help you with that. Let's work through this together."
        ],
        'mindfulness-coach': [
          "Take a deep breath. Let's approach this mindfully.",
          "I hear what you're saying. Let's explore how to bring more clarity to this situation.",
          "That's a common challenge. Here's a mindfulness technique that might help..."
        ],
        'sales-agent': [
          "That's a great point! Our voice technology can definitely help with that.",
          "Many of our customers have had similar questions. Here's how our solution addresses that need...",
          "I'd be happy to explain how our platform can transform that experience for you."
        ],
        'wizard': [
          "Ah, an interesting quest indeed. The ancient scrolls speak of such matters...",
          "The path you seek requires wisdom. Let me share what the stars have revealed...",
          "Many have walked this road before you. Here's what the mystical realms suggest..."
        ]
      };
      
      const agentResponses = responses[activeAgent.id as keyof typeof responses] || responses['support-agent'];
      const fullResponse = agentResponses[Math.floor(Math.random() * agentResponses.length)];
      
      // Simulate streaming text response
      for (let i = 0; i < fullResponse.length; i++) {
        if (isInterruptingRef.current) {
          console.log('Response interrupted by user');
          isInterruptingRef.current = false;
          break;
        }
        
        setCurrentResponseText(fullResponse.substring(0, i + 1));
        await new Promise(resolve => setTimeout(resolve, 30)); // Adjust speed as needed
      }
      
      // Simulate generating audio
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // In a real implementation, we would call the Eleven Labs API to generate audio
      // For now, we'll simulate having an audio URL
      const simulatedAudioUrl = 'https://example.com/audio.mp3';
      
      // Update the loading message with the response
      handleAgentResponse(currentResponseText || fullResponse, simulatedAudioUrl);
      
    } catch (error) {
      console.error('Error in agent response:', error);
      setError('Failed to generate response. Please try again.');
      
      // Update the loading message with error
      setMessages(prev => prev.map(msg => 
        msg.isLoading ? {
          ...msg,
          isLoading: false,
          error: 'Failed to generate response. Please try again.'
        } : msg
      ));
    } finally {
      setIsProcessing(false);
      setIsStreamingResponse(false);
      setCurrentResponseText('');
    }
  };

  const handleAgentResponse = (content: string, audioUrl?: string) => {
    // Remove any loading message
    setMessages(prev => prev.filter(msg => !msg.isLoading));
    
    // Add the actual response
    const agentMessage: ChatMessage = {
      id: `agent-${Date.now()}`,
      content,
      sender: 'agent',
      timestamp: new Date(),
      audioUrl
    };
    
    setMessages(prev => [...prev, agentMessage]);
    
    // Auto-play the audio
    if (audioUrl) {
      handlePlayAudio(agentMessage.id, audioUrl);
    }
  };

  const handlePlayAudio = (messageId: string, audioUrl?: string) => {
    // Stop any currently playing audio
    stopAudio();
    
    // In a real implementation, this would play the actual audio from Eleven Labs
    // For demo purposes, we'll create a simple oscillator sound
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContext();
      
      // Create an oscillator
      const oscillator = audioContextRef.current.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioContextRef.current.currentTime); // A4 note
      
      // Create a gain node for volume control
      const gainNode = audioContextRef.current.createGain();
      gainNode.gain.setValueAtTime(0.1, audioContextRef.current.currentTime); // Lower volume
      
      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      
      // Start and stop the oscillator after a short time
      oscillator.start();
      
      // Update playing state
      setIsPlaying(prev => ({
        ...prev,
        [messageId]: true
      }));
      
      // Stop after 2 seconds
      setTimeout(() => {
        oscillator.stop();
        setIsPlaying(prev => ({
          ...prev,
          [messageId]: false
        }));
      }, 2000);
      
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const stopAudio = () => {
    // Stop any currently playing audio
    if (audioContextRef.current && audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current = null;
    }
    
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
    
    setIsPlaying({});
  };

  const startRecording = async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Create recorder
      recorderRef.current = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/webm',
        recorderType: RecordRTC.StereoAudioRecorder,
        numberOfAudioChannels: 1,
        desiredSampRate: 16000,
        bufferSize: 4096
      });
      
      // Start recording
      recorderRef.current.startRecording();
      setIsRecording(true);
      
      // Clear any previous error
      setError(null);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      setError('Failed to access microphone. Please check your permissions and try again.');
    }
  };

  const stopRecording = async () => {
    if (!recorderRef.current || !isRecording) return;
    
    try {
      setIsRecording(false);
      
      // Stop recording
      recorderRef.current.stopRecording(async () => {
        const blob = recorderRef.current?.getBlob();
        
        if (blob) {
          // In a real implementation, we would send this to the server for speech-to-text
          // For now, we'll simulate a transcription
          await processAudioBlob(blob);
        }
        
        // Clean up
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        recorderRef.current = null;
      });
      
    } catch (error) {
      console.error('Error stopping recording:', error);
      setError('Failed to process recording. Please try again.');
      setIsRecording(false);
    }
  };

  const processAudioBlob = async (blob: Blob) => {
    try {
      setIsProcessing(true);
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Simulate transcription
      const transcription = "This is a simulated voice message that was transcribed.";
      
      // Add user message with transcription
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        content: transcription,
        sender: 'user',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, userMessage]);
      
      // Generate agent response
      await generateAgentResponse(transcription);
      
    } catch (error) {
      console.error('Error processing audio:', error);
      setError('Failed to process audio. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartRecording = () => {
    if (isRecording || isProcessing) return;
    startRecording();
  };

  const handleStopRecording = () => {
    if (!isRecording) return;
    stopRecording();
  };

  const handleDownloadAudio = (messageId: string) => {
    // In a real implementation, this would download the audio file
    console.log('Downloading audio for message:', messageId);
    
    // Create a simple beep sound for demo purposes
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContext();
      
      // Create an oscillator
      const oscillator = audioContext.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4 note
      
      // Create a gain node for volume control
      const gainNode = audioContext.createGain();
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime); // Lower volume
      
      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Start and stop the oscillator after a short time
      oscillator.start();
      setTimeout(() => oscillator.stop(), 500);
      
    } catch (error) {
      console.error('Error creating audio:', error);
    }
  };

  const handleSaveSettings = () => {
    // In a real implementation, this would save the voice settings
    setShowSettings(false);
  };

  const handleInterruptResponse = () => {
    // Set the interruption flag
    isInterruptingRef.current = true;
    
    // Stop any audio playback
    stopAudio();
    
    // Remove loading message if present
    setMessages(prev => prev.filter(msg => !msg.isLoading));
    
    // Stop streaming response
    setIsStreamingResponse(false);
    setCurrentResponseText('');
    setIsProcessing(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden transform animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg animate-bounceIn">
                <Volume2 size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">AI Voice Chats</h2>
                <p className="text-purple-100">Have natural conversations with AI voice agents</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/20 transition-all duration-200 hover:scale-110"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar with Agents */}
          <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-medium text-gray-900">Choose an AI Voice Agent</h3>
              <p className="text-sm text-gray-500">Select an agent to start a conversation</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className={`p-3 rounded-lg cursor-pointer transition-all duration-200 mb-2 ${
                    activeAgent?.id === agent.id
                      ? 'bg-purple-100 border-2 border-purple-300'
                      : 'bg-white border border-gray-200 hover:border-purple-200 hover:bg-purple-50'
                  }`}
                  onClick={() => handleSelectAgent(agent)}
                >
                  <div className="flex items-center space-x-3">
                    <img
                      src={agent.avatar}
                      alt={agent.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{agent.name}</h4>
                      <p className="text-xs text-gray-500 line-clamp-2">{agent.description}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center space-x-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                      <Volume2 size={12} className="mr-1" />
                      Voice Agent
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayAudio(`preview-${agent.id}`);
                      }}
                      className="p-1 rounded-full bg-purple-600 text-white hover:bg-purple-700"
                    >
                      {isPlaying[`preview-${agent.id}`] ? (
                        <Pause size={12} />
                      ) : (
                        <Play size={12} />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Voice Settings */}
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center space-x-2 w-full px-3 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
              >
                <Settings size={16} />
                <span>Voice Settings</span>
              </button>
              
              {showSettings && (
                <div className="mt-3 space-y-3 p-3 bg-white rounded-lg border border-gray-200">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Stability: {voiceSettings.stability.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={voiceSettings.stability}
                      onChange={(e) => setVoiceSettings(prev => ({ ...prev, stability: parseFloat(e.target.value) }))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Clarity: {voiceSettings.clarity.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={voiceSettings.clarity}
                      onChange={(e) => setVoiceSettings(prev => ({ ...prev, clarity: parseFloat(e.target.value) }))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Style: {voiceSettings.style.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={voiceSettings.style}
                      onChange={(e) => setVoiceSettings(prev => ({ ...prev, style: parseFloat(e.target.value) }))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  
                  <button
                    onClick={handleSaveSettings}
                    className="w-full flex items-center justify-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Save size={14} />
                    <span>Save Settings</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Chat Area */}
          <div className="flex-1 flex flex-col">
            {activeAgent ? (
              <>
                {/* Chat Header */}
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img
                      src={activeAgent.avatar}
                      alt={activeAgent.name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div>
                      <h3 className="font-medium text-gray-900">{activeAgent.name}</h3>
                      <p className="text-xs text-gray-500">{activeAgent.personality}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {isConnecting ? (
                      <div className="flex items-center space-x-2 text-purple-600">
                        <Loader2 size={16} className="animate-spin" />
                        <span className="text-sm">Connecting...</span>
                      </div>
                    ) : isConnected ? (
                      <div className="flex items-center space-x-2 text-green-600">
                        <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
                        <span className="text-sm">Connected</span>
                      </div>
                    ) : (
                      <button
                        onClick={connectSocket}
                        className="flex items-center space-x-2 px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                      >
                        <RefreshCw size={14} />
                        <span>Connect</span>
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                      <Volume2 size={48} className="mb-4 text-purple-300" />
                      <h3 className="text-lg font-medium text-gray-700 mb-2">Start a Voice Conversation</h3>
                      <p className="max-w-md text-sm">
                        {isConnected ? 
                          "You're connected! Type a message or use the microphone to start talking." :
                          "Click 'Connect' to start a real-time voice conversation with this agent."}
                      </p>
                    </div>
                  ) : (
                    <>
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[80%] ${message.sender === 'user' ? 'order-1' : 'order-2'}`}>
                            {message.sender === 'agent' && activeAgent && (
                              <div className="flex items-center space-x-2 mb-1">
                                <img
                                  src={activeAgent.avatar}
                                  alt={activeAgent.name}
                                  className="w-6 h-6 rounded-full object-cover"
                                />
                                <span className="text-xs font-medium text-gray-700">{activeAgent.name}</span>
                              </div>
                            )}
                            
                            <div
                              className={`p-3 rounded-lg ${
                                message.sender === 'user'
                                  ? 'bg-purple-600 text-white'
                                  : message.isLoading
                                  ? 'bg-gray-100 text-gray-500'
                                  : 'bg-gray-200 text-gray-800'
                              }`}
                            >
                              {message.isLoading ? (
                                <div className="flex items-center space-x-2">
                                  <Loader2 size={16} className="animate-spin" />
                                  <span>Generating response...</span>
                                </div>
                              ) : message.error ? (
                                <div className="flex items-center space-x-2 text-red-600">
                                  <AlertCircle size={16} />
                                  <span>{message.error}</span>
                                </div>
                              ) : (
                                <p>{message.content}</p>
                              )}
                            </div>
                            
                            {message.sender === 'agent' && message.audioUrl && !message.isLoading && !message.error && (
                              <div className="flex items-center space-x-2 mt-1">
                                <button
                                  onClick={() => handlePlayAudio(message.id, message.audioUrl)}
                                  className={`p-1 rounded-full ${
                                    isPlaying[message.id]
                                      ? 'bg-red-600 text-white'
                                      : 'bg-purple-600 text-white'
                                  } hover:opacity-90 transition-opacity`}
                                >
                                  {isPlaying[message.id] ? (
                                    <Pause size={14} />
                                  ) : (
                                    <Play size={14} />
                                  )}
                                </button>
                                <div className="h-1 bg-gray-200 rounded-full flex-1">
                                  <div
                                    className={`h-1 bg-purple-600 rounded-full ${
                                      isPlaying[message.id] ? 'animate-pulse' : ''
                                    }`}
                                    style={{ width: isPlaying[message.id] ? '60%' : '0%' }}
                                  />
                                </div>
                                <button
                                  onClick={() => handleDownloadAudio(message.id)}
                                  className="p-1 text-gray-500 hover:text-gray-700"
                                >
                                  <Download size={14} />
                                </button>
                              </div>
                            )}
                            
                            <div className="text-xs text-gray-500 mt-1">
                              {message.timestamp.toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {/* Streaming response indicator */}
                      {isStreamingResponse && currentResponseText && (
                        <div className="flex justify-start">
                          <div className="max-w-[80%] order-2">
                            {activeAgent && (
                              <div className="flex items-center space-x-2 mb-1">
                                <img
                                  src={activeAgent.avatar}
                                  alt={activeAgent.name}
                                  className="w-6 h-6 rounded-full object-cover"
                                />
                                <span className="text-xs font-medium text-gray-700">{activeAgent.name}</span>
                              </div>
                            )}
                            
                            <div className="p-3 rounded-lg bg-gray-200 text-gray-800">
                              <p>{currentResponseText}<span className="animate-pulse">|</span></p>
                            </div>
                            
                            <div className="flex items-center space-x-2 mt-1">
                              <div className="flex space-x-1">
                                <div className="w-1.5 h-1.5 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-1.5 h-1.5 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-1.5 h-1.5 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                              </div>
                              <span className="text-xs text-gray-500">Speaking...</span>
                              
                              <button
                                onClick={handleInterruptResponse}
                                className="p-1 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors ml-2"
                                title="Interrupt"
                              >
                                <StopCircle size={14} />
                              </button>
                            </div>
                            
                            <div className="text-xs text-gray-500 mt-1">
                              {new Date().toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                
                {/* Input Area */}
                <div className="p-4 border-t border-gray-200">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={isRecording ? handleStopRecording : handleStartRecording}
                      className={`p-3 rounded-full ${
                        isRecording
                          ? 'bg-red-600 text-white animate-pulse'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      } transition-colors`}
                      disabled={isProcessing || !isConnected}
                      title={isRecording ? "Stop recording" : "Start recording"}
                    >
                      <Mic size={20} />
                    </button>
                    <input
                      type="text"
                      value={userInput}
                      onChange={(e) => setUserInput(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      disabled={isProcessing || isRecording || !isConnected}
                    />
                    <button
                      onClick={handleSendMessage}
                      className="p-3 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!userInput.trim() || isProcessing || isRecording || !isConnected}
                      title="Send message"
                    >
                      <Send size={20} />
                    </button>
                  </div>
                  
                  {isRecording && (
                    <div className="mt-2 text-center">
                      <div className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs animate-pulse">
                        <span className="w-2 h-2 bg-red-600 rounded-full mr-2"></span>
                        Recording... Click the microphone to stop
                      </div>
                    </div>
                  )}
                  
                  {error && (
                    <div className="mt-2 text-center text-red-600 text-sm">
                      {error}
                    </div>
                  )}
                  
                  {!isConnected && !isConnecting && (
                    <div className="mt-2 text-center">
                      <div className="inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                        <AlertCircle size={12} className="mr-1" />
                        Please connect to start the conversation
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <Volume2 size={64} className="text-purple-300 mb-4" />
                <h3 className="text-xl font-medium text-gray-700 mb-2">Select an AI Voice Agent</h3>
                <p className="max-w-md text-gray-500 mb-6">
                  Choose an agent from the sidebar to start a voice conversation. Each agent has a unique personality and voice.
                </p>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 max-w-md">
                  <h4 className="font-medium text-purple-800 mb-2 flex items-center">
                    <Headphones size={16} className="mr-2" />
                    Real-Time Voice Chat
                  </h4>
                  <ul className="text-sm text-purple-700 space-y-2">
                    <li className="flex items-start">
                      <span className="font-bold mr-2">1.</span>
                      <span>Select an AI voice agent with a unique personality</span>
                    </li>
                    <li className="flex items-start">
                      <span className="font-bold mr-2">2.</span>
                      <span>Connect to establish a real-time voice channel</span>
                    </li>
                    <li className="flex items-start">
                      <span className="font-bold mr-2">3.</span>
                      <span>Type messages or use voice input to chat</span>
                    </li>
                    <li className="flex items-start">
                      <span className="font-bold mr-2">4.</span>
                      <span>Interrupt the AI at any time by clicking the stop button</span>
                    </li>
                    <li className="flex items-start">
                      <span className="font-bold mr-2">5.</span>
                      <span>Adjust voice settings to customize the experience</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
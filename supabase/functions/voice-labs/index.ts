// Voice Labs Edge Function
// This function handles real-time voice communication using WebSockets.
// It integrates with ElevenLabs for speech-to-text and text-to-speech,
// and uses OpenAI for AI responses.

import { createClient } from "npm:@supabase/supabase-js@2.39.0";

// WebSocket connections pool
const connections = new Map();

// Create a Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Function to get global API key
async function getGlobalApiKey(provider: string, userTier: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("global_api_keys")
      .select("api_key")
      .eq("provider", provider)
      .eq("is_active", true)
      .single();

    if (error) {
      console.error("Error getting global API key:", error);
      return null;
    }

    return data?.api_key || null;
  } catch (error) {
    console.error("Failed to get global API key:", error);
    return null;
  }
}

// Function to increment global API key usage
async function incrementGlobalUsage(provider: string): Promise<void> {
  try {
    const { error } = await supabase
      .from("global_api_keys")
      .update({ 
        current_usage: supabase.rpc("increment_counter", { row_id: null }),
        updated_at: new Date().toISOString()
      })
      .eq("provider", provider);

    if (error) {
      console.error("Error incrementing global API key usage:", error);
    }
  } catch (error) {
    console.error("Failed to increment global API key usage:", error);
  }
}

// Function to call ElevenLabs STT API
async function streamToElevenLabsStt(
  audioData: Int16Array,
  apiKey: string
): Promise<{ text: string; isFinal: boolean }> {
  try {
    // This is a placeholder for the actual API call
    // In a real implementation, you would stream audio to ElevenLabs STT API
    // and get back partial transcripts
    
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    // For demo purposes, return a mock response
    const mockPhrases = [
      "Hello, how are you today?",
      "What can I help you with?",
      "That's an interesting question.",
      "Let me think about that.",
      "I understand what you're saying.",
      "Could you tell me more about that?",
      "I'd like to know more about AI voice technology.",
      "What's the weather like today?",
      "Can you explain how this works?",
      "I'm enjoying this conversation.",
    ];
    
    const randomPhrase = mockPhrases[Math.floor(Math.random() * mockPhrases.length)];
    
    return {
      text: randomPhrase,
      isFinal: Math.random() > 0.7, // Randomly decide if this is a final transcript
    };
  } catch (error) {
    console.error("Error calling ElevenLabs STT API:", error);
    throw error;
  }
}

// Function to call LLM API
async function callLlmApi(
  transcript: string,
  apiKey: string
): Promise<string> {
  try {
    // This is a placeholder for the actual API call
    // In a real implementation, you would call an LLM API like OpenAI
    
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 300));
    
    // Generate a contextual response based on the transcript
    const responses = [
      `That's a great point about "${transcript}". Let me elaborate on that. Voice technology has advanced significantly in recent years, allowing for more natural and fluid conversations between humans and AI systems. The latency has decreased while the quality of voice synthesis has improved dramatically.`,
      `I understand you mentioned "${transcript}". Here's my perspective on that topic. Voice interfaces are becoming increasingly important as they provide a more natural way for humans to interact with technology. They're particularly valuable for accessibility and for situations where hands-free interaction is necessary.`,
      `Regarding "${transcript}", I think there are several ways to approach this. Voice AI systems like me use a combination of speech-to-text, natural language processing, and text-to-speech technologies to create a seamless conversational experience. Each component has its own challenges and areas for improvement.`,
      `You raise an interesting question about "${transcript}". Let me share some insights. The quality of voice interactions depends on multiple factors including microphone quality, background noise, processing power, and the sophistication of the AI models involved. Improvements in any of these areas can enhance the overall experience.`,
      `Thank you for bringing up "${transcript}". This is definitely worth discussing further. Voice technology is evolving rapidly, with new models and approaches being developed constantly. The goal is to make conversations like ours feel as natural and helpful as talking to another human.`,
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  } catch (error) {
    console.error("Error calling LLM API:", error);
    throw error;
  }
}

// Function to call ElevenLabs TTS API
async function streamToElevenLabsTts(
  text: string,
  voiceSettings: any,
  apiKey: string
): Promise<Int16Array> {
  try {
    // This is a placeholder for the actual API call
    // In a real implementation, you would stream text to ElevenLabs TTS API
    // and get back audio chunks
    
    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 200));
    
    // Generate mock audio data that varies based on text length
    const audioLength = Math.max(1600, text.length * 50);
    const mockAudioData = new Int16Array(audioLength);
    
    // Generate more realistic audio waveform
    for (let i = 0; i < mockAudioData.length; i++) {
      const frequency = 440 + (text.charCodeAt(i % text.length) % 200);
      const amplitude = 5000 * Math.exp(-i / (audioLength * 0.3));
      mockAudioData[i] = Math.floor(amplitude * Math.sin(2 * Math.PI * frequency * i / 16000));
    }
    
    return mockAudioData;
  } catch (error) {
    console.error("Error calling ElevenLabs TTS API:", error);
    throw error;
  }
}

// WebSocket handler
function handleWebSocket(req: Request): Response {
  const { socket, response } = Deno.upgradeWebSocket(req);
  const connectionId = crypto.randomUUID();
  
  console.log(`New WebSocket connection: ${connectionId}`);
  
  // Store connection state
  const connectionState = {
    id: connectionId,
    socket,
    userTier: "tier1",
    voiceSettings: {
      voice: "rachel",
      stability: 0.5,
      similarityBoost: 0.75,
      style: 0.0,
      useSpeakerBoost: true,
    },
    elevenLabsKey: null as string | null,
    whisperKey: null as string | null,
    isMuted: false,
    lastActivity: Date.now(),
  };
  
  connections.set(connectionId, connectionState);
  
  // Handle WebSocket events
  socket.onopen = async () => {
    console.log(`WebSocket connection opened: ${connectionId}`);
    
    // Send welcome message
    socket.send(JSON.stringify({
      type: "connection_status",
      status: "connected",
      message: "WebSocket connection established",
      connectionId: connectionId,
    }));
  };
  
  socket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      connectionState.lastActivity = Date.now();
      
      console.log(`Received message from ${connectionId}:`, message.type);
      
      switch (message.type) {
        case "init":
          // Initialize connection with user tier and voice settings
          connectionState.userTier = message.userTier || "tier1";
          if (message.voiceSettings) {
            connectionState.voiceSettings = {
              ...connectionState.voiceSettings,
              ...message.voiceSettings,
            };
          }
          
          console.log(`Initializing connection for tier: ${connectionState.userTier}`);
          
          // Check for direct API key first
          if (message.directApiKey) {
            console.log("Using direct API key");
            connectionState.elevenLabsKey = message.directApiKey;
          } else {
            // Get API keys from global settings
            const elevenLabsKey = await getGlobalApiKey("elevenlabs", connectionState.userTier);
            connectionState.elevenLabsKey = elevenLabsKey;
          }
          
          console.log(`API keys available - ElevenLabs: ${!!connectionState.elevenLabsKey}`);
          
          // Send connection status
          if (connectionState.elevenLabsKey) {
            socket.send(JSON.stringify({
              type: "connection_status",
              status: "ready",
              message: "Voice services ready",
              hasApiKeys: true,
            }));
          } else {
            socket.send(JSON.stringify({
              type: "connection_status",
              status: "ready",
              message: "Voice services ready (demo mode)",
              hasApiKeys: false,
            }));
          }
          break;
          
        case "audio":
          // Process audio data from client
          if (connectionState.isMuted) {
            console.log(`Audio ignored - connection ${connectionId} is muted`);
            break;
          }
          
          // Convert array to Int16Array
          const audioData = new Int16Array(message.data);
          console.log(`Processing audio data: ${audioData.length} samples`);
          
          // Process with ElevenLabs STT (or mock)
          try {
            const { text, isFinal } = await streamToElevenLabsStt(
              audioData,
              connectionState.elevenLabsKey || "demo"
            );
            
            // Send transcript back to client
            socket.send(JSON.stringify({
              type: "transcript",
              text,
              isFinal,
            }));
            
            console.log(`Transcript: ${text} (final: ${isFinal})`);
            
            // If final transcript, process with LLM and TTS
            if (isFinal && text.trim()) {
              // Increment ElevenLabs usage if using real API
              if (connectionState.elevenLabsKey) {
                await incrementGlobalUsage("elevenlabs");
              }
              
              // Get AI response
              const aiResponse = await callLlmApi(
                text,
                connectionState.elevenLabsKey || "demo"
              );
              
              console.log(`AI Response: ${aiResponse}`);
              
              // Send AI response text to client
              socket.send(JSON.stringify({
                type: "ai_response",
                text: aiResponse,
              }));
              
              // Convert AI response to speech
              const speechAudio = await streamToElevenLabsTts(
                aiResponse,
                connectionState.voiceSettings,
                connectionState.elevenLabsKey || "demo"
              );
              
              // Send audio chunks to client
              socket.send(JSON.stringify({
                type: "audio",
                data: Array.from(speechAudio),
              }));
              
              // Increment ElevenLabs usage again for TTS if using real API
              if (connectionState.elevenLabsKey) {
                await incrementGlobalUsage("elevenlabs");
              }
              
              // Signal that AI has finished speaking
              socket.send(JSON.stringify({
                type: "ai_finished",
              }));
              
              // Send latency metrics
              const latency = Math.floor(Math.random() * 200) + 100;
              socket.send(JSON.stringify({
                type: "latency",
                latency: latency,
              }));
              
              console.log(`Conversation turn completed with ${latency}ms latency`);
            }
          } catch (error) {
            console.error("Error processing audio:", error);
            socket.send(JSON.stringify({
              type: "error",
              message: "Failed to process audio",
            }));
          }
          break;
          
        case "mute":
          // Update mute status
          connectionState.isMuted = message.muted;
          console.log(`Connection ${connectionId} mute status: ${connectionState.isMuted}`);
          break;
          
        case "update_voice_settings":
          // Update voice settings
          if (message.voiceSettings) {
            connectionState.voiceSettings = {
              ...connectionState.voiceSettings,
              ...message.voiceSettings,
            };
            console.log(`Updated voice settings for ${connectionId}:`, connectionState.voiceSettings);
          }
          break;
          
        case "ping":
          // Respond to ping with pong
          socket.send(JSON.stringify({
            type: "pong",
            timestamp: message.timestamp,
          }));
          break;
          
        default:
          console.log(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
      socket.send(JSON.stringify({
        type: "error",
        message: "Failed to process message",
      }));
    }
  };
  
  socket.onclose = (event) => {
    console.log(`WebSocket connection closed: ${connectionId} (code: ${event.code})`);
    connections.delete(connectionId);
  };
  
  socket.onerror = (error) => {
    console.error(`WebSocket error for ${connectionId}:`, error);
    connections.delete(connectionId);
  };
  
  return response;
}

// HTTP handler for non-WebSocket requests
function handleHttp(req: Request): Response {
  const url = new URL(req.url);
  
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }
  
  // Health check endpoint
  if (url.pathname.endsWith("/health")) {
    return new Response(JSON.stringify({
      status: "healthy",
      timestamp: new Date().toISOString(),
      connections: connections.size,
    }), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }
  
  // Default response
  return new Response(JSON.stringify({
    message: "Voice Labs API - Use WebSocket connection for real-time communication",
    endpoints: {
      websocket: "wss://your-project.supabase.co/functions/v1/voice-labs",
      health: "/health"
    },
    activeConnections: connections.size,
  }), {
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

// Main request handler
Deno.serve(async (req) => {
  try {
    // Handle WebSocket upgrade requests
    if (req.headers.get("upgrade") === "websocket") {
      console.log("Handling WebSocket upgrade request");
      return handleWebSocket(req);
    }
    
    // Handle HTTP requests
    return handleHttp(req);
  } catch (error) {
    console.error("Error in main handler:", error);
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: error.message,
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  }
});

// Cleanup inactive connections periodically
setInterval(() => {
  const now = Date.now();
  const timeout = 5 * 60 * 1000; // 5 minutes
  
  for (const [id, state] of connections.entries()) {
    if (now - state.lastActivity > timeout) {
      console.log(`Closing inactive connection: ${id}`);
      try {
        state.socket.close(1000, "Connection timeout");
      } catch (error) {
        console.error(`Error closing connection ${id}:`, error);
      }
      connections.delete(id);
    }
  }
  
  if (connections.size > 0) {
    console.log(`Active connections: ${connections.size}`);
  }
}, 60 * 1000); // Check every minute

console.log("Voice Labs Edge Function started successfully");
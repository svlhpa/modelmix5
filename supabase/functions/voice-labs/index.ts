// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

// WebSocket connections pool
const connections = new Map();

// Create a Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Function to get global API key
async function getGlobalApiKey(provider: string, userTier: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("get_global_api_key", {
      provider_name: provider,
      user_tier: userTier,
    });

    if (error) {
      console.error("Error getting global API key:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Failed to get global API key:", error);
    return null;
  }
}

// Function to increment global API key usage
async function incrementGlobalUsage(provider: string): Promise<void> {
  try {
    const { error } = await supabase.rpc("increment_global_usage", {
      provider_name: provider,
    });

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
    return {
      text: "This is a simulated transcript from ElevenLabs STT API",
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
    
    // For demo purposes, return a mock response
    return `This is a simulated response to: "${transcript}"`;
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
    
    // For demo purposes, return a mock audio buffer
    const mockAudioData = new Int16Array(1600);
    for (let i = 0; i < mockAudioData.length; i++) {
      mockAudioData[i] = Math.floor(Math.sin(i / 10) * 10000);
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
  };
  
  socket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      connectionState.lastActivity = Date.now();
      
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
          
          // Get API keys
          const [elevenLabsKey, whisperKey] = await Promise.all([
            getGlobalApiKey("elevenlabs", connectionState.userTier),
            getGlobalApiKey("openai_whisper", connectionState.userTier),
          ]);
          
          connectionState.elevenLabsKey = elevenLabsKey;
          connectionState.whisperKey = whisperKey;
          
          // Send connection status
          if (elevenLabsKey && whisperKey) {
            socket.send(JSON.stringify({
              type: "connection_status",
              status: "ready",
              message: "Voice services ready",
            }));
          } else {
            socket.send(JSON.stringify({
              type: "error",
              message: "API keys not available. Please contact support.",
            }));
          }
          break;
          
        case "audio":
          // Process audio data from client
          if (connectionState.isMuted) break;
          
          // Convert array to Int16Array
          const audioData = new Int16Array(message.data);
          
          // Process with ElevenLabs STT
          if (connectionState.elevenLabsKey) {
            try {
              const { text, isFinal } = await streamToElevenLabsStt(
                audioData,
                connectionState.elevenLabsKey
              );
              
              // Send transcript back to client
              socket.send(JSON.stringify({
                type: "transcript",
                text,
                isFinal,
              }));
              
              // If final transcript, process with LLM and TTS
              if (isFinal && text.trim()) {
                // Increment ElevenLabs usage
                await incrementGlobalUsage("elevenlabs");
                
                // Get AI response
                const aiResponse = await callLlmApi(
                  text,
                  connectionState.whisperKey || ""
                );
                
                // Send AI response text to client
                socket.send(JSON.stringify({
                  type: "ai_response",
                  text: aiResponse,
                }));
                
                // Convert AI response to speech
                const speechAudio = await streamToElevenLabsTts(
                  aiResponse,
                  connectionState.voiceSettings,
                  connectionState.elevenLabsKey
                );
                
                // Send audio chunks to client
                socket.send(JSON.stringify({
                  type: "audio",
                  data: Array.from(speechAudio),
                }));
                
                // Increment ElevenLabs usage again for TTS
                await incrementGlobalUsage("elevenlabs");
                
                // Signal that AI has finished speaking
                socket.send(JSON.stringify({
                  type: "ai_finished",
                }));
                
                // Send latency metrics
                socket.send(JSON.stringify({
                  type: "latency",
                  latency: Math.floor(Math.random() * 200) + 100, // Simulated latency between 100-300ms
                }));
              }
            } catch (error) {
              console.error("Error processing audio:", error);
              socket.send(JSON.stringify({
                type: "error",
                message: "Failed to process audio",
              }));
            }
          }
          break;
          
        case "mute":
          // Update mute status
          connectionState.isMuted = message.muted;
          break;
          
        case "update_voice_settings":
          // Update voice settings
          if (message.voiceSettings) {
            connectionState.voiceSettings = {
              ...connectionState.voiceSettings,
              ...message.voiceSettings,
            };
          }
          break;
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
      socket.send(JSON.stringify({
        type: "error",
        message: "Failed to process message",
      }));
    }
  };
  
  socket.onclose = () => {
    console.log(`WebSocket connection closed: ${connectionId}`);
    connections.delete(connectionId);
  };
  
  socket.onerror = (error) => {
    console.error(`WebSocket error for ${connectionId}:`, error);
    connections.delete(connectionId);
  };
  
  return response;
}

// HTTP handler
function handleHttp(req: Request): Response {
  return new Response(JSON.stringify({
    message: "Voice Labs API - Use WebSocket connection",
  }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

// Main request handler
serve((req) => {
  // Handle WebSocket upgrade requests
  if (req.headers.get("upgrade") === "websocket") {
    return handleWebSocket(req);
  }
  
  // Handle HTTP requests
  return handleHttp(req);
});

// Cleanup inactive connections periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, state] of connections.entries()) {
    if (now - state.lastActivity > 5 * 60 * 1000) { // 5 minutes
      console.log(`Closing inactive connection: ${id}`);
      state.socket.close();
      connections.delete(id);
    }
  }
}, 60 * 1000); // Check every minute
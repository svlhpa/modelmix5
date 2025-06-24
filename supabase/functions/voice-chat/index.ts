// This is a Supabase Edge Function for handling real-time voice chat
// It acts as a WebSocket server and communicates with Eleven Labs API

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

// Create a Supabase client
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Eleven Labs API configuration
const ELEVEN_LABS_API_URL = "https://api.elevenlabs.io/v1";

// Function to get global API key for Eleven Labs
async function getElevenLabsApiKey(userTier: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("get_global_api_key", {
      provider_name: "elevenlabs",
      user_tier: userTier,
    });

    if (error) {
      console.error("Error getting Eleven Labs API key:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error in getElevenLabsApiKey:", error);
    return null;
  }
}

// Function to get global API key for OpenAI Whisper
async function getWhisperApiKey(userTier: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc("get_global_api_key", {
      provider_name: "openai_whisper",
      user_tier: userTier,
    });

    if (error) {
      console.error("Error getting Whisper API key:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error in getWhisperApiKey:", error);
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
      console.error(`Error incrementing ${provider} usage:`, error);
    }
  } catch (error) {
    console.error(`Error in incrementGlobalUsage for ${provider}:`, error);
  }
}

// Function to convert text to speech using Eleven Labs API
async function textToSpeech(
  text: string,
  voiceId: string,
  apiKey: string,
  voiceSettings?: {
    stability: number;
    similarity_boost: number;
    style?: number;
  }
): Promise<Response> {
  try {
    const response = await fetch(
      `${ELEVEN_LABS_API_URL}/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          voice_id: voiceId,
          model_id: "eleven_turbo_v2",
          voice_settings: voiceSettings || {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to convert text to speech: ${response.status}`);
    }

    return response;
  } catch (error) {
    console.error("Error in textToSpeech:", error);
    throw error;
  }
}

// Function to stream text to speech using Eleven Labs API
async function streamTextToSpeech(
  text: string,
  voiceId: string,
  apiKey: string,
  voiceSettings?: {
    stability: number;
    similarity_boost: number;
    style?: number;
  }
): Promise<Response> {
  try {
    const response = await fetch(
      `${ELEVEN_LABS_API_URL}/text-to-speech/${voiceId}/stream`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          voice_id: voiceId,
          model_id: "eleven_monolingual_v1", // Streaming-optimized model
          voice_settings: voiceSettings || {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.5,
          },
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to stream text to speech: ${response.status}`);
    }

    return response;
  } catch (error) {
    console.error("Error in streamTextToSpeech:", error);
    throw error;
  }
}

// Function to transcribe audio using OpenAI Whisper API
async function speechToText(
  audioBlob: Blob,
  apiKey: string
): Promise<string> {
  try {
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.webm");
    formData.append("model", "whisper-1");

    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to transcribe audio: ${response.status}`);
    }

    const data = await response.json();
    return data.text || "";
  } catch (error) {
    console.error("Error in speechToText:", error);
    throw error;
  }
}

// Function to generate AI response
async function generateAIResponse(
  userMessage: string,
  agentId: string,
  agentName: string
): Promise<string> {
  // In a real implementation, this would call an LLM API
  // For now, we'll return a simple response based on the agent
  
  const responses: Record<string, string[]> = {
    "support-agent": [
      `I understand your concern about "${userMessage}". Let me help you resolve this issue.`,
      `That's a great question about "${userMessage}". Here's what you need to know...`,
      `I'm here to help you with "${userMessage}". Let's work through this together.`
    ],
    "mindfulness-coach": [
      `Take a deep breath. Let's approach "${userMessage}" mindfully.`,
      `I hear what you're saying about "${userMessage}". Let's explore how to bring more clarity to this situation.`,
      `"${userMessage}" is a common challenge. Here's a mindfulness technique that might help...`
    ],
    "sales-agent": [
      `That's a great point about "${userMessage}"! Our voice technology can definitely help with that.`,
      `Many of our customers have had similar questions about "${userMessage}". Here's how our solution addresses that need...`,
      `I'd be happy to explain how our platform can transform "${userMessage}" for you.`
    ],
    "wizard": [
      `Ah, "${userMessage}" is an interesting quest indeed. The ancient scrolls speak of such matters...`,
      `The path of "${userMessage}" requires wisdom. Let me share what the stars have revealed...`,
      `Many have walked the road of "${userMessage}" before you. Here's what the mystical realms suggest...`
    ]
  };
  
  const agentResponses = responses[agentId] || responses["support-agent"];
  return agentResponses[Math.floor(Math.random() * agentResponses.length)];
}

// Main handler for the edge function
serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };

  // Handle OPTIONS request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Parse request
  try {
    const { action, userTier, voiceId, text, agentId, agentName, voiceSettings } = await req.json();

    // Get API keys
    const elevenLabsApiKey = await getElevenLabsApiKey(userTier || "tier1");
    const whisperApiKey = await getWhisperApiKey(userTier || "tier1");

    if (!elevenLabsApiKey) {
      return new Response(
        JSON.stringify({ error: "Eleven Labs API key not available" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Handle different actions
    switch (action) {
      case "text-to-speech": {
        if (!voiceId || !text) {
          return new Response(
            JSON.stringify({ error: "Missing required parameters" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Convert text to speech
        const ttsResponse = await textToSpeech(
          text,
          voiceId,
          elevenLabsApiKey,
          voiceSettings
        );

        // Increment usage
        await incrementGlobalUsage("elevenlabs");

        // Return audio
        const audioBlob = await ttsResponse.blob();
        return new Response(audioBlob, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "audio/mpeg",
          },
        });
      }

      case "stream-text-to-speech": {
        if (!voiceId || !text) {
          return new Response(
            JSON.stringify({ error: "Missing required parameters" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Stream text to speech
        const streamResponse = await streamTextToSpeech(
          text,
          voiceId,
          elevenLabsApiKey,
          voiceSettings
        );

        // Increment usage
        await incrementGlobalUsage("elevenlabs");

        // Return streaming audio
        return new Response(streamResponse.body, {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "audio/mpeg",
            "Transfer-Encoding": "chunked",
          },
        });
      }

      case "speech-to-text": {
        if (!whisperApiKey) {
          return new Response(
            JSON.stringify({ error: "Whisper API key not available" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Get audio blob from request
        const formData = await req.formData();
        const audioFile = formData.get("audio") as File;

        if (!audioFile) {
          return new Response(
            JSON.stringify({ error: "No audio file provided" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Convert speech to text
        const transcription = await speechToText(
          await audioFile.arrayBuffer(),
          whisperApiKey
        );

        // Increment usage
        await incrementGlobalUsage("openai_whisper");

        return new Response(
          JSON.stringify({ text: transcription }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      case "generate-response": {
        if (!agentId || !text) {
          return new Response(
            JSON.stringify({ error: "Missing required parameters" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Generate AI response
        const response = await generateAIResponse(text, agentId, agentName || "AI");

        return new Response(
          JSON.stringify({ response }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
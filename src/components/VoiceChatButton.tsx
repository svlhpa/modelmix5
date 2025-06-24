import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, Volume2, AlertCircle } from 'lucide-react';
import { elevenLabsService } from '../services/elevenLabsService';
import { whisperService } from '../services/whisperService';
import { aiService } from '../services/aiService';
import { useAuth } from '../hooks/useAuth';

interface VoiceChatButtonProps {
  onSendMessage: (message: string) => Promise<void>;
  disabled?: boolean;
}

export const VoiceChatButton: React.FC<VoiceChatButtonProps> = ({ 
  onSendMessage,
  disabled = false
}) => {
  const { getCurrentTier } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const currentTier = getCurrentTier();

  useEffect(() => {
    checkAvailability();
    
    return () => {
      // Clean up on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, []);

  const checkAvailability = async () => {
    try {
      const [elevenLabsAvailable, whisperAvailable] = await Promise.all([
        elevenLabsService.isAvailable(currentTier),
        whisperService.isAvailable(currentTier)
      ]);
      
      setIsAvailable(elevenLabsAvailable && whisperAvailable);
    } catch (error) {
      console.error('Failed to check voice chat availability:', error);
      setIsAvailable(false);
    }
  };

  const startRecording = async () => {
    if (disabled) return;
    
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
      setError('Mic access denied');
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
        { language: 'en' },
        currentTier,
        abortControllerRef.current.signal
      );
      
      if (transcribedText.trim()) {
        // Send the transcribed message
        await onSendMessage(transcribedText);
        
        // Get the last AI response for TTS
        // This is a simplified approach - in a real app, you'd get the actual response
        // For now, we'll generate a simple response
        const response = "I've received your voice message and processed it. Here's my response.";
        
        // Generate speech from AI response
        const audioBlob = await elevenLabsService.textToSpeech(
          {
            text: response,
            voice_id: 'pNInz6obpgDQGcFmaJgB', // Default voice (Adam)
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75
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
        
        // Auto-play the response
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play()
            .then(() => setIsPlaying(true))
            .catch(err => console.error('Failed to auto-play audio:', err));
        }
      } else {
        setError('No speech detected');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Voice chat operation aborted');
        return;
      }
      
      console.error('Voice chat error:', error);
      setError('Processing failed');
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
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
    
    setError(null);
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  if (!isAvailable) return null;

  return (
    <div className="relative">
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled || isProcessing}
        className={`p-2 rounded-full transition-colors ${
          isRecording 
            ? 'bg-red-100 text-red-600 hover:bg-red-200' 
            : isProcessing
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
        }`}
        title={isRecording ? 'Stop recording' : 'Start voice chat'}
      >
        {isRecording ? (
          <MicOff size={20} />
        ) : isProcessing ? (
          <Loader2 size={20} className="animate-spin" />
        ) : (
          <Mic size={20} />
        )}
      </button>
      
      {/* Audio Element (Hidden) */}
      <audio
        ref={audioRef}
        src={audioUrl || ''}
        onEnded={handleAudioEnded}
        className="hidden"
      />
      
      {/* Playing Indicator */}
      {isPlaying && (
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
          <Volume2 size={10} className="text-white" />
        </div>
      )}
      
      {/* Error Indicator */}
      {error && (
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center" title={error}>
          <AlertCircle size={10} className="text-white" />
        </div>
      )}
    </div>
  );
};
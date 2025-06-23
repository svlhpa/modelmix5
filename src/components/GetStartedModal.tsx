import React, { useState, useEffect } from 'react';
import { X, Play, CheckCircle, Loader2, Youtube } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface GetStartedModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  userId: string;
}

export const GetStartedModal: React.FC<GetStartedModalProps> = ({
  isOpen,
  onClose,
  videoUrl,
  userId
}) => {
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [hasWatched, setHasWatched] = useState(false);
  const [isMarking, setIsMarking] = useState(false);

  // Extract YouTube video ID from URL
  const getYouTubeVideoId = (url: string): string | null => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const videoId = getYouTubeVideoId(videoUrl);
  const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1` : null;

  const handleMarkAsWatched = async () => {
    if (!userId || isMarking) return;

    console.log('Marking video as watched for user:', userId);
    setIsMarking(true);
    
    try {
      // Call the database function to mark video as watched
      const { data, error } = await supabase.rpc('mark_get_started_video_viewed', {
        target_user_id: userId
      });

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      console.log('Successfully marked video as watched');
      setHasWatched(true);
      
      // Auto-close after a short delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error('Failed to mark video as watched:', error);
      // Still close the modal even if there's an error
      setTimeout(() => {
        onClose();
      }, 1000);
    } finally {
      setIsMarking(false);
    }
  };

  const handleSkip = async () => {
    console.log('User skipped video');
    // Mark as watched even when skipped
    await handleMarkAsWatched();
  };

  const handleClose = async () => {
    console.log('User closed modal');
    // Mark as watched when closed
    await handleMarkAsWatched();
  };

  if (!isOpen || !embedUrl) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden transform animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-blue-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/20 rounded-lg animate-bounceIn">
                <Play size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Welcome to ModelMix! 🎉</h2>
                <p className="text-emerald-100">Let's get you started with a quick overview</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-white/20 transition-all duration-200 hover:scale-110"
              disabled={isMarking}
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Video Content */}
        <div className="p-6">
          <div className="relative bg-black rounded-lg overflow-hidden mb-6" style={{ aspectRatio: '16/9' }}>
            {!isVideoLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <div className="text-center text-white">
                  <Youtube size={48} className="mx-auto mb-4 text-red-500" />
                  <p className="text-lg font-medium mb-2">Loading video...</p>
                  <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              </div>
            )}
            
            <iframe
              src={embedUrl}
              className="w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={() => setIsVideoLoaded(true)}
              title="Get Started with ModelMix"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
            {!hasWatched ? (
              <>
                <button
                  onClick={handleMarkAsWatched}
                  disabled={isMarking}
                  className="flex items-center space-x-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 transform"
                >
                  {isMarking ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Marking as watched...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={18} />
                      <span>I've watched this - Let's start!</span>
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleSkip}
                  disabled={isMarking}
                  className="px-6 py-3 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                  Skip for now
                </button>
              </>
            ) : (
              <div className="flex items-center space-x-2 text-emerald-600 animate-fadeInUp">
                <CheckCircle size={20} className="animate-bounceIn" />
                <span className="font-medium">Great! You're all set to explore ModelMix</span>
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounde d-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">What you'll learn in this video:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• How to compare AI responses from multiple models</li>
              <li>• Setting up your API keys for personalized access</li>
              <li>• Understanding the analytics dashboard</li>
              <li>• Tips for getting the best results from AI models</li>
              <li>• Exploring advanced features like image generation and debates</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, CreditCard, Loader2 } from 'lucide-react';
import { paypalService } from '../services/paypalService';

interface PayPalButtonProps {
  onSuccess: (details: any) => void;
  onError: (error: any) => void;
  disabled?: boolean;
  className?: string;
}

export const PayPalButton: React.FC<PayPalButtonProps> = ({
  onSuccess,
  onError,
  disabled = false,
  className = ''
}) => {
  const paypalRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [containerId] = useState(`paypal-button-container-${Math.random().toString(36).substr(2, 9)}`);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    // Longer delay to ensure DOM is ready
    const timer = setTimeout(() => {
      initializePayPal();
    }, 500);

    return () => clearTimeout(timer);
  }, [retryCount]);

  const initializePayPal = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if PayPal is configured
      if (!paypalService.isConfigured()) {
        setError('PayPal is not configured. Please add your PayPal Client ID to the environment variables.');
        setIsConfigured(false);
        setLoading(false);
        return;
      }

      setIsConfigured(true);

      // Ensure the container exists before initializing
      if (!paypalRef.current) {
        setError('Payment container not ready');
        setLoading(false);
        return;
      }

      // Clear any existing content
      paypalRef.current.innerHTML = '';

      // Add another delay to ensure everything is ready
      await new Promise(resolve => setTimeout(resolve, 200));

      // Initialize PayPal buttons with the container reference
      await paypalService.initializePayPalButtons(
        containerId,
        (details) => {
          console.log('PayPal payment successful:', details);
          onSuccess(details);
        },
        (error) => {
          console.error('PayPal payment error:', error);
          const errorMessage = error?.message || error?.toString() || 'Payment failed';
          setError(errorMessage);
          onError(error);
        }
      );
    } catch (error) {
      console.error('Failed to initialize PayPal:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load payment system';
      setError(errorMessage);
      onError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  if (!isConfigured && !loading) {
    return (
      <div className={`p-4 bg-amber-50 border border-amber-200 rounded-lg ${className}`}>
        <div className="flex items-center space-x-2 text-amber-700">
          <AlertCircle size={20} />
          <div>
            <p className="font-medium">Payment System Not Configured</p>
            <p className="text-sm">
              PayPal integration requires a Client ID. Please add <code>VITE_PAYPAL_CLIENT_ID</code> to your environment variables.
            </p>
            <div className="mt-2 text-xs bg-amber-100 p-2 rounded">
              <p><strong>Setup Instructions:</strong></p>
              <p>1. Go to <a href="https://developer.paypal.com/" target="_blank" rel="noopener noreferrer" className="underline">PayPal Developer</a></p>
              <p>2. Create an app and get your Client ID</p>
              <p>3. Add it to your .env file as VITE_PAYPAL_CLIENT_ID</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <div className="flex items-center space-x-2 text-red-700 mb-3">
          <AlertCircle size={20} />
          <div>
            <p className="font-medium">Payment Error</p>
            <p className="text-sm">{error}</p>
            {error.includes('create') && (
              <p className="text-xs mt-1 bg-red-100 p-2 rounded">
                This error usually means the PayPal SDK is not fully loaded. Try refreshing the page or check your internet connection.
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleRetry}
          className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <CreditCard size={16} />
          <span>Retry Payment Setup</span>
        </button>
      </div>
    );
  }

  return (
    <div className={className}>
      {loading && (
        <div className="flex items-center justify-center p-8 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center space-x-3 text-gray-600">
            <Loader2 size={20} className="animate-spin" />
            <span>Loading PayPal...</span>
          </div>
        </div>
      )}
      
      <div
        ref={paypalRef}
        id={containerId}
        className={`${loading ? 'hidden' : 'block'} ${disabled ? 'opacity-50 pointer-events-none' : ''} min-h-[50px]`}
      />
      
      {!loading && isConfigured && (
        <div className="mt-3 text-center">
          <p className="text-xs text-gray-500">
            Secure payment powered by PayPal
          </p>
          <div className="flex items-center justify-center space-x-1 mt-1">
            <CheckCircle size={12} className="text-green-500" />
            <span className="text-xs text-green-600">SSL Encrypted</span>
          </div>
        </div>
      )}
    </div>
  );
};
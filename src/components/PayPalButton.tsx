import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, CreditCard, Loader2, RefreshCw } from 'lucide-react';
import { paypalService } from '../services/paypalService';

interface PayPalButtonProps {
  onSuccess: (details: any) => void;
  onError: (error: any) => void;
  disabled?: boolean;
  className?: string;
  isRecurring?: boolean;
}

export const PayPalButton: React.FC<PayPalButtonProps> = ({
  onSuccess,
  onError,
  disabled = false,
  className = '',
  isRecurring = false
}) => {
  const paypalRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [containerId] = useState(`paypal-button-container-${Math.random().toString(36).substr(2, 9)}`);
  const [retryCount, setRetryCount] = useState(0);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    console.log('PayPal Button component mounted, initializing...');
    initializePayPal();
    
    // Cleanup function to prevent memory leaks
    return () => {
      if (paypalRef.current) {
        paypalRef.current.innerHTML = '';
      }
      setIsInitialized(false);
    };
  }, [retryCount]);

  // Effect to handle container changes
  useEffect(() => {
    if (isInitialized && paypalRef.current && !paypalRef.current.hasChildNodes()) {
      console.log('PayPal container detected as empty, reinitializing...');
      setIsInitialized(false);
      initializePayPal();
    }
  }, [isInitialized]);

  const initializePayPal = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Checking PayPal configuration...');
      
      // Get debug info
      const envInfo = paypalService.getEnvironmentInfo();
      setDebugInfo(envInfo);
      console.log('PayPal environment info:', envInfo);

      // Check if PayPal is configured
      if (!paypalService.isConfigured()) {
        setError('PayPal is not configured. Please add your PayPal Client ID to the environment variables.');
        setIsConfigured(false);
        setLoading(false);
        return;
      }

      setIsConfigured(true);
      console.log('PayPal is configured, proceeding with initialization...');

      // Wait for DOM to be ready and ensure container exists
      await new Promise(resolve => setTimeout(resolve, 500));

      // Ensure the container exists and is in the DOM
      if (!paypalRef.current) {
        throw new Error('PayPal container ref not found');
      }

      // Check if container is actually in the DOM
      if (!document.contains(paypalRef.current)) {
        throw new Error('PayPal container not in DOM');
      }

      console.log('PayPal container found and in DOM, initializing buttons...');

      // Clear any existing content
      paypalRef.current.innerHTML = '';

      // Initialize PayPal buttons with better error handling
      await paypalService.initializePayPalButtons(
        containerId,
        (details) => {
          console.log('PayPal payment successful:', details);
          setIsInitialized(true);
          onSuccess(details);
        },
        (error) => {
          console.error('PayPal payment error:', error);
          const errorMessage = error?.message || error?.toString() || 'Payment failed';
          setError(errorMessage);
          setIsInitialized(false);
          onError(error);
        },
        isRecurring
      );

      console.log('PayPal buttons initialized successfully');
      setIsInitialized(true);
      setLoading(false);
    } catch (error) {
      console.error('Failed to initialize PayPal:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load payment system';
      setError(errorMessage);
      setIsInitialized(false);
      onError(error);
      setLoading(false);
    }
  };

  const handleRetry = () => {
    console.log('Retrying PayPal initialization...');
    setIsInitialized(false);
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
            {debugInfo && (
              <div className="mt-2 text-xs bg-amber-100 p-2 rounded">
                <p><strong>Debug Info:</strong></p>
                <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
              </div>
            )}
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
            {error.includes('container') && (
              <p className="text-xs mt-1 bg-red-100 p-2 rounded">
                This error indicates the PayPal button container was removed from the page. This can happen when:
                <br />• The modal is closed and reopened quickly
                <br />• React re-renders the component
                <br />• Navigation occurs during initialization
              </p>
            )}
            {error.includes('SDK') && (
              <p className="text-xs mt-1 bg-red-100 p-2 rounded">
                This error usually means the PayPal SDK failed to load. This could be due to:
                <br />• Network connectivity issues
                <br />• Invalid PayPal Client ID
                <br />• Browser blocking the PayPal script
                <br />• Ad blockers or privacy extensions
              </p>
            )}
            {debugInfo && (
              <div className="mt-2 text-xs bg-red-100 p-2 rounded">
                <p><strong>Debug Info:</strong></p>
                <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleRetry}
          className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <RefreshCw size={16} />
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
            <div className="text-center">
              <p>Loading PayPal...</p>
              <p className="text-xs text-gray-500 mt-1">
                This may take a few seconds
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div
        ref={paypalRef}
        id={containerId}
        className={`${loading ? 'hidden' : 'block'} ${disabled ? 'opacity-50 pointer-events-none' : ''} min-h-[50px]`}
        style={{ minHeight: '50px' }}
      />
      
      {!loading && isConfigured && isInitialized && (
        <div className="mt-3 text-center">
          <p className="text-xs text-gray-500">
            Secure payment powered by PayPal
            {isRecurring && <span className="block">Monthly subscription</span>}
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
import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, CreditCard, Loader2, Shield, Crown } from 'lucide-react';
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
  isRecurring = true // Changed to true for subscriptions
}) => {
  const paypalRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [containerId] = useState(`paypal-button-container-${Math.random().toString(36).substr(2, 9)}`);
  const [retryCount, setRetryCount] = useState(0);
  const [connectionTested, setConnectionTested] = useState(false);
  const [planVerified, setPlanVerified] = useState(false);
  const [initializationAttempts, setInitializationAttempts] = useState(0);

  useEffect(() => {
    // Reset state on retry
    if (retryCount > 0) {
      setLoading(true);
      setError(null);
      setConnectionTested(false);
      setPlanVerified(false);
    }

    const initializePayPal = async () => {
      try {
        console.log(`PayPal subscription initialization attempt ${initializationAttempts + 1}`);
        setLoading(true);
        setError(null);

        // Check if PayPal is configured
        if (!paypalService.isConfigured()) {
          setError('PayPal is not configured. Please check your environment variables.');
          setIsConfigured(false);
          setLoading(false);
          return;
        }

        setIsConfigured(true);
        console.log('PayPal configuration verified');

        // Test API connection
        console.log('Testing PayPal API connection...');
        const connectionOk = await paypalService.testConnection();
        setConnectionTested(connectionOk);
        
        if (!connectionOk) {
          setError('Failed to connect to PayPal API. Please check your credentials.');
          setLoading(false);
          return;
        }

        console.log('PayPal API connection successful');

        // Verify subscription plan
        console.log('Verifying subscription plan...');
        const planOk = await paypalService.verifySubscriptionPlan();
        setPlanVerified(planOk);
        
        if (!planOk) {
          setError('Subscription plan not found. Please verify your plan ID is correct.');
          setLoading(false);
          return;
        }

        console.log('Subscription plan verified');

        // Wait for container to be ready
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Initialize PayPal buttons
        console.log('Initializing PayPal subscription buttons...');
        await initializeButtons();
        
        console.log('PayPal subscription initialization completed successfully');
        setLoading(false);
        
      } catch (error) {
        console.error('PayPal initialization error:', error);
        setError(error instanceof Error ? error.message : 'Failed to initialize PayPal');
        setLoading(false);
      } finally {
        setInitializationAttempts(prev => prev + 1);
      }
    };

    // Delay initialization to ensure DOM is ready
    const timer = setTimeout(() => {
      initializePayPal();
    }, 1000);

    return () => clearTimeout(timer);
  }, [retryCount]);

  const initializeButtons = async () => {
    try {
      // Ensure the container exists
      if (!paypalRef.current) {
        throw new Error('Payment container not ready');
      }

      console.log('Container found, initializing PayPal subscription buttons...');

      // Initialize PayPal buttons
      await paypalService.initializePayPalButtons(
        containerId,
        (details) => {
          console.log('PayPal subscription successful:', details);
          onSuccess(details);
        },
        (error) => {
          console.error('PayPal subscription error:', error);
          const errorMessage = error?.message || error?.toString() || 'Subscription failed';
          setError(errorMessage);
          onError(error);
        },
        isRecurring
      );

    } catch (error) {
      console.error('Failed to initialize PayPal subscription buttons:', error);
      throw error;
    }
  };

  const handleRetry = () => {
    console.log('Retrying PayPal subscription initialization...');
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
              PayPal subscription integration requires proper configuration.
            </p>
            <div className="mt-2 text-xs bg-amber-100 p-2 rounded">
              <p><strong>Required Environment Variables:</strong></p>
              <p>• VITE_PAYPAL_CLIENT_ID</p>
              <p>• VITE_PAYPAL_CLIENT_SECRET</p>
              <p>• VITE_PAYPAL_ENVIRONMENT=production</p>
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
            <p className="font-medium">Subscription Setup Error</p>
            <p className="text-sm">{error}</p>
            {error.includes('credentials') && (
              <p className="text-xs mt-1 bg-red-100 p-2 rounded">
                Please verify your PayPal Client ID and Secret are correct for the production environment.
              </p>
            )}
            {error.includes('plan') && (
              <p className="text-xs mt-1 bg-red-100 p-2 rounded">
                The subscription plan ID (P-2A58044182497992VNBMPFYI) was not found. Please verify it exists in your PayPal account.
              </p>
            )}
            {error.includes('SDK') && (
              <p className="text-xs mt-1 bg-red-100 p-2 rounded">
                PayPal SDK failed to load. Please check your internet connection and try again.
              </p>
            )}
            <p className="text-xs mt-1 text-red-600">
              Attempt {initializationAttempts} - You can retry the setup below.
            </p>
          </div>
        </div>
        <button
          onClick={handleRetry}
          className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <CreditCard size={16} />
          <span>Retry Subscription Setup</span>
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
              <div>Setting up PayPal Subscription...</div>
              <div className="text-xs mt-1">
                {!connectionTested ? 'Testing connection...' : 
                 !planVerified ? 'Verifying plan...' : 
                 'Loading payment form...'}
              </div>
              <div className="text-xs">Attempt {initializationAttempts + 1}</div>
            </div>
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
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Shield size={12} className="text-green-500" />
            <span className="text-xs text-green-600">Production PayPal Gateway</span>
            {connectionTested && (
              <>
                <CheckCircle size={12} className="text-green-500" />
                <span className="text-xs text-green-600">Connected</span>
              </>
            )}
            {planVerified && (
              <>
                <Crown size={12} className="text-yellow-500" />
                <span className="text-xs text-yellow-600">Plan Verified</span>
              </>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Secure subscription powered by PayPal
            <span className="block">Recurring monthly subscription • $17.99/month</span>
          </p>
          <div className="flex items-center justify-center space-x-1 mt-1">
            <CheckCircle size={12} className="text-green-500" />
            <span className="text-xs text-green-600">SSL Encrypted • Live Environment</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Plan ID: {paypalService.getSubscriptionPlanId()}
          </p>
        </div>
      )}
    </div>
  );
};
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

  useEffect(() => {
    initializePayPal();
  }, []);

  const initializePayPal = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if PayPal is configured
      if (!paypalService.isConfigured()) {
        setError('PayPal is not configured. Please contact support.');
        setIsConfigured(false);
        setLoading(false);
        return;
      }

      setIsConfigured(true);

      // Initialize PayPal buttons
      if (paypalRef.current) {
        // Clear any existing content
        paypalRef.current.innerHTML = '';
        
        await paypalService.initializePayPalButtons(
          paypalRef.current.id,
          (details) => {
            console.log('PayPal payment successful:', details);
            onSuccess(details);
          },
          (error) => {
            console.error('PayPal payment error:', error);
            setError(error.message || 'Payment failed');
            onError(error);
          }
        );
      }
    } catch (error) {
      console.error('Failed to initialize PayPal:', error);
      setError(error instanceof Error ? error.message : 'Failed to load payment system');
      onError(error);
    } finally {
      setLoading(false);
    }
  };

  if (!isConfigured && !loading) {
    return (
      <div className={`p-4 bg-amber-50 border border-amber-200 rounded-lg ${className}`}>
        <div className="flex items-center space-x-2 text-amber-700">
          <AlertCircle size={20} />
          <div>
            <p className="font-medium">Payment System Not Configured</p>
            <p className="text-sm">PayPal integration is not set up. Please contact support to enable payments.</p>
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
          </div>
        </div>
        <button
          onClick={initializePayPal}
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
        id={`paypal-button-container-${Math.random().toString(36).substr(2, 9)}`}
        className={`${loading ? 'hidden' : 'block'} ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
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
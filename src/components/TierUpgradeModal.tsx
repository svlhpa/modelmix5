import React, { useState, useEffect } from 'react';
import { X, Crown, Check, Zap, Star, CreditCard, Loader2, Infinity, CheckCircle, AlertCircle, RefreshCw, Smartphone, Clock } from 'lucide-react';
import { tierService } from '../services/tierService';
import { TierLimits, UserTier } from '../types';
import { useAuth } from '../hooks/useAuth';
import { GCashPayment } from './GCashPayment';

interface TierUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier?: UserTier;
}

export const TierUpgradeModal: React.FC<TierUpgradeModalProps> = ({
  isOpen,
  onClose,
  currentTier = 'tier1'
}) => {
  const { refreshProfile } = useAuth();
  const [tiers, setTiers] = useState<TierLimits[]>([]);
  const [loading, setLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showRefreshPrompt, setShowRefreshPrompt] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'paypal' | 'gcash' | null>(null);
  const [showGCashForm, setShowGCashForm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTiers(tierService.getAllTiers());
      setPaymentSuccess(false);
      setPaymentError(null);
      setProcessingPayment(false);
      setShowRefreshPrompt(false);
      setSelectedPaymentMethod(null);
      setShowGCashForm(false);
    }
  }, [isOpen]);

  const handlePaymentSuccess = async (details: any) => {
    setProcessingPayment(true);
    setPaymentError(null);

    try {
      console.log('Payment successful:', details);
      
      // Add a small delay to ensure payment is fully processed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Upgrade user to Pro tier with improved error handling
      try {
        await tierService.upgradeTier('tier2');
        console.log('Tier upgrade successful');
      } catch (tierError) {
        console.error('Tier upgrade error:', tierError);
        
        // If it's an RLS error, try refreshing the session first
        if (tierError instanceof Error && tierError.message.includes('row-level security')) {
          console.log('RLS error detected, refreshing session...');
          await refreshProfile();
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Try upgrade again
          await tierService.upgradeTier('tier2');
        } else {
          throw tierError;
        }
      }
      
      // Refresh profile to get updated tier info
      await refreshProfile();
      
      console.log('Profile refreshed after upgrade');
      
      setPaymentSuccess(true);
      setProcessingPayment(false);
      setShowRefreshPrompt(true);
      
    } catch (error) {
      console.error('Error processing payment:', error);
      setPaymentError('Failed to process payment. Please try again.');
      setProcessingPayment(false);
    }
  };

  const handlePaymentError = (error: any) => {
    console.error('Payment error:', error);
    setPaymentError(error instanceof Error ? error.message : 'Payment failed');
    setProcessingPayment(false);
  };

  const handleSelectPaymentMethod = (method: 'paypal' | 'gcash') => {
    setSelectedPaymentMethod(method);
    if (method === 'gcash') {
      setShowGCashForm(true);
    } else {
      setShowGCashForm(false);
    }
  };

  const handleGCashSuccess = () => {
    setPaymentSuccess(true);
    setShowGCashForm(false);
  };

  const handleGCashCancel = () => {
    setShowGCashForm(false);
    setSelectedPaymentMethod(null);
  };

  const handleRefreshPage = () => {
    window.location.reload();
  };

  const formatLimit = (value: number, type: 'conversations' | 'models') => {
    if (value === -1) {
      return (
        <div className="flex items-center space-x-1">
          <Infinity size={16} className="animate-pulse" />
          <span>Unlimited</span>
        </div>
      );
    }
    return value.toString();
  };

  const isCurrentTier = (tier: UserTier) => tier === currentTier;
  const isUpgrade = (tier: UserTier) => {
    const tierOrder = { tier1: 1, tier2: 2 };
    return tierOrder[tier] > tierOrder[currentTier];
  };

  if (!isOpen) return null;

  // Payment success screen
  if (paymentSuccess) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
        <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto transform animate-slideUp">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {selectedPaymentMethod === 'gcash' 
                ? 'Payment Submitted Successfully!' 
                : 'Payment Successful!'}
            </h3>
            
            {selectedPaymentMethod === 'gcash' ? (
              <div className="space-y-4">
                <p className="text-gray-600">
                  Your GCash payment information has been submitted for verification.
                </p>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 text-blue-800 mb-2">
                    <Clock size={20} />
                    <span className="font-medium">Processing Time</span>
                  </div>
                  <p className="text-sm text-blue-700">
                    Your account will be upgraded to Pro within <strong>1 business day</strong> after payment verification.
                    You'll receive an email confirmation once your account is upgraded.
                  </p>
                </div>
                
                <button
                  onClick={onClose}
                  className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-gray-600 mb-4">
                  Your payment has been processed and your account has been upgraded to Pro!
                </p>
                
                {showRefreshPrompt && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 animate-pulse">
                    <div className="flex items-center space-x-2 text-yellow-800">
                      <RefreshCw size={20} />
                      <span className="font-medium">Please refresh the page</span>
                    </div>
                    <p className="text-sm text-yellow-700 mt-1">
                      To see your new Pro features, please refresh the page.
                    </p>
                    <button
                      onClick={handleRefreshPage}
                      className="w-full mt-2 py-2 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition-colors"
                    >
                      Refresh Now
                    </button>
                  </div>
                )}
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-800 mb-2 flex items-center">
                    <Crown size={16} className="mr-2 text-yellow-600" />
                    Pro Features Unlocked
                  </h4>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• Unlimited conversations</li>
                    <li>• Compare unlimited AI models</li>
                    <li>• Advanced analytics</li>
                    <li>• Priority support</li>
                    <li>• All premium features</li>
                  </ul>
                </div>
                
                <button
                  onClick={onClose}
                  className="w-full py-3 px-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                >
                  Start Using Pro Features
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Payment method selection or payment processing screens
  if (selectedPaymentMethod) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
        <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto transform animate-slideUp">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Crown size={20} className="text-yellow-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedPaymentMethod === 'paypal' 
                    ? 'Complete Your PayPal Payment' 
                    : 'Complete Your GCash Payment'}
                </h2>
                <p className="text-sm text-gray-500">
                  {selectedPaymentMethod === 'paypal'
                    ? 'Secure payment via PayPal - $18.00/month'
                    : 'Secure payment via GCash - ₱580.00 PHP'}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedPaymentMethod(null);
                setShowGCashForm(false);
              }}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              disabled={processingPayment}
            >
              <X size={20} className="text-gray-500" />
            </button>
          </div>

          {selectedPaymentMethod === 'paypal' ? (
            <div className="space-y-6">
              {paymentError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 animate-shakeX">
                  <div className="flex items-center space-x-2 text-red-700">
                    <AlertCircle size={20} />
                    <span className="font-medium">{paymentError}</span>
                  </div>
                </div>
              )}
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">Subscription Details</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">Plan</span>
                    <span className="font-medium">ModelMix Pro</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">Price</span>
                    <span className="font-medium">$18.00 USD/month</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">Billing</span>
                    <span className="font-medium">Monthly (recurring)</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">Payment Method</span>
                    <span className="font-medium">PayPal</span>
                  </div>
                </div>
              </div>
              
              <div id="paypal-button-container" className="min-h-[150px]">
                {/* PayPal button will be rendered here */}
              </div>
              
              <p className="text-xs text-gray-500 text-center">
                By completing this payment, you agree to our Terms of Service and Privacy Policy.
                Your subscription will automatically renew each month until cancelled.
              </p>
            </div>
          ) : showGCashForm ? (
            <GCashPayment 
              onSuccess={handleGCashSuccess}
              onCancel={handleGCashCancel}
            />
          ) : null}
        </div>
      </div>
    );
  }

  // Main plan selection screen
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-white rounded-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto transform animate-slideUp">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-yellow-100 rounded-lg animate-bounceIn">
              <Crown size={20} className="text-yellow-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Choose Your Plan</h2>
              <p className="text-sm text-gray-500">Unlock unlimited AI models and conversations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-all duration-200 hover:scale-110"
            disabled={loading}
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tiers.map((tier, index) => (
            <div
              key={tier.tier}
              className={`relative border-2 rounded-xl p-6 transition-all duration-300 hover:shadow-lg transform hover:scale-105 animate-fadeInUp ${
                isCurrentTier(tier.tier)
                  ? 'ring-2 ring-blue-300 border-blue-300'
                  : tier.tier === 'tier2'
                    ? 'border-yellow-300 hover:shadow-xl'
                    : 'border-gray-200 hover:shadow-md'
              } bg-gradient-to-br ${
                tier.tier === 'tier1'
                  ? 'from-gray-50 to-gray-100 border-gray-200'
                  : 'from-yellow-50 to-yellow-100 border-yellow-200'
              }`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Popular badge for tier2 */}
              {tier.tier === 'tier2' && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 animate-bounceIn" style={{ animationDelay: '0.3s' }}>
                  <span className="bg-yellow-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Current plan badge */}
              {isCurrentTier(tier.tier) && (
                <div className="absolute -top-3 right-4 animate-bounceIn" style={{ animationDelay: '0.4s' }}>
                  <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                    Current Plan
                  </span>
                </div>
              )}

              <div className="flex items-center space-x-3 mb-4">
                {tier.tier === 'tier1' ? (
                  <Star className="text-gray-600" size={24} />
                ) : (
                  <Crown className="text-yellow-600 animate-pulse" size={24} />
                )}
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{tier.name}</h3>
                  <div className="flex items-baseline space-x-1">
                    <span className="text-2xl font-bold text-gray-900">
                      {tier.price === 0 ? 'Free' : tierService.formatPrice(tier.price)}
                    </span>
                    {tier.price > 0 && (
                      <span className="text-sm text-gray-600">/month</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                {tier.features.map((feature, featureIndex) => (
                  <div 
                    key={featureIndex} 
                    className="flex items-center space-x-2 animate-fadeInUp"
                    style={{ animationDelay: `${0.5 + featureIndex * 0.1}s` }}
                  >
                    <Check size={16} className="text-green-600 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 mb-6 animate-fadeInUp" style={{ animationDelay: '0.8s' }}>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Monthly Conversations</span>
                  <span className="font-medium text-gray-900">
                    {formatLimit(tier.monthlyConversations, 'conversations')}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">AI Models per Comparison</span>
                  <span className="font-medium text-gray-900">
                    {formatLimit(tier.maxModelsPerComparison, 'models')}
                  </span>
                </div>
              </div>

              {tier.tier === 'tier2' && !isCurrentTier(tier.tier) && (
                <div className="space-y-3">
                  <button
                    onClick={() => handleSelectPaymentMethod('paypal')}
                    className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    <CreditCard size={16} />
                    <span>Pay with PayPal - $18.00/month</span>
                  </button>
                  
                  <button
                    onClick={() => handleSelectPaymentMethod('gcash')}
                    className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                  >
                    <Smartphone size={16} />
                    <span>Pay with GCash - ₱580.00</span>
                  </button>
                  
                  <p className="text-xs text-gray-500 text-center">
                    PayPal is a recurring monthly subscription.
                    GCash is a one-time payment for 1 month of access.
                  </p>
                </div>
              )}

              {isCurrentTier(tier.tier) && (
                <button
                  disabled
                  className="w-full py-3 px-4 bg-gray-100 text-gray-500 rounded-lg font-medium cursor-not-allowed"
                >
                  Current Plan
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4 animate-fadeInUp" style={{ animationDelay: '0.6s' }}>
          <div className="flex items-start space-x-2">
            <Zap className="text-blue-600 flex-shrink-0 mt-0.5 animate-pulse" size={20} />
            <div>
              <h4 className="font-medium text-blue-800 mb-1">Why Upgrade to Pro?</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• <strong>Unlimited Conversations:</strong> No monthly limits - chat as much as you want</li>
                <li>• <strong>Unlimited AI Models:</strong> Compare responses from as many models as you like</li>
                <li>• <strong>Advanced Analytics:</strong> Deep insights into AI performance patterns</li>
                <li>• <strong>Priority Support:</strong> Get help faster when you need it</li>
                <li>• <strong>Export Features:</strong> Download your conversations and data</li>
                <li>• <strong>Early Access:</strong> Be first to try new features and models</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center animate-fadeInUp" style={{ animationDelay: '0.8s' }}>
          <p className="text-xs text-gray-500">
            All plans include secure data storage, conversation history, and access to our growing library of AI models.
            Pro plan removes all limits and unlocks premium features.
          </p>
        </div>
      </div>
    </div>
  );
};
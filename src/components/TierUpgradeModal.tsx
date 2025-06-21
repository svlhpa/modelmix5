import React, { useState, useEffect } from 'react';
import { X, Crown, Check, Zap, Star, CreditCard, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { tierService } from '../services/tierService';
import { TierLimits, UserTier } from '../types';
import { useAuth } from '../hooks/useAuth';
import { PayPalButton } from './PayPalButton';

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

  useEffect(() => {
    if (isOpen) {
      setTiers(tierService.getAllTiers());
      setPaymentSuccess(false);
      setPaymentError(null);
      setProcessingPayment(false);
    }
  }, [isOpen]);

  const handlePaymentSuccess = async (details: any) => {
    setProcessingPayment(true);
    setPaymentError(null);

    try {
      console.log('Payment successful:', details);
      
      // Upgrade user to Pro tier
      await tierService.upgradeTier('tier2');
      await refreshProfile();
      
      setPaymentSuccess(true);
      
      // Close modal after a delay to show success message
      setTimeout(() => {
        onClose();
      }, 3000);
    } catch (error) {
      console.error('Failed to upgrade tier after payment:', error);
      setPaymentError('Payment was successful, but there was an error upgrading your account. Please contact support.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handlePaymentError = (error: any) => {
    console.error('Payment error:', error);
    setPaymentError(error.message || 'Payment failed. Please try again.');
    setProcessingPayment(false);
  };

  const getTierIcon = (tier: UserTier) => {
    switch (tier) {
      case 'tier1':
        return <Star className="text-gray-600" size={24} />;
      case 'tier2':
        return <Crown className="text-yellow-600 animate-pulse" size={24} />;
      default:
        return <Star className="text-gray-600" size={24} />;
    }
  };

  const getTierColor = (tier: UserTier) => {
    switch (tier) {
      case 'tier1':
        return 'from-gray-50 to-gray-100 border-gray-200';
      case 'tier2':
        return 'from-yellow-50 to-yellow-100 border-yellow-200';
      default:
        return 'from-gray-50 to-gray-100 border-gray-200';
    }
  };

  const formatLimit = (value: number, type: 'conversations' | 'models') => {
    if (value === -1) {
      return (
        <div className="flex items-center space-x-1">
          <span className="text-2xl">∞</span>
          <span>Unlimited</span>
        </div>
      );
    }
    return value.toString();
  };

  const isCurrentTier = (tier: UserTier) => tier === currentTier;

  if (!isOpen) return null;

  // Payment success screen
  if (paymentSuccess) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fadeIn">
        <div className="bg-white rounded-xl max-w-md w-full p-6 text-center transform animate-slideUp">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Pro!</h2>
          <p className="text-gray-600 mb-4">
            Your payment was successful and your account has been upgraded to Pro.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-2 text-yellow-800">
              <Crown size={20} />
              <span className="font-medium">Pro Features Unlocked:</span>
            </div>
            <ul className="text-sm text-yellow-700 mt-2 space-y-1">
              <li>• Unlimited conversations</li>
              <li>• Unlimited AI models</li>
              <li>• Advanced analytics</li>
              <li>• Priority support</li>
            </ul>
          </div>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
          >
            Start Using Pro Features
          </button>
        </div>
      </div>
    );
  }

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
            disabled={processingPayment}
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Payment Error */}
        {paymentError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg animate-shakeX">
            <div className="flex items-center space-x-2 text-red-700">
              <AlertCircle size={20} />
              <div>
                <p className="font-medium">Payment Error</p>
                <p className="text-sm">{paymentError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Processing Payment */}
        {processingPayment && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-3 text-blue-700">
              <Loader2 size={20} className="animate-spin" />
              <div>
                <p className="font-medium">Processing Payment...</p>
                <p className="text-sm">Please wait while we upgrade your account.</p>
              </div>
            </div>
          </div>
        )}

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
              } bg-gradient-to-br ${getTierColor(tier.tier)}`}
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
                {getTierIcon(tier.tier)}
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

              {/* Payment Button or Current Plan Indicator */}
              {isCurrentTier(tier.tier) ? (
                <button
                  disabled
                  className="w-full py-3 px-4 rounded-lg font-medium bg-gray-100 text-gray-500 cursor-not-allowed"
                >
                  Current Plan
                </button>
              ) : tier.tier === 'tier2' ? (
                <div className="space-y-3">
                  <PayPalButton
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                    disabled={processingPayment}
                  />
                </div>
              ) : (
                <button
                  disabled
                  className="w-full py-3 px-4 rounded-lg font-medium bg-gray-100 text-gray-500 cursor-not-allowed"
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
            Pro plan removes all limits and unlocks premium features. Payments are processed securely through PayPal.
          </p>
        </div>
      </div>
    </div>
  );
};
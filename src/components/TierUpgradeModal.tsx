import React, { useState, useEffect } from 'react';
import { X, Crown, Check, Zap, Star, CreditCard, Loader2 } from 'lucide-react';
import { tierService } from '../services/tierService';
import { TierLimits, UserTier } from '../types';
import { useAuth } from '../hooks/useAuth';

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
  const [selectedTier, setSelectedTier] = useState<UserTier | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTiers(tierService.getAllTiers());
    }
  }, [isOpen]);

  const handleUpgrade = async (tier: UserTier) => {
    if (tier === currentTier) return;
    
    setLoading(true);
    setSelectedTier(tier);
    
    try {
      if (tier === 'tier2') {
        // In a real app, this would integrate with Stripe or another payment processor
        // For now, we'll simulate the upgrade
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate payment processing
        await tierService.upgradeTier(tier);
        await refreshProfile();
        onClose();
      }
    } catch (error) {
      console.error('Failed to upgrade tier:', error);
    } finally {
      setLoading(false);
      setSelectedTier(null);
    }
  };

  const getTierIcon = (tier: UserTier) => {
    switch (tier) {
      case 'tier1':
        return <Star className="text-gray-600" size={24} />;
      case 'tier2':
        return <Crown className="text-yellow-600" size={24} />;
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

  const isCurrentTier = (tier: UserTier) => tier === currentTier;
  const isUpgrade = (tier: UserTier) => {
    const tierOrder = { tier1: 1, tier2: 2 };
    return tierOrder[tier] > tierOrder[currentTier];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Crown size={20} className="text-yellow-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Choose Your Plan</h2>
              <p className="text-sm text-gray-500">Unlock more AI models and conversations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            disabled={loading}
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tiers.map((tier) => (
            <div
              key={tier.tier}
              className={`relative border-2 rounded-xl p-6 transition-all ${
                isCurrentTier(tier.tier)
                  ? 'ring-2 ring-blue-300 border-blue-300'
                  : tier.tier === 'tier2'
                    ? 'border-yellow-300 hover:shadow-lg'
                    : 'border-gray-200 hover:shadow-md'
              } bg-gradient-to-br ${getTierColor(tier.tier)}`}
            >
              {/* Popular badge for tier2 */}
              {tier.tier === 'tier2' && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-yellow-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                    Most Popular
                  </span>
                </div>
              )}

              {/* Current plan badge */}
              {isCurrentTier(tier.tier) && (
                <div className="absolute -top-3 right-4">
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
                {tier.features.map((feature, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <Check size={16} className="text-green-600 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Monthly Conversations</span>
                  <span className="font-medium text-gray-900">
                    {tier.monthlyConversations === 1000 ? '1,000' : tier.monthlyConversations}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">AI Models per Comparison</span>
                  <span className="font-medium text-gray-900">{tier.maxModelsPerComparison}</span>
                </div>
              </div>

              <button
                onClick={() => handleUpgrade(tier.tier)}
                disabled={isCurrentTier(tier.tier) || loading}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 ${
                  isCurrentTier(tier.tier)
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                    : tier.tier === 'tier2'
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                      : 'bg-gray-600 hover:bg-gray-700 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading && selectedTier === tier.tier ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : isCurrentTier(tier.tier) ? (
                  <span>Current Plan</span>
                ) : isUpgrade(tier.tier) ? (
                  <>
                    <CreditCard size={16} />
                    <span>Upgrade to {tier.name}</span>
                  </>
                ) : (
                  <span>Select {tier.name}</span>
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <Zap className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className="font-medium text-blue-800 mb-1">Why Upgrade?</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Compare more AI models simultaneously for better insights</li>
                <li>• Higher conversation limits for power users</li>
                <li>• Advanced analytics to track AI performance</li>
                <li>• Priority support and new features first</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            All plans include secure data storage, conversation history, and access to our growing library of AI models.
          </p>
        </div>
      </div>
    </div>
  );
};
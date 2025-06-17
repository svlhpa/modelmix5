import React from 'react';
import { Zap, Crown, AlertTriangle, Infinity } from 'lucide-react';
import { tierService } from '../services/tierService';
import { UserTier } from '../types';

interface UsageIndicatorProps {
  usage: number;
  limit: number;
  tier: UserTier;
  onUpgradeClick?: () => void;
  className?: string;
}

export const UsageIndicator: React.FC<UsageIndicatorProps> = ({
  usage,
  limit,
  tier,
  onUpgradeClick,
  className = ''
}) => {
  const percentage = tierService.getUsagePercentage(usage, limit);
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;
  const isUnlimited = limit === -1 || tier === 'tier2'; // Pro tier is always unlimited

  const getTierIcon = () => {
    switch (tier) {
      case 'tier1':
        return <Zap size={14} className="text-gray-600" />;
      case 'tier2':
        return <Crown size={14} className="text-yellow-600" />;
      default:
        return <Zap size={14} className="text-gray-600" />;
    }
  };

  const getTierName = () => {
    return tierService.getTierLimits(tier).name;
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          {getTierIcon()}
          <span className="text-sm font-medium text-gray-700">{getTierName()} Plan</span>
        </div>
        {!isUnlimited && isNearLimit && (
          <AlertTriangle size={14} className={isAtLimit ? 'text-red-500' : 'text-orange-500'} />
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs text-gray-600">
          <span>Conversations this month</span>
          <span className={isUnlimited ? 'text-green-600' : tierService.getUsageColor(percentage)}>
            {isUnlimited ? (
              <div className="flex items-center space-x-1">
                <Infinity size={12} />
                <span>unlimited</span>
              </div>
            ) : (
              `${usage} / ${limit}`
            )}
          </span>
        </div>

        {!isUnlimited && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${tierService.getUsageBarColor(percentage)}`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        )}

        {isUnlimited && (
          <div className="mt-2 text-center">
            <div className="inline-flex items-center space-x-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
              <Crown size={10} />
              <span>Unlimited Usage</span>
            </div>
          </div>
        )}

        {!isUnlimited && isAtLimit && tier === 'tier1' && (
          <div className="mt-2">
            <p className="text-xs text-red-600 mb-2">
              You've reached your monthly limit. Upgrade to continue.
            </p>
            {onUpgradeClick && (
              <button
                onClick={onUpgradeClick}
                className="w-full text-xs bg-yellow-600 text-white py-1.5 px-3 rounded-md hover:bg-yellow-700 transition-colors"
              >
                Upgrade to Pro
              </button>
            )}
          </div>
        )}

        {!isUnlimited && isNearLimit && !isAtLimit && tier === 'tier1' && (
          <div className="mt-2">
            <p className="text-xs text-orange-600 mb-2">
              You're approaching your monthly limit.
            </p>
            {onUpgradeClick && (
              <button
                onClick={onUpgradeClick}
                className="w-full text-xs bg-yellow-600 text-white py-1.5 px-3 rounded-md hover:bg-yellow-700 transition-colors"
              >
                Upgrade for Unlimited
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
Here's the fixed version with missing closing brackets added:

```javascript
import React, { useState, useEffect } from 'react';
import { X, Crown, Check, Zap, Star, CreditCard, Loader2, CheckCircle, AlertCircle, RefreshCw, Smartphone } from 'lucide-react';
import { tierService } from '../services/tierService';
import { TierLimits, UserTier } from '../types';
import { useAuth } from '../hooks/useAuth';
import { PayPalButton } from './PayPalButton';
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
 \     }
      
    \  // Refresh profile to get updated tier info
      awai\t refreshProfile();
      
      console.log('Profile refreshed after upgrade');
      
      setPaymentSuccess(true);
      setP\rocessingPayment(false);
      setShowRefreshPrompt(true);
      
    } catch (error) {
      console.error('Error processing payment:', error);
      setPaymentError('Failed to process payment. Please try again.');
      setProcessingPayment(false);
    }
  }
}
```

I added the missing closing curly brace `}` at the end of the file to close the component definition.
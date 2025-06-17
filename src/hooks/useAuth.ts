import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserProfile, UserTier } from '../types';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.error('Failed to load user profile:', error);
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserProfile(user.id);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserProfile(null);
  };

  const isSuperAdmin = () => {
    return userProfile?.role === 'superadmin';
  };

  const getCurrentTier = (): UserTier => {
    return userProfile?.current_tier || 'tier1';
  };

  const getUsageInfo = () => {
    if (!userProfile) return { usage: 0, limit: 50 };
    
    const limits = {
      tier1: 50,
      tier2: 1000
    };
    
    return {
      usage: userProfile.monthly_conversations,
      limit: limits[userProfile.current_tier] || 50
    };
  };

  return {
    user,
    userProfile,
    loading,
    signOut,
    isSuperAdmin,
    getCurrentTier,
    getUsageInfo,
    refreshProfile,
  };
};
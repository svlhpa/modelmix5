import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserProfile, UserTier } from '../types';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [justLoggedIn, setJustLoggedIn] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const sessionUser = session?.user ?? null;
      
      // CRITICAL: For testing - accept users even without email confirmation
      if (sessionUser) {
        setUser(sessionUser);
        loadUserProfile(sessionUser.id);
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      const previousUser = user;
      
      // CRITICAL: For testing - accept users even without email confirmation
      if (sessionUser) {
        setUser(sessionUser);
        loadUserProfile(sessionUser.id);
        
        // Set justLoggedIn flag if this is a new login
        if (!previousUser) {
          setJustLoggedIn(true);
        }
      } else {
        setUser(null);
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

      if (error) {
        // If profile doesn't exist, it might be a new user - wait a moment and try again
        if (error.code === 'PGRST116') {
          console.log('Profile not found, waiting for creation...');
          setTimeout(() => loadUserProfile(userId), 1000);
          return;
        }
        throw error;
      }
      
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
    
    const currentTier = getCurrentTier();
    
    // Pro tier has unlimited conversations
    if (currentTier === 'tier2') {
      return {
        usage: userProfile.monthly_conversations,
        limit: -1 // -1 indicates unlimited
      };
    }
    
    // Free tier has 50 conversation limit
    return {
      usage: userProfile.monthly_conversations,
      limit: 50
    };
  };

  // Reset the justLoggedIn flag
  const clearJustLoggedInFlag = () => {
    setJustLoggedIn(false);
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
    justLoggedIn,
    clearJustLoggedInFlag
  };
};
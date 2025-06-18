import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(50);

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    return () => subscription.unsubscribe();
  }, []);

  const handleGetStarted = () => {
    if (user) {
      router.push('/chat');
    } else {
      router.push('/auth');
    }
  };

  const features = [
    {
      icon: 'shuffle-outline',
      title: 'Mix AI Models',
      description: 'Compare responses from multiple AI models simultaneously',
    },
    {
      icon: 'analytics-outline',
      title: 'Smart Analytics',
      description: 'Track which AI models perform best for your needs',
    },
    {
      icon: 'shield-checkmark-outline',
      title: 'Secure & Private',
      description: 'Your conversations and data are encrypted and private',
    },
    {
      icon: 'sync-outline',
      title: 'Cross-Platform',
      description: 'Seamlessly sync between mobile and web applications',
    },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.View style={[styles.loadingContent, { opacity: fadeAnim }]}>
          <Ionicons name="shuffle-outline" size={60} color="#059669" />
          <Text style={styles.loadingText}>ModelMix</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#059669', '#047857', '#065f46']}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.logoContainer}>
            <Ionicons name="shuffle-outline" size={60} color="white" />
            <Text style={styles.logoText}>ModelMix</Text>
          </View>
          
          <Text style={styles.tagline}>
            Mix and compare AI responses from multiple models
          </Text>
          
          <Text style={styles.subtitle}>
            Get the best insights by blending different AI perspectives
          </Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.featuresContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {features.map((feature, index) => (
            <Animated.View
              key={feature.title}
              style={[
                styles.featureCard,
                {
                  opacity: fadeAnim,
                  transform: [
                    {
                      translateY: Animated.add(
                        slideAnim,
                        new Animated.Value(index * 20)
                      ),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.featureIcon}>
                <Ionicons
                  name={feature.icon as any}
                  size={24}
                  color="#059669"
                />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>
                  {feature.description}
                </Text>
              </View>
            </Animated.View>
          ))}
        </Animated.View>

        <Animated.View
          style={[
            styles.actionContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleGetStarted}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#ffffff', '#f3f4f6']}
              style={styles.buttonGradient}
            >
              <Text style={styles.primaryButtonText}>
                {user ? 'Continue Chatting' : 'Get Started'}
              </Text>
              <Ionicons
                name="arrow-forward"
                size={20}
                color="#059669"
                style={styles.buttonIcon}
              />
            </LinearGradient>
          </TouchableOpacity>

          {user && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/settings')}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>Settings</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        <Animated.View
          style={[
            styles.footer,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <Text style={styles.footerText}>
            Powered by advanced AI models including OpenAI, Claude, Gemini, and more
          </Text>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#059669',
    marginTop: 16,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 12,
  },
  tagline: {
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresContainer: {
    marginBottom: 40,
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  actionContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  primaryButton: {
    width: '100%',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#059669',
    marginRight: 8,
  },
  buttonIcon: {
    marginLeft: 4,
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'white',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 18,
  },
});
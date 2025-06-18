import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import * as Haptics from 'expo-haptics';
import { APISettings, ModelSettings } from '../types';

export default function SettingsScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [apiSettings, setApiSettings] = useState<APISettings>({
    openai: '',
    openrouter: '',
    gemini: '',
    deepseek: '',
    serper: '',
  });
  const [modelSettings, setModelSettings] = useState<ModelSettings>({
    openai: true,
    gemini: true,
    deepseek: true,
    openrouter_models: {},
  });
  const [loading, setLoading] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadSettings();
      } else {
        router.replace('/auth');
      }
    });
  }, []);

  const loadSettings = async () => {
    try {
      // Load API settings
      const { data: apiData, error: apiError } = await supabase
        .from('user_api_settings')
        .select('provider, api_key')
        .neq('provider', 'model_settings');

      if (apiError) throw apiError;

      const settings: APISettings = {
        openai: '',
        openrouter: '',
        gemini: '',
        deepseek: '',
        serper: '',
      };

      apiData?.forEach((setting) => {
        if (setting.provider in settings) {
          (settings as any)[setting.provider] = setting.api_key;
        }
      });

      setApiSettings(settings);

      // Load model settings
      const { data: modelData, error: modelError } = await supabase
        .from('user_api_settings')
        .select('api_key')
        .eq('provider', 'model_settings')
        .maybeSingle();

      if (modelError && modelError.code !== 'PGRST116') throw modelError;

      if (modelData) {
        try {
          const parsedSettings = JSON.parse(modelData.api_key);
          setModelSettings({
            openai: parsedSettings.openai ?? true,
            gemini: parsedSettings.gemini ?? true,
            deepseek: parsedSettings.deepseek ?? true,
            openrouter_models: parsedSettings.openrouter_models ?? {},
          });
        } catch {
          // Keep default settings if parsing fails
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      // Save API settings
      const promises = Object.entries(apiSettings).map(async ([provider, apiKey]) => {
        if (!apiKey) return;

        const { error } = await supabase
          .from('user_api_settings')
          .upsert({
            provider,
            api_key: apiKey,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,provider'
          });

        if (error) throw error;
      });

      // Save model settings
      promises.push(
        supabase
          .from('user_api_settings')
          .upsert({
            provider: 'model_settings',
            api_key: JSON.stringify(modelSettings),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,provider'
          })
          .then(({ error }) => {
            if (error) throw error;
          })
      );

      await Promise.all(promises);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/');
          },
        },
      ]
    );
  };

  const toggleShowKey = (provider: string) => {
    setShowKeys(prev => ({ ...prev, [provider]: !prev[provider] }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleModel = (model: keyof ModelSettings) => {
    if (model === 'openrouter_models') return;
    
    setModelSettings(prev => ({ ...prev, [model]: !prev[model] }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const apiProviders = [
    {
      key: 'openai' as keyof APISettings,
      name: 'OpenAI',
      description: 'GPT-4o model with vision support',
      icon: 'logo-openai',
    },
    {
      key: 'openrouter' as keyof APISettings,
      name: 'OpenRouter',
      description: 'Access to 400+ AI models',
      icon: 'shuffle-outline',
    },
    {
      key: 'gemini' as keyof APISettings,
      name: 'Google Gemini',
      description: 'Gemini 1.5 Pro with multimodal capabilities',
      icon: 'diamond-outline',
    },
    {
      key: 'deepseek' as keyof APISettings,
      name: 'DeepSeek',
      description: 'DeepSeek Chat for reasoning tasks',
      icon: 'search-outline',
    },
    {
      key: 'serper' as keyof APISettings,
      name: 'Serper',
      description: 'Internet search for real-time information',
      icon: 'globe-outline',
    },
  ];

  const models = [
    { key: 'openai' as keyof ModelSettings, name: 'OpenAI GPT-4o', icon: 'logo-openai' },
    { key: 'gemini' as keyof ModelSettings, name: 'Google Gemini', icon: 'diamond-outline' },
    { key: 'deepseek' as keyof ModelSettings, name: 'DeepSeek Chat', icon: 'search-outline' },
  ];

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#059669', '#047857']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerButton}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Settings</Text>

          <TouchableOpacity
            onPress={saveSettings}
            style={styles.headerButton}
            disabled={loading}
          >
            <Ionicons 
              name={loading ? "hourglass-outline" : "checkmark"} 
              size={24} 
              color="white" 
            />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.userCard}>
            <View style={styles.userInfo}>
              <Ionicons name="person-circle-outline" size={40} color="#059669" />
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{user.email}</Text>
                <Text style={styles.userTier}>Free Plan</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={signOut}
              style={styles.signOutButton}
              activeOpacity={0.7}
            >
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* API Keys */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>API Keys</Text>
          <Text style={styles.sectionDescription}>
            Configure your API keys to access AI models
          </Text>
          
          {apiProviders.map((provider) => (
            <View key={provider.key} style={styles.providerCard}>
              <View style={styles.providerHeader}>
                <View style={styles.providerInfo}>
                  <Ionicons name={provider.icon as any} size={24} color="#059669" />
                  <View style={styles.providerDetails}>
                    <Text style={styles.providerName}>{provider.name}</Text>
                    <Text style={styles.providerDescription}>
                      {provider.description}
                    </Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.apiKeyInput}
                  placeholder={`Enter ${provider.name} API key`}
                  placeholderTextColor="#9ca3af"
                  value={apiSettings[provider.key]}
                  onChangeText={(text) =>
                    setApiSettings(prev => ({ ...prev, [provider.key]: text }))
                  }
                  secureTextEntry={!showKeys[provider.key]}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => toggleShowKey(provider.key)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showKeys[provider.key] ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#6b7280"
                  />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Model Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AI Models</Text>
          <Text style={styles.sectionDescription}>
            Choose which AI models to include in comparisons
          </Text>
          
          {models.map((model) => (
            <View key={model.key} style={styles.modelCard}>
              <View style={styles.modelInfo}>
                <Ionicons name={model.icon as any} size={24} color="#059669" />
                <Text style={styles.modelName}>{model.name}</Text>
              </View>
              <Switch
                value={modelSettings[model.key] as boolean}
                onValueChange={() => toggleModel(model.key)}
                trackColor={{ false: '#e5e7eb', true: '#bbf7d0' }}
                thumbColor={modelSettings[model.key] ? '#059669' : '#9ca3af'}
              />
            </View>
          ))}
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.aboutCard}>
            <Text style={styles.aboutText}>
              ModelMix allows you to compare AI responses from multiple models
              to get the best insights for your questions.
            </Text>
            <Text style={styles.versionText}>Version 1.0.0</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  userCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  userTier: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  signOutButton: {
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#dc2626',
  },
  providerCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  providerHeader: {
    marginBottom: 12,
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerDetails: {
    marginLeft: 12,
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  providerDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
  },
  apiKeyInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    paddingVertical: 12,
  },
  eyeButton: {
    padding: 8,
  },
  modelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  modelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modelName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginLeft: 12,
  },
  aboutCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  aboutText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  versionText: {
    fontSize: 12,
    color: '#9ca3af',
  },
});
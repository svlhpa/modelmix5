import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { SettingsModal } from './components/SettingsModal';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { AuthModal } from './components/AuthModal';
import { AdminDashboard } from './components/AdminDashboard';
import { TierUpgradeModal } from './components/TierUpgradeModal';
import { DebateClub } from './components/DebateClub';
import { AIVideoCall } from './components/AIVideoCall';
import { WriteupAgent } from './components/WriteupAgent';
import { VoiceLabs } from './components/VoiceLabs';
import { GetStartedModal } from './components/GetStartedModal';
import { useChat } from './hooks/useChat';
import { useAuth } from './hooks/useAuth';
import { useGetStartedVideo } from './hooks/useGetStartedVideo';
import { aiService } from './services/aiService';
import { tierService } from './services/tierService';
import { APISettings, ModelSettings } from './types';

function App() {
  const { user, userProfile, isSuperAdmin, getCurrentTier, getUsageInfo, refreshProfile } = useAuth();
  const {
    sessions,
    currentSession,
    currentSessionId,
    isLoading,
    createNewSession,
    setCurrentSessionId,
    sendMessage,
    selectResponse,
    deleteSession,
    saveConversationTurn
  } = useChat();

  // Get Started Video Hook
  const { shouldShowVideo, videoUrl, loading: videoLoading, hideVideo, markVideoAsWatched } = useGetStartedVideo();

  const [showSettings, setShowSettings] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showTierUpgrade, setShowTierUpgrade] = useState(false);
  const [showDebateClub, setShowDebateClub] = useState(false);
  const [showVideoCall, setShowVideoCall] = useState(false);
  const [showWriteupAgent, setShowWriteupAgent] = useState(false);
  const [showVoiceLabs, setShowVoiceLabs] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [apiSettings, setApiSettings] = useState<APISettings>({
    openai: '',
    openrouter: '',
    gemini: '',
    deepseek: '',
    serper: '',
    imagerouter: ''
  });
  const [modelSettings, setModelSettings] = useState<ModelSettings>({
    openai: true,
    gemini: true,
    deepseek: true,
    openrouter_models: {},
    image_models: {}
  });

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      const [apiSettings, modelSettings] = await Promise.all([
        aiService.loadSettings(),
        aiService.loadModelSettings()
      ]);
      setApiSettings(apiSettings);
      setModelSettings(modelSettings);
      
      // Load OpenRouter models for the AI service
      await aiService.loadOpenRouterModels();
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleNewChat = async () => {
    if (!user) {
      setShowAuth(true);
      return;
    }

    // Check usage limits
    const { canUse } = await tierService.checkUsageLimit();
    if (!canUse) {
      setShowTierUpgrade(true);
      return;
    }

    createNewSession();
  };

  const handleSaveSettings = async (settings: APISettings, models: ModelSettings) => {
    try {
      await Promise.all([
        aiService.updateSettings(settings),
        aiService.updateModelSettings(models)
      ]);
      setApiSettings(settings);
      setModelSettings(models);
      
      // Reload OpenRouter models if the API key changed
      if (settings.openrouter !== apiSettings.openrouter) {
        await aiService.loadOpenRouterModels();
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const toggleMobileSidebar = () => {
    setMobileSidebarOpen(!mobileSidebarOpen);
  };

  const handleOpenSettings = () => {
    if (user) {
      setShowSettings(true);
    } else {
      setShowAuth(true);
    }
  };

  const handleOpenAnalytics = () => {
    if (user) {
      setShowAnalytics(true);
    } else {
      setShowAuth(true);
    }
  };

  const handleOpenAdmin = () => {
    if (user && isSuperAdmin()) {
      setShowAdmin(true);
    } else {
      setShowAuth(true);
    }
  };

  const handleOpenDebateClub = () => {
    setShowDebateClub(true);
  };

  const handleOpenVideoCall = () => {
    if (user) {
      setShowVideoCall(true);
    } else {
      setShowAuth(true);
    }
  };

  const handleOpenWriteupAgent = () => {
    if (user) {
      setShowWriteupAgent(true);
    } else {
      setShowAuth(true);
    }
  };

  const handleOpenVoiceLabs = () => {
    if (user) {
      setShowVoiceLabs(true);
    } else {
      setShowAuth(true);
    }
  };

  const handleTierUpgradeClose = () => {
    setShowTierUpgrade(false);
    refreshProfile(); // Refresh profile to get updated tier info
  };

  const handleGetStartedVideoClose = async () => {
    await markVideoAsWatched();
    hideVideo();
  };

  if (!user) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onNewChat={handleNewChat}
          onSelectSession={setCurrentSessionId}
          onDeleteSession={deleteSession}
          onOpenSettings={handleOpenSettings}
          onOpenAnalytics={handleOpenAnalytics}
          onOpenAuth={() => setShowAuth(true)}
          onOpenAdmin={isSuperAdmin() ? handleOpenAdmin : undefined}
          onOpenTierUpgrade={() => setShowTierUpgrade(true)}
          onOpenDebateClub={handleOpenDebateClub}
          onOpenVideoCall={handleOpenVideoCall}
          onOpenWriteupAgent={handleOpenWriteupAgent}
          onOpenVoiceLabs={handleOpenVoiceLabs}
          isCollapsed={sidebarCollapsed}
          isMobileOpen={mobileSidebarOpen}
          onToggleMobile={toggleMobileSidebar}
        />
        
        <ChatArea
          messages={currentSession?.messages || []}
          onSendMessage={sendMessage}
          onSelectResponse={selectResponse}
          isLoading={isLoading}
          onToggleSidebar={toggleSidebar}
          onToggleMobileSidebar={toggleMobileSidebar}
          onSaveConversationTurn={saveConversationTurn}
          modelSettings={modelSettings}
          onTierUpgrade={() => setShowTierUpgrade(true)}
        />

        <AuthModal
          isOpen={showAuth}
          onClose={() => setShowAuth(false)}
        />

        <DebateClub
          isOpen={showDebateClub}
          onClose={() => setShowDebateClub(false)}
        />

        <AIVideoCall
          isOpen={showVideoCall}
          onClose={() => setShowVideoCall(false)}
        />

        <VoiceLabs
          isOpen={showVoiceLabs}
          onClose={() => setShowVoiceLabs(false)}
        />

        <WriteupAgent
          isOpen={showWriteupAgent}
          onClose={() => setShowWriteupAgent(false)}
        />

        <TierUpgradeModal
          isOpen={showTierUpgrade}
          onClose={handleTierUpgradeClose}
          currentTier={getCurrentTier()}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onNewChat={handleNewChat}
        onSelectSession={setCurrentSessionId}
        onDeleteSession={deleteSession}
        onOpenSettings={handleOpenSettings}
        onOpenAnalytics={handleOpenAnalytics}
        onOpenAuth={() => setShowAuth(false)}
        onOpenAdmin={isSuperAdmin() ? handleOpenAdmin : undefined}
        onOpenTierUpgrade={() => setShowTierUpgrade(true)}
        onOpenDebateClub={handleOpenDebateClub}
        onOpenVideoCall={handleOpenVideoCall}
        onOpenWriteupAgent={handleOpenWriteupAgent}
        onOpenVoiceLabs={handleOpenVoiceLabs}
        isCollapsed={sidebarCollapsed}
        isMobileOpen={mobileSidebarOpen}
        onToggleMobile={toggleMobileSidebar}
      />
      
      <ChatArea
        messages={currentSession?.messages || []}
        onSendMessage={sendMessage}
        onSelectResponse={selectResponse}
        isLoading={isLoading}
        onToggleSidebar={toggleSidebar}
        onToggleMobileSidebar={toggleMobileSidebar}
        onSaveConversationTurn={saveConversationTurn}
        modelSettings={modelSettings}
        onTierUpgrade={() => setShowTierUpgrade(true)}
      />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={handleSaveSettings}
        currentSettings={apiSettings}
        currentModelSettings={modelSettings}
      />

      <AnalyticsDashboard
        isOpen={showAnalytics}
        onClose={() => setShowAnalytics(false)}
      />

      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
      />

      {isSuperAdmin() && (
        <AdminDashboard
          isOpen={showAdmin}
          onClose={() => setShowAdmin(false)}
        />
      )}

      <DebateClub
        isOpen={showDebateClub}
        onClose={() => setShowDebateClub(false)}
      />

      <AIVideoCall
        isOpen={showVideoCall}
        onClose={() => setShowVideoCall(false)}
      />

      <VoiceLabs
        isOpen={showVoiceLabs}
        onClose={() => setShowVoiceLabs(false)}
      />

      <WriteupAgent
        isOpen={showWriteupAgent}
        onClose={() => setShowWriteupAgent(false)}
      />

      <TierUpgradeModal
        isOpen={showTierUpgrade}
        onClose={handleTierUpgradeClose}
        currentTier={getCurrentTier()}
      />

      {/* Get Started Video Modal */}
      {!videoLoading && shouldShowVideo && videoUrl && (
        <GetStartedModal
          isOpen={true}
          onClose={handleGetStartedVideoClose}
          videoUrl={videoUrl}
          userId={user.id}
        />
      )}
    </div>
  );
}

export default App;
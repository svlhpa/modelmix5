import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { SettingsModal } from './components/SettingsModal';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { AuthModal } from './components/AuthModal';
import { AdminDashboard } from './components/AdminDashboard';
import { useChat } from './hooks/useChat';
import { useAuth } from './hooks/useAuth';
import { aiService } from './services/aiService';
import { APISettings, ModelSettings } from './types';

function App() {
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
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

  const [showSettings, setShowSettings] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [apiSettings, setApiSettings] = useState<APISettings>({
    openai: '',
    openrouter: '',
    gemini: '',
    deepseek: ''
  });
  const [modelSettings, setModelSettings] = useState<ModelSettings>({
    openai: true,
    gemini: true,
    deepseek: true,
    openrouter_models: {}
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

  const handleNewChat = () => {
    if (user) {
      createNewSession();
    } else {
      setShowAuth(true);
    }
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

  if (authLoading) {
    return (
      <div className="flex h-screen bg-gray-100 items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
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
        onOpenAuth={() => setShowAuth(true)}
        onOpenAdmin={isSuperAdmin() ? handleOpenAdmin : undefined}
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
    </div>
  );
}

export default App;
import React, { useState } from 'react';
import { Plus, MessageCircle, Settings, Trash2, Search, BarChart3, LogOut, User, X, Shield, Crown, Infinity, Mic, Video, ChevronDown, ChevronUp, Sparkles, Headphones } from 'lucide-react';
import { ChatSession } from '../types';
import { useAuth } from '../hooks/useAuth';
import { Logo } from './Logo';

interface SidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onOpenSettings: () => void;
  onOpenAnalytics: () => void;
  onOpenAuth: () => void;
  onOpenAdmin?: () => void;
  onOpenTierUpgrade: () => void;
  onOpenDebateClub: () => void;
  onOpenVideoCall: () => void;
  onOpenVoiceLabs: () => void;
  isCollapsed: boolean;
  isMobileOpen: boolean;
  onToggleMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  currentSessionId,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onOpenSettings,
  onOpenAnalytics,
  onOpenAuth,
  onOpenAdmin,
  onOpenTierUpgrade,
  onOpenDebateClub,
  onOpenVideoCall,
  onOpenVoiceLabs,
  isCollapsed,
  isMobileOpen,
  onToggleMobile
}) => {
  const { user, userProfile, signOut, isSuperAdmin, getCurrentTier, getUsageInfo } = useAuth();
  const [featuresExpanded, setFeaturesExpanded] = useState(false);
  const [userMenuExpanded, setUserMenuExpanded] = useState(false);

  const handleSignOut = async () => {
    await signOut();
  };

  const getSessionPreview = (session: ChatSession) => {
    if (session.messages.length === 0) {
      return 'New conversation';
    }
    const lastMessage = session.messages[session.messages.length - 1];
    return lastMessage.content.slice(0, 50) + (lastMessage.content.length > 50 ? '...' : '');
  };

  const getSessionMessageCount = (session: ChatSession) => {
    return Math.ceil(session.messages.length / 2); // Divide by 2 since each turn has user + AI message
  };

  const currentTier = getCurrentTier();
  const { usage, limit } = getUsageInfo();
  const isProUser = currentTier === 'tier2';

  // Mobile overlay
  if (isMobileOpen) {
    return (
      <>
        {/* Mobile backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden animate-fadeIn"
          onClick={onToggleMobile}
        />
        
        {/* Mobile sidebar */}
        <div className="fixed left-0 top-0 h-full w-80 bg-gray-900 text-white z-50 lg:hidden transform transition-transform duration-300 ease-in-out animate-slideInLeft">
          <div className="flex flex-col h-full">
            {/* Header with Logo and Close */}
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <Logo size="sm" className="animate-fadeInUp" showProCrown={isProUser} />
                <button
                  onClick={onToggleMobile}
                  className="p-2 rounded-lg hover:bg-gray-800 transition-all duration-200 hover:scale-110 transform"
                >
                  <X size={20} />
                </button>
              </div>
              {user && (
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      onNewChat();
                      onToggleMobile();
                    }}
                    className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-all duration-200 hover:scale-105 transform animate-fadeInUp"
                    style={{ animationDelay: '0.1s' }}
                  >
                    <Plus size={18} />
                    <span className="font-medium">New Chat</span>
                  </button>
                  
                  {/* Features Submenu - Mobile */}
                  <div className="animate-fadeInUp" style={{ animationDelay: '0.15s' }}>
                    <button
                      onClick={() => setFeaturesExpanded(!featuresExpanded)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all duration-200 hover:scale-105 transform"
                    >
                      <div className="flex items-center space-x-3">
                        <Sparkles size={18} />
                        <span className="font-medium">Features</span>
                      </div>
                      {featuresExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    
                    {featuresExpanded && (
                      <div className="mt-2 ml-4 space-y-1 animate-slideDown">
                        <button
                          onClick={() => {
                            onOpenDebateClub();
                            onToggleMobile();
                          }}
                          className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-all duration-200 text-sm"
                        >
                          <Mic size={16} />
                          <span>AI Debate Club</span>
                        </button>

                        <button
                          onClick={() => {
                            onOpenVoiceLabs();
                            onToggleMobile();
                          }}
                          className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-all duration-200 text-sm"
                        >
                          <Headphones size={16} />
                          <span>Voice Labs</span>
                        </button>

                        {isProUser ? (
                          <button
                            onClick={() => {
                              onOpenVideoCall();
                              onToggleMobile();
                            }}
                            className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-all duration-200 text-sm"
                          >
                            <Video size={16} />
                            <span>AI Video Call</span>
                          </button>
                        ) : (
                          <div className="relative">
                            <button
                              disabled
                              className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg opacity-50 cursor-not-allowed text-sm"
                            >
                              <Video size={16} />
                              <span>AI Video Call</span>
                              <Crown size={12} className="text-yellow-400 ml-auto" />
                            </button>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <button
                                onClick={() => {
                                  onOpenTierUpgrade();
                                  onToggleMobile();
                                }}
                                className="text-xs bg-yellow-600 text-white px-2 py-1 rounded-full hover:bg-yellow-700 transition-colors"
                              >
                                Pro Only
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Mobile Upgrade to Pro Button for Free Users */}
                  {!isProUser && (
                    <button
                      onClick={() => {
                        onOpenTierUpgrade();
                        onToggleMobile();
                      }}
                      className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 transition-all duration-200 hover:scale-105 transform animate-fadeInUp"
                      style={{ animationDelay: '0.2s' }}
                    >
                      <Crown size={18} />
                      <span className="font-medium">Upgrade to Pro</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {user ? (
              <>
                <div className="p-4 border-b border-gray-700 animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
                  <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search chats..."
                      className="w-full pl-10 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-200"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                  <div className="space-y-1">
                    {sessions.map((session, index) => (
                      <div
                        key={session.id}
                        className={`group flex flex-col px-3 py-3 rounded-lg cursor-pointer transition-all duration-200 transform hover:scale-105 animate-fadeInUp ${
                          currentSessionId === session.id
                            ? 'bg-gray-700'
                            : 'hover:bg-gray-800'
                        }`}
                        style={{ animationDelay: `${0.35 + index * 0.05}s` }}
                        onClick={() => {
                          onSelectSession(session.id);
                          onToggleMobile();
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2 flex-1 min-w-0">
                            <MessageCircle size={16} className="text-gray-400 flex-shrink-0" />
                            <span className="text-sm font-medium truncate">{session.title}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSession(session.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-600 transition-all duration-200 flex-shrink-0 hover:scale-110 transform"
                          >
                            <Trash2 size={12} className="text-gray-400" />
                          </button>
                        </div>
                        
                        <div className="text-xs text-gray-400 truncate">
                          {getSessionPreview(session)}
                        </div>
                        
                        {session.messages.length > 0 && (
                          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                            <span>{getSessionMessageCount(session)} turn{getSessionMessageCount(session) !== 1 ? 's' : ''}</span>
                            <span>{session.updatedAt.toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {sessions.length === 0 && (
                      <div className="text-center py-8 text-gray-400 animate-fadeInUp" style={{ animationDelay: '0.35s' }}>
                        <MessageCircle size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No conversations yet</p>
                        <p className="text-xs">Start a new chat to begin</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* User Menu - Mobile */}
                <div className="p-4 border-t border-gray-700">
                  {/* SuperAdmin Dashboard Button */}
                  {isSuperAdmin() && onOpenAdmin && (
                    <button
                      onClick={() => {
                        onOpenAdmin();
                        onToggleMobile();
                      }}
                      className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-all duration-200 bg-red-900/20 border border-red-700/30 hover:scale-105 transform animate-fadeInUp mb-2"
                      style={{ animationDelay: '0.4s' }}
                    >
                      <Shield size={18} className="text-red-400" />
                      <span className="font-medium text-red-400">Admin Dashboard</span>
                    </button>
                  )}
                  
                  {/* User Menu Dropdown */}
                  <div className="animate-fadeInUp" style={{ animationDelay: '0.45s' }}>
                    <button
                      onClick={() => setUserMenuExpanded(!userMenuExpanded)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-800 transition-all duration-200"
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        {isSuperAdmin() ? (
                          <Shield size={16} className="text-red-400 flex-shrink-0" />
                        ) : isProUser ? (
                          <Crown size={16} className="text-yellow-400 flex-shrink-0" />
                        ) : (
                          <User size={16} className="flex-shrink-0" />
                        )}
                        <span className="text-sm truncate">{user.email}</span>
                        {isSuperAdmin() && (
                          <span className="text-xs bg-red-900/30 text-red-400 px-2 py-0.5 rounded-full animate-pulse flex-shrink-0">
                            ADMIN
                          </span>
                        )}
                        {isProUser && !isSuperAdmin() && (
                          <span className="text-xs bg-yellow-900/30 text-yellow-400 px-2 py-0.5 rounded-full animate-pulse flex-shrink-0">
                            PRO
                          </span>
                        )}
                      </div>
                      {userMenuExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    
                    {userMenuExpanded && (
                      <div className="mt-2 ml-4 space-y-1 animate-slideDown">
                        <button
                          onClick={() => {
                            onOpenAnalytics();
                            onToggleMobile();
                          }}
                          className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-all duration-200 text-sm"
                        >
                          <BarChart3 size={16} />
                          <span>Analytics</span>
                        </button>
                        
                        <button
                          onClick={() => {
                            onOpenSettings();
                            onToggleMobile();
                          }}
                          className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-all duration-200 text-sm"
                        >
                          <Settings size={16} />
                          <span>Settings</span>
                        </button>
                        
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-all duration-200 text-red-400 hover:text-red-300 text-sm"
                        >
                          <LogOut size={16} />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center animate-fadeInUp">
                  <User size={48} className="text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">Welcome!</h3>
                  <p className="text-gray-400 text-sm mb-4">Sign in to start comparing AI responses</p>
                  <button
                    onClick={() => {
                      onOpenAuth();
                      onToggleMobile();
                    }}
                    className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all duration-200 hover:scale-105 transform"
                  >
                    Sign In / Sign Up
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // Desktop collapsed sidebar
  if (isCollapsed) {
    return (
      <div className="hidden lg:flex w-16 bg-gray-900 text-white flex-col items-center py-4 space-y-4 transition-all duration-300 ease-in-out">
        <Logo variant="icon" size="sm" className="animate-fadeInUp" showProCrown={isProUser} />
        {user ? (
          <>
            <button
              onClick={onNewChat}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-all duration-200 hover:scale-110 transform animate-fadeInUp"
              style={{ animationDelay: '0.1s' }}
              title="New Chat"
            >
              <Plus size={20} />
            </button>
            
            {/* Features Icon - Collapsed */}
            <button
              onClick={() => setFeaturesExpanded(!featuresExpanded)}
              className="p-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all duration-200 hover:scale-110 transform animate-fadeInUp"
              style={{ animationDelay: '0.15s' }}
              title="Features"
            >
              <Sparkles size={20} />
            </button>

            {/* Tier Upgrade Button */}
            {!isProUser && (
              <button
                onClick={onOpenTierUpgrade}
                className="p-2 rounded-lg hover:bg-gray-800 transition-all duration-200 bg-yellow-900/20 border border-yellow-700/30 hover:scale-110 transform animate-fadeInUp"
                style={{ animationDelay: '0.2s' }}
                title="Upgrade to Pro"
              >
                <Crown size={20} className="text-yellow-400" />
              </button>
            )}
            
            {/* SuperAdmin Dashboard Button */}
            {isSuperAdmin() && onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                className="p-2 rounded-lg hover:bg-gray-800 transition-all duration-200 bg-red-900/20 border border-red-700/30 hover:scale-110 transform animate-fadeInUp"
                style={{ animationDelay: '0.25s' }}
                title="Admin Dashboard"
              >
                <Shield size={20} className="text-red-400" />
              </button>
            )}
            
            <div className="flex-1"></div>
            
            {/* User Icon - Collapsed */}
            <button
              onClick={() => setUserMenuExpanded(!userMenuExpanded)}
              className="p-2 rounded-lg hover:bg-gray-800 transition-all duration-200 hover:scale-110 transform animate-fadeInUp"
              style={{ animationDelay: '0.3s' }}
              title={user.email}
            >
              {isSuperAdmin() ? (
                <Shield size={20} className="text-red-400" />
              ) : isProUser ? (
                <Crown size={20} className="text-yellow-400" />
              ) : (
                <User size={20} />
              )}
            </button>
          </>
        ) : (
          <button
            onClick={onOpenAuth}
            className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 transition-all duration-200 hover:scale-110 transform animate-fadeInUp"
            title="Sign In"
          >
            <User size={20} />
          </button>
        )}
      </div>
    );
  }

  // Desktop expanded sidebar
  return (
    <div className="hidden lg:flex w-64 bg-gray-900 text-white flex-col h-full transition-all duration-300 ease-in-out">
      {/* Header with Logo */}
      <div className="p-4 border-b border-gray-700">
        <Logo size="sm" className="mb-4 animate-fadeInUp" showProCrown={isProUser} />
        {user && (
          <div className="space-y-2">
            <button
              onClick={onNewChat}
              className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-all duration-200 hover:scale-105 transform animate-fadeInUp"
              style={{ animationDelay: '0.1s' }}
            >
              <Plus size={18} />
              <span className="font-medium">New Chat</span>
            </button>
            
            {/* Features Submenu - Desktop */}
            <div className="animate-fadeInUp" style={{ animationDelay: '0.15s' }}>
              <button
                onClick={() => setFeaturesExpanded(!featuresExpanded)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all duration-200 hover:scale-105 transform"
              >
                <div className="flex items-center space-x-3">
                  <Sparkles size={18} />
                  <span className="font-medium">Features</span>
                </div>
                {featuresExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              
              {featuresExpanded && (
                <div className="mt-2 ml-4 space-y-1 animate-slideDown">
                  <button
                    onClick={onOpenDebateClub}
                    className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-all duration-200 text-sm"
                  >
                    <Mic size={16} />
                    <span>AI Debate Club</span>
                  </button>

                  <button
                    onClick={onOpenVoiceLabs}
                    className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-all duration-200 text-sm"
                  >
                    <Headphones size={16} />
                    <span>Voice Labs</span>
                  </button>

                  {isProUser ? (
                    <button
                      onClick={onOpenVideoCall}
                      className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-all duration-200 text-sm"
                    >
                      <Video size={16} />
                      <span>AI Video Call</span>
                    </button>
                  ) : (
                    <div className="relative">
                      <button
                        disabled
                        className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg opacity-50 cursor-not-allowed text-sm"
                      >
                        <Video size={16} />
                        <span>AI Video Call</span>
                        <Crown size={12} className="text-yellow-400 ml-auto" />
                      </button>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <button
                          onClick={onOpenTierUpgrade}
                          className="text-xs bg-yellow-600 text-white px-2 py-1 rounded-full hover:bg-yellow-700 transition-colors"
                        >
                          Pro Only
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Desktop Upgrade to Pro Button for Free Users */}
            {!isProUser && (
              <button
                onClick={onOpenTierUpgrade}
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 transition-all duration-200 hover:scale-105 transform animate-fadeInUp"
                style={{ animationDelay: '0.2s' }}
              >
                <Crown size={18} />
                <span className="font-medium">Upgrade to Pro</span>
              </button>
            )}
          </div>
        )}
      </div>

      {user ? (
        <>
          <div className="p-4 border-b border-gray-700 animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search chats..."
                className="w-full pl-10 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all duration-200"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            <div className="space-y-1">
              {sessions.map((session, index) => (
                <div
                  key={session.id}
                  className={`group flex flex-col px-3 py-3 rounded-lg cursor-pointer transition-all duration-200 transform hover:scale-105 animate-fadeInUp ${
                    currentSessionId === session.id
                      ? 'bg-gray-700'
                      : 'hover:bg-gray-800'
                  }`}
                  style={{ animationDelay: `${0.35 + index * 0.05}s` }}
                  onClick={() => onSelectSession(session.id)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <MessageCircle size={16} className="text-gray-400 flex-shrink-0" />
                      <span className="text-sm font-medium truncate">{session.title}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-600 transition-all duration-200 flex-shrink-0 hover:scale-110 transform"
                    >
                      <Trash2 size={12} className="text-gray-400" />
                    </button>
                  </div>
                  
                  <div className="text-xs text-gray-400 truncate">
                    {getSessionPreview(session)}
                  </div>
                  
                  {session.messages.length > 0 && (
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                      <span>{getSessionMessageCount(session)} turn{getSessionMessageCount(session) !== 1 ? 's' : ''}</span>
                      <span>{session.updatedAt.toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              ))}
              
              {sessions.length === 0 && (
                <div className="text-center py-8 text-gray-400 animate-fadeInUp" style={{ animationDelay: '0.35s' }}>
                  <MessageCircle size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No conversations yet</p>
                  <p className="text-xs">Start a new chat to begin</p>
                </div>
              )}
            </div>
          </div>

          {/* SuperAdmin Dashboard Button */}
          {isSuperAdmin() && onOpenAdmin && (
            <div className="p-4 border-t border-gray-700">
              <button
                onClick={onOpenAdmin}
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-all duration-200 bg-red-900/20 border border-red-700/30 hover:scale-105 transform animate-fadeInUp"
                style={{ animationDelay: '0.4s' }}
              >
                <Shield size={18} className="text-red-400" />
                <span className="font-medium text-red-400">Admin Dashboard</span>
              </button>
            </div>
          )}
          
          {/* User Menu Dropdown */}
          <div className="p-4 border-t border-gray-700 animate-fadeInUp" style={{ animationDelay: '0.45s' }}>
            <button
              onClick={() => setUserMenuExpanded(!userMenuExpanded)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-800 transition-all duration-200"
            >
              <div className="flex items-center space-x-2 min-w-0">
                {isSuperAdmin() ? (
                  <Shield size={16} className="text-red-400 flex-shrink-0" />
                ) : isProUser ? (
                  <Crown size={16} className="text-yellow-400 flex-shrink-0" />
                ) : (
                  <User size={16} className="flex-shrink-0" />
                )}
                <span className="text-sm truncate">{user.email}</span>
                {isSuperAdmin() && (
                  <span className="text-xs bg-red-900/30 text-red-400 px-2 py-0.5 rounded-full animate-pulse flex-shrink-0">
                    ADMIN
                  </span>
                )}
                {isProUser && !isSuperAdmin() && (
                  <span className="text-xs bg-yellow-900/30 text-yellow-400 px-2 py-0.5 rounded-full animate-pulse flex-shrink-0">
                    PRO
                  </span>
                )}
              </div>
              {userMenuExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            
            {userMenuExpanded && (
              <div className="mt-2 ml-4 space-y-1 animate-slideDown">
                <button
                  onClick={onOpenAnalytics}
                  className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-all duration-200 text-sm"
                >
                  <BarChart3 size={16} />
                  <span>Analytics</span>
                </button>
                
                <button
                  onClick={onOpenSettings}
                  className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-all duration-200 text-sm"
                >
                  <Settings size={16} />
                  <span>Settings</span>
                </button>
                
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-all duration-200 text-red-400 hover:text-red-300 text-sm"
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center animate-fadeInUp">
            <User size={48} className="text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Welcome!</h3>
            <p className="text-gray-400 text-sm mb-4">Sign in to start comparing AI responses</p>
            <button
              onClick={onOpenAuth}
              className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all duration-200 hover:scale-105 transform"
            >
              Sign In / Sign Up
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
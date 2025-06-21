import React from 'react';
import { Plus, MessageCircle, Settings, Trash2, Search, BarChart3, LogOut, User, X, Shield, Crown, Infinity, Mic, Video } from 'lucide-react';
import { ChatSession } from '../types';
import { useAuth } from '../hooks/useAuth';
import { UsageIndicator } from './UsageIndicator';
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
  isCollapsed,
  isMobileOpen,
  onToggleMobile
}) => {
  const { user, userProfile, signOut, isSuperAdmin, getCurrentTier, getUsageInfo } = useAuth();

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
                <Logo size="sm" className="animate-fadeInUp" />
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
                  
                  <button
                    onClick={() => {
                      onOpenDebateClub();
                      onToggleMobile();
                    }}
                    className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all duration-200 hover:scale-105 transform animate-fadeInUp"
                    style={{ animationDelay: '0.15s' }}
                  >
                    <Mic size={18} />
                    <span className="font-medium">AI Debate Club</span>
                  </button>

                  <button
                    onClick={() => {
                      onOpenVideoCall();
                      onToggleMobile();
                    }}
                    className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 hover:scale-105 transform animate-fadeInUp"
                    style={{ animationDelay: '0.2s' }}
                  >
                    <Video size={18} />
                    <span className="font-medium">AI Video Call</span>
                  </button>
                </div>
              )}
            </div>

            {user ? (
              <>
                {/* Usage Indicator */}
                <div className="p-4 border-b border-gray-700 animate-fadeInUp" style={{ animationDelay: '0.25s' }}>
                  <UsageIndicator
                    usage={usage}
                    limit={limit}
                    tier={currentTier}
                    onUpgradeClick={() => {
                      onOpenTierUpgrade();
                      onToggleMobile();
                    }}
                  />
                </div>

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
                        style={{ animationDelay: `${0.4 + index * 0.05}s` }}
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
                      <div className="text-center py-8 text-gray-400 animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
                        <MessageCircle size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No conversations yet</p>
                        <p className="text-xs">Start a new chat to begin</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 border-t border-gray-700 space-y-2">
                  {[
                    { onClick: () => { onOpenAnalytics(); onToggleMobile(); }, icon: BarChart3, label: 'Analytics' },
                    { onClick: () => { onOpenSettings(); onToggleMobile(); }, icon: Settings, label: 'Settings' }
                  ].map((item, index) => (
                    <button
                      key={item.label}
                      onClick={item.onClick}
                      className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-all duration-200 hover:scale-105 transform animate-fadeInUp"
                      style={{ animationDelay: `${0.5 + index * 0.1}s` }}
                    >
                      <item.icon size={18} />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  ))}
                  
                  {/* SuperAdmin Dashboard Button */}
                  {isSuperAdmin() && onOpenAdmin && (
                    <button
                      onClick={() => {
                        onOpenAdmin();
                        onToggleMobile();
                      }}
                      className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-all duration-200 bg-red-900/20 border border-red-700/30 hover:scale-105 transform animate-fadeInUp"
                      style={{ animationDelay: '0.7s' }}
                    >
                      <Shield size={18} className="text-red-400" />
                      <span className="font-medium text-red-400">Admin Dashboard</span>
                    </button>
                  )}
                  
                  <div className="pt-2 border-t border-gray-700 animate-fadeInUp" style={{ animationDelay: '0.8s' }}>
                    <div className="flex items-center space-x-3 px-3 py-2 text-sm text-gray-400">
                      <div className="flex items-center space-x-2">
                        {isSuperAdmin() ? (
                          <Shield size={16} className="text-red-400" />
                        ) : isProUser ? (
                          <Crown size={16} className="text-yellow-400" />
                        ) : (
                          <User size={16} />
                        )}
                        <span className="truncate">{user.email}</span>
                      </div>
                      {isSuperAdmin() && (
                        <span className="text-xs bg-red-900/30 text-red-400 px-2 py-0.5 rounded-full animate-pulse">
                          ADMIN
                        </span>
                      )}
                      {isProUser && !isSuperAdmin() && (
                        <span className="text-xs bg-yellow-900/30 text-yellow-400 px-2 py-0.5 rounded-full animate-pulse">
                          PRO
                        </span>
                      )}
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-all duration-200 text-red-400 hover:text-red-300 hover:scale-105 transform"
                    >
                      <LogOut size={18} />
                      <span className="font-medium">Sign Out</span>
                    </button>
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
        <Logo variant="icon" size="sm" className="animate-fadeInUp" />
        {user ? (
          <>
            {[
              { onClick: onNewChat, icon: Plus, title: 'New Chat', bgClass: 'bg-gray-800 hover:bg-gray-700' },
              { onClick: onOpenDebateClub, icon: Mic, title: 'AI Debate Club', bgClass: 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700' },
              { onClick: onOpenVideoCall, icon: Video, title: 'AI Video Call', bgClass: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700' },
              { onClick: onOpenAnalytics, icon: BarChart3, title: 'Analytics', bgClass: 'hover:bg-gray-800' },
              { onClick: onOpenSettings, icon: Settings, title: 'Settings', bgClass: 'hover:bg-gray-800' }
            ].map((item, index) => (
              <button
                key={item.title}
                onClick={item.onClick}
                className={`p-2 rounded-lg transition-all duration-200 hover:scale-110 transform animate-fadeInUp ${item.bgClass}`}
                style={{ animationDelay: `${0.1 + index * 0.1}s` }}
                title={item.title}
              >
                <item.icon size={20} />
              </button>
            ))}
            
            {/* SuperAdmin Dashboard Button */}
            {isSuperAdmin() && onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                className="p-2 rounded-lg hover:bg-gray-800 transition-all duration-200 bg-red-900/20 border border-red-700/30 hover:scale-110 transform animate-fadeInUp"
                style={{ animationDelay: '0.6s' }}
                title="Admin Dashboard"
              >
                <Shield size={20} className="text-red-400" />
              </button>
            )}

            {/* Tier Upgrade Button */}
            {!isProUser && (
              <button
                onClick={onOpenTierUpgrade}
                className="p-2 rounded-lg hover:bg-gray-800 transition-all duration-200 bg-yellow-900/20 border border-yellow-700/30 hover:scale-110 transform animate-fadeInUp"
                style={{ animationDelay: '0.7s' }}
                title="Upgrade to Pro"
              >
                <Crown size={20} className="text-yellow-400" />
              </button>
            )}
            
            <div className="flex-1"></div>
            <button
              onClick={handleSignOut}
              className="p-2 rounded-lg hover:bg-gray-800 transition-all duration-200 hover:scale-110 transform animate-fadeInUp"
              style={{ animationDelay: '0.8s' }}
              title="Sign Out"
            >
              <LogOut size={20} />
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
        <Logo size="sm" className="mb-4 animate-fadeInUp" />
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
            
            <button
              onClick={onOpenDebateClub}
              className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transition-all duration-200 hover:scale-105 transform animate-fadeInUp"
              style={{ animationDelay: '0.15s' }}
            >
              <Mic size={18} />
              <span className="font-medium">AI Debate Club</span>
            </button>

            <button
              onClick={onOpenVideoCall}
              className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 hover:scale-105 transform animate-fadeInUp"
              style={{ animationDelay: '0.2s' }}
            >
              <Video size={18} />
              <span className="font-medium">AI Video Call</span>
            </button>
          </div>
        )}
      </div>

      {user ? (
        <>
          {/* Usage Indicator */}
          <div className="p-4 border-b border-gray-700 animate-fadeInUp" style={{ animationDelay: '0.25s' }}>
            <UsageIndicator
              usage={usage}
              limit={limit}
              tier={currentTier}
              onUpgradeClick={onOpenTierUpgrade}
            />
          </div>

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
                  style={{ animationDelay: `${0.4 + index * 0.05}s` }}
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
                <div className="text-center py-8 text-gray-400 animate-fadeInUp" style={{ animationDelay: '0.4s' }}>
                  <MessageCircle size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No conversations yet</p>
                  <p className="text-xs">Start a new chat to begin</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-gray-700 space-y-2">
            {[
              { onClick: onOpenAnalytics, icon: BarChart3, label: 'Analytics' },
              { onClick: onOpenSettings, icon: Settings, label: 'Settings' }
            ].map((item, index) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-all duration-200 hover:scale-105 transform animate-fadeInUp"
                style={{ animationDelay: `${0.5 + index * 0.1}s` }}
              >
                <item.icon size={18} />
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
            
            {/* SuperAdmin Dashboard Button */}
            {isSuperAdmin() && onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-all duration-200 bg-red-900/20 border border-red-700/30 hover:scale-105 transform animate-fadeInUp"
                style={{ animationDelay: '0.7s' }}
              >
                <Shield size={18} className="text-red-400" />
                <span className="font-medium text-red-400">Admin Dashboard</span>
              </button>
            )}

            {/* Tier Upgrade Button */}
            {!isProUser && (
              <button
                onClick={onOpenTierUpgrade}
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-all duration-200 bg-yellow-900/20 border border-yellow-700/30 hover:scale-105 transform animate-fadeInUp"
                style={{ animationDelay: '0.8s' }}
              >
                <Crown size={18} className="text-yellow-400" />
                <span className="font-medium text-yellow-400">Upgrade to Pro</span>
              </button>
            )}
            
            <div className="pt-2 border-t border-gray-700 animate-fadeInUp" style={{ animationDelay: '0.9s' }}>
              <div className="flex items-center space-x-3 px-3 py-2 text-sm text-gray-400">
                <div className="flex items-center space-x-2">
                  {isSuperAdmin() ? (
                    <Shield size={16} className="text-red-400" />
                  ) : isProUser ? (
                    <Crown size={16} className="text-yellow-400" />
                  ) : (
                    <User size={16} />
                  )}
                  <span className="truncate">{user.email}</span>
                </div>
                {isSuperAdmin() && (
                  <span className="text-xs bg-red-900/30 text-red-400 px-2 py-0.5 rounded-full animate-pulse">
                    ADMIN
                  </span>
                )}
                {isProUser && !isSuperAdmin() && (
                  <span className="text-xs bg-yellow-900/30 text-yellow-400 px-2 py-0.5 rounded-full animate-pulse">
                    PRO
                  </span>
                )}
              </div>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-all duration-200 text-red-400 hover:text-red-300 hover:scale-105 transform"
              >
                <LogOut size={18} />
                <span className="font-medium">Sign Out</span>
              </button>
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
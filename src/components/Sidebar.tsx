import React from 'react';
import { Plus, MessageCircle, Settings, Trash2, Search, BarChart3, LogOut, User, X } from 'lucide-react';
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
  isCollapsed,
  isMobileOpen,
  onToggleMobile
}) => {
  const { user, signOut } = useAuth();

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

  // Mobile overlay
  if (isMobileOpen) {
    return (
      <>
        {/* Mobile backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggleMobile}
        />
        
        {/* Mobile sidebar */}
        <div className="fixed left-0 top-0 h-full w-80 bg-gray-900 text-white z-50 lg:hidden transform transition-transform duration-300 ease-in-out">
          <div className="flex flex-col h-full">
            {/* Header with Logo and Close */}
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <Logo size="sm" />
                <button
                  onClick={onToggleMobile}
                  className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              {user && (
                <button
                  onClick={() => {
                    onNewChat();
                    onToggleMobile();
                  }}
                  className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                >
                  <Plus size={18} />
                  <span className="font-medium">New Chat</span>
                </button>
              )}
            </div>

            {user ? (
              <>
                <div className="p-4 border-b border-gray-700">
                  <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search chats..."
                      className="w-full pl-10 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                  <div className="space-y-1">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className={`group flex flex-col px-3 py-3 rounded-lg cursor-pointer transition-colors ${
                          currentSessionId === session.id
                            ? 'bg-gray-700'
                            : 'hover:bg-gray-800'
                        }`}
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
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-600 transition-all flex-shrink-0"
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
                      <div className="text-center py-8 text-gray-400">
                        <MessageCircle size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No conversations yet</p>
                        <p className="text-xs">Start a new chat to begin</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 border-t border-gray-700 space-y-2">
                  <button
                    onClick={() => {
                      onOpenAnalytics();
                      onToggleMobile();
                    }}
                    className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    <BarChart3 size={18} />
                    <span className="font-medium">Analytics</span>
                  </button>
                  <button
                    onClick={() => {
                      onOpenSettings();
                      onToggleMobile();
                    }}
                    className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    <Settings size={18} />
                    <span className="font-medium">Settings</span>
                  </button>
                  <div className="pt-2 border-t border-gray-700">
                    <div className="flex items-center space-x-3 px-3 py-2 text-sm text-gray-400">
                      <User size={16} />
                      <span className="truncate">{user.email}</span>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors text-red-400 hover:text-red-300"
                    >
                      <LogOut size={18} />
                      <span className="font-medium">Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center">
                  <User size={48} className="text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">Welcome!</h3>
                  <p className="text-gray-400 text-sm mb-4">Sign in to start comparing AI responses</p>
                  <button
                    onClick={() => {
                      onOpenAuth();
                      onToggleMobile();
                    }}
                    className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
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
      <div className="hidden lg:flex w-16 bg-gray-900 text-white flex-col items-center py-4 space-y-4">
        <Logo variant="icon" size="sm" />
        {user ? (
          <>
            <button
              onClick={onNewChat}
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
              title="New Chat"
            >
              <Plus size={20} />
            </button>
            <button
              onClick={onOpenAnalytics}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
              title="Analytics"
            >
              <BarChart3 size={20} />
            </button>
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
              title="Settings"
            >
              <Settings size={20} />
            </button>
            <div className="flex-1"></div>
            <button
              onClick={handleSignOut}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>
          </>
        ) : (
          <button
            onClick={onOpenAuth}
            className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 transition-colors"
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
    <div className="hidden lg:flex w-64 bg-gray-900 text-white flex-col h-full">
      {/* Header with Logo */}
      <div className="p-4 border-b border-gray-700">
        <Logo size="sm" className="mb-4" />
        {user && (
          <button
            onClick={onNewChat}
            className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            <Plus size={18} />
            <span className="font-medium">New Chat</span>
          </button>
        )}
      </div>

      {user ? (
        <>
          <div className="p-4 border-b border-gray-700">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search chats..."
                className="w-full pl-10 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            <div className="space-y-1">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group flex flex-col px-3 py-3 rounded-lg cursor-pointer transition-colors ${
                    currentSessionId === session.id
                      ? 'bg-gray-700'
                      : 'hover:bg-gray-800'
                  }`}
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
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-600 transition-all flex-shrink-0"
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
                <div className="text-center py-8 text-gray-400">
                  <MessageCircle size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No conversations yet</p>
                  <p className="text-xs">Start a new chat to begin</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-gray-700 space-y-2">
            <button
              onClick={onOpenAnalytics}
              className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <BarChart3 size={18} />
              <span className="font-medium">Analytics</span>
            </button>
            <button
              onClick={onOpenSettings}
              className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors"
            >
              <Settings size={18} />
              <span className="font-medium">Settings</span>
            </button>
            <div className="pt-2 border-t border-gray-700">
              <div className="flex items-center space-x-3 px-3 py-2 text-sm text-gray-400">
                <User size={16} />
                <span className="truncate">{user.email}</span>
              </div>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors text-red-400 hover:text-red-300"
              >
                <LogOut size={18} />
                <span className="font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <User size={48} className="text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">Welcome!</h3>
            <p className="text-gray-400 text-sm mb-4">Sign in to start comparing AI responses</p>
            <button
              onClick={onOpenAuth}
              className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Sign In / Sign Up
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
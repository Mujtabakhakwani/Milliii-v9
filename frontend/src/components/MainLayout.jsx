import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { 
  LayoutDashboard, 
  CheckSquare, 
  FolderKanban, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Users,
  MessageCircle,
  Clock,
  BarChart3
} from 'lucide-react';
import TopBar from './TopBar';
import { BACKEND_URL, API_URL } from '../config';
import { toast } from 'sonner';
import { usePermissions } from '../contexts/PermissionContext';

const API = API_URL;

const MainLayout = ({ children, currentUser, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { permissions, loading: permissionsLoading, hasPermission } = usePermissions();

  // Define all navigation items with their permission requirements
  const allNavItems = [
    {
      name: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      alwaysShow: true  // Dashboard always visible
    },
    {
      name: 'My Tasks',
      path: '/my-tasks',
      icon: CheckSquare,
      alwaysShow: true  // My Tasks always visible
    },
    {
      name: 'My Projects',
      path: '/projects',
      icon: FolderKanban,
      alwaysShow: true  // My Projects always visible
    },
    {
      name: 'Chats',
      path: '/chats',
      icon: MessageCircle,
      permission: ['can_have_direct_chat', 'can_chat_with_millii']  // Show if either permission
    },
    {
      name: 'Team Members',
      path: '/team-members',
      icon: Users,
      permission: 'can_view_team_tab'
    },
    {
      name: 'Time Sheet',
      path: '/time-sheet',
      icon: Clock,
      permission: 'can_view_time_sheet_tab'
    },
    {
      name: 'Reports',
      path: '/reports',
      icon: BarChart3,
      permission: 'can_view_reports_tab'
    }
  ];

  // Filter nav items based on permissions
  const navItems = allNavItems.filter(item => {
    // Always show items marked as alwaysShow
    if (item.alwaysShow) return true;
    
    // If no permission check needed, show it
    if (!item.permission) return true;
    
    // If permissions are still loading, don't show restricted items
    if (permissionsLoading || !permissions) return false;
    
    // Check if user has the required permission(s)
    if (Array.isArray(item.permission)) {
      // Show if user has ANY of the permissions in the array
      return item.permission.some(perm => hasPermission(perm));
    }
    
    // Single permission check
    return hasPermission(item.permission);
  });

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 overflow-hidden">
      {/* Sidebar with Enhanced Glassmorphism */}
      <div 
        className={`${
          collapsed ? 'w-20' : 'w-64'
        } relative transition-all duration-500 ease-in-out flex flex-col animate-slide-in-left`}
      >
        {/* Glassmorphism Background */}
        <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-r border-gray-200 dark:border-gray-700"></div>
        
        {/* Sidebar Content */}
        <div className="relative z-10 flex flex-col h-full">
          {/* Logo Section */}
          <div className="h-24 flex items-center justify-center px-5 border-b border-white/30 dark:border-purple-500/20">
            {!collapsed && (
              <div className="flex items-center space-x-4 animate-fade-in">
                <div className="relative">
                  <Sparkles className="w-12 h-12 text-purple-600 dark:text-purple-400 animate-pulse" />
                  <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full"></div>
                </div>
                <span className="text-3xl font-extrabold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-clip-text text-transparent animate-shimmer bg-[length:200%_auto]">
                  Millii
                </span>
              </div>
            )}
            {collapsed && (
              <div className="relative mx-auto">
                <Sparkles className="w-12 h-12 text-purple-600 dark:text-purple-400 animate-pulse" />
                <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full"></div>
              </div>
            )}
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navItems.filter(item => !item.adminOnly || currentUser?.role === 'admin').map((item, index) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  style={{ animationDelay: `${index * 0.1}s` }}
                  className={`
                    w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-300 animate-fade-in group
                    ${active 
                      ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 dark:from-blue-500/30 dark:to-purple-500/30 text-purple-700 dark:text-purple-300 shadow-lg shadow-purple-500/20 border border-purple-500/30 backdrop-blur-sm' 
                      : 'text-gray-700 dark:text-gray-300 hover:bg-white/40 dark:hover:bg-white/5 hover:shadow-md hover:shadow-blue-500/10 hover:border hover:border-blue-500/20 hover:backdrop-blur-sm'
                    }
                    ${collapsed ? 'justify-center' : ''}
                  `}
                  title={collapsed ? item.name : ''}
                >
                  <Icon className={`w-5 h-5 transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'} ${collapsed ? '' : 'flex-shrink-0'}`} />
                  {!collapsed && (
                    <span className="text-sm font-semibold tracking-wide">{item.name}</span>
                  )}
                  {active && !collapsed && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 animate-pulse"></div>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Settings at Bottom */}
          <div className="px-4 pb-6 space-y-2 border-t border-white/30 dark:border-purple-500/20 pt-6">
            <button
              onClick={() => navigate('/settings')}
              className={`
                w-full flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all duration-300 group
                ${isActive('/settings')
                  ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 dark:from-blue-500/30 dark:to-purple-500/30 text-purple-700 dark:text-purple-300 shadow-lg shadow-purple-500/20 border border-purple-500/30 backdrop-blur-sm' 
                  : 'text-gray-700 dark:text-gray-300 hover:bg-white/40 dark:hover:bg-white/5 hover:shadow-md hover:shadow-blue-500/10 hover:border hover:border-blue-500/20 hover:backdrop-blur-sm'
                }
                ${collapsed ? 'justify-center' : ''}
              `}
              title={collapsed ? 'Settings' : ''}
            >
              <Settings className={`w-5 h-5 transition-transform duration-300 ${isActive('/settings') ? 'scale-110 rotate-90' : 'group-hover:scale-110 group-hover:rotate-90'} ${collapsed ? '' : 'flex-shrink-0'}`} />
              {!collapsed && (
                <span className="text-sm font-semibold tracking-wide">Settings</span>
              )}
            </button>

            {/* Collapse Toggle */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="w-full flex items-center justify-center px-3 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-white/40 dark:hover:bg-white/5 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-300 hover:shadow-md hover:border hover:border-purple-500/20"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <ChevronRight className="w-5 h-5 transition-transform duration-300 hover:scale-110" />
              ) : (
                <ChevronLeft className="w-5 h-5 transition-transform duration-300 hover:scale-110" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <TopBar currentUser={currentUser} onLogout={onLogout} />

        {/* Page Content with Smooth Entry Animation */}
        <main className="flex-1 overflow-y-auto bg-transparent">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default MainLayout;

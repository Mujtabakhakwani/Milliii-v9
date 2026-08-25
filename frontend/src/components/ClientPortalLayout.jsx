import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Briefcase, LogOut, User, Menu, X, MessageSquare, ChevronDown, ChevronRight, Hash } from 'lucide-react';
import axios from 'axios';
import { BACKEND_URL, API_URL } from '../config';

const API = API_URL;

const ClientPortalLayout = ({ children, currentUser, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatsExpanded, setChatsExpanded] = useState(false);
  const [channels, setChannels] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(false);

  // Load channels on component mount
  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    if (loadingChannels) return; // Prevent duplicate calls
    
    setLoadingChannels(true);
    try {
      const token = localStorage.getItem('token');
      console.log('Loading channels with token:', token ? 'exists' : 'missing');
      
      const response = await axios.get(`${API}/channels`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Channels API response:', response.data);
      
      // Handle the response structure - it returns {channels: [], organized: {}}
      const channelData = response.data?.channels || response.data;
      
      if (Array.isArray(channelData)) {
        console.log(`Successfully loaded ${channelData.length} channels`);
        setChannels(channelData);
      } else if (typeof channelData === 'object' && channelData !== null) {
        // If it's an object, try to extract channels array
        const extractedChannels = channelData.channels || [];
        console.log(`Extracted ${extractedChannels.length} channels from object`);
        setChannels(extractedChannels);
      } else {
        console.warn('Channels response is not an array or valid object:', channelData);
        setChannels([]);
      }
    } catch (error) {
      console.error('Failed to load channels:', error);
      setChannels([]);
    } finally {
      setLoadingChannels(false);
    }
  };

  const handleChatNavigation = (channelId = null) => {
    if (channelId) {
      navigate(`/chats?channel=${channelId}`);
    } else {
      navigate('/chats');
    }
  };

  const navigation = [
    { name: 'My Projects', path: '/projects', icon: Briefcase },
  ];

  // Filter project channels only for clients - ensure channels is an array
  const projectChannels = Array.isArray(channels) ? channels.filter(ch => ch.type === 'project') : [];
  
  // Also include direct message channels if any
  const allUserChannels = Array.isArray(channels) ? channels.filter(ch => 
    ch.type === 'project' || ch.type === 'direct'
  ) : [];
  
  console.log('Total channels:', channels.length);
  console.log('Project channels:', projectChannels.length);
  console.log('All user channels:', allUserChannels.length);

  const isChatsActive = location.pathname === '/chats' || location.pathname.startsWith('/chats');

  return (
    <div className="flex h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-r border-gray-200 dark:border-gray-700 flex flex-col`}>
        {/* Logo & Toggle */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          {sidebarOpen && (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800 dark:text-white">Client Portal</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Welcome, {currentUser?.name?.split(' ')[0]}</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path);
            return (
              <button
                key={item.name}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center ${sidebarOpen ? 'space-x-3 px-4' : 'justify-center'} py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Icon className="w-5 h-5" />
                {sidebarOpen && <span className="font-medium">{item.name}</span>}
              </button>
            );
          })}

          {/* Chats with expandable submenu */}
          <div>
            <button
              onClick={() => {
                if (sidebarOpen) {
                  setChatsExpanded(!chatsExpanded);
                } else {
                  navigate('/chats');
                }
              }}
              className={`w-full flex items-center ${sidebarOpen ? 'space-x-3 px-4' : 'justify-center'} py-3 rounded-lg transition-all ${
                isChatsActive
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <MessageSquare className="w-5 h-5" />
              {sidebarOpen && (
                <>
                  <span className="font-medium flex-1 text-left">Chats</span>
                  {chatsExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </>
              )}
            </button>

            {/* Channel submenu */}
            {sidebarOpen && chatsExpanded && (
              <div className="ml-4 mt-1 space-y-1">
                {loadingChannels ? (
                  <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">Loading channels...</p>
                ) : allUserChannels.length > 0 ? (
                  allUserChannels.map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => handleChatNavigation(channel.id)}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Hash className="w-4 h-4" />
                      <span className="truncate">{channel.name}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">No channels available</p>
                )}
              </div>
            )}
          </div>
        </nav>

        {/* User Menu */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className={`flex items-center ${sidebarOpen ? 'space-x-3' : 'justify-center'} mb-3`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-500 to-teal-500 flex items-center justify-center text-white font-bold">
              {currentUser?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'G'}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{currentUser?.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Guest Access</p>
              </div>
            )}
          </div>
          
          <button
            onClick={onLogout}
            className={`w-full flex items-center ${sidebarOpen ? 'space-x-3 px-4' : 'justify-center'} py-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors`}
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export default ClientPortalLayout;

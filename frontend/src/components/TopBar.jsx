import React, { useState, useEffect } from 'react';
import { Moon, Sun, ChevronDown, LogOut, UserCircle, Zap, Clock, Play, Square } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import axios from 'axios';
import { toast } from 'sonner';
import Notifications from './Notifications';
import ClockInOutDialog from './ClockInOutDialog';
import InactivityWarningModal from './InactivityWarningModal';
import InactivityIndicator from './InactivityIndicator';
import useInactivityTimer from '../hooks/useInactivityTimer';
import { API_URL } from '../config';

const API = API_URL;

const TopBar = ({ currentUser, onLogout }) => {
  const { theme, toggleTheme } = useTheme();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showClockInDialog, setShowClockInDialog] = useState(false);
  const [activeTimeEntry, setActiveTimeEntry] = useState(null);
  const [isLoadingTimeEntry, setIsLoadingTimeEntry] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);

  // Inactivity timer handlers
  const handleShowInactivityWarning = () => {
    console.log('🚨 Showing inactivity warning modal');
    setShowInactivityWarning(true);
  };

  const handleAutoStopTimer = async () => {
    console.log('⏹️ Auto-stopping timer due to inactivity');
    if (activeTimeEntry) {
      try {
        await axios.post(`${API}/time-entries/clock-out`, {
          time_entry_id: activeTimeEntry.id,
          note: 'Auto-stopped due to inactivity'
        });
        setActiveTimeEntry(null);
        setShowInactivityWarning(false);
        toast.info('Timer stopped automatically due to inactivity', {
          description: 'Your time has been saved up to the point of inactivity.',
        });
      } catch (error) {
        console.error('Error auto-stopping timer:', error);
        toast.error('Failed to auto-stop timer');
      }
    }
  };

  const handleContinueWorking = () => {
    console.log('✅ User chose to continue working');
    setShowInactivityWarning(false);
    inactivityTimer.triggerActivity();
    toast.success('Timer continues running', {
      description: 'Great! We\'ll keep tracking your time.',
    });
  };

  const handleManualStopTimer = async () => {
    console.log('⏸️ User manually stopped timer from inactivity warning');
    await handleAutoStopTimer();
  };

  // Initialize inactivity timer
  const inactivityTimer = useInactivityTimer({
    activeTimeEntry,
    onShowWarning: handleShowInactivityWarning,
    onAutoStop: handleAutoStopTimer,
    warningThreshold: 4 * 60 * 1000, // 4 minutes
    autoStopThreshold: 5 * 60 * 1000, // 5 minutes
  });

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate elapsed time for active time entry
  useEffect(() => {
    if (activeTimeEntry) {
      const interval = setInterval(() => {
        const clockInTime = new Date(activeTimeEntry.clock_in_time);
        const now = new Date();
        const seconds = Math.floor((now - clockInTime) / 1000);
        setElapsedTime(seconds);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [activeTimeEntry]);

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Fetch active time entry
  useEffect(() => {
    const fetchActiveTimeEntry = async () => {
      try {
        const response = await axios.get(`${API}/time-entries/active`);
        setActiveTimeEntry(response.data);
      } catch (error) {
        console.error('Error fetching active time entry:', error);
      } finally {
        setIsLoadingTimeEntry(false);
      }
    };

    if (currentUser) {
      fetchActiveTimeEntry();
    }
  }, [currentUser]);

  // Fetch team members if admin
  useEffect(() => {
    if (currentUser?.role === 'admin') {
      fetchTeamMembers();
    }
  }, [currentUser]);

  const fetchTeamMembers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API}/team-members-list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTeamMembers(response.data);
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast.error('Failed to fetch team members');
    }
  };

  const handleImpersonate = async (userId) => {
    try {
      // Store original admin token before impersonation
      const currentToken = localStorage.getItem('token');
      const currentUser = localStorage.getItem('user');
      localStorage.setItem('admin_token', currentToken);
      localStorage.setItem('admin_user', currentUser);
      
      const response = await axios.post(`${API}/admin/impersonate/${userId}`);
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('user', JSON.stringify(response.data.user)); // Store impersonated user data
      localStorage.setItem('is_impersonating', 'true');
      toast.success(`Switched to ${response.data.user.name}'s account`);
      window.location.reload();
    } catch (error) {
      toast.error('Failed to impersonate user');
      console.error('Impersonation error:', error);
    }
  };

  const handleExitImpersonation = () => {
    const adminToken = localStorage.getItem('admin_token');
    const adminUser = localStorage.getItem('admin_user');
    if (adminToken) {
      localStorage.setItem('token', adminToken);
      if (adminUser) {
        localStorage.setItem('user', adminUser); // Restore admin user data
      }
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      localStorage.removeItem('is_impersonating');
      toast.success('Returned to admin account');
      window.location.reload();
    }
  };

  const isImpersonating = localStorage.getItem('is_impersonating') === 'true';

  const formatDateTime = (date) => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: timeZone
    });
  };

  const formatDate = (date) => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: timeZone
    });
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="h-16 relative">
      {/* Glassmorphism Background */}
      <div className="absolute inset-0 bg-white/40 dark:bg-gray-900/40 backdrop-blur-2xl"></div>
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-blue-500/5 dark:from-blue-500/10 dark:via-purple-500/10 dark:to-blue-500/10"></div>
      
      {/* Content */}
      <div className="relative z-10 h-full flex items-center justify-end px-8">
        {/* Right side - Clock In, Notifications, Profile */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <Notifications />

          {/* Clock In/Out Button - Between Notifications and Profile */}
          {!isLoadingTimeEntry && (
            <div className="relative">
              <button
                onClick={() => setShowClockInDialog(true)}
                className={`relative px-3 py-2.5 rounded-xl backdrop-blur-lg border shadow-md transition-all duration-300 hover:shadow-lg hover:scale-105 group ${
                  activeTimeEntry
                    ? 'bg-red-500/20 dark:bg-red-500/30 border-red-500/40 dark:border-red-500/50'
                    : 'bg-green-500/20 dark:bg-green-500/30 border-green-500/40 dark:border-green-500/50'
                }`}
                title={activeTimeEntry ? `Tracking: ${activeTimeEntry.task?.title}` : 'Clock In'}
              >
                <div className={`absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                  activeTimeEntry
                    ? 'bg-gradient-to-r from-red-500/10 to-orange-500/10'
                    : 'bg-gradient-to-r from-green-500/10 to-emerald-500/10'
                }`}></div>
                
                {activeTimeEntry ? (
                  <div className="relative z-10 flex items-center space-x-2">
                    <Square className="w-4 h-4 fill-current text-red-600 dark:text-red-400" />
                    <span className="text-sm font-mono font-semibold text-red-700 dark:text-red-300">
                      {formatTime(elapsedTime)}
                    </span>
                  </div>
                ) : (
                  <Play className="w-5 h-5 relative z-10 transition-transform duration-300 group-hover:scale-110 text-green-600 dark:text-green-400" />
                )}
              </button>
              
              {/* Inactivity Indicator */}
              <InactivityIndicator 
                isTrackingInactivity={inactivityTimer.isTrackingInactivity}
                warningShown={showInactivityWarning}
                isInactive={inactivityTimer.isInactive}
                activeTimeEntry={activeTimeEntry}
              />
            </div>
          )}

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center space-x-2 p-1 rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg border border-white/40 dark:border-purple-500/30 shadow-md transition-all duration-300 hover:shadow-lg hover:scale-105 group"
            >
              {currentUser?.profile_image_url ? (
                <img
                  src={currentUser.profile_image_url}
                  alt={currentUser.name}
                  className="w-9 h-9 rounded-lg object-cover ring-2 ring-purple-500/50 transition-transform duration-300 group-hover:scale-110"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 via-purple-600 to-blue-500 flex items-center justify-center text-white text-sm font-bold shadow-lg ring-2 ring-purple-500/50 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                  {getInitials(currentUser?.name)}
                </div>
              )}
              <ChevronDown className={`w-4 h-4 text-purple-600 dark:text-purple-400 mr-1 transition-transform duration-300 ${showProfileMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu with Enhanced Glassmorphism */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-3 w-72 rounded-2xl overflow-hidden animate-scale-in shadow-2xl z-50">
                {/* Glassmorphism Background */}
                <div className="absolute inset-0 bg-white/60 dark:bg-gray-800/60 backdrop-blur-2xl border border-white/50 dark:border-purple-500/30"></div>
                
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-blue-500/10 dark:from-blue-500/20 dark:via-purple-500/20 dark:to-blue-500/20"></div>
                
                {/* Content */}
                <div className="relative z-10">
                  {/* User Info */}
                  <div className="px-5 py-4 border-b border-white/40 dark:border-purple-500/30">
                    <p className="text-sm font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      {currentUser?.name}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 font-medium">
                      {currentUser?.email}
                    </p>
                    <div className="mt-2 inline-block px-3 py-1 rounded-lg bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-purple-500/30">
                      <p className="text-xs font-bold text-purple-700 dark:text-purple-300">
                        {currentUser?.role === 'admin' ? '👑 Administrator' : '👤 Team Member'}
                      </p>
                    </div>
                  </div>

                  {/* Admin Impersonation Section */}
                  {currentUser?.role === 'admin' && teamMembers.length > 0 && (
                    <div className="px-3 py-3 border-b border-white/40 dark:border-purple-500/30">
                      <p className="px-2 text-xs font-bold text-purple-600 dark:text-purple-400 mb-2">
                        🔄 Login as Team Member
                      </p>
                      
                      {/* Search Input */}
                      <div className="px-2 mb-2">
                        <input
                          type="text"
                          placeholder="Search team members..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full px-3 py-2 text-sm bg-white/50 dark:bg-gray-700/50 border border-purple-500/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 placeholder-gray-500 dark:placeholder-gray-400"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      
                      {/* Team Members List - Scrollable */}
                      <div className="max-h-64 overflow-y-auto space-y-1">
                        {teamMembers
                          .filter(member => 
                            member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            member.email.toLowerCase().includes(searchQuery.toLowerCase())
                          )
                          .map((member) => (
                            <button
                              key={member.id}
                              onClick={() => handleImpersonate(member.id)}
                              className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-white/60 dark:hover:bg-white/5 transition-all duration-300 text-left group border border-transparent hover:border-purple-500/30 hover:shadow-md"
                            >
                              {member.profile_image_url ? (
                                <img
                                  src={member.profile_image_url}
                                  alt={member.name}
                                  className="w-8 h-8 rounded-lg object-cover ring-2 ring-purple-500/30 transition-transform duration-300 group-hover:scale-110"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-md ring-2 ring-purple-500/30 transition-transform duration-300 group-hover:scale-110">
                                  {getInitials(member.name)}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                                  {member.name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {member.email}
                                </p>
                              </div>
                            </button>
                          ))}
                        {teamMembers.filter(member => 
                          member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          member.email.toLowerCase().includes(searchQuery.toLowerCase())
                        ).length === 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
                            No team members found
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Exit Impersonation Button - Only show if impersonating */}
                  {isImpersonating && (
                    <div className="px-3 py-3 border-b border-white/40 dark:border-purple-500/30">
                      <button
                        onClick={handleExitImpersonation}
                        className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 text-purple-700 dark:text-purple-300 transition-all duration-300 group border border-purple-500/30 hover:shadow-md"
                      >
                        <Zap className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
                        <span className="text-sm font-bold">Exit Impersonation</span>
                      </button>
                    </div>
                  )}

                  {/* Dark Mode Toggle in Dropdown */}
                  <div className="px-3 py-3 border-b border-white/40 dark:border-purple-500/30">
                    <button
                      onClick={toggleTheme}
                      className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-purple-500/10 dark:hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 transition-all duration-300 group border border-transparent hover:border-purple-500/30 hover:shadow-md"
                    >
                      {theme === 'light' ? (
                        <>
                          <Moon className="w-4 h-4 transition-transform duration-300 group-hover:rotate-12" />
                          <span className="text-sm font-semibold">Dark Mode</span>
                        </>
                      ) : (
                        <>
                          <Sun className="w-4 h-4 transition-transform duration-300 group-hover:rotate-180" />
                          <span className="text-sm font-semibold">Light Mode</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Logout */}
                  <div className="px-3 py-3">
                    <button
                      onClick={onLogout}
                      className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-red-500/10 dark:hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-all duration-300 group border border-transparent hover:border-red-500/30 hover:shadow-md"
                    >
                      <LogOut className="w-4 h-4 transition-transform duration-300 group-hover:scale-110" />
                      <span className="text-sm font-semibold">Logout</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Clock In/Out Dialog */}
      <ClockInOutDialog
        open={showClockInDialog}
        onOpenChange={setShowClockInDialog}
        currentUser={currentUser}
        activeTimeEntry={activeTimeEntry}
        onTimeEntryChange={setActiveTimeEntry}
      />

      {/* Inactivity Warning Modal */}
      <InactivityWarningModal
        show={showInactivityWarning}
        onContinue={handleContinueWorking}
        onStopTimer={handleManualStopTimer}
        onClose={() => setShowInactivityWarning(false)}
        timeUntilAutoStop={inactivityTimer.getTimeUntilAutoStop()}
        activeTimeEntry={activeTimeEntry}
      />
    </div>
  );
};

export default TopBar;

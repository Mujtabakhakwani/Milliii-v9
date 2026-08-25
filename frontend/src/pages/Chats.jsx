import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, Hash, User, Users, Plus, Search, Smile, Paperclip, X, ChevronDown, ChevronRight, Bold, Italic, Code, List, Image as ImageIcon, FileText, Trash2, Edit, Sparkles, Calendar, Flag } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import EmojiPicker from 'emoji-picker-react';
import RichTextInput from '../components/RichTextInput';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { BACKEND_URL, API_URL } from '../config';

const API = API_URL;

// ReadReceipt component - moved outside to avoid hooks issues
const ReadReceipt = ({ message, selectedChannel, currentUserId }) => {
  const [readByNames, setReadByNames] = useState([]);
  
  const read_by = message.read_by || [];
  const read_count = read_by.length;
  const isDM = selectedChannel?.type === 'direct';

  // MUST call useEffect before any conditional returns (Rules of Hooks)
  useEffect(() => {
    const fetchNames = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(
          `${API}/messages/${message.id}/read-by`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setReadByNames(response.data.read_by.map(u => u.name));
      } catch (error) {
        console.error('Failed to get read by users:', error);
      }
    };
    
    // Only fetch if it's your own message, has reads, and not a DM
    if (message.sender_id === currentUserId && read_count > 0 && !isDM) {
      fetchNames();
    }
  }, [read_count, message.id, isDM, message.sender_id, currentUserId]);

  // Now safe to do conditional returns AFTER hooks
  // Only show read receipts for your own messages
  if (message.sender_id !== currentUserId) return null;
  if (read_count === 0) return null;

  if (isDM) {
    // Simple "Read" for direct messages
    return (
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Read
      </div>
    );
  } else {
    // Show "Read by names" for channels
    if (readByNames.length === 0) return null;

    return (
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Read by {readByNames.slice(0, 3).join(', ')}
        {readByNames.length > 3 && ` and ${readByNames.length - 3} more`}
      </div>
    );
  }
};

const Chats = () => {
  const { socket, channels, setChannels, on, sendMessage, joinChannel, leaveChannel, sendTyping, connected, channelUnreads, setChannelUnreads } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pendingChannelId, setPendingChannelId] = useState(null); // Track channel ID from URL
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    channels: true,  // Team Channels (main category)
    projects: true,  // Project Channels
    directMessages: true  // Direct Messages
  });
  const [typingUsers, setTypingUsers] = useState([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  
  // New states for Slack features
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFormattingToolbar, setShowFormattingToolbar] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [filePreview, setFilePreview] = useState(null);
  const [editingChannel, setEditingChannel] = useState(null);
  const [hoveredMessage, setHoveredMessage] = useState(null);
  const [messageReactions, setMessageReactions] = useState({});
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  
  // Channel management states
  const [showChannelMembers, setShowChannelMembers] = useState(false);
  const [selectedChannelForMembers, setSelectedChannelForMembers] = useState(null);
  const [channelMembers, setChannelMembers] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [channelMenuOpen, setChannelMenuOpen] = useState(null); // Track which channel menu is open
  const [organizedChannels, setOrganizedChannels] = useState({
    company: [],
    project: [],
    direct: [],
    team: [],
    announcement: []
  });
  
  // Milli thread states
  const [milliThreads, setMilliThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [showThreadList, setShowThreadList] = useState(true);
  const [creatingThread, setCreatingThread] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState('');
  
  // AI Task Extraction states
  const [analyzingMessage, setAnalyzingMessage] = useState(null);
  const [taskSuggestions, setTaskSuggestions] = useState({}); // messageId -> suggestion
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [extractedTask, setExtractedTask] = useState(null);
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const messageInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const backendUrl = BACKEND_URL;
  const token = localStorage.getItem('token');
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  // Helper function to check if user can send messages in current channel
  const canSendMessagesInChannel = (channel) => {
    if (!channel) return true; // Default to enabled if no channel
    
    // Check if channel is read-only
    const isReadOnly = channel.permissions?.read_only || false;
    
    // If channel is read-only, only admins and managers can send messages
    if (isReadOnly) {
      return currentUser.role === 'admin' || currentUser.role === 'manager';
    }
    
    // Check if channel has can_send_messages disabled
    const canSendMessages = channel.permissions?.can_send_messages !== false;
    if (!canSendMessages) {
      return currentUser.role === 'admin' || currentUser.role === 'manager';
    }
    
    return true;
  };

  // Helper functions for avatar
  const getUserProfileImage = (userId) => {
    const user = users.find(u => u.id === userId);
    return user?.profile_image_url || null;
  };

  const renderAvatar = (user, size = 'w-10 h-10') => {
    const profileImage = user.profile_image_url;
    
    if (profileImage) {
      return (
        <img
          src={profileImage}
          alt={user.name}
          className={`${size} rounded-full object-cover flex-shrink-0`}
        />
      );
    }
    
    return (
      <div
        className={`${size} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}
        style={{ backgroundColor: getAvatarColor(user.name) }}
      >
        {getInitials(user.name)}
      </div>
    );
  };

  const renderAvatarByMessage = (message, size = 'w-10 h-10') => {
    // Special handling for Milli AI
    if (message.sender_id === 'milli-ai') {
      return (
        <div className={`${size} rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0`}>
          <Sparkles className="w-5 h-5 text-white" />
        </div>
      );
    }
    
    const user = users.find(u => u.id === message.sender_id);
    
    if (user?.profile_image_url) {
      return (
        <img
          src={user.profile_image_url}
          alt={message.sender_name}
          className={`${size} rounded-full object-cover flex-shrink-0`}
        />
      );
    }
    
    return (
      <div
        className={`${size} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}
        style={{ backgroundColor: getAvatarColor(message.sender_name) }}
      >
        {getInitials(message.sender_name)}
      </div>
    );
  };

  const getAvatarColor = (name) => {
    if (!name) return '#8b5cf6'; // Default color for undefined names
    const colors = [
      '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4',
      '#14b8a6', '#10b981', '#84cc16', '#eab308', '#f59e0b',
      '#f97316', '#ef4444', '#ec4899', '#d946ef', '#a855f7'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getInitials = (name) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  useEffect(() => {
    console.log("prime". backendUrl)
    loadChannels();
    loadUsers();
    loadProjects();
  }, []);

  // Step 1: Capture channel ID from URL parameter immediately
  useEffect(() => {
    const channelId = searchParams.get('channel');
    if (channelId) {
      console.log('Captured channel ID from URL:', channelId);
      setPendingChannelId(channelId);
      setSearchParams({}); // Clear query parameter
    }
  }, [searchParams]);

  // Step 2: Process channel selection when channels are loaded
  useEffect(() => {
    if (pendingChannelId && channels.length > 0) {
      console.log('Processing pending channel ID:', pendingChannelId, 'Total channels:', channels.length);
      
      const channel = channels.find(ch => ch.id === pendingChannelId);
      console.log('Found channel:', channel);
      
      if (channel) {
        console.log('Selecting channel from notification:', channel.name);
        setSelectedChannel(channel);
        
        // Load messages for this channel
        const loadChannelMessages = async () => {
          try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${backendUrl}/api/channels/${channel.id}/messages`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            console.log('Messages loaded for channel:', response.data.length);
            setMessages(response.data);
            setLoading(false);
            
            // Join the channel via WebSocket
            if (joinChannel) {
              joinChannel(channel.id);
              console.log('Joined channel via WebSocket');
            }
            
            // Mark as read
            await axios.post(
              `${backendUrl}/api/channels/${channel.id}/mark-read`,
              {},
              { headers: { Authorization: `Bearer ${token}` } }
            );
            console.log('Marked channel as read');
          } catch (error) {
            console.error('Failed to load channel messages:', error);
          }
        };
        
        loadChannelMessages();
        setPendingChannelId(null); // Clear pending state
      } else {
        console.log('Channel not found in available channels');
      }
    }
  }, [pendingChannelId, channels]);

  // Listen for channel updates from WebSocket
  useEffect(() => {
    const handleChannelsUpdated = () => {
      console.log('Channels updated event received - reloading channels');
      loadChannels();
    };

    window.addEventListener('channelsUpdated', handleChannelsUpdated);

    return () => {
      window.removeEventListener('channelsUpdated', handleChannelsUpdated);
    };
  }, []);

  // WebSocket event listeners
  useEffect(() => {
    if (!on) return;

    // Listen for new messages in real-time
    const cleanupNewMessage = on('new_message', (data) => {
      console.log('Received new message:', data.message);
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.some(m => m.id === data.message.id)) {
          return prev;
        }
        return [...prev, data.message];
      });
    });

    // Listen for typing indicators
    const cleanupTyping = on('user_typing', (data) => {
      setTypingUsers((prev) => {
        if (data.is_typing) {
          // Add user to typing list if not already there
          if (!prev.find(u => u.user_id === data.user_id)) {
            return [...prev, data];
          }
        } else {
          // Remove user from typing list
          return prev.filter(u => u.user_id !== data.user_id);
        }
        return prev;
      });

      // Auto-remove typing indicator after 3 seconds
      setTimeout(() => {
        setTypingUsers((prev) => prev.filter(u => u.user_id !== data.user_id));
      }, 3000);
    });

    // Listen for read receipts
    const cleanupMessageRead = on('message_read', (data) => {
      console.log('Message read by:', data);
      setMessages((prev) => prev.map(msg => {
        if (msg.id === data.message_id) {
          const read_by = msg.read_by || [];
          if (!read_by.includes(data.user_id)) {
            return { ...msg, read_by: [...read_by, data.user_id] };
          }
        }
        return msg;
      }));
    });

    // Listen for reaction updates in real-time
    const cleanupReactionAdded = on('reaction_added', (data) => {
      console.log('Reaction added:', data);
      setMessages((prev) => prev.map(msg => {
        if (msg.id === data.message_id) {
          const reactions = { ...(msg.reactions || {}) };
          const emoji = data.emoji;
          const userId = data.user_id;
          
          if (!reactions[emoji]) {
            reactions[emoji] = [];
          }
          
          if (!reactions[emoji].includes(userId)) {
            reactions[emoji] = [...reactions[emoji], userId];
          }
          
          return { ...msg, reactions };
        }
        return msg;
      }));
    });

    const cleanupReactionRemoved = on('reaction_removed', (data) => {
      console.log('Reaction removed:', data);
      setMessages((prev) => prev.map(msg => {
        if (msg.id === data.message_id) {
          const reactions = { ...(msg.reactions || {}) };
          const emoji = data.emoji;
          const userId = data.user_id;
          
          if (reactions[emoji]) {
            reactions[emoji] = reactions[emoji].filter(id => id !== userId);
            if (reactions[emoji].length === 0) {
              delete reactions[emoji];
            }
          }
          
          return { ...msg, reactions };
        }
        return msg;
      }));
    });

    return () => {
      cleanupNewMessage();
      cleanupTyping();
      cleanupMessageRead();
      cleanupReactionAdded();
      cleanupReactionRemoved();
    };
  }, [on]);

  useEffect(() => {
    if (selectedChannel) {
      // Load initial messages
      loadMessages(selectedChannel.id);
      
      // Join the channel room for real-time updates
      if (socket && connected) {
        joinChannel(selectedChannel.id);
      }

      return () => {
        // Leave channel when switching
        if (socket && connected) {
          leaveChannel(selectedChannel.id);
        }
        setTypingUsers([]);
      };
    }
  }, [selectedChannel, socket, connected]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Close channel menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (channelMenuOpen && !event.target.closest('.channel-menu-container')) {
        setChannelMenuOpen(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [channelMenuOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChannels = async () => {
    try {
      const response = await axios.get(`${backendUrl}/api/channels`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Handle new organized channel structure
      let allChannels = [];
      let channelOrganization = {
        company: [],
        project: [],
        direct: [],
        team: [],
        announcement: []
      };
      
      // Check if backend returns organized structure or legacy flat array
      if (response.data.organized && response.data.channels) {
        // New organized structure
        allChannels = response.data.channels;
        channelOrganization = response.data.organized;
      } else if (Array.isArray(response.data)) {
        // Legacy flat array - organize ourselves
        allChannels = response.data;
        allChannels.forEach(channel => {
          const type = channel.type || 'team';
          if (channelOrganization[type]) {
            channelOrganization[type].push(channel);
          } else {
            channelOrganization.team.push(channel);
          }
        });
      }
      
      // Try to fetch Milli channel (will fail for guests)
      try {
        const milliResponse = await axios.get(`${backendUrl}/api/milli/channel`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Add Milli channel to the beginning if successful
        allChannels = [milliResponse.data, ...allChannels];
      } catch (milliError) {
        // Guest users will get 403, which is expected - just use regular channels
        console.log('Milli channel not available for this user');
      }
      
      setChannels(allChannels);
      setOrganizedChannels(channelOrganization);
      
      // Check if currently selected channel is still available
      if (selectedChannel) {
        const channelStillExists = allChannels.find(ch => ch.id === selectedChannel.id);
        if (!channelStillExists) {
          console.log('Previously selected channel no longer available - switching to first available channel');
          const firstTeamChannel = allChannels.find(ch => ch.type === 'team');
          setSelectedChannel(firstTeamChannel || (allChannels.length > 0 ? allChannels[0] : null));
          setMessages([]); // Clear messages for hidden channel
        }
      } else {
        // Auto-select first team channel, then project channel, fallback to Milli if no channels
        const firstTeamChannel = allChannels.find(ch => ch.type === 'team');
        const firstProjectChannel = allChannels.find(ch => ch.type === 'project');
        
        if (firstTeamChannel) {
          setSelectedChannel(firstTeamChannel);
        } else if (firstProjectChannel) {
          setSelectedChannel(firstProjectChannel);
        } else if (milliChannel) {
          setSelectedChannel(milliChannel);
        } else if (allChannels.length > 0) {
          setSelectedChannel(allChannels[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load channels:', error);
    }
  };

  // Channel management functions with improved responsiveness
  const [actionLoading, setActionLoading] = useState(null); // Track which action is loading

  const loadChannelMembers = async (channelId) => {
    setActionLoading('loadMembers');
    try {
      const response = await axios.get(`${backendUrl}/api/channels/${channelId}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChannelMembers(response.data.members || []);
    } catch (error) {
      console.error('Failed to load channel members:', error);
      setChannelMembers([]);
    } finally {
      setActionLoading(null);
    }
  };

  const loadAvailableUsers = async (channelId = null) => {
    setActionLoading('loadUsers');
    try {
      const url = channelId 
        ? `${backendUrl}/api/users/available-for-channel?channel_id=${channelId}`
        : `${backendUrl}/api/users/available-for-channel`;
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAvailableUsers(response.data.users || []);
    } catch (error) {
      console.error('Failed to load available users:', error);
      setAvailableUsers([]);
    } finally {
      setActionLoading(null);
    }
  };

  const addMemberToChannel = async (channelId, userIds) => {
    setActionLoading('addMembers');
    
    // Optimistic update - add members to UI immediately
    const newMembers = availableUsers.filter(user => userIds.includes(user.id));
    setChannelMembers(prev => [...prev, ...newMembers]);
    
    try {
      await axios.post(`${backendUrl}/api/channels/${channelId}/members`, {
        action: 'add',
        user_ids: userIds
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Reload data to ensure consistency and refresh channels
      await Promise.all([
        loadChannelMembers(channelId),
        loadAvailableUsers(channelId),
        loadChannels()
      ]);
      
      return true;
    } catch (error) {
      console.error('Failed to add member to channel:', error);
      // Revert optimistic update on error
      setChannelMembers(prev => prev.filter(member => !userIds.includes(member.id)));
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  const removeMemberFromChannel = async (channelId, userId) => {
    setActionLoading('removeMembers');
    
    // Optimistic update - remove member from UI immediately
    const updatedMembers = channelMembers.filter(member => member.id !== userId);
    setChannelMembers(updatedMembers);
    
    try {
      await axios.delete(`${backendUrl}/api/channels/${channelId}/members/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Reload data to ensure consistency and refresh channels
      await Promise.all([
        loadChannelMembers(channelId),
        loadAvailableUsers(channelId),
        loadChannels()
      ]);
      
      return true;
    } catch (error) {
      console.error('Failed to remove member from channel:', error);
      // Revert optimistic update on error
      setChannelMembers(channelMembers);
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  const updateChannelSettings = async (channelId, updateData) => {
    setActionLoading('updateSettings');
    try {
      const response = await axios.put(`${backendUrl}/api/channels/${channelId}`, updateData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Reload channels to reflect changes
      await loadChannels();
      
      return response.data;
    } catch (error) {
      console.error('Failed to update channel settings:', error);
      return null;
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteChannel = async (channelId) => {
    setActionLoading('deleteChannel');
    try {
      await axios.delete(`${backendUrl}/api/channels/${channelId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // If the deleted channel was selected, select first available team channel, then project, then any
      if (selectedChannel && selectedChannel.id === channelId) {
        const remainingChannels = channels.filter(ch => ch.id !== channelId);
        const firstTeamChannel = remainingChannels.find(ch => ch.type === 'team');
        const firstProjectChannel = remainingChannels.find(ch => ch.type === 'project');
        
        if (firstTeamChannel) {
          setSelectedChannel(firstTeamChannel);
        } else if (firstProjectChannel) {
          setSelectedChannel(firstProjectChannel);
        } else if (milliChannel) {
          setSelectedChannel(milliChannel);
        } else {
          setSelectedChannel(remainingChannels.length > 0 ? remainingChannels[0] : null);
        }
        setMessages([]);
      }
      
      // Close any open menus
      setChannelMenuOpen(null);
      
      // Reload channels
      await loadChannels();
      
      return true;
    } catch (error) {
      console.error('Failed to delete channel:', error);
      return false;
    } finally {
      setActionLoading(null);
    }
  };

  // Handle channel member popup with loading state
  const handleViewChannelMembers = async (channel) => {
    setSelectedChannelForMembers(channel);
    setShowChannelMembers(true);
    setChannelMenuOpen(null);
    await loadChannelMembers(channel.id);
  };

  const handleAddMemberClick = async (channel) => {
    setSelectedChannelForMembers(channel);
    setShowAddMember(true);
    setChannelMenuOpen(null);
    await loadAvailableUsers(channel.id);
  };

  const loadMessages = async (channelId) => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${backendUrl}/api/channels/${channelId}/messages`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markChannelAsRead = async (channelId) => {
    try {
      // Mark channel as read in backend
      await axios.put(
        `${backendUrl}/api/channels/${channelId}/mark-read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update local unread counts
      setChannelUnreads(prev => {
        const newUnreads = { ...prev };
        delete newUnreads[channelId];
        return newUnreads;
      });
    } catch (error) {
      console.error('Failed to mark channel as read:', error);
    }
  };

  const handleChannelSelect = async (channel) => {
    setSelectedChannel(channel);
    // Mark channel as read when selected
    await markChannelAsRead(channel.id);
  };
  
  // Load Milli threads from messages (group by conversation sessions)
  const loadMilliThreads = () => {
    if (!selectedChannel || selectedChannel.type !== 'milli_ai') return;
    
    // Threads should persist and only be created explicitly
    // We'll track threads in state and update them as messages come in
    // For now, just keep existing threads
    // This will be managed by the message sending flow
  };
  
  // Create new thread
  const handleCreateThread = () => {
    setSelectedThread(null);
    setShowThreadList(false);
    setCreatingThread(true);
  };
  
  // Select a thread
  const handleThreadSelect = (thread) => {
    setSelectedThread(thread);
    setShowThreadList(false);
    setCreatingThread(false);
  };

  const loadUsers = async () => {
    try {
      console.log(backendUrl)
      const response = await axios.get(`${backendUrl}/api/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const usersData = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setUsers(usersData);
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadProjects = async () => {
    try {
      console.log("NOVA PRIME ")
      const response = await axios.get(`${backendUrl}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const projectsData = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setProjects(projectsData);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedChannel) return;
    
    // Check if user has permission to send messages in this channel
    if (!canSendMessagesInChannel(selectedChannel)) {
      toast.error('You do not have permission to send messages in this channel');
      return;
    }

    try {
      // Check if this is the Milli AI channel
      if (selectedChannel.type === 'milli_ai') {
        // If creating a new thread, create it now with the message as title
        let currentThreadToUse = selectedThread;
        
        if (creatingThread || !selectedThread) {
          // Create new thread
          const newThread = {
            id: `thread-${Date.now()}`,
            title: messageInput.substring(0, 50) + (messageInput.length > 50 ? '...' : ''),
            messages: [],
            created_at: new Date().toISOString()
          };
          currentThreadToUse = newThread;
          setSelectedThread(newThread);
          setMilliThreads(prev => [newThread, ...prev]);
          setCreatingThread(false);
        }
        
        // Handle Milli AI conversation
        const tempUserMessage = {
          id: `temp-${Date.now()}`,
          channel_id: selectedChannel.id,
          content: messageInput,
          sender_id: currentUser.id,
          sender_name: currentUser.name,
          created_at: new Date().toISOString(),
          mentions: [],
          attachments: []
        };
        
        // Add user message to current thread immediately
        setSelectedThread(prev => ({
          ...prev,
          messages: [...(prev?.messages || []), tempUserMessage]
        }));
        
        // Also update in threads list
        setMilliThreads(prev => prev.map(t => 
          t.id === currentThreadToUse.id 
            ? { ...t, messages: [...(t.messages || []), tempUserMessage] }
            : t
        ));
        
        // Add user message to global messages
        setMessages(prev => [...prev, tempUserMessage]);
        const userQuery = messageInput;
        setMessageInput('');
        
        // Show "Milli is typing..." indicator
        setTypingUsers(['Milli']);
        
        try {
          // Send to Milli backend
          const response = await axios.post(
            `${backendUrl}/api/milli/chat`,
            { message: userQuery },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          // Add Milli's response to messages
          const milliMessage = {
            id: response.data.milli_message_id,
            channel_id: selectedChannel.id,
            content: response.data.response,
            sender_id: 'milli-ai',
            sender_name: 'Milli',
            created_at: new Date().toISOString(),
            mentions: [],
            attachments: []
          };
          
          // Update user message ID and add Milli response to current thread
          setSelectedThread(prev => ({
            ...prev,
            messages: prev.messages.map(msg => 
              msg.id === tempUserMessage.id 
                ? { ...msg, id: response.data.user_message_id }
                : msg
            ).concat([milliMessage])
          }));
          
          // Update in threads list
          setMilliThreads(prev => prev.map(t => 
            t.id === currentThreadToUse.id 
              ? { 
                  ...t, 
                  messages: t.messages.map(msg => 
                    msg.id === tempUserMessage.id 
                      ? { ...msg, id: response.data.user_message_id }
                      : msg
                  ).concat([milliMessage])
                }
              : t
          ));
          
          // Update global messages
          setMessages(prev => prev.map(msg => 
            msg.id === tempUserMessage.id 
              ? { ...msg, id: response.data.user_message_id }
              : msg
          ).concat([milliMessage]));
          
        } catch (error) {
          console.error('Failed to get Milli response:', error);
          // Show error message
          const errorMessage = {
            id: `error-${Date.now()}`,
            channel_id: selectedChannel.id,
            content: "Sorry, I'm having trouble responding right now. Please try again.",
            sender_id: 'milli-ai',
            sender_name: 'Milli',
            created_at: new Date().toISOString(),
            mentions: [],
            attachments: []
          };
          
          // Add error to thread
          setSelectedThread(prev => ({
            ...prev,
            messages: [...(prev?.messages || []), errorMessage]
          }));
          
          setMilliThreads(prev => prev.map(t => 
            t.id === currentThreadToUse.id 
              ? { ...t, messages: [...t.messages, errorMessage] }
              : t
          ));
          
          setMessages(prev => [...prev, errorMessage]);
        } finally {
          setTypingUsers([]);
        }
        
        return;
      }
      
      // Regular channel message handling
      // Extract mentions (@username or @all)
      const mentions = [];
      
      // Check for @all mention
      if (messageInput.includes('@all')) {
        // Add all channel members (except current user)
        const channelMembers = getChannelMembers();
        channelMembers.forEach(user => {
          if (user.id !== currentUser.id) {
            mentions.push(user.id);
          }
        });
      }
      
      // Extract individual mentions (@username)
      const mentionRegex = /@(\w+)/g;
      let match;
      while ((match = mentionRegex.exec(messageInput)) !== null) {
        const mentionText = match[1];
        if (mentionText !== 'all') {
          const mentionedUser = users.find(u => 
            u.name.toLowerCase().includes(mentionText.toLowerCase()) && 
            u.id !== currentUser.id
          );
          if (mentionedUser && !mentions.includes(mentionedUser.id)) {
            mentions.push(mentionedUser.id);
          }
        }
      }

      // Include file attachment if present
      const attachments = filePreview ? [{
        name: filePreview.name,
        type: filePreview.type,
        data: filePreview.data
      }] : [];

      const response = await sendMessage({
        channel_id: selectedChannel.id,
        content: messageInput,
        mentions: mentions,
        attachments: attachments
      });

      if (response.success) {
        setMessageInput('');
        setFilePreview(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        // Send "stopped typing" indicator
        sendTyping(selectedChannel.id, false);
        // No need to reload - WebSocket will broadcast the message
        
        // Auto-analyze for task if in project channel
        if (selectedChannel?.type === 'project' && response.message_id) {
          handleAnalyzeForTask(response.message_id);
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    }
  };

  const renderMessageContent = (content) => {
    // Check if content contains HTML tags (from rich text editor)
    // Simple regex to detect any HTML tag
    const htmlTagRegex = /<[^>]+>/;
    const hasHtmlTags = htmlTagRegex.test(content);
    
    if (hasHtmlTags) {
      // Render as HTML with mentions highlighted and URLs as links
      let processedContent = content;
      
      // First, convert URLs to clickable links (if not already <a> tags)
      const urlRegex = /(?<!href=["'])(https?:\/\/[^\s<]+)(?![^<]*<\/a>)/g;
      processedContent = processedContent.replace(urlRegex, (url) => {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">${url}</a>`;
      });
      
      // Then highlight mentions - match @username with up to 2 words (for full names)
      // This prevents rest of message from being highlighted
      const mentionRegex = /@([\w]+(?:\s+[\w]+){0,1}|all|everyone)\b/gi;
      processedContent = processedContent.replace(mentionRegex, (match, name) => {
        const trimmedName = name.trim();
        const lowerName = trimmedName.toLowerCase().replace(/\s+/g, '');
        const currentUsername = currentUser?.name?.replace(/\s+/g, '').toLowerCase();
        const currentEmailUser = currentUser?.email?.split('@')[0].toLowerCase();
        
        // Check if current user is mentioned
        const isMentioned = 
          lowerName === 'all' || 
          lowerName === 'everyone' || 
          lowerName === currentUsername ||
          lowerName === currentEmailUser ||
          currentUsername?.includes(lowerName) ||
          lowerName.includes(currentUsername);
        
        // Slack-style mention styling with inline styles
        return `<span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 500; cursor: pointer; ${
          isMentioned 
            ? 'background-color: #3b82f6; color: #ffffff;' 
            : 'background-color: #dbeafe; color: #1e40af;'
        }" class="mention-tag">${match}</span>`;
      });
      
      return (
        <div 
          className="message-content break-words"
          dangerouslySetInnerHTML={{ __html: processedContent }}
          style={{
            display: 'inline'
          }}
        />
      );
    }
    
    // Original markdown rendering for backward compatibility
    // Match @username with up to 2 words (for full names like "Irfan Ahmad")
    const mentionRegex = /@([\w]+(?:\s+[\w]+){0,1}|all|everyone)\b/gi;
    const parts = [];
    let lastIndex = 0;
    let match;
    let key = 0;
    
    while ((match = mentionRegex.exec(content)) !== null) {
      // Add text before mention (with markdown)
      if (match.index > lastIndex) {
        const textBefore = content.substring(lastIndex, match.index);
        parts.push(
          <ReactMarkdown 
            key={`text-${key++}`}
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }) {
                const codeMatch = /language-(\w+)/.exec(className || '');
                
                return !inline && codeMatch ? (
                  <SyntaxHighlighter
                    style={oneDark}
                    language={codeMatch[1]}
                    PreTag="div"
                    className="rounded-lg my-2"
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-sm">
                    {children}
                  </code>
                );
              },
              p: ({ children }) => <span>{children}</span>,
              strong: ({ children }) => <strong className="font-bold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
            }}
          >
            {textBefore}
          </ReactMarkdown>
        );
      }
      
      // Add highlighted mention
      const mentionText = match[0]; // Full match like @all or @username
      const mentionedName = match[1]; // Just the name part (all, everyone, username)
      
      // Check if current user is mentioned
      const lowerMentionedName = mentionedName.toLowerCase().replace(/\s+/g, '');
      const currentUsername = currentUser?.name?.replace(/\s+/g, '').toLowerCase();
      const currentEmailUser = currentUser?.email?.split('@')[0].toLowerCase();
      
      const isCurrentUserMentioned = 
        lowerMentionedName === 'all' || 
        lowerMentionedName === 'everyone' || 
        lowerMentionedName === currentUsername ||
        lowerMentionedName === currentEmailUser ||
        currentUsername?.includes(lowerMentionedName) ||
        lowerMentionedName.includes(currentUsername);
      
      parts.push(
        <span
          key={`mention-${key++}`}
          className={`inline-block font-medium px-2 py-0.5 rounded cursor-pointer ${
            isCurrentUserMentioned
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800'
          }`}
        >
          {mentionText}
        </span>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text (with markdown)
    if (lastIndex < content.length) {
      const remaining = content.substring(lastIndex);
      parts.push(
        <ReactMarkdown 
          key={`text-${key++}`}
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, inline, className, children, ...props }) {
              const codeMatch = /language-(\w+)/.exec(className || '');
              
              return !inline && codeMatch ? (
                <SyntaxHighlighter
                  style={oneDark}
                  language={codeMatch[1]}
                  PreTag="div"
                  className="rounded-lg my-2"
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-sm">
                  {children}
                </code>
              );
            },
            p: ({ children }) => <span>{children}</span>,
            strong: ({ children }) => <strong className="font-bold">{children}</strong>,
            em: ({ children }) => <em className="italic">{children}</em>,
          }}
        >
          {remaining}
        </ReactMarkdown>
      );
    }
    
    // If no mentions found, just render the whole content with markdown
    if (parts.length === 0) {
      return (
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, inline, className, children, ...props }) {
              const codeMatch = /language-(\w+)/.exec(className || '');
              
              return !inline && codeMatch ? (
                <SyntaxHighlighter
                  style={oneDark}
                  language={codeMatch[1]}
                  PreTag="div"
                  className="rounded-lg my-2"
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-sm">
                  {children}
                </code>
              );
            },
            p: ({ children }) => <span>{children}</span>,
            strong: ({ children }) => <strong className="font-bold">{children}</strong>,
            em: ({ children }) => <em className="italic">{children}</em>,
          }}
        >
          {content}
        </ReactMarkdown>
      );
    }
    
    return <div className="inline">{parts}</div>;
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setMessageInput(value);
    
    // Check for @ mentions
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtSymbol !== -1 && lastAtSymbol === cursorPosition - 1) {
      // Just typed @, show all channel members
      setMentionSearch('');
      setShowMentionDropdown(true);
      setSelectedMentionIndex(0);
      
      // Calculate dropdown position
      const rect = e.target.getBoundingClientRect();
      setMentionPosition({
        top: rect.top - 200,
        left: rect.left
      });
    } else if (lastAtSymbol !== -1) {
      // Get text after @ symbol
      const textAfterAt = textBeforeCursor.substring(lastAtSymbol + 1);
      
      // Check if we're still in a mention (no spaces)
      if (!textAfterAt.includes(' ')) {
        setMentionSearch(textAfterAt.toLowerCase());
        setShowMentionDropdown(true);
        setSelectedMentionIndex(0);
      } else {
        setShowMentionDropdown(false);
      }
    } else {
      setShowMentionDropdown(false);
    }
    
    if (selectedChannel && socket && connected) {
      // Send typing indicator
      sendTyping(selectedChannel.id, true);
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set new timeout to send "stopped typing" after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        sendTyping(selectedChannel.id, false);
      }, 2000);
    }
  };

  const getChannelMembers = () => {
    if (!selectedChannel) return [];
    
    // Get members from selected channel
    const memberIds = selectedChannel.members || [];
    return users.filter(u => memberIds.includes(u.id));
  };

  const getFilteredMentions = () => {
    const channelMembers = getChannelMembers();
    
    // Filter out current user
    const otherMembers = channelMembers.filter(user => user.id !== currentUser.id);
    
    // Add @all option at the beginning
    const allOption = {
      id: '@all',
      name: 'all',
      role: 'Mention everyone in this channel',
      isSpecial: true
    };
    
    if (!mentionSearch) {
      return [allOption, ...otherMembers];
    }
    
    // Filter by search
    const filtered = otherMembers.filter(user => 
      user.name.toLowerCase().includes(mentionSearch)
    );
    
    // Include @all if it matches the search
    if ('all'.includes(mentionSearch)) {
      return [allOption, ...filtered];
    }
    
    return filtered;
  };

  const insertMention = (user) => {
    // Get current content as text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = messageInput;
    const textContent = tempDiv.innerText || tempDiv.textContent;
    
    // Find the last @ symbol
    const lastAtSymbol = textContent.lastIndexOf('@');
    
    if (lastAtSymbol === -1) {
      setShowMentionDropdown(false);
      return;
    }
    
    // Build new text with mention
    const beforeMention = textContent.substring(0, lastAtSymbol);
    const mentionText = user.isSpecial ? '@all' : `@${user.name}`;
    const afterAt = textContent.substring(lastAtSymbol + 1);
    const afterMention = afterAt.includes(' ') ? afterAt.substring(afterAt.indexOf(' ')) : '';
    
    const newText = `${beforeMention}${mentionText} ${afterMention}`;
    
    // Convert back to HTML with basic formatting preserved
    const newHtml = newText.replace(/\n/g, '<br>');
    
    setMessageInput(newHtml);
    setShowMentionDropdown(false);
  };

  const handleMentionKeyDown = (e) => {
    if (!showMentionDropdown) return;
    
    const filteredMentions = getFilteredMentions();
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedMentionIndex((prev) => 
        prev < filteredMentions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedMentionIndex((prev) => 
        prev > 0 ? prev - 1 : filteredMentions.length - 1
      );
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (filteredMentions.length > 0) {
        e.preventDefault();
        insertMention(filteredMentions[selectedMentionIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowMentionDropdown(false);
    }
  };

  // Formatting functions
  const insertFormatting = (formatType) => {
    const textarea = messageInputRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = messageInput.substring(start, end);
    const before = messageInput.substring(0, start);
    const after = messageInput.substring(end);
    
    let newText = '';
    let cursorOffset = 0;
    
    switch (formatType) {
      case 'bold':
        newText = `${before}**${selectedText || 'bold text'}**${after}`;
        cursorOffset = selectedText ? 2 : 2;
        break;
      case 'italic':
        newText = `${before}*${selectedText || 'italic text'}*${after}`;
        cursorOffset = selectedText ? 1 : 1;
        break;
      case 'code':
        newText = `${before}\`${selectedText || 'code'}\`${after}`;
        cursorOffset = selectedText ? 1 : 1;
        break;
      case 'codeblock':
        newText = `${before}\n\`\`\`\n${selectedText || 'code block'}\n\`\`\`\n${after}`;
        cursorOffset = selectedText ? 4 : 4;
        break;
      case 'list':
        newText = `${before}\n- ${selectedText || 'list item'}\n${after}`;
        cursorOffset = selectedText ? 3 : 3;
        break;
      default:
        return;
    }
    
    setMessageInput(newText);
    setTimeout(() => {
      textarea.focus();
      const newPos = start + cursorOffset;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleEmojiClick = (emojiData) => {
    // Simply append emoji to the message input
    // The RichTextInput will handle the insertion
    setMessageInput(messageInput + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }
    
    setUploadingFile(true);
    
    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target.result;
        
        setFilePreview({
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64
        });
        
        setUploadingFile(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadingFile(false);
      alert('Failed to upload file');
    }
  };

  const removeFilePreview = () => {
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddReaction = async (messageId, emoji) => {
    try {
      await axios.post(
        `${backendUrl}/api/messages/${messageId}/reactions`,
        { emoji },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update local reactions
      setMessageReactions(prev => ({
        ...prev,
        [messageId]: {
          ...prev[messageId],
          [emoji]: [...(prev[messageId]?.[emoji] || []), currentUser.id]
        }
      }));
      
      setShowReactionPicker(null);
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  };


  // AI Task Extraction
  const handleAnalyzeForTask = async (messageId) => {
    setAnalyzingMessage(messageId);
    try {
      const response = await axios.post(
        `${API}/messages/${messageId}/analyze-for-task`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (response.data.is_actionable) {
        // Store suggestion
        setTaskSuggestions(prev => ({
          ...prev,
          [messageId]: response.data
        }));
      }
    } catch (error) {
      console.error('Failed to analyze message:', error);
      toast.error('Failed to analyze message for task extraction');
    } finally {
      setAnalyzingMessage(null);
    }
  };

  const handleOpenTaskModal = (messageId) => {
    const suggestion = taskSuggestions[messageId];
    if (!suggestion) return;
    
    setExtractedTask({
      title: suggestion.task_title || '',
      description: suggestion.task_description || '',
      priority: suggestion.priority || 'Medium',
      status: 'Not Started',
      due_date: suggestion.suggested_due_date || '',
      assignee: suggestion.suggested_assignee_id || '',
      project_id: suggestion.project_id, // Auto-assign to channel's project
      message_id: messageId
    });
    setShowTaskModal(true);
  };

  const handleCreateTaskFromMessage = async () => {
    if (!extractedTask.title.trim()) {
      toast.error('Task title is required');
      return;
    }

    try {
      await axios.post(
        `${API}/tasks`,
        {
          ...extractedTask,
          status: 'Not Started'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Task created successfully!');
      setShowTaskModal(false);
      setExtractedTask(null);
    } catch (error) {
      console.error('Failed to create task:', error);
      toast.error('Failed to create task');
    }
  };


  // Mark message as read
  const markMessageAsRead = async (messageId) => {
    try {
      const user = JSON.parse(localStorage.getItem('user'));
      await axios.post(
        `${backendUrl}/api/messages/${messageId}/mark-read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      // Silently fail - not critical
      console.error('Failed to mark message as read:', error);
    }
  };

  // Intersection Observer to auto-mark messages as read when visible
  useEffect(() => {
    if (!selectedChannel || messages.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const messageId = entry.target.dataset.messageId;
            const senderId = entry.target.dataset.senderId;
            const user = JSON.parse(localStorage.getItem('user'));
            
            // Don't mark your own messages as read
            if (messageId && senderId && senderId !== user?.id) {
              markMessageAsRead(messageId);
            }
          }
        });
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: 0.5 // Message must be 50% visible
      }
    );

    // Observe all message elements
    const messageElements = document.querySelectorAll('[data-message-id]');
    messageElements.forEach((el) => observer.observe(el));

    return () => {
      messageElements.forEach((el) => observer.unobserve(el));
    };
  }, [messages, selectedChannel]);


  const handleKeyPress = (e) => {
    // Handle mention dropdown navigation
    handleMentionKeyDown(e);
    
    // Handle message sending
    if (e.key === 'Enter' && !e.shiftKey && !showMentionDropdown) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const openDirectMessage = async (userId) => {
    try {
      const response = await axios.get(
        `${backendUrl}/api/direct-channels/${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const dmChannel = response.data;
      
      // Add to channels if not already there
      if (!channels.find(ch => ch.id === dmChannel.id)) {
        setChannels([...channels, dmChannel]);
      }
      
      setSelectedChannel(dmChannel);
    } catch (error) {
      console.error('Failed to open direct message:', error);
    }
  };

  const createTeamChannel = async (channelName) => {
    if (!channelName.trim()) return;
    
    try {
      const response = await axios.post(
        `${backendUrl}/api/channels`,
        {
          name: channelName,
          type: 'team',
          category: 'general',
          members: users.filter(u => u.role !== 'client').map(u => u.id),
          is_private: false,
          permissions: {
            can_send_messages: true,
            can_invite_members: false,
            can_edit_channel: false,
            can_delete_messages: false,
            read_only: false
          }
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      await loadChannels(); // Reload to get organized structure
      setShowCreateChannel(false);
    } catch (error) {
      console.error('Failed to create channel:', error);
    }
  };

  const createAdvancedChannel = async (channelData) => {
    try {
      const response = await axios.post(
        `${backendUrl}/api/channels`,
        channelData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      await loadChannels(); // Reload to get organized structure
      setShowCreateChannel(false);
      return response.data;
    } catch (error) {
      console.error('Failed to create advanced channel:', error);
      return null;
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get display name for DM channels (show user name instead of email)
  const getDMChannelDisplayName = (channel) => {
    if (channel.type !== 'direct') return channel.name;
    
    // Find the other user in the DM
    const otherUserId = channel.members?.find(id => id !== currentUser?.id);
    if (!otherUserId) return channel.name;
    
    const otherUser = users.find(u => u.id === otherUserId);
    return otherUser?.name || channel.name;
  };

  // Render channel item with unread count and menu
  const renderChannelItem = (channel) => {
    const unreadCount = channelUnreads[channel.id] || 0;
    const hasUnread = unreadCount > 0;
    const isMenuOpen = channelMenuOpen === channel.id;
    const canManageChannel = currentUser?.role === 'admin' || currentUser?.role === 'manager';
    
    return (
      <div key={channel.id} className="relative group">
        <button
          onClick={() => handleChannelSelect(channel)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
            selectedChannel?.id === channel.id
              ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
              : hasUnread
              ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-semibold'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          <Hash className="w-4 h-4 flex-shrink-0" />
          <span className="truncate flex-1 text-left">{channel.name}</span>
          <div className="flex items-center gap-1">
            {hasUnread && (
              <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
            {/* Settings button - visible on hover or when menu is open */}
            {canManageChannel && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setChannelMenuOpen(isMenuOpen ? null : channel.id);
                }}
                className={`p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-all ${
                  isMenuOpen ? 'opacity-100 bg-gray-200 dark:bg-gray-600' : 'opacity-0 group-hover:opacity-100'
                }`}
                title="Channel settings"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 12 12">
                  <circle cx="2" cy="6" r="1"/>
                  <circle cx="6" cy="6" r="1"/>
                  <circle cx="10" cy="6" r="1"/>
                </svg>
              </button>
            )}
          </div>
        </button>
        
        {/* Dropdown Menu */}
        {isMenuOpen && canManageChannel && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 channel-menu-container">
            <div className="py-1">
              <button
                onClick={() => {
                  handleViewChannelMembers(channel);
                  setChannelMenuOpen(null);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                View Members
              </button>
              <button
                onClick={() => {
                  handleAddMemberClick(channel);
                  setChannelMenuOpen(null);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Members
              </button>
              <button
                onClick={() => {
                  setSelectedChannelForMembers(channel);
                  setEditingChannel(channel);
                  setShowCreateChannel(true);
                  setChannelMenuOpen(null);
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Channel Settings
              </button>
              {/* Delete option - only for admins or managers who can delete this channel */}
              {(currentUser?.role === 'admin' || 
                (currentUser?.role === 'manager' && channel.created_by !== 'admin')) && (
                <>
                  <hr className="my-1 border-gray-200 dark:border-gray-600" />
                  <button
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to delete the channel "${channel.name}"? This action cannot be undone.`)) {
                        handleDeleteChannel(channel.id);
                      }
                      setChannelMenuOpen(null);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                    disabled={actionLoading === 'deleteChannel'}
                  >
                    {actionLoading === 'deleteChannel' ? (
                      <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Delete Channel
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Channel filtering - Team channels, Project channels, and Direct messages
  console.log('Current user role:', currentUser?.role, 'Type:', typeof currentUser?.role);
  
  // Milli AI channel - available for all authenticated users
  const milliChannel = channels.find(ch => ch.type === 'milli_ai');
  
  // Filter channels by type and search query
  const teamChannels = channels.filter(ch => 
    ch.type === 'team' && ch.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const projectChannels = channels.filter(ch => 
    ch.type === 'project' && ch.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const directChannels = channels.filter(ch => 
    ch.type === 'direct' && ch.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Previously, clients had a restricted chat view. We now allow all roles
  // to use the full chat experience (including Milli and channels).
  const isExternalUser = false;

  return (
    <div className={`flex ${isExternalUser ? 'h-full' : 'h-[calc(100vh-4rem)]'} bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900`}>
      {/* Sidebar - Hidden for external users (clients) */}
      {!isExternalUser && (
        <div className="w-64 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text">
            Chats
          </h2>
          <div className="mt-2 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Channels List */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Milli AI Assistant Button - Always at top */}
          {milliChannel && (
            <div className="p-2 border-b border-purple-200 dark:border-purple-800">
              <button
                onClick={() => handleChannelSelect(milliChannel)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-all ${
                  selectedChannel?.id === milliChannel.id
                    ? 'bg-gradient-to-r from-purple-100 to-indigo-100 dark:from-purple-900 dark:to-indigo-900 text-purple-700 dark:text-purple-300 shadow-md'
                    : 'hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold">Chat with Milli</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">AI Workspace Assistant</div>
                </div>
              </button>
            </div>
          )}
          
          {/* Team Channels Section - Main and Only Category */}
          {!isExternalUser && (
            <div className="p-2">
              <div className="flex items-center justify-between px-2 py-1 mb-2">
                <button
                  onClick={() => toggleSection('channels')}
                  className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1"
                >
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    Team Channels
                  </span>
                  {expandedSections.channels ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                  <button
                    onClick={() => setShowCreateChannel(true)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    title="Create new channel"
                  >
                    <Plus className="w-4 h-4 text-gray-500" />
                  </button>
                )}
              </div>
              {expandedSections.channels && teamChannels.length > 0 ? (
                teamChannels.map((channel) => renderChannelItem(channel))
              ) : expandedSections.channels && teamChannels.length === 0 ? (
                <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                  No team channels yet. 
                  {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && (
                    <button
                      onClick={() => setShowCreateChannel(true)}
                      className="block mx-auto mt-2 text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Create your first channel
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          )}
          
          {/* Project Channels Section */}
          {projectChannels.length > 0 && (
            <div className="p-2">
              <button
                onClick={() => toggleSection('projects')}
                className="w-full flex items-center justify-between px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  Project Channels
                </span>
                {expandedSections.projects ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </button>
              {expandedSections.projects && projectChannels.map((channel) => renderChannelItem(channel))}
            </div>
          )}

          {/* Direct Messages Section - Hidden for clients */}
          {!isExternalUser && (
            <div className="p-2">
              <div className="flex items-center justify-between px-2 py-1 mb-2">
                <button
                  onClick={() => toggleSection('directMessages')}
                  className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1"
                >
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                    Direct Messages
                  </span>
                  {expandedSections.directMessages ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                </button>
                <button
                  onClick={() => {
                    // Show user selection for DM - we can implement this later
                    console.log('Create DM clicked');
                  }}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  title="Start direct message"
                >
                  <Plus className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              {expandedSections.directMessages && (
                <div className="space-y-1">
                  {/* Show all users (except current user and clients) for DM */}
                  {users
                    .filter(user => 
                      user.id !== currentUser?.id && 
                      user.role !== 'client' &&
                      user.name.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((user) => {
                      // Find existing DM channel with this user
                      const dmChannel = directChannels.find(ch => 
                        ch.type === 'direct' && ch.members.includes(user.id)
                      );
                      const unreadCount = dmChannel ? (channelUnreads[dmChannel.id] || 0) : 0;
                      const hasUnread = unreadCount > 0;
                      const isSelected = dmChannel && selectedChannel?.id === dmChannel.id;
                      
                      return (
                        <button
                          key={user.id}
                          onClick={() => openDirectMessage(user.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                            isSelected
                              ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
                              : hasUnread
                              ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-semibold'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {/* User Avatar */}
                          {renderAvatar(user, 'w-8 h-8')}
                          
                          {/* User Info */}
                          <div className="flex-1 text-left">
                            <div className="font-medium">{user.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                              {user.role === 'team member' ? 'Team Member' : user.role}
                            </div>
                          </div>
                          
                          {/* Online Status Dot */}
                          {user.is_online ? (
                            <div className="w-3 h-3 rounded-full flex-shrink-0 bg-green-500" title="Online"></div>
                          ) : (
                            <div className="w-3 h-3 rounded-full flex-shrink-0 bg-gray-300 dark:bg-gray-600" title="Offline"></div>
                          )}
                          
                          {/* Unread Count */}
                          {hasUnread && (
                            <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                              {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  
                  {/* Empty State */}
                  {users.filter(user => 
                    user.id !== currentUser?.id && 
                    user.role !== 'client'
                  ).length === 0 && (
                    <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                      No team members available for messaging.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Connection Status */}
        <div className="p-2 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            {connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedChannel ? (
          <>
            {/* Chat Header */}
            <div className="h-16 bg-white dark:bg-gray-800 border-b-2 border-gray-300 dark:border-gray-600 flex items-center justify-between px-6 flex-shrink-0 shadow-sm">
              <div className="flex items-center gap-3">
                {selectedChannel.type === 'milli_ai' ? (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                ) : selectedChannel.type === 'project' ? (
                  <Hash className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                ) : selectedChannel.type === 'direct' ? (
                  <User className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <Hash className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                )}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {getDMChannelDisplayName(selectedChannel)}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedChannel.type === 'milli_ai' 
                      ? 'AI Workspace Assistant - Ask me anything!'
                      : `${selectedChannel.members?.length || 0} members`
                    }
                  </p>
                </div>
              </div>
              
              {/* Thread controls for Milli */}
              {selectedChannel.type === 'milli_ai' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowThreadList(!showThreadList)}
                    className="px-3 py-1.5 text-sm bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors"
                  >
                    {showThreadList ? 'Hide' : 'Show'} Threads ({milliThreads.length})
                  </button>
                  <button
                    onClick={handleCreateThread}
                    className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    New Thread
                  </button>
                </div>
              )}
            </div>

            {/* Milli Thread-based Interface */}
            {selectedChannel.type === 'milli_ai' ? (
              <div className="flex-1 flex min-h-0">
                {/* Thread List Sidebar */}
                {showThreadList && (
                  <div className="w-80 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-r border-gray-200 dark:border-gray-700 flex flex-col">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="font-semibold text-gray-900 dark:text-white">Conversation Threads</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Your chat history with Milli</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                      {milliThreads.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                          No threads yet. Start a conversation!
                        </div>
                      ) : (
                        milliThreads.map((thread) => (
                          <button
                            key={thread.id}
                            onClick={() => handleThreadSelect(thread)}
                            className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${
                              selectedThread?.id === thread.id
                                ? 'bg-purple-100 dark:bg-purple-900 border border-purple-300 dark:border-purple-700'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                              {thread.title}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {thread.messages.length} messages • {new Date(thread.created_at).toLocaleDateString()}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
                
                {/* Thread Messages Area */}
                <div className="flex-1 flex flex-col min-w-0">
                  {/* Show welcome screen only if NO thread selected AND not creating new thread */}
                  {!selectedThread && !creatingThread ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center">
                        <Sparkles className="w-16 h-16 text-purple-500 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          Welcome to Milli!
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-4">
                          Select a thread or create a new one to start chatting
                        </p>
                        <button
                          onClick={handleCreateThread}
                          className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all inline-flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Start New Conversation
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Show messages + input when thread selected OR creating new thread */
                    <>
                      {/* Messages area - only show if thread selected */}
                      <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
                        {selectedThread && selectedThread.messages && selectedThread.messages.map((message) => (
                          <div key={message.id} className="group flex gap-3">
                            {renderAvatarByMessage(message)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2">
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  {message.sender_name}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {formatTime(message.created_at)}
                                </span>
                              </div>
                              <div className="mt-1 text-gray-700 dark:text-gray-300 break-words">
                                {renderMessageContent(message.content)}
                              </div>
                            </div>
                          </div>
                        ))}
                        {creatingThread && (
                          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                            <Sparkles className="w-12 h-12 text-purple-500 mx-auto mb-3" />
                            <p>Start a new conversation with Milli</p>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                      
                      {/* Message Input - Always show when thread selected or creating */}
                      <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl">
                        <div className="flex items-end gap-2">
                          <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-3">
                            <textarea
                              ref={messageInputRef}
                              value={messageInput}
                              onChange={handleInputChange}
                              onKeyDown={handleKeyPress}
                              placeholder="Ask Milli anything about your projects, tasks, or workspace..."
                              rows={3}
                              className="w-full bg-transparent resize-none focus:outline-none text-gray-900 dark:text-white"
                            />
                          </div>
                          <button
                            onClick={handleSendMessage}
                            disabled={!messageInput.trim()}
                            className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-3 rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            <Send className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              /* Regular Messages Area for non-Milli channels */
            <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500 dark:text-gray-400">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div 
                    key={message.id} 
                    className="group flex gap-3 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 -mx-4 relative transition-colors"
                    data-message-id={message.id}
                    data-sender-id={message.sender_id}
                    onMouseEnter={() => setHoveredMessage(message.id)}
                    onMouseLeave={() => setHoveredMessage(null)}
                  >
                    {renderAvatarByMessage(message)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-bold text-gray-900 dark:text-white text-sm">
                          {message.sender_name}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                          {formatTime(message.created_at)}
                        </span>
                      </div>
                      
                      {/* Message Content */}
                      <div className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                        {renderMessageContent(message.content)}
                      </div>
                      
                      {/* File Attachments */}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {message.attachments.map((attachment, idx) => (
                            <div key={idx} className="bg-gray-100 dark:bg-gray-700 rounded-lg p-2">
                              {attachment.type.startsWith('image/') ? (
                                <img 
                                  src={attachment.data} 
                                  alt={attachment.name}
                                  className="max-w-sm max-h-64 rounded cursor-pointer"
                                  onClick={() => window.open(attachment.data, '_blank')}
                                />
                              ) : (
                                <div className="flex items-center gap-2">
                                  <FileText className="w-8 h-8 text-gray-500" />
                                  <div className="flex-1">
                                    <p className="text-sm font-medium">{attachment.name}</p>
                                    <p className="text-xs text-gray-500">Click to download</p>
                                  </div>
                                  <a
                                    href={attachment.data}
                                    download={attachment.name}
                                    className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm"
                                  >
                                    Download
                                  </a>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Message Reactions */}
                      {message.reactions && Object.keys(message.reactions).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {Object.entries(message.reactions).map(([emoji, userIds]) => (
                            <button
                              key={emoji}
                              onClick={() => handleAddReaction(message.id, emoji)}
                              className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm border ${
                                userIds.includes(currentUser.id)
                                  ? 'bg-indigo-100 dark:bg-indigo-900 border-indigo-300 dark:border-indigo-700'
                                  : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="text-xs">{userIds.length}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {/* Read Receipt */}
                      <ReadReceipt message={message} selectedChannel={selectedChannel} currentUserId={currentUser?.id} />
                    </div>
                    
                    {/* Action Buttons (on hover) - Right side */}
                    {hoveredMessage === message.id && (
                      <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex gap-1 relative">
                          {/* Add as Task Button - Only show if AI detected actionable item in project channel */}
                          {selectedChannel?.type === 'project' && taskSuggestions[message.id]?.is_actionable && (
                            <button
                              onClick={() => handleOpenTaskModal(message.id)}
                              className="bg-white dark:bg-gray-700 border border-indigo-300 dark:border-indigo-600 rounded-full px-2 py-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 shadow-sm flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400"
                              title="Add as task"
                            >
                              <Sparkles className="w-3 h-3" />
                              <span>Task</span>
                            </button>
                          )}
                          
                          <button
                            onClick={() => setShowReactionPicker(showReactionPicker === message.id ? null : message.id)}
                            className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-600 shadow-sm"
                            title="Add reaction"
                          >
                            <Smile className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                          </button>
                          
                          {/* Quick Reaction Picker */}
                          {showReactionPicker === message.id && (
                            <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-2 flex gap-1 z-[9999]">
                              {['👍', '❤️', '😂', '😮', '😢', '🎉'].map(emoji => (
                                <button
                                  key={emoji}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddReaction(message.id, emoji);
                                    setShowReactionPicker(null);
                                  }}
                                  className="text-2xl hover:scale-125 transition-transform p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
              
              {/* Typing indicator */}
              {typingUsers.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 dark:text-gray-400 italic">
                  <div className="flex gap-1">
                    <span className="animate-bounce">●</span>
                    <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>●</span>
                    <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>●</span>
                  </div>
                  <span>
                    {typingUsers.length === 1
                      ? `${typingUsers[0].user_name} is typing...`
                      : `${typingUsers.length} people are typing...`}
                  </span>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
            )}

            {/* Message Input - Only show for non-Milli channels */}
            {selectedChannel.type !== 'milli_ai' && (
            <div className="relative">
              {/* Emoji Picker */}
              {showEmojiPicker && (
                <div className="absolute bottom-full left-4 mb-2 z-50">
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    theme="auto"
                    width={350}
                    height={400}
                  />
                </div>
              )}
              
              {/* Mention Dropdown */}
              {showMentionDropdown && (
                <div 
                  className="absolute bottom-full left-4 right-4 mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto z-50"
                  style={{ maxWidth: '400px' }}
                >
                  <div className="p-2">
                    <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 px-2 py-1">
                      Mention someone
                    </div>
                    {getFilteredMentions().length > 0 ? (
                      getFilteredMentions().map((user, index) => (
                        <div
                          key={user.id}
                          onClick={() => insertMention(user)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                            index === selectedMentionIndex
                              ? 'bg-indigo-100 dark:bg-indigo-900/30'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          {user.isSpecial ? (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-500 text-white font-semibold text-sm">
                              @
                            </div>
                          ) : (
                            renderAvatar(user, 'w-8 h-8 text-sm')
                          )}
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {user.isSpecial ? '@all' : user.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {user.role}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                        No members found
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* File Preview */}
              {filePreview && (
                <div className="p-4 pb-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl">
                  <div className="mb-2 p-3 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center gap-3">
                    {filePreview.type.startsWith('image/') ? (
                      <img src={filePreview.data} alt={filePreview.name} className="w-16 h-16 object-cover rounded" />
                    ) : (
                      <FileText className="w-12 h-12 text-gray-500" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{filePreview.name}</p>
                      <p className="text-xs text-gray-500">{(filePreview.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button onClick={removeFilePreview} className="text-gray-500 hover:text-gray-700">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
              
              {/* Read-only channel warning */}
              {selectedChannel && !canSendMessagesInChannel(selectedChannel) && (
                <div className="p-3 mx-4 mb-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    This is a read-only channel. Only admins and managers can post messages.
                  </p>
                </div>
              )}
              
              {/* Rich Text Input */}
              <RichTextInput
                value={messageInput}
                onChange={setMessageInput}
                onSend={handleSendMessage}
                placeholder={`Message ${getDMChannelDisplayName(selectedChannel)} (type @ to mention)`}
                disabled={uploadingFile || !canSendMessagesInChannel(selectedChannel)}
                onEmojiClick={() => setShowEmojiPicker(!showEmojiPicker)}
                onFileClick={() => fileInputRef.current?.click()}
                onAtMention={(show) => {
                  setShowMentionDropdown(show);
                }}
                showEmojiPicker={showEmojiPicker}
                uploadingFile={uploadingFile}
              />
              
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={handleFileSelect}
              />
            </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 dark:text-gray-400">
              Select a channel to start messaging
            </p>
          </div>
        )}
      </div>

      {/* Advanced Create/Edit Channel Modal */}
      {(showCreateChannel || editingChannel) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-[500px] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {editingChannel ? 'Edit Channel' : 'Create New Channel'}
              </h3>
              <button onClick={() => {
                setShowCreateChannel(false);
                setEditingChannel(null);
              }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              
              const channelData = {
                name: formData.get('name'),
                description: formData.get('description'),
                type: formData.get('type'),
                category: formData.get('category'),
                is_private: formData.get('is_private') === 'on',
                permissions: {
                  can_send_messages: formData.get('can_send_messages') !== 'off',
                  can_invite_members: formData.get('can_invite_members') === 'on',
                  can_edit_channel: formData.get('can_edit_channel') === 'on',
                  can_delete_messages: formData.get('can_delete_messages') === 'on',
                  read_only: formData.get('read_only') === 'on'
                },
                members: Array.from(formData.getAll('members'))
              };
              
              if (editingChannel) {
                const updated = await updateChannelSettings(editingChannel.id, channelData);
                if (updated) {
                  setEditingChannel(null);
                }
              } else {
                await createAdvancedChannel(channelData);
              }
            }} className="space-y-4">
              
              {/* Channel Name */}
              <div>
                <label className="block text-sm font-medium mb-1">Channel Name *</label>
                <input
                  name="name"
                  type="text"
                  placeholder="Channel name"
                  defaultValue={editingChannel?.name || ''}
                  required
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Channel Description */}
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  name="description"
                  placeholder="Channel description (optional)"
                  defaultValue={editingChannel?.description || ''}
                  rows={2}
                  className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Channel Type - Fixed to Team */}
              <input name="type" type="hidden" value="team" />
              <input name="category" type="hidden" value="general" />

              {/* Channel Visibility */}
              <div>
                <label className="flex items-center gap-2">
                  <input 
                    name="is_private"
                    type="checkbox" 
                    defaultChecked={editingChannel?.is_private || false}
                    className="rounded"
                  />
                  <span className="text-sm">Private channel (invite-only)</span>
                </label>
              </div>

              {/* Channel Permissions */}
              <div>
                <label className="block text-sm font-medium mb-2">Channel Permissions</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input 
                      name="can_send_messages"
                      type="checkbox" 
                      defaultChecked={editingChannel?.permissions?.can_send_messages !== false}
                      className="rounded"
                    />
                    <span className="text-sm">Members can send messages</span>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input 
                      name="can_invite_members"
                      type="checkbox" 
                      defaultChecked={editingChannel?.permissions?.can_invite_members || false}
                      className="rounded"
                    />
                    <span className="text-sm">Members can invite others</span>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input 
                      name="can_edit_channel"
                      type="checkbox" 
                      defaultChecked={editingChannel?.permissions?.can_edit_channel || false}
                      className="rounded"
                    />
                    <span className="text-sm">Members can edit channel</span>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input 
                      name="can_delete_messages"
                      type="checkbox" 
                      defaultChecked={editingChannel?.permissions?.can_delete_messages || false}
                      className="rounded"
                    />
                    <span className="text-sm">Members can delete messages</span>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input 
                      name="read_only"
                      type="checkbox" 
                      defaultChecked={editingChannel?.permissions?.read_only || false}
                      className="rounded"
                    />
                    <span className="text-sm">Read-only channel</span>
                  </label>
                </div>
              </div>

              {/* Member Selection */}
              {!editingChannel && (
                <div>
                  <label className="block text-sm font-medium mb-2">Add Members</label>
                  <div className="max-h-32 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2">
                    {users.filter(user => user.role !== 'client').map(user => (
                      <label key={user.id} className="flex items-center gap-2 py-1">
                        <input 
                          name="members"
                          type="checkbox" 
                          value={user.id}
                          className="rounded"
                        />
                        <span className="text-sm">{user.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateChannel(false);
                    setEditingChannel(null);
                  }}
                  className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-700 transition-colors"
                >
                  {editingChannel ? 'Update Channel' : 'Create Channel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Channel Members Modal */}
      {showChannelMembers && selectedChannelForMembers && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-[500px] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                Channel Members - {selectedChannelForMembers.name}
              </h3>
              <button onClick={() => setShowChannelMembers(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3">
              {actionLoading === 'loadMembers' ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : channelMembers.length > 0 ? (
                channelMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center gap-3">
                      {renderAvatar(member, 'w-10 h-10')}
                      <div>
                        <div className="font-medium">{member.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{member.role}</div>
                      </div>
                    </div>
                    {(currentUser?.role === 'admin' || currentUser?.role === 'manager') && member.id !== currentUser.id && (
                      <button
                        onClick={async () => {
                          if (window.confirm(`Remove ${member.name} from this channel?`)) {
                            await removeMemberFromChannel(selectedChannelForMembers.id, member.id);
                          }
                        }}
                        className="text-red-500 hover:text-red-700 p-1 disabled:opacity-50"
                        title="Remove member"
                        disabled={actionLoading === 'removeMembers'}
                      >
                        {actionLoading === 'removeMembers' ? (
                          <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No members found
                </div>
              )}
            </div>
            
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  setShowChannelMembers(false);
                  handleAddMemberClick(selectedChannelForMembers);
                }}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                disabled={actionLoading === 'loadUsers'}
              >
                {actionLoading === 'loadUsers' ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add Members
              </button>
              <button
                onClick={() => setShowChannelMembers(false)}
                className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && selectedChannelForMembers && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-[500px] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                Add Members to {selectedChannelForMembers.name}
              </h3>
              <button onClick={() => setShowAddMember(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const selectedUserIds = Array.from(formData.getAll('members'));
              
              if (selectedUserIds.length > 0) {
                const success = await addMemberToChannel(selectedChannelForMembers.id, selectedUserIds);
                if (success) {
                  setShowAddMember(false);
                }
              }
            }}>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {actionLoading === 'loadUsers' ? (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : availableUsers.length > 0 ? (
                  availableUsers.map((user) => (
                    <label key={user.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600">
                      <input 
                        name="members"
                        type="checkbox" 
                        value={user.id}
                        className="rounded"
                        disabled={actionLoading === 'addMembers'}
                      />
                      {renderAvatar(user, 'w-10 h-10')}
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{user.role}</div>
                      </div>
                    </label>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No available users to add
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddMember(false)}
                  className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  disabled={actionLoading === 'addMembers'}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  disabled={availableUsers.length === 0 || actionLoading === 'addMembers'}
                >
                  {actionLoading === 'addMembers' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Adding...
                    </>
                  ) : (
                    'Add Selected Members'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Task Extraction Modal */}
      <Dialog open={showTaskModal} onOpenChange={setShowTaskModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {extractedTask && (
            <>
              {/* Header */}
              <div className="border-b pb-4">
                <input
                  type="text"
                  value={extractedTask.title}
                  onChange={(e) => setExtractedTask({ ...extractedTask, title: e.target.value })}
                  placeholder="Task title"
                  className="text-2xl font-bold text-gray-900 dark:text-white bg-transparent border-none outline-none w-full focus:ring-0"
                />
              </div>

              {/* Task Details Row */}
              <div className="flex flex-wrap items-center gap-3 py-4">
                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Status</span>
                  <select
                    value={extractedTask.status || 'Not Started'}
                    onChange={(e) => setExtractedTask({ ...extractedTask, status: e.target.value })}
                    className="px-3 py-1.5 rounded-lg border text-sm font-medium
                             text-gray-700 bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                {/* Priority */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Priority</span>
                  <select
                    value={extractedTask.priority}
                    onChange={(e) => setExtractedTask({ ...extractedTask, priority: e.target.value })}
                    className="px-3 py-1.5 rounded-lg border text-sm font-medium
                             text-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>

                {/* Assignee */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Assignee</span>
                  <select
                    value={extractedTask.assignee}
                    onChange={(e) => setExtractedTask({ ...extractedTask, assignee: e.target.value })}
                    className="px-3 py-1.5 rounded-lg border text-sm font-medium
                             text-purple-700 bg-purple-50 dark:bg-purple-900/20 border-purple-200"
                  >
                    <option value="">Unassigned</option>
                    {users
                      .filter(u => u.role !== 'client')
                      .map(user => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Due Date */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Due Date</span>
                  <input
                    type="date"
                    value={extractedTask.due_date}
                    onChange={(e) => setExtractedTask({ ...extractedTask, due_date: e.target.value })}
                    className="px-3 py-1.5 rounded-lg border text-sm font-medium
                             text-blue-700 bg-blue-50 dark:bg-blue-900/20 border-blue-200"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="py-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Description
                  </h3>
                </div>
                <Textarea
                  value={extractedTask.description}
                  onChange={(e) => setExtractedTask({ ...extractedTask, description: e.target.value })}
                  placeholder="Add task description..."
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowTaskModal(false);
                    setExtractedTask(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateTaskFromMessage}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Task
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Chats;

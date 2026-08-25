import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { BACKEND_URL } from '../config';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

// Custom WebSocket client with Socket.io-like features
class ReconnectingWebSocket {
  constructor(url, token, onConnected, onDisconnected, onMessage) {
    this.url = url;
    this.token = token;
    this.onConnected = onConnected;
    this.onDisconnected = onDisconnected;
    this.onMessage = onMessage;
    
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.heartbeatInterval = null;
    this.isIntentionallyClosed = false;
    this.connectionId = null;
    
    this.connect();
  }
  
  connect() {
    if (this.isIntentionallyClosed) return;
    
    try {
      // Convert https:// to wss:// for WebSocket
      const wsUrl = this.url.replace('https://', 'wss://').replace('http://', 'ws://') + '/api/ws';
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected, sending auth...');
        // Send authentication
        this.send({ type: 'auth', token: this.token });
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'connected') {
            console.log('WebSocket authenticated successfully');
            this.connectionId = data.connection_id;
            this.reconnectAttempts = 0;
            this.startHeartbeat();
            this.onConnected();
          } else if (data.type === 'ping') {
            // Respond to heartbeat
            this.send({ type: 'pong' });
          } else if (data.type === 'error') {
            console.error('WebSocket error:', data.message);
          } else {
            // Pass message to handler
            this.onMessage(data);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket closed');
        this.stopHeartbeat();
        this.onDisconnected();
        
        if (!this.isIntentionallyClosed) {
          this.scheduleReconnect();
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.scheduleReconnect();
    }
  }
  
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }
  
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Server sends ping, we just need to respond
      }
    }, 30000);
  }
  
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }
  
  close() {
    this.isIntentionallyClosed = true;
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
    }
  }
}

export const SocketProvider = ({ children }) => {
  const [connected, setConnected] = useState(false);
  const [channels, setChannels] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [channelUnreads, setChannelUnreads] = useState({});
  const wsRef = useRef(null);
  const messageHandlersRef = useRef({});

  const backendUrl = BACKEND_URL;
  const token = localStorage.getItem('token');

  const handleMessage = useCallback((data) => {
    // Handle permission change notifications
    if (data.type === 'permissions_changed') {
      console.log('Permission change detected, triggering auto-logout...');
      // Dispatch custom event for permission change
      window.dispatchEvent(new CustomEvent('permissionsChangedByAdmin', { detail: data }));
      return;
    }
    
    // Handle channel updates (project status changes)
    if (data.type === 'channels_updated') {
      console.log('Channel update detected, refreshing channel list...');
      // Trigger channel reload
      window.dispatchEvent(new CustomEvent('channelsUpdated', { detail: data }));
      return;
    }
    
    // Handle new notification
    if (data.type === 'new_notification') {
      console.log('New notification received:', data.notification);
      setNotifications((prev) => [data.notification, ...prev]);
      setUnreadCount((prev) => prev + 1);
      
      // Play notification sound
      try {
        // Create a simple pleasant notification sound using Web Audio API
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create two oscillators for a pleasant two-tone sound
        const oscillator1 = audioContext.createOscillator();
        const oscillator2 = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        // Connect oscillators to gain node to audio output
        oscillator1.connect(gainNode);
        oscillator2.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Set frequencies for a pleasant notification sound (like Slack)
        oscillator1.frequency.setValueAtTime(800, audioContext.currentTime); // First tone
        oscillator2.frequency.setValueAtTime(1000, audioContext.currentTime); // Second tone (higher)
        
        // Set oscillator types
        oscillator1.type = 'sine';
        oscillator2.type = 'sine';
        
        // Set volume envelope - fade in and fade out
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        // Play the sound
        oscillator1.start(audioContext.currentTime);
        oscillator2.start(audioContext.currentTime);
        oscillator1.stop(audioContext.currentTime + 0.3);
        oscillator2.stop(audioContext.currentTime + 0.3);
      } catch (error) {
        console.error('Failed to play notification sound:', error);
      }
      
      // Show browser notification if permission is granted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(data.notification.title, {
          body: data.notification.message,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: data.notification.id
        });
      }
      return;
    }
    
    // Emit to all registered handlers
    Object.values(messageHandlersRef.current).forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    });
  }, []);

  useEffect(() => {
    if (!token) return;

    // Initialize WebSocket
    wsRef.current = new ReconnectingWebSocket(
      backendUrl,
      token,
      () => setConnected(true),
      () => setConnected(false),
      handleMessage
    );

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Poll for unread counts
    const pollUnreads = async () => {
      if (token) {
        try {
          const response = await axios.get(
            `${backendUrl}/api/channels/unreads/counts`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setChannelUnreads(response.data);
          
          // Update unread count to include channel unreads
          const totalChannelUnreads = Object.values(response.data).reduce((sum, count) => sum + count, 0);
          
          // Also get notification unreads
          const notifResponse = await axios.get(
            `${backendUrl}/api/notifications/unread-count`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          setUnreadCount(totalChannelUnreads + notifResponse.data.count);
        } catch (error) {
          console.error('Failed to fetch unread counts:', error);
        }
      }
    };

    pollUnreads();
    const unreadInterval = setInterval(pollUnreads, 10000);

    return () => {
      clearInterval(unreadInterval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [token, backendUrl, handleMessage]);

  const on = useCallback((event, handler) => {
    const id = Math.random().toString(36);
    messageHandlersRef.current[id] = (data) => {
      if (data.type === event) {
        handler(data);
      }
    };
    return () => delete messageHandlersRef.current[id];
  }, []);

  const sendMessage = useCallback(async (messageData) => {
    return new Promise((resolve, reject) => {
      if (!wsRef.current || !connected) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const success = wsRef.current.send({
        type: 'send_message',
        ...messageData
      });

      if (success) {
        // Listen for confirmation
        const cleanup = on('message_sent', (data) => {
          cleanup();
          resolve({ success: true, message_id: data.message_id });
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          cleanup();
          reject(new Error('Message send timeout'));
        }, 5000);
      } else {
        reject(new Error('Failed to send message'));
      }
    });
  }, [connected, on]);

  const joinChannel = useCallback((channelId) => {
    if (wsRef.current && connected) {
      wsRef.current.send({
        type: 'join_channel',
        channel_id: channelId
      });
    }
  }, [connected]);

  const leaveChannel = useCallback((channelId) => {
    if (wsRef.current && connected) {
      wsRef.current.send({
        type: 'leave_channel',
        channel_id: channelId
      });
    }
  }, [connected]);

  const sendTyping = useCallback((channelId, isTyping = true) => {
    if (wsRef.current && connected) {
      wsRef.current.send({
        type: 'typing',
        channel_id: channelId,
        is_typing: isTyping
      });
    }
  }, [connected]);

  const markNotificationRead = async (notificationId) => {
    try {
      await axios.put(
        `${backendUrl}/api/notifications/${notificationId}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? { ...notif, read: true } : notif
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const value = {
    socket: wsRef.current,
    connected,
    channels,
    setChannels,
    notifications,
    setNotifications,
    unreadCount,
    setUnreadCount,
    channelUnreads,
    setChannelUnreads,
    on,
    sendMessage,
    joinChannel,
    leaveChannel,
    sendTyping,
    markNotificationRead,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

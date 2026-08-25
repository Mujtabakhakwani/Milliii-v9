import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, X, ExternalLink } from 'lucide-react';
import { useSocket } from '../contexts/SocketContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BACKEND_URL } from '../config';

const Notifications = () => {
  const { notifications, setNotifications, unreadCount, setUnreadCount, markNotificationRead } = useSocket();
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const backendUrl = BACKEND_URL;
  const token = localStorage.getItem('token');

  useEffect(() => {
    loadNotifications();
    loadUnreadCount();
  }, []);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${backendUrl}/api/notifications?limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(response.data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const response = await axios.get(`${backendUrl}/api/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnreadCount(response.data.count);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    console.log('Notification clicked:', notification);
    
    if (!notification.read) {
      try {
        await axios.put(
          `${backendUrl}/api/notifications/${notification.id}/read`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        );
        markNotificationRead(notification.id);
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    // Navigate to the link if provided
    if (notification.link) {
      console.log('Navigating to:', notification.link);
      navigate(notification.link);
      setShowDropdown(false);
    } else {
      console.warn('No link provided for notification:', notification);
      
      // Fallback navigation based on notification type
      const fallbackRoutes = {
        'mention': '/chats',
        'new_message': '/chats',
        'task_assigned': '/my-tasks',
        'task_approved': '/my-tasks',
        'task_rejected': '/my-tasks',
        'task_under_review': '/my-tasks',
        'project_created': '/projects',
        'project_completed': '/projects'
      };
      
      const fallbackRoute = fallbackRoutes[notification.type];
      if (fallbackRoute) {
        console.log('Using fallback route:', fallbackRoute);
        navigate(fallbackRoute);
        setShowDropdown(false);
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await axios.put(
        `${backendUrl}/api/notifications/mark-all-read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setNotifications((prev) =>
        prev.map((notif) => ({ ...notif, read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleDeleteNotification = async (notificationId, e) => {
    e.stopPropagation();
    try {
      await axios.delete(
        `${backendUrl}/api/notifications/${notificationId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setNotifications((prev) => prev.filter((notif) => notif.id !== notificationId));
      loadUnreadCount();
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'mention':
        return '💬';
      case 'task_assigned':
        return '📋';
      case 'task_approved':
        return '✅';
      case 'task_rejected':
        return '❌';
      case 'task_under_review':
        return '👀';
      case 'project_completed':
        return '🎉';
      case 'project_created':
        return '📁';
      case 'new_message':
        return '📥';
      default:
        return '📢';
    }
  };

  const getPriorityClass = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'border-l-4 border-red-500 bg-red-50 dark:bg-red-900/20';
      case 'low':
        return 'border-l-4 border-gray-300 dark:border-gray-600';
      default:
        return 'border-l-4 border-blue-300 dark:border-blue-600';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown */}
      {showDropdown && (
        <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 z-50 max-h-[600px] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
            {notifications.filter(n => !n.read).length > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-gray-500 dark:text-gray-400">
                <Bell className="w-12 h-12 mb-2 opacity-50" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div>
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors ${
                      !notification.read ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                    } ${getPriorityClass(notification.priority)}`}
                  >
                    <div className="flex gap-3">
                      <div className="text-2xl flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 dark:text-white text-sm">
                              {notification.title}
                            </p>
                            {notification.priority === 'urgent' && (
                              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                                URGENT
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => handleDeleteNotification(notification.id, e)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTime(notification.created_at)}
                          </span>
                          {notification.link && (
                            <ExternalLink className="w-3 h-3 text-gray-400" />
                          )}
                          {!notification.read && (
                            <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications;

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { notificationService } from '../services/notificationService';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const intervalRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const count = await notificationService.getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Silently fail
    }
  }, [token]);

  const fetchNotifications = useCallback(async (page = 1, limit = 20) => {
    if (!token) return [];
    try {
      const data = await notificationService.getNotifications(page, limit);
      setNotifications(data.data || []);
      return data;
    } catch {
      return { data: [], pagination: {} };
    }
  }, [token]);

  const startPolling = useCallback((intervalMs = 30000) => {
    if (intervalRef.current) return;
    fetchUnreadCount();
    intervalRef.current = setInterval(fetchUnreadCount, intervalMs);
  }, [fetchUnreadCount]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const markAsRead = async (id) => {
    await notificationService.markAsRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    await notificationService.markAllAsRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  return (
    <NotificationContext.Provider value={{
      unreadCount, notifications, fetchUnreadCount, fetchNotifications,
      startPolling, stopPolling, markAsRead, markAllAsRead, setUnreadCount
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};

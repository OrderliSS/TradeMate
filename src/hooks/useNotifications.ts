import { useState, useCallback, useEffect } from 'react';
import { Notification } from '@/components/notifications/NotificationItem';

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('notifications');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        
        // Filter out legacy session-related notifications (these were noise, not real notifications)
        const legacySessionTitles = ['Session Paused', 'Welcome Back'];
        const filtered = parsed.filter((n: any) => !legacySessionTitles.includes(n.title));
        
        setNotifications(
          filtered.map((n: any) => ({
            ...n,
            timestamp: new Date(n.timestamp),
          }))
        );
        
        // Clean up storage if we filtered anything
        if (filtered.length !== parsed.length) {
          localStorage.setItem('notifications', JSON.stringify(filtered));
        }
      } catch (error) {
        console.error('Failed to parse notifications:', error);
      }
    }
  }, []);

  // Save to localStorage whenever notifications change
  useEffect(() => {
    localStorage.setItem('notifications', JSON.stringify(notifications));
  }, [notifications]);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notification-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      read: false,
    };

    setNotifications((prev) => [newNotification, ...prev].slice(0, 50)); // Keep last 50
  }, []);

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
}

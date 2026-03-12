import { useState, useEffect, useCallback } from 'react';

export type NotificationType = 
  | 'sign_in'
  | 'purchase_orders'
  | 'asset_delivery'
  | 'task_reminders'
  | 'system_announcements'
  | 'inventory_alerts';

export interface NotificationPreferences {
  showToastPopups: boolean;
  enabledTypes: Record<NotificationType, boolean>;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  showToastPopups: true,
  enabledTypes: {
    sign_in: true,
    purchase_orders: true,
    asset_delivery: true,
    task_reminders: true,
    system_announcements: true,
    inventory_alerts: true,
  },
};

const STORAGE_KEY = 'notification_preferences';

export function useNotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle new notification types
        return {
          ...DEFAULT_PREFERENCES,
          ...parsed,
          enabledTypes: {
            ...DEFAULT_PREFERENCES.enabledTypes,
            ...parsed.enabledTypes,
          },
        };
      }
    } catch (e) {
      console.error('Failed to load notification preferences:', e);
    }
    return DEFAULT_PREFERENCES;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (e) {
      console.error('Failed to save notification preferences:', e);
    }
  }, [preferences]);

  const setShowToastPopups = useCallback((show: boolean) => {
    setPreferences(prev => ({ ...prev, showToastPopups: show }));
  }, []);

  const setNotificationTypeEnabled = useCallback((type: NotificationType, enabled: boolean) => {
    setPreferences(prev => ({
      ...prev,
      enabledTypes: {
        ...prev.enabledTypes,
        [type]: enabled,
      },
    }));
  }, []);

  const isNotificationEnabled = useCallback((type: NotificationType): boolean => {
    return preferences.enabledTypes[type] ?? true;
  }, [preferences.enabledTypes]);

  const shouldShowToast = useCallback((type?: NotificationType): boolean => {
    if (!preferences.showToastPopups) return false;
    if (type && !isNotificationEnabled(type)) return false;
    return true;
  }, [preferences.showToastPopups, isNotificationEnabled]);

  const resetToDefaults = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
  }, []);

  return {
    preferences,
    showToastPopups: preferences.showToastPopups,
    setShowToastPopups,
    setNotificationTypeEnabled,
    isNotificationEnabled,
    shouldShowToast,
    resetToDefaults,
  };
}

// Notification type labels for UI
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, { label: string; description: string }> = {
  sign_in: {
    label: 'Sign-in Confirmations',
    description: 'Notifications when you sign in to your account',
  },
  purchase_orders: {
    label: 'Purchase Order Updates',
    description: 'Status changes and updates for purchase orders',
  },
  asset_delivery: {
    label: 'Asset Delivery Alerts',
    description: 'Notifications when assets are delivered or shipped',
  },
  task_reminders: {
    label: 'Task Reminders',
    description: 'Reminders for upcoming and overdue tasks',
  },
  system_announcements: {
    label: 'System Announcements',
    description: 'Important system updates and announcements',
  },
  inventory_alerts: {
    label: 'Inventory Alerts',
    description: 'Low stock and reorder notifications',
  },
};

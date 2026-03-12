import { useEffect, useCallback, useRef } from 'react';
import { useNotifications } from './useNotifications';

type NotificationType = 'info' | 'success' | 'warning' | 'error';

interface ToastEvent {
  type: NotificationType;
  title: string;
  message?: string;
}

/**
 * Bridge hook that captures toast notifications and persists them
 * to the notification center for later viewing.
 * 
 * Also handles screen visibility events (lock/unlock).
 */
export function useNotificationBridge() {
  const { addNotification } = useNotifications();
  const lastVisibilityState = useRef(document.visibilityState);
  
  // Persist a notification from a toast or system event
  const persistNotification = useCallback((event: ToastEvent) => {
    addNotification({
      type: event.type,
      title: event.title,
      message: event.message || '',
    });
  }, [addNotification]);

  // NOTE: Visibility change handler removed - "Session Paused" / "Welcome Back" 
  // notifications were noise, not real user notifications. The persistNotification 
  // function remains available for legitimate use cases (e.g., PO updates).

  // Expose the persist function for manual toast bridging
  return { persistNotification };
}

/**
 * Utility to create a toast that also persists to notification center.
 * Use this instead of enhancedToast when you want the toast to be saved.
 */
export function createPersistentToast(
  addNotification: (notification: { type: NotificationType; title: string; message: string }) => void
) {
  return {
    success: (title: string, message?: string) => {
      addNotification({ type: 'success', title, message: message || '' });
    },
    error: (title: string, message?: string) => {
      addNotification({ type: 'error', title, message: message || '' });
    },
    warning: (title: string, message?: string) => {
      addNotification({ type: 'warning', title, message: message || '' });
    },
    info: (title: string, message?: string) => {
      addNotification({ type: 'info', title, message: message || '' });
    },
  };
}

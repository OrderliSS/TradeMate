/**
 * PWA hooks using vite-plugin-pwa - Phase 5 Enhanced
 * Provides install prompts, update notifications, and cache management
 */
import { useState, useEffect, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import {
  isInstalledPWA,
  getCacheStorageEstimate,
  requestPersistentStorage,
  clearAllCaches,
  registerBackgroundSync,
  isBackgroundSyncSupported,
} from '@/lib/pwa';

// Type for BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

/**
 * Hook for PWA service worker registration and updates
 */
export const usePWAUpdate = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      logger.info('SW Registered', { scope: registration?.scope });

      // Register for background sync
      if (registration) {
        registerBackgroundSync('orderli-sync');
      }

      // Check for updates frequently (every 10 mins)
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 10 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      logger.error('SW registration error', { error });
    },
    // Force update when new SW is available
    onNeedRefresh() {
      logger.info('New content available, forcing update...');
      updateServiceWorker(true);
    },
  });

  const acceptUpdate = useCallback(() => {
    updateServiceWorker(true);
  }, [updateServiceWorker]);

  const dismissUpdate = useCallback(() => {
    setNeedRefresh(false);
  }, [setNeedRefresh]);

  return {
    needRefresh,
    offlineReady,
    acceptUpdate,
    dismissUpdate,
  };
};

/**
 * Hook for PWA install prompt
 */
export const usePWAInstall = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already running as installed PWA
    const isInStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    setIsStandalone(isInStandaloneMode);

    // Check if user previously dismissed
    const dismissedUntil = localStorage.getItem('pwa-install-dismissed');
    if (dismissedUntil) {
      const dismissedDate = new Date(dismissedUntil);
      if (dismissedDate > new Date()) {
        setDismissed(true);
      } else {
        localStorage.removeItem('pwa-install-dismissed');
      }
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      logger.info('PWA install prompt available');
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      logger.info('PWA installed successfully');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) return false;

    try {
      const result = await installPrompt.prompt();
      logger.info('PWA install prompt result', { outcome: result.outcome });

      if (result.outcome === 'accepted') {
        setInstallPrompt(null);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('PWA install failed', { error });
      return false;
    }
  }, [installPrompt]);

  const dismiss = useCallback((daysToHide: number = 7) => {
    const dismissUntil = new Date();
    dismissUntil.setDate(dismissUntil.getDate() + daysToHide);
    localStorage.setItem('pwa-install-dismissed', dismissUntil.toISOString());
    setDismissed(true);
    setInstallPrompt(null);
  }, []);

  const canInstall = !!installPrompt && !isInstalled && !isStandalone && !dismissed;

  return {
    canInstall,
    isInstalled,
    isStandalone,
    install,
    dismiss,
  };
};

/**
 * Platform detection for install instructions
 */
export const usePlatformDetection = () => {
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop' | 'unknown'>('unknown');

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();

    if (/iphone|ipad|ipod/.test(userAgent)) {
      setPlatform('ios');
    } else if (/android/.test(userAgent)) {
      setPlatform('android');
    } else if (/windows|macintosh|linux/.test(userAgent)) {
      setPlatform('desktop');
    }
  }, []);

  return platform;
};

/**
 * Unified PWA hook - Phase 5
 * Combines install, update, and cache management functionality
 */
export interface PWAState {
  isInstalled: boolean;
  isInstallable: boolean;
  isUpdateAvailable: boolean;
  isOfflineReady: boolean;
  storageEstimate: {
    usage: number;
    quota: number;
    usagePercent: number;
  } | null;
  isPersistent: boolean;
  backgroundSyncSupported: boolean;
}

export function usePWA() {
  const { needRefresh, offlineReady, acceptUpdate, dismissUpdate } = usePWAUpdate();
  const { canInstall, isInstalled, isStandalone, install, dismiss } = usePWAInstall();

  const [storageEstimate, setStorageEstimate] = useState<PWAState['storageEstimate']>(null);
  const [isPersistent, setIsPersistent] = useState(false);

  // Check storage estimate periodically
  useEffect(() => {
    const checkStorage = async () => {
      const estimate = await getCacheStorageEstimate();
      setStorageEstimate(estimate);
    };

    checkStorage();
    const interval = setInterval(checkStorage, 60000);
    return () => clearInterval(interval);
  }, []);

  // Check persistent storage on mount
  useEffect(() => {
    const checkPersistence = async () => {
      if ('storage' in navigator && 'persisted' in navigator.storage) {
        const isPersisted = await navigator.storage.persisted();
        setIsPersistent(isPersisted);
      }
    };
    checkPersistence();
  }, []);

  // Request persistent storage
  const requestPersistence = useCallback(async (): Promise<boolean> => {
    const granted = await requestPersistentStorage();
    setIsPersistent(granted);
    return granted;
  }, []);

  // Clear all caches
  const clearCaches = useCallback(async () => {
    try {
      await clearAllCaches();
      const estimate = await getCacheStorageEstimate();
      setStorageEstimate(estimate);
      toast.success('Caches cleared');
    } catch (error) {
      console.error('[PWA] Failed to clear caches:', error);
      toast.error('Failed to clear caches');
    }
  }, []);

  return {
    // State
    isInstalled: isInstalled || isStandalone,
    isInstallable: canInstall,
    isUpdateAvailable: needRefresh,
    isOfflineReady: offlineReady,
    storageEstimate,
    isPersistent,
    backgroundSyncSupported: isBackgroundSyncSupported(),

    // Actions
    install,
    applyUpdate: acceptUpdate,
    dismissUpdate,
    dismissInstall: dismiss,
    requestPersistence,
    clearCaches,
  };
}

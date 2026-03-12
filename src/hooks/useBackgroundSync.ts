/**
 * Background Sync Hook
 * Manages automatic sync in the background when online
 */

import { useEffect, useRef, useCallback } from 'react';
import { useSyncMode } from '@/contexts/SyncModeContext';
import { 
  processSyncBatch, 
  getPendingChanges, 
  getSyncStats,
  retryFailedChanges,
  type SyncBatchResult 
} from '@/lib/sync-engine';
import { canSyncToServer, shouldQueueChanges } from '@/lib/sync/sync-state-machine';
import { toast } from 'sonner';

interface BackgroundSyncOptions {
  /** Interval between sync attempts in ms (default: 30000 = 30s) */
  interval?: number;
  /** Whether to sync immediately when coming online */
  syncOnReconnect?: boolean;
  /** Whether to show toast notifications */
  showNotifications?: boolean;
  /** Callback when sync completes */
  onSyncComplete?: (result: SyncBatchResult) => void;
  /** Callback when sync fails */
  onSyncError?: (error: Error) => void;
  /** Callback when conflicts are detected */
  onConflictsDetected?: (count: number) => void;
  /** Whether background sync is enabled */
  enabled?: boolean;
}

export function useBackgroundSync({
  interval = 30000,
  syncOnReconnect = true,
  showNotifications = false,
  onSyncComplete,
  onSyncError,
  onConflictsDetected,
  enabled = true,
}: BackgroundSyncOptions = {}) {
  const { isEnabled, isOnline, canSync, isSyncing, triggerSync, syncState } = useSyncMode();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const wasOfflineRef = useRef(!isOnline);
  const isSyncingRef = useRef(false);

  // Process pending changes - respect state machine
  const processQueue = useCallback(async () => {
    // Check state machine: can we sync to server?
    if (isSyncingRef.current || !canSync || !canSyncToServer(syncState)) {
      // If we should queue changes instead, just return
      if (shouldQueueChanges(syncState)) {
        console.log('[BackgroundSync] Queuing changes (offline or degraded state)');
      }
      return null;
    }

    const pending = getPendingChanges();
    if (pending.length === 0) {
      return null;
    }

    isSyncingRef.current = true;

    try {
      const result = await processSyncBatch();

      if (result.conflicts > 0) {
        onConflictsDetected?.(result.conflicts);
        if (showNotifications) {
          toast.warning(`${result.conflicts} sync conflict(s) need resolution`);
        }
      }

      if (result.successful > 0 && showNotifications) {
        toast.success(`Synced ${result.successful} change(s)`);
      }

      if (result.failed > 0 && showNotifications) {
        toast.error(`Failed to sync ${result.failed} change(s)`);
      }

      onSyncComplete?.(result);
      return result;
    } catch (error) {
      const syncError = error instanceof Error ? error : new Error('Sync failed');
      onSyncError?.(syncError);
      if (showNotifications) {
        toast.error('Background sync failed');
      }
      return null;
    } finally {
      isSyncingRef.current = false;
    }
  }, [canSync, syncState, showNotifications, onSyncComplete, onSyncError, onConflictsDetected]);

  // Handle coming back online
  useEffect(() => {
    if (isOnline && wasOfflineRef.current && syncOnReconnect && enabled) {
      // Coming back online - trigger immediate sync
      console.log('[BackgroundSync] Back online, triggering sync...');
      
      // Retry any failed changes first
      retryFailedChanges();
      
      // Then process the queue
      processQueue();
    }
    wasOfflineRef.current = !isOnline;
  }, [isOnline, syncOnReconnect, enabled, processQueue]);

  // Set up interval-based sync
  useEffect(() => {
    if (!enabled || !isEnabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial sync
    processQueue();

    // Set up interval
    intervalRef.current = setInterval(() => {
      if (canSync && !isSyncingRef.current) {
        processQueue();
      }
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, isEnabled, interval, canSync, processQueue]);

  // Manual sync trigger
  const sync = useCallback(async () => {
    if (!canSync) {
      if (showNotifications) {
        toast.error('Cannot sync: offline or sync disabled');
      }
      return null;
    }

    triggerSync();
    return processQueue();
  }, [canSync, triggerSync, processQueue, showNotifications]);

  // Get current stats
  const getStats = useCallback(() => getSyncStats(), []);

  return {
    sync,
    getStats,
    isProcessing: isSyncingRef.current || isSyncing,
    hasPendingChanges: getPendingChanges().length > 0,
  };
}

/**
 * Hook for registering service worker for offline sync
 * (Placeholder for PWA implementation)
 */
export function useServiceWorkerSync() {
  useEffect(() => {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      // Register for background sync when supported
      navigator.serviceWorker.ready.then((registration) => {
        // Check if sync is supported
        if ('sync' in registration) {
          console.log('[ServiceWorkerSync] Background sync supported');
        }
      });
    }
  }, []);
}

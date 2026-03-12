/**
 * Catch-up Sync Hook
 * 
 * Performs a targeted data refresh when the application resumes
 * from a period of disconnection or tab inactivity.
 * 
 * This ensures users see the latest data after:
 * - Reconnecting after network issues
 * - Returning to a backgrounded tab
 * - App resume on mobile
 */

import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { connectionStateManager } from '@/lib/realtime';
import { logger } from '@/lib/logger';

interface CatchUpSyncOptions {
  /**
   * Query keys to refresh on catch-up
   */
  queryKeys?: string[];
  
  /**
   * Minimum time (ms) since last sync to trigger catch-up
   * Default: 60000 (1 minute)
   */
  minStalenessMs?: number;
  
  /**
   * Whether to run catch-up sync on mount if data is stale
   */
  syncOnMount?: boolean;
  
  /**
   * Callback when catch-up sync completes
   */
  onSyncComplete?: () => void;
}

const DEFAULT_QUERY_KEYS = [
  'purchases',
  'tasks', 
  'customers',
  'dashboard-stats',
  'operations-queue',
];

export function useCatchUpSync(options: CatchUpSyncOptions = {}) {
  const {
    queryKeys = DEFAULT_QUERY_KEYS,
    minStalenessMs = 60000, // 1 minute
    syncOnMount = true,
    onSyncComplete,
  } = options;

  const queryClient = useQueryClient();
  const hasSyncedOnMount = useRef(false);
  const isSyncing = useRef(false);

  const performSync = useCallback(async (lastSyncTimestamp?: number) => {
    if (isSyncing.current) {
      logger.debug('[CatchUpSync] Skipping - sync already in progress', {});
      return;
    }

    const timeSinceSync = Date.now() - (lastSyncTimestamp || connectionStateManager.getLastSyncTimestamp());
    
    // Only sync if data is stale enough
    if (timeSinceSync < minStalenessMs) {
      logger.debug('[CatchUpSync] Skipping - data not stale enough', { timeSinceSync, minStalenessMs });
      return;
    }

    isSyncing.current = true;
    
    logger.info('[CatchUpSync] Starting catch-up sync', { 
      queryKeys, 
      timeSinceSync,
    });

    try {
      // Invalidate all specified query keys
      await Promise.all(
        queryKeys.map(key => 
          queryClient.invalidateQueries({ queryKey: [key] })
        )
      );

      // Record successful sync
      connectionStateManager.recordSync();
      
      logger.info('[CatchUpSync] Catch-up sync complete', {});
      onSyncComplete?.();
    } catch (error) {
      logger.error('[CatchUpSync] Sync failed', { error });
    } finally {
      isSyncing.current = false;
    }
  }, [queryClient, queryKeys, minStalenessMs, onSyncComplete]);

  // Subscribe to catch-up events from connection state manager
  useEffect(() => {
    const unsubscribe = connectionStateManager.onCatchUp(performSync);
    return unsubscribe;
  }, [performSync]);

  // Sync on mount if enabled and data is stale
  useEffect(() => {
    if (syncOnMount && !hasSyncedOnMount.current) {
      hasSyncedOnMount.current = true;
      
      const lastSync = connectionStateManager.getLastSyncTimestamp();
      const timeSinceSync = Date.now() - lastSync;
      
      if (timeSinceSync > minStalenessMs) {
        performSync(lastSync);
      }
    }
  }, [syncOnMount, minStalenessMs, performSync]);

  return {
    performSync,
    isStale: () => {
      const lastSync = connectionStateManager.getLastSyncTimestamp();
      return Date.now() - lastSync > minStalenessMs;
    },
  };
}

/**
 * Hook for page-specific catch-up sync
 * 
 * Use this in page components to ensure data is fresh
 * when the page mounts or tab becomes visible.
 */
export function usePageCatchUpSync(queryKeys: string[]) {
  return useCatchUpSync({
    queryKeys,
    syncOnMount: true,
    minStalenessMs: 30000, // 30 seconds for page-level
  });
}

/**
 * Offline-First Data Hook - Phase 7
 * Provides offline-first data fetching with automatic caching and sync
 */

import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSyncMode } from '@/contexts/SyncModeContext';
import { 
  getCachedEntities, 
  cacheEntities, 
  updateCachedEntity,
  removeCachedEntity,
} from '@/lib/pwa/offline-cache';
import { addToSyncQueue } from '@/lib/sync-engine';
import { toast } from 'sonner';

type TableName = 'customers' | 'purchases' | 'tasks' | 'stock_orders' | 'products';

interface UseOfflineFirstOptions<T> {
  /** Table name to query */
  table: TableName;
  /** Query key for React Query */
  queryKey: string[];
  /** Select statement for Supabase */
  select?: string;
  /** Filter function for the query */
  filter?: (query: ReturnType<typeof supabase.from>) => ReturnType<typeof supabase.from>;
  /** Max age for cached data in ms (default: 5 minutes) */
  maxCacheAge?: number;
  /** Whether to show stale data indicator */
  showStaleIndicator?: boolean;
  /** Enable caching */
  enableCache?: boolean;
  /** Additional React Query options */
  queryOptions?: Partial<UseQueryOptions<T[], Error>>;
}

interface UseOfflineFirstResult<T> {
  data: T[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isStale: boolean;
  isFromCache: boolean;
  refetch: () => void;
  // Mutation helpers
  optimisticCreate: (item: Partial<T>) => Promise<string>;
  optimisticUpdate: (id: string, updates: Partial<T>) => Promise<void>;
  optimisticDelete: (id: string) => Promise<void>;
}

export function useOfflineFirst<T extends { id: string }>({
  table,
  queryKey,
  select = '*',
  filter,
  maxCacheAge = 5 * 60 * 1000, // 5 minutes
  showStaleIndicator = true,
  enableCache = true,
  queryOptions,
}: UseOfflineFirstOptions<T>): UseOfflineFirstResult<T> {
  const queryClient = useQueryClient();
  const { isOnline, deviceId, queueChange } = useSyncMode();
  const [isFromCache, setIsFromCache] = useState(false);
  const [isStale, setIsStale] = useState(false);

  // Fetch function with offline fallback
  const fetchData = useCallback(async (): Promise<T[]> => {
    // If online, fetch from server
    if (isOnline) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query = (supabase as any).from(table).select(select);
        if (filter) {
          query = filter(query);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        // Cache the fresh data
        if (enableCache && data) {
          cacheEntities(table, data as unknown[]);
        }
        
        setIsFromCache(false);
        setIsStale(false);
        return (data || []) as T[];
      } catch (error) {
        console.error(`[OfflineFirst] Fetch error for ${table}:`, error);
        // Fall through to cache
      }
    }

    // Offline or fetch failed - try cache
    if (enableCache) {
      const cached = getCachedEntities<T>(table, maxCacheAge);
      if (cached) {
        setIsFromCache(true);
        setIsStale(cached.isStale);
        
        if (cached.isStale && showStaleIndicator && isOnline) {
          toast.info('Showing cached data', { 
            description: 'Data may be outdated. Pull to refresh.',
            duration: 3000,
          });
        }
        
        return cached.data;
      }
    }

    // No cache available
    if (!isOnline) {
      throw new Error('No cached data available offline');
    }
    
    throw new Error(`Failed to fetch ${table}`);
  }, [isOnline, table, select, filter, enableCache, maxCacheAge, showStaleIndicator]);

  // Use React Query with offline support
  const query = useQuery({
    queryKey,
    queryFn: fetchData,
    staleTime: maxCacheAge,
    gcTime: maxCacheAge * 2,
    retry: isOnline ? 3 : 0,
    ...queryOptions,
  });

  // Optimistic create
  const optimisticCreate = useCallback(async (item: Partial<T>): Promise<string> => {
    const id = crypto.randomUUID();
    const newItem = { ...item, id } as T;
    
    // Update cache optimistically
    queryClient.setQueryData<T[]>(queryKey, (old) => {
      return old ? [...old, newItem] : [newItem];
    });

    if (enableCache) {
      updateCachedEntity(table, newItem);
    }

    // Queue for sync if offline
    if (!isOnline) {
      addToSyncQueue({
        entityType: table,
        entityId: id,
        operation: 'create',
        payload: item as Record<string, unknown>,
        localVersion: 1,
        serverVersion: 0,
        deviceId,
      });
      toast.info('Created offline', { description: 'Will sync when online' });
      return id;
    }

    // Create on server
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from(table).insert([item]);
      if (error) throw error;
      toast.success('Created successfully');
    } catch (error) {
      // Revert and queue for retry
      queryClient.setQueryData<T[]>(queryKey, (old) => {
        return old?.filter(i => i.id !== id);
      });
      addToSyncQueue({
        entityType: table,
        entityId: id,
        operation: 'create',
        payload: item as Record<string, unknown>,
        localVersion: 1,
        serverVersion: 0,
        deviceId,
      });
      toast.error('Failed to create', { description: 'Queued for retry' });
    }

    return id;
  }, [queryClient, queryKey, table, isOnline, enableCache, deviceId]);

  // Optimistic update
  const optimisticUpdate = useCallback(async (id: string, updates: Partial<T>): Promise<void> => {
    // Get current item
    const currentData = queryClient.getQueryData<T[]>(queryKey);
    const currentItem = currentData?.find(i => i.id === id);
    
    if (!currentItem) return;

    const updatedItem = { ...currentItem, ...updates };

    // Update cache optimistically
    queryClient.setQueryData<T[]>(queryKey, (old) => {
      return old?.map(i => i.id === id ? updatedItem : i);
    });

    if (enableCache) {
      updateCachedEntity(table, updatedItem);
    }

    // Queue for sync if offline
    if (!isOnline) {
      addToSyncQueue({
        entityType: table,
        entityId: id,
        operation: 'update',
        payload: updates as Record<string, unknown>,
        localVersion: ((currentItem as Record<string, unknown>).local_version as number || 0) + 1,
        serverVersion: (currentItem as Record<string, unknown>).server_version as number || 0,
        deviceId,
      });
      toast.info('Updated offline', { description: 'Will sync when online' });
      return;
    }

    // Update on server
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from(table).update(updates).eq('id', id);
      if (error) throw error;
    } catch (error) {
      // Revert and queue for retry
      queryClient.setQueryData<T[]>(queryKey, (old) => {
        return old?.map(i => i.id === id ? currentItem : i);
      });
      addToSyncQueue({
        entityType: table,
        entityId: id,
        operation: 'update',
        payload: updates as Record<string, unknown>,
        localVersion: ((currentItem as Record<string, unknown>).local_version as number || 0) + 1,
        serverVersion: (currentItem as Record<string, unknown>).server_version as number || 0,
        deviceId,
      });
      toast.error('Failed to update', { description: 'Queued for retry' });
    }
  }, [queryClient, queryKey, table, isOnline, enableCache, deviceId]);

  // Optimistic delete
  const optimisticDelete = useCallback(async (id: string): Promise<void> => {
    // Get current item for potential revert
    const currentData = queryClient.getQueryData<T[]>(queryKey);
    const currentItem = currentData?.find(i => i.id === id);

    // Remove from cache optimistically
    queryClient.setQueryData<T[]>(queryKey, (old) => {
      return old?.filter(i => i.id !== id);
    });

    if (enableCache) {
      removeCachedEntity<T>(table, id);
    }

    // Queue for sync if offline
    if (!isOnline) {
      addToSyncQueue({
        entityType: table,
        entityId: id,
        operation: 'delete',
        payload: {},
        localVersion: 0,
        serverVersion: 0,
        deviceId,
      });
      toast.info('Deleted offline', { description: 'Will sync when online' });
      return;
    }

    // Delete on server
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      toast.success('Deleted successfully');
    } catch (error) {
      // Revert and queue for retry
      if (currentItem) {
        queryClient.setQueryData<T[]>(queryKey, (old) => {
          return old ? [...old, currentItem] : [currentItem];
        });
      }
      addToSyncQueue({
        entityType: table,
        entityId: id,
        operation: 'delete',
        payload: {},
        localVersion: 0,
        serverVersion: 0,
        deviceId,
      });
      toast.error('Failed to delete', { description: 'Queued for retry' });
    }
  }, [queryClient, queryKey, table, isOnline, enableCache, deviceId]);

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isStale,
    isFromCache,
    refetch: () => query.refetch(),
    optimisticCreate,
    optimisticUpdate,
    optimisticDelete,
  };
}

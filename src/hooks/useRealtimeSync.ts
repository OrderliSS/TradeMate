/**
 * Realtime Sync Hook
 * Subscribes to database changes and keeps local state in sync
 */

import { useEffect, useCallback, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { useSyncMode } from '@/contexts/SyncModeContext';

type TableName = 'customers' | 'purchases' | 'tasks' | 'stock_orders' | 'products';

interface RealtimeSyncOptions {
  tables: TableName[];
  onInsert?: (table: TableName, record: Record<string, unknown>) => void;
  onUpdate?: (table: TableName, record: Record<string, unknown>, oldRecord: Record<string, unknown>) => void;
  onDelete?: (table: TableName, oldRecord: Record<string, unknown>) => void;
  onConflict?: (table: TableName, record: Record<string, unknown>) => void;
  filter?: Record<TableName, string>;
  enabled?: boolean;
  showToasts?: boolean;
}

export function useRealtimeSync({
  tables,
  onInsert,
  onUpdate,
  onDelete,
  onConflict,
  filter,
  enabled = true,
  showToasts = false,
}: RealtimeSyncOptions) {
  const queryClient = useQueryClient();
  const { isEnabled: syncEnabled, isOnline, deviceId } = useSyncMode();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isSubscribedRef = useRef(false);

  // Create a stable key for tables to prevent dependency changes
  const tablesKey = useMemo(() => [...tables].sort().join('-'), [tables]);

  // Store callbacks in refs to avoid triggering re-subscriptions
  const callbacksRef = useRef({ onInsert, onUpdate, onDelete, onConflict, showToasts });
  useEffect(() => {
    callbacksRef.current = { onInsert, onUpdate, onDelete, onConflict, showToasts };
  }, [onInsert, onUpdate, onDelete, onConflict, showToasts]);

  // Store filter in ref to avoid re-subscriptions when filter object changes
  const filterRef = useRef(filter);
  useEffect(() => {
    filterRef.current = filter;
  }, [filter]);

  // Store handleChange in a ref to avoid dependency issues
  const handleChangeRef = useRef<(table: TableName, payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void>(() => {});

  // Map table names to query keys
  const getQueryKeyForTable = useCallback((table: TableName): string[] => {
    const mapping: Record<TableName, string[]> = {
      customers: ['customers'],
      purchases: ['purchases'],
      tasks: ['tasks'],
      stock_orders: ['stock-orders'],
      products: ['products'],
    };
    return mapping[table] || [table];
  }, []);

  // Handle incoming changes - defined once and stored in ref
  useEffect(() => {
    handleChangeRef.current = (table: TableName, payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;
      const callbacks = callbacksRef.current;

      // Skip changes from this device to avoid loops
      const record = (newRecord || oldRecord) as Record<string, unknown>;
      if (record?.last_modified_by === deviceId) {
        return;
      }

      // Check for conflicts (if we have pending changes for this entity)
      const localQueue = localStorage.getItem('syncQueue');
      if (localQueue) {
        const queue = JSON.parse(localQueue) as Array<{ entityType: string; entityId: string }>;
        const hasLocalChange = queue.some(
          c => c.entityType === table && c.entityId === record?.id
        );
        if (hasLocalChange && eventType === 'UPDATE') {
          callbacks.onConflict?.(table, newRecord as Record<string, unknown>);
          return;
        }
      }

      // Process the change
      switch (eventType) {
        case 'INSERT':
          callbacks.onInsert?.(table, newRecord as Record<string, unknown>);
          if (callbacks.showToasts) {
            toast.info(`New ${table.slice(0, -1)} added`);
          }
          break;

        case 'UPDATE':
          callbacks.onUpdate?.(
            table,
            newRecord as Record<string, unknown>,
            oldRecord as Record<string, unknown>
          );
          break;

        case 'DELETE':
          callbacks.onDelete?.(table, oldRecord as Record<string, unknown>);
          if (callbacks.showToasts) {
            toast.info(`${table.slice(0, -1)} deleted`);
          }
          break;
      }

      // Invalidate relevant queries
      const queryKey = getQueryKeyForTable(table);
      queryClient.invalidateQueries({ queryKey });
    };
  }, [queryClient, getQueryKeyForTable, deviceId]);

  // Set up subscriptions - use stable tablesKey to prevent re-subscriptions
  useEffect(() => {
    if (!enabled || !syncEnabled || !isOnline) {
      // Clean up existing subscription
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isSubscribedRef.current = false;
      }
      return;
    }

    // Prevent re-subscription if already connected
    if (isSubscribedRef.current && channelRef.current) {
      return;
    }

    // Create a stable channel name using memoized tablesKey
    const channelName = `realtime-sync-${tablesKey}`;
    
    // Parse tables from the key for subscription
    const tableList = tablesKey.split('-') as TableName[];
    
    // Create the channel
    let channel = supabase.channel(channelName);

    // Subscribe to each table
    tableList.forEach((table) => {
      const tableFilter = filterRef.current?.[table];
      
      channel = channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          ...(tableFilter ? { filter: tableFilter } : {}),
        },
        (payload) => handleChangeRef.current(table, payload)
      );
    });

    // Subscribe to the channel
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        isSubscribedRef.current = true;
        console.log('[RealtimeSync] Subscribed to:', tableList);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        isSubscribedRef.current = false;
        console.error('[RealtimeSync] Subscription error:', status);
      }
    });

    channelRef.current = channel;

    // Cleanup on unmount or dependency change
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        isSubscribedRef.current = false;
      }
    };
  }, [enabled, syncEnabled, isOnline, tablesKey]);

  // Return subscription state
  return {
    isSubscribed: isSubscribedRef.current,
    reconnect: useCallback(() => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current.subscribe();
      }
    }, []),
  };
}

/**
 * Hook for syncing a specific entity type
 */
export function useEntityRealtimeSync<T extends Record<string, unknown>>(
  table: TableName,
  options?: {
    filter?: string;
    onUpdate?: (record: T) => void;
    enabled?: boolean;
  }
) {
  const queryClient = useQueryClient();

  return useRealtimeSync({
    tables: [table],
    filter: options?.filter ? { [table]: options.filter } as Record<TableName, string> : undefined,
    enabled: options?.enabled,
    onUpdate: (_, record) => {
      options?.onUpdate?.(record as T);
    },
    onInsert: () => {
      queryClient.invalidateQueries({ queryKey: [table] });
    },
    onDelete: () => {
      queryClient.invalidateQueries({ queryKey: [table] });
    },
  });
}

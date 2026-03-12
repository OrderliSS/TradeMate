/**
 * Global Real-Time Subscriptions Hook (Phase 2)
 * 
 * Centralized real-time subscription manager that runs at app root level
 * and processes database changes through the unified event pipeline.
 * 
 * Features:
 * - Unified event processing with deduplication
 * - Connection state management with fallback polling
 * - Automatic catch-up sync on reconnection
 * - Organization-scoped subscriptions for security
 */

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { logger } from '@/lib/logger';
import { 
  realtimeEventProcessor, 
  connectionStateManager,
  type RealtimeEvent 
} from '@/lib/realtime';

// Tables to subscribe to
const REALTIME_TABLES = [
  { name: 'purchases', queryKeys: ['purchases', 'dashboard-stats', 'purchase-order-metrics', 'operations-queue', 'customers-with-stats', 'purchase-orders', 'recent-purchases'] },
  { name: 'tasks', queryKeys: ['tasks', 'task-stats', 'reminders', 'dashboard-stats'] },
  { name: 'customers', queryKeys: ['customers', 'customers-with-stats', 'dashboard-stats'] },
  { name: 'products', queryKeys: ['products', 'sot-metrics', 'product-stock-summary', 'inventory', 'dashboard-stats'] },
  { name: 'asset_management', queryKeys: ['asset-management', 'unified-asset-metrics', 'sot-metrics', 'assets', 'all-assets'] },
  { name: 'allocations_v2', queryKeys: ['allocations', 'sot-metrics', 'available-assets'] },
  { name: 'stock_orders', queryKeys: ['stock-orders', 'sot-metrics', 'dashboard-stats'] },
  { name: 'appointments', queryKeys: ['appointments', 'calendar-events', 'reminders'] },
  { name: 'stock_order_shipments', queryKeys: ['stock-order-shipments', 'all-tracking-data', 'package-records', 'shipment-records'] },
] as const;

export const useGlobalRealtimeSubscriptions = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Safely try to get organization context (may be unavailable on unconfigured database)
  let currentOrganization: { id: string } | null = null;
  try {
    const orgContext = useOrganization();
    currentOrganization = orgContext.currentOrganization;
  } catch (err) {
    // OrganizationProvider may have errored during initialization
    // Continue without org context - will use user-scoped channel
    console.warn('[GlobalRealtime] OrganizationContext unavailable, using user-scoped channel', err);
  }
  
  const currentOrganizationId = currentOrganization?.id ?? null;
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isSubscribedRef = useRef(false);

  // Store callbacks in refs to prevent re-subscriptions
  const invalidateForTableRef = useRef((tableName: string) => {
    const tableConfig = REALTIME_TABLES.find(t => t.name === tableName);
    if (tableConfig) {
      tableConfig.queryKeys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
    }
  });

  // Update ref when queryClient changes
  useEffect(() => {
    invalidateForTableRef.current = (tableName: string) => {
      const tableConfig = REALTIME_TABLES.find(t => t.name === tableName);
      if (tableConfig) {
        tableConfig.queryKeys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      }
    };
  }, [queryClient]);

  // Handle incoming postgres changes - stored in ref
  const handlePostgresChangeRef = useRef((payload: any) => {
    const event: RealtimeEvent = {
      eventType: payload.eventType,
      table: payload.table,
      schema: payload.schema,
      new: payload.new,
      old: payload.old,
      commit_timestamp: payload.commit_timestamp,
    };

    logger.debug('[GlobalRealtime] Received change', { 
      table: event.table, 
      eventType: event.eventType,
      entityId: (event.new as any)?.id || (event.old as any)?.id,
    });

    // Process through unified pipeline
    const processed = realtimeEventProcessor.process(event);

    // If not skipped, invalidate relevant queries
    if (!processed.skipped) {
      invalidateForTableRef.current(event.table);
    } else {
      logger.debug('[GlobalRealtime] Event skipped', { 
        reason: processed.skipReason,
        entityType: processed.entityType,
        entityId: processed.entityId,
      });
    }
  });

  // Fallback polling function - stored in ref
  const performPollingSyncRef = useRef(async () => {
    logger.debug('[GlobalRealtime] Performing fallback polling sync', {});
    
    // Invalidate key queries to refresh data
    const criticalKeys = ['purchases', 'tasks', 'customers', 'dashboard-stats'];
    criticalKeys.forEach(key => {
      queryClient.invalidateQueries({ queryKey: [key] });
    });
  });

  // Catch-up sync function - stored in ref
  const performCatchUpSyncRef = useRef(async (lastSyncTimestamp: number) => {
    logger.info('[GlobalRealtime] Performing catch-up sync', { 
      lastSyncTimestamp,
      timeSinceSync: Date.now() - lastSyncTimestamp,
    });

    // For catch-up, invalidate all realtime-affected queries
    REALTIME_TABLES.forEach(table => {
      table.queryKeys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
    });
  });

  // Update refs when queryClient changes
  useEffect(() => {
    performPollingSyncRef.current = async () => {
      logger.debug('[GlobalRealtime] Performing fallback polling sync', {});
      const criticalKeys = ['purchases', 'tasks', 'customers', 'dashboard-stats'];
      criticalKeys.forEach(key => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
    };
    
    performCatchUpSyncRef.current = async (lastSyncTimestamp: number) => {
      logger.info('[GlobalRealtime] Performing catch-up sync', { 
        lastSyncTimestamp,
        timeSinceSync: Date.now() - lastSyncTimestamp,
      });
      REALTIME_TABLES.forEach(table => {
        table.queryKeys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      });
    };
  }, [queryClient]);

  useEffect(() => {
    // Only set up subscriptions if user is authenticated
    if (!user) {
      return;
    }

    // Prevent duplicate subscriptions
    if (isSubscribedRef.current) {
      return;
    }

    logger.debug('[GlobalRealtime] Setting up real-time subscriptions', {
      userId: user.id,
      organizationId: currentOrganization?.id,
    });

    // Set up connection state callbacks using refs
    connectionStateManager.setPollingCallback(() => performPollingSyncRef.current());
    const unsubscribeCatchUp = connectionStateManager.onCatchUp((ts) => performCatchUpSyncRef.current(ts));

    // Create single channel for all table subscriptions
    const channelName = currentOrganization 
      ? `org-${currentOrganization.id}-realtime`
      : `user-${user.id}-realtime`;

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false }, // Don't receive our own broadcasts
        presence: { key: user.id },
      },
    });

    // Subscribe to each table
    REALTIME_TABLES.forEach(({ name }) => {
      channel.on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: name,
          // Filter by organization if available (requires RLS)
          // Exclude tables that don't have organization_id column
          ...(currentOrganization && !['products', 'tasks', 'allocations_v2'].includes(name)
            ? { filter: `organization_id=eq.${currentOrganization.id}` }
            : {}),
        },
        (payload) => handlePostgresChangeRef.current(payload)
      );
    });

    // Handle channel state changes
    channel.subscribe((status, error) => {
      if (status === 'SUBSCRIBED') {
        logger.info('[GlobalRealtime] Channel status changed', { status });
      } else {
        logger.debug('[GlobalRealtime] Channel status changed', { status, error });
      }
      
      switch (status) {
        case 'SUBSCRIBED':
          connectionStateManager.setStatus('connected');
          isSubscribedRef.current = true;
          break;
        case 'CHANNEL_ERROR':
          connectionStateManager.setStatus('error');
          break;
        case 'TIMED_OUT':
          connectionStateManager.setStatus('disconnected');
          break;
        case 'CLOSED':
          connectionStateManager.setStatus('disconnected');
          isSubscribedRef.current = false;
          break;
      }
    });

    channelRef.current = channel;
    connectionStateManager.setStatus('connecting');

    logger.debug('[GlobalRealtime] Real-time channel configured', {
      channelName,
      tables: REALTIME_TABLES.map(t => t.name),
    });

    // Cleanup function
    return () => {
      logger.debug('[GlobalRealtime] Cleaning up real-time subscriptions', {});
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      isSubscribedRef.current = false;
      unsubscribeCatchUp();
    };
  }, [user, currentOrganizationId]);

  // Return connection status for UI indicators if needed
  return {
    isConnected: connectionStateManager.isConnected(),
    isPolling: connectionStateManager.isPolling(),
    getStatus: () => connectionStateManager.getStatus(),
  };
};

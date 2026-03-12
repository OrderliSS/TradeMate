/**
 * Realtime Queue Counts Hook
 * 
 * Provides live queue counts that update via delta-based events
 * rather than full refetches. Falls back to query invalidation
 * when feature flag is disabled.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useEventBusMultiple, EventPayload } from '@/lib/event-bus';
import {
  QueueCounts,
  PurchaseEventPayload,
  ticketQueueReducer,
  getInitialQueueCounts,
} from '@/lib/realtime/metrics-reducer';
import { useOperationsQueue } from './useOperationsQueue';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentOrganizationId } from './useOrganization';

// Feature flag - enable delta-based updates
const ENABLE_REALTIME_DELTAS = true;

export interface UseRealtimeQueueCountsResult {
  counts: QueueCounts;
  isLoading: boolean;
  error: Error | null;
  lastUpdated: Date | null;
}

export function useRealtimeQueueCounts(): UseRealtimeQueueCountsResult {
  const queryClient = useQueryClient();
  const { data: queue, isLoading, error } = useOperationsQueue();
  const orgId = useCurrentOrganizationId();

  // Separate query for sold/complete count (since main queue excludes them)
  const { data: soldCount } = useQuery({
    queryKey: ['sold-count', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('purchases')
        .select('*', { count: 'exact', head: true })
        .eq('order_status', 'complete')
        .eq('organization_id', orgId);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60000,
  });

  // Track last updated time for UI feedback
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Store counts with delta updates
  const [counts, setCounts] = useState<QueueCounts>(getInitialQueueCounts());
  const initializedRef = useRef(false);

  // Sync counts from query data when it changes
  useEffect(() => {
    if (queue && !isLoading) {
      const newCounts: QueueCounts = {
        orderedCount: queue.filter(item => item.order_status === 'ordered').length,
        configuringCount: queue.filter(item => item.order_status === 'configuring').length,
        pendingAllocationCount: queue.filter(item => item.allocation_status === 'pending_allocation').length,
        noCaseCount: 0,
        soldCount: soldCount ?? 0,
        total: queue.length,
      };
      setCounts(newCounts);
      initializedRef.current = true;
    }
  }, [queue, isLoading, soldCount]);

  // Handle purchase events with delta updates
  const handlePurchaseEvent = useCallback((payload: EventPayload & { eventType: string }) => {
    if (!ENABLE_REALTIME_DELTAS || !initializedRef.current) {
      queryClient.invalidateQueries({ queryKey: ['operations-queue', orgId] });
      queryClient.invalidateQueries({ queryKey: ['sold-count', orgId] });
      return;
    }

    const { eventType } = payload;
    let action: 'created' | 'updated' | 'deleted' = 'updated';

    if (eventType === 'purchase.created') action = 'created';
    else if (eventType === 'purchase.deleted') action = 'deleted';
    else if (eventType === 'purchase.updated' || eventType === 'purchase.status_changed') action = 'updated';

    setCounts(prevCounts => {
      const newCounts = ticketQueueReducer(prevCounts, action, payload as PurchaseEventPayload);
      return newCounts;
    });

    setLastUpdated(new Date());

    queryClient.invalidateQueries({
      queryKey: ['operations-queue', orgId],
      refetchType: 'none',
    });
    queryClient.invalidateQueries({
      queryKey: ['sold-count', orgId],
      refetchType: 'none',
    });
  }, [queryClient, orgId]);

  // Subscribe to purchase events
  useEventBusMultiple(
    [
      'purchase.created',
      'purchase.updated',
      'purchase.deleted',
      'purchase.status_changed',
    ],
    handlePurchaseEvent,
    []
  );

  return {
    counts,
    isLoading,
    error: error as Error | null,
    lastUpdated,
  };
}

// Hook for animating count changes
export function useAnimatedCount(value: number, duration: number = 300): number {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);

  useEffect(() => {
    if (value === previousValue.current) return;

    const startValue = previousValue.current;
    const diff = value - startValue;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.round(startValue + diff * easeProgress);

      setDisplayValue(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        previousValue.current = value;
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return displayValue;
}

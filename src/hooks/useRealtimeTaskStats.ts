/**
 * Realtime Task Stats Hook
 * 
 * Provides live task statistics that update via delta-based events
 * rather than full refetches. Falls back to query invalidation
 * when feature flag is disabled.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useEventBusMultiple, EventPayload } from '@/lib/event-bus';
import {
  TaskStats,
  TaskEventPayload,
  taskStatsReducer,
  getInitialTaskStats,
} from '@/lib/realtime/metrics-reducer';
import { useTaskStats } from './useTasks';

// Feature flag - enable delta-based updates
const ENABLE_REALTIME_DELTAS = true;

export interface UseRealtimeTaskStatsResult {
  stats: TaskStats;
  isLoading: boolean;
  error: Error | null;
  lastUpdated: Date | null;
}

export function useRealtimeTaskStats(): UseRealtimeTaskStatsResult {
  const queryClient = useQueryClient();
  const { data: queryStats, isLoading, error } = useTaskStats();
  
  // Track last updated time for UI feedback
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Store stats with delta updates
  const [stats, setStats] = useState<TaskStats>(getInitialTaskStats());
  const initializedRef = useRef(false);
  
  // Sync stats from query data when it changes
  useEffect(() => {
    if (queryStats && !isLoading) {
      setStats({
        pendingCases: queryStats.pendingCases,
        pendingTasks: queryStats.pendingTasks,
        overdueTasks: queryStats.overdueTasks,
        dueTodayTasks: queryStats.dueTodayTasks,
      });
      initializedRef.current = true;
    }
  }, [queryStats, isLoading]);
  
  // Handle task events with delta updates
  const handleTaskEvent = useCallback((payload: EventPayload & { eventType: string }) => {
    if (!ENABLE_REALTIME_DELTAS || !initializedRef.current) {
      // Fall back to query invalidation
      queryClient.invalidateQueries({ queryKey: ['task-stats'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      return;
    }
    
    const { eventType } = payload;
    let action: 'created' | 'updated' | 'deleted' | 'completed' = 'updated';
    
    if (eventType === 'task.created') action = 'created';
    else if (eventType === 'task.deleted') action = 'deleted';
    else if (eventType === 'task.completed') action = 'completed';
    else if (eventType === 'task.updated' || eventType === 'task.archived') action = 'updated';
    
    // Enhance payload with parent task detection
    const enhancedPayload: TaskEventPayload = {
      ...payload,
      metadata: {
        ...payload.metadata,
        isParentTask: (payload.changes as any)?.parent_task_id === null,
      },
    };
    
    setStats(prevStats => {
      const newStats = taskStatsReducer(prevStats, action, enhancedPayload);
      return newStats;
    });
    
    setLastUpdated(new Date());
    
    // Also trigger a background refetch to ensure eventual consistency
    queryClient.invalidateQueries({ 
      queryKey: ['task-stats'],
      refetchType: 'none', // Don't refetch immediately
    });
  }, [queryClient]);
  
  // Subscribe to task events
  useEventBusMultiple(
    [
      'task.created',
      'task.updated',
      'task.deleted',
      'task.completed',
      'task.archived',
    ],
    handleTaskEvent,
    []
  );
  
  return {
    stats,
    isLoading,
    error: error as Error | null,
    lastUpdated,
  };
}

// Convenience hook for individual stat values
export function useRealtimePendingCases(): { count: number; isLoading: boolean } {
  const { stats, isLoading } = useRealtimeTaskStats();
  return { count: stats.pendingCases, isLoading };
}

export function useRealtimePendingTasks(): { count: number; isLoading: boolean } {
  const { stats, isLoading } = useRealtimeTaskStats();
  return { count: stats.pendingTasks, isLoading };
}

export function useRealtimeOverdueTasks(): { count: number; isLoading: boolean } {
  const { stats, isLoading } = useRealtimeTaskStats();
  return { count: stats.overdueTasks, isLoading };
}

export function useRealtimeDueTodayTasks(): { count: number; isLoading: boolean } {
  const { stats, isLoading } = useRealtimeTaskStats();
  return { count: stats.dueTodayTasks, isLoading };
}

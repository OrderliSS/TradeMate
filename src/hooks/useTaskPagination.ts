import { useState, useMemo, useCallback } from 'react';
import type { TaskWithCustomer } from '@/types/database';

interface PaginationConfig {
  initialPageSize: number;
  loadMoreSize: number;
}

const DEFAULT_CONFIG: PaginationConfig = {
  initialPageSize: 30,
  loadMoreSize: 30,
};

/**
 * Progressive loading hook for large task lists
 * Implements pagination to improve initial render performance
 */
export function useTaskPagination(
  allTasks: TaskWithCustomer[],
  config: Partial<PaginationConfig> = {}
) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const [displayCount, setDisplayCount] = useState(mergedConfig.initialPageSize);

  // Reset display count when tasks change significantly
  const visibleTasks = useMemo(() => {
    return allTasks.slice(0, Math.min(displayCount, allTasks.length));
  }, [allTasks, displayCount]);

  const hasMore = displayCount < allTasks.length;

  const loadMore = useCallback(() => {
    setDisplayCount(prev => 
      Math.min(prev + mergedConfig.loadMoreSize, allTasks.length)
    );
  }, [allTasks.length, mergedConfig.loadMoreSize]);

  const loadAll = useCallback(() => {
    setDisplayCount(allTasks.length);
  }, [allTasks.length]);

  const reset = useCallback(() => {
    setDisplayCount(mergedConfig.initialPageSize);
  }, [mergedConfig.initialPageSize]);

  return {
    visibleTasks,
    hasMore,
    loadMore,
    loadAll,
    reset,
    displayedCount: visibleTasks.length,
    totalCount: allTasks.length,
  };
}

import { useMemo } from 'react';
import { useDebouncedValue } from './useDebouncedValue';
import { filterTasks } from '@/lib/task-filter-utils';
import { sortTasks } from '@/lib/task-sorting-utils';
import type { TaskWithCustomer } from '@/types/database';

import type { TaskFilters } from './useTaskFilters';
import type { SortConfig } from './useTaskSorting';

/**
 * Optimized task filtering with debounced search
 * Prevents expensive filter operations on every keystroke
 */
export function useOptimizedTaskFiltering(
  tasks: TaskWithCustomer[],
  filters: TaskFilters,
  sortConfig: SortConfig
) {
  // Debounce search to reduce filter calls
  const debouncedSearch = useDebouncedValue(filters.search, 300);

  // Memoize filtering and sorting
  const filteredAndSortedTasks = useMemo(() => {
    // Use debounced search value
    const filterWithDebouncedSearch: TaskFilters = {
      ...filters,
      search: debouncedSearch,
    };

    // Apply filters
    const filtered = filterTasks(tasks, filterWithDebouncedSearch);
    
    // Apply sorting
    return sortTasks(filtered, sortConfig);
  }, [tasks, debouncedSearch, filters.status, filters.priority, filters.taskType, 
      filters.dateRange, filters.hasCustomer, filters.hasPurchaseOrder, sortConfig]);

  return filteredAndSortedTasks;
}

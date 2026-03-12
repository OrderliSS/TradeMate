import { useState, useEffect, useMemo } from 'react';

export type SortField = 'priority' | 'due_date' | 'follow_up_date' | 'created_at' | 'customer' | 'status' | 'task_number';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

const STORAGE_KEY = 'taskSortConfig';

const DEFAULT_SORT: SortConfig = {
  field: 'due_date',
  direction: 'asc',
};

export const useTaskSorting = () => {
  const [sortConfig, setSortConfig] = useState<SortConfig>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return DEFAULT_SORT;
      }
    }
    return DEFAULT_SORT;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sortConfig));
  }, [sortConfig]);

  const updateSort = (field: SortField, direction?: SortDirection) => {
    setSortConfig({
      field,
      direction: direction || sortConfig.direction,
    });
  };

  const toggleDirection = () => {
    setSortConfig((prev) => ({
      ...prev,
      direction: prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const resetSort = () => {
    setSortConfig(DEFAULT_SORT);
  };

  return {
    sortConfig,
    updateSort,
    toggleDirection,
    resetSort,
  };
};

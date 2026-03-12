import { useState, useEffect } from 'react';

export interface TaskFilters {
  search: string;
  status: string[];
  priority: string[];
  taskType: string[];
  dateRange: {
    from?: Date;
    to?: Date;
  };
  hasCustomer: boolean | null;
  hasPurchaseOrder: boolean | null;
}

const DEFAULT_FILTERS: TaskFilters = {
  search: '',
  status: [],
  priority: [],
  taskType: [],
  dateRange: {},
  hasCustomer: null,
  hasPurchaseOrder: null,
};

export const useTaskFilters = () => {
  const [filters, setFilters] = useState<TaskFilters>(() => {
    const saved = localStorage.getItem('taskFilters');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_FILTERS,
          ...parsed,
          dateRange: parsed.dateRange || {},
        };
      } catch {
        return DEFAULT_FILTERS;
      }
    }
    return DEFAULT_FILTERS;
  });

  useEffect(() => {
    localStorage.setItem('taskFilters', JSON.stringify(filters));
  }, [filters]);

  const updateFilter = <K extends keyof TaskFilters>(
    key: K,
    value: TaskFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleArrayFilter = <K extends keyof TaskFilters>(
    key: K,
    value: string
  ) => {
    setFilters(prev => {
      const currentArray = prev[key] as string[];
      const newArray = currentArray.includes(value)
        ? currentArray.filter(v => v !== value)
        : [...currentArray, value];
      return { ...prev, [key]: newArray };
    });
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const hasActiveFilters = () => {
    return (
      filters.search !== '' ||
      filters.status.length > 0 ||
      filters.priority.length > 0 ||
      filters.taskType.length > 0 ||
      filters.dateRange.from !== undefined ||
      filters.dateRange.to !== undefined ||
      filters.hasCustomer !== null ||
      filters.hasPurchaseOrder !== null
    );
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.search) count++;
    if (filters.status.length > 0) count += filters.status.length;
    if (filters.priority.length > 0) count += filters.priority.length;
    if (filters.taskType.length > 0) count += filters.taskType.length;
    if (filters.dateRange.from || filters.dateRange.to) count++;
    if (filters.hasCustomer !== null) count++;
    if (filters.hasPurchaseOrder !== null) count++;
    return count;
  };

  return {
    filters,
    updateFilter,
    toggleArrayFilter,
    clearFilters,
    hasActiveFilters,
    getActiveFilterCount,
  };
};

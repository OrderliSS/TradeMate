import { useState, useEffect, useCallback } from 'react';

export type OperationsQueueSortField = 'created_at' | 'customer' | 'status' | 'amount';
export type SortDirection = 'asc' | 'desc';
export type OperationsViewMode = 'cards' | 'compact' | 'table';

export interface OperationsQueueFilters {
  search: string;
  statuses: string[];
  allocations: string[];
}

export interface OperationsQueueSortConfig {
  field: OperationsQueueSortField;
  direction: SortDirection;
}

const STORAGE_KEY = 'operations-queue-filters';

const defaultFilters: OperationsQueueFilters = {
  search: '',
  statuses: [],
  allocations: [],
};

const defaultSort: OperationsQueueSortConfig = {
  field: 'created_at',
  direction: 'desc',
};

export const useOperationsQueueFilters = () => {
  const [filters, setFilters] = useState<OperationsQueueFilters>(defaultFilters);
  const [sortConfig, setSortConfig] = useState<OperationsQueueSortConfig>(defaultSort);
  const [viewMode, setViewMode] = useState<OperationsViewMode>('cards');

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.sortConfig) setSortConfig(parsed.sortConfig);
        if (parsed.viewMode) setViewMode(parsed.viewMode);
      }
    } catch (e) {
      console.error('Failed to load operations queue filters', e);
    }
  }, []);

  // Save to localStorage when sort or view changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sortConfig, viewMode }));
    } catch (e) {
      console.error('Failed to save operations queue filters', e);
    }
  }, [sortConfig, viewMode]);

  const updateSearch = useCallback((search: string) => {
    setFilters(prev => ({ ...prev, search }));
  }, []);

  const toggleStatus = useCallback((status: string) => {
    setFilters(prev => ({
      ...prev,
      statuses: prev.statuses.includes(status)
        ? prev.statuses.filter(s => s !== status)
        : [...prev.statuses, status],
    }));
  }, []);

  const toggleAllocation = useCallback((allocation: string) => {
    setFilters(prev => ({
      ...prev,
      allocations: prev.allocations.includes(allocation)
        ? prev.allocations.filter(a => a !== allocation)
        : [...prev.allocations, allocation],
    }));
  }, []);

  const updateSort = useCallback((field: OperationsQueueSortField) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const toggleDirection = useCallback(() => {
    setSortConfig(prev => ({
      ...prev,
      direction: prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
    setSortConfig(defaultSort);
  }, []);

  const hasActiveFilters = filters.search !== '' || filters.statuses.length > 0 || filters.allocations.length > 0;

  return {
    filters,
    sortConfig,
    viewMode,
    updateSearch,
    toggleStatus,
    toggleAllocation,
    updateSort,
    toggleDirection,
    setViewMode,
    resetFilters,
    hasActiveFilters,
  };
};

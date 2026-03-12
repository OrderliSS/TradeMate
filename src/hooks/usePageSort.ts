import { useState, useCallback, useEffect } from 'react';

export interface SortConfig {
  field: string;
  direction: 'asc' | 'desc';
}

export interface UsePageSortOptions {
  pageKey: string;
  defaultField: string;
  defaultDirection?: 'asc' | 'desc';
}

export interface UsePageSortReturn {
  sortField: string;
  sortDirection: 'asc' | 'desc';
  updateSort: (field: string, direction: 'asc' | 'desc') => void;
  toggleDirection: () => void;
  resetSort: () => void;
  isActive: boolean;
}

export const usePageSort = ({
  pageKey,
  defaultField,
  defaultDirection = 'desc'
}: UsePageSortOptions): UsePageSortReturn => {
  const storageKey = `${pageKey}_sortConfig`;

  // Initialize from localStorage or defaults
  const [sortField, setSortField] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.field || defaultField;
      }
    } catch (e) {
      console.error('Error loading sort config:', e);
    }
    return defaultField;
  });

  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.direction || defaultDirection;
      }
    } catch (e) {
      console.error('Error loading sort config:', e);
    }
    return defaultDirection;
  });

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        field: sortField,
        direction: sortDirection
      }));
    } catch (e) {
      console.error('Error saving sort config:', e);
    }
  }, [sortField, sortDirection, storageKey]);

  const updateSort = useCallback((field: string, direction: 'asc' | 'desc') => {
    setSortField(field);
    setSortDirection(direction);
  }, []);

  const toggleDirection = useCallback(() => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  }, []);

  const resetSort = useCallback(() => {
    setSortField(defaultField);
    setSortDirection(defaultDirection);
  }, [defaultField, defaultDirection]);

  const isActive = sortField !== defaultField || sortDirection !== defaultDirection;

  return {
    sortField,
    sortDirection,
    updateSort,
    toggleDirection,
    resetSort,
    isActive
  };
};

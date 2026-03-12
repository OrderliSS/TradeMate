import { useState, useCallback, useEffect } from 'react';
import { STORAGE_KEYS } from '@/lib/storage-keys';

export type RemindersSortField = 'due_date' | 'priority' | 'customer' | 'created_at';
export type SortDirection = 'asc' | 'desc';
export type RemindersViewMode = 'sections' | 'list' | 'compact';

export interface RemindersFilters {
  search: string;
  statuses: string[];
  priorities: string[];
}

export interface RemindersSortConfig {
  field: RemindersSortField;
  direction: SortDirection;
}

interface RemindersPreferences {
  sortConfig: RemindersSortConfig;
  viewMode: RemindersViewMode;
}

const STORAGE_KEY = STORAGE_KEYS.page.reminders.filters;

const defaultFilters: RemindersFilters = {
  search: '',
  statuses: [],
  priorities: [],
};

const defaultPreferences: RemindersPreferences = {
  sortConfig: {
    field: 'due_date',
    direction: 'asc',
  },
  viewMode: 'sections',
};

// Load preferences helper
const loadPreferences = (): RemindersPreferences => {
  if (typeof window === 'undefined') return defaultPreferences;
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const prefs = parsed?.value ?? parsed;
      return {
        sortConfig: prefs.sortConfig ?? defaultPreferences.sortConfig,
        viewMode: prefs.viewMode ?? defaultPreferences.viewMode,
      };
    }
  } catch (e) {
    console.error('Failed to load reminders filters', e);
  }
  return defaultPreferences;
};

// Save preferences helper
const savePreferences = (prefs: RemindersPreferences) => {
  try {
    const toStore = { value: prefs, timestamp: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch (e) {
    console.error('Failed to save reminders filters', e);
  }
};

export const useRemindersFilters = () => {
  const [filters, setFilters] = useState<RemindersFilters>(defaultFilters);
  const [preferences, setPreferences] = useState<RemindersPreferences>(loadPreferences);

  const { sortConfig, viewMode } = preferences;

  // Persist to localStorage when preferences change
  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

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

  const togglePriority = useCallback((priority: string) => {
    setFilters(prev => ({
      ...prev,
      priorities: prev.priorities.includes(priority)
        ? prev.priorities.filter(p => p !== priority)
        : [...prev.priorities, priority],
    }));
  }, []);

  const updateSort = useCallback((field: RemindersSortField) => {
    setPreferences(prev => ({
      ...prev,
      sortConfig: {
        field,
        direction: prev.sortConfig.field === field && prev.sortConfig.direction === 'asc' ? 'desc' : 'asc',
      },
    }));
  }, []);

  const toggleDirection = useCallback(() => {
    setPreferences(prev => ({
      ...prev,
      sortConfig: {
        ...prev.sortConfig,
        direction: prev.sortConfig.direction === 'asc' ? 'desc' : 'asc',
      },
    }));
  }, []);

  const setViewMode = useCallback((mode: RemindersViewMode) => {
    setPreferences(prev => ({ ...prev, viewMode: mode }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
    setPreferences(defaultPreferences);
  }, []);

  const hasActiveFilters = filters.search !== '' || filters.statuses.length > 0 || filters.priorities.length > 0;

  return {
    filters,
    sortConfig,
    viewMode,
    updateSearch,
    toggleStatus,
    togglePriority,
    updateSort,
    toggleDirection,
    setViewMode,
    resetFilters,
    hasActiveFilters,
  };
};

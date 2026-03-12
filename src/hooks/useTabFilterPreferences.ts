import { useState, useCallback, useEffect } from 'react';
import { STORAGE_KEYS } from '@/lib/storage-keys';

const STORAGE_KEY = STORAGE_KEYS.page.tabFilters;
const SYSTEM_DEFAULT_STATUSES = ['active'];

interface TabFilterPreferencesState {
  casesDefaultStatuses: string[] | null;  // null = no user default (use system)
  tasksDefaultStatuses: string[] | null;
}

const defaultPreferences: TabFilterPreferencesState = {
  casesDefaultStatuses: null,
  tasksDefaultStatuses: null,
};

// Load preferences helper
const loadPreferences = (): TabFilterPreferencesState => {
  if (typeof window === 'undefined') return defaultPreferences;
  
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed?.value ?? parsed ?? defaultPreferences;
    }
  } catch (e) {
    console.error('Failed to load tab filter preferences:', e);
  }
  return defaultPreferences;
};

// Save preferences helper
const savePreferences = (prefs: TabFilterPreferencesState) => {
  try {
    const toStore = { value: prefs, timestamp: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch (e) {
    console.error('Failed to save tab filter preferences:', e);
  }
};

export const useTabFilterPreferences = () => {
  const [preferences, setPreferencesState] = useState<TabFilterPreferencesState>(loadPreferences);
  
  // Current session statuses (initialized from defaults)
  const [casesCurrentStatuses, setCasesCurrentStatuses] = useState<string[]>(
    () => preferences.casesDefaultStatuses ?? SYSTEM_DEFAULT_STATUSES
  );
  const [tasksCurrentStatuses, setTasksCurrentStatuses] = useState<string[]>(
    () => preferences.tasksDefaultStatuses ?? SYSTEM_DEFAULT_STATUSES
  );

  // Persist preferences when they change
  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  // Cases tab functions
  const updateCasesStatus = useCallback((statuses: string[]) => {
    setCasesCurrentStatuses(statuses);
  }, []);

  const toggleCasesStatus = useCallback((status: string) => {
    setCasesCurrentStatuses(prev => {
      if (prev.includes(status)) {
        // Don't allow removing the last status
        if (prev.length === 1) return prev;
        return prev.filter(s => s !== status);
      }
      return [...prev, status];
    });
  }, []);

  const setCasesDefaultStatus = useCallback(() => {
    setPreferencesState(prev => ({
      ...prev,
      casesDefaultStatuses: [...casesCurrentStatuses],
    }));
  }, [casesCurrentStatuses]);

  const resetCasesToDefault = useCallback(() => {
    const defaultStatuses = preferences.casesDefaultStatuses ?? SYSTEM_DEFAULT_STATUSES;
    setCasesCurrentStatuses(defaultStatuses);
  }, [preferences.casesDefaultStatuses]);

  const resetCasesToSystemDefault = useCallback(() => {
    setPreferencesState(prev => ({
      ...prev,
      casesDefaultStatuses: null,
    }));
    setCasesCurrentStatuses(SYSTEM_DEFAULT_STATUSES);
  }, []);

  // Tasks tab functions
  const updateTasksStatus = useCallback((statuses: string[]) => {
    setTasksCurrentStatuses(statuses);
  }, []);

  const toggleTasksStatus = useCallback((status: string) => {
    setTasksCurrentStatuses(prev => {
      if (prev.includes(status)) {
        // Don't allow removing the last status
        if (prev.length === 1) return prev;
        return prev.filter(s => s !== status);
      }
      return [...prev, status];
    });
  }, []);

  const setTasksDefaultStatus = useCallback(() => {
    setPreferencesState(prev => ({
      ...prev,
      tasksDefaultStatuses: [...tasksCurrentStatuses],
    }));
  }, [tasksCurrentStatuses]);

  const resetTasksToDefault = useCallback(() => {
    const defaultStatuses = preferences.tasksDefaultStatuses ?? SYSTEM_DEFAULT_STATUSES;
    setTasksCurrentStatuses(defaultStatuses);
  }, [preferences.tasksDefaultStatuses]);

  const resetTasksToSystemDefault = useCallback(() => {
    setPreferencesState(prev => ({
      ...prev,
      tasksDefaultStatuses: null,
    }));
    setTasksCurrentStatuses(SYSTEM_DEFAULT_STATUSES);
  }, []);

  // Helper functions
  const hasCasesUserDefault = preferences.casesDefaultStatuses !== null;
  const hasTasksUserDefault = preferences.tasksDefaultStatuses !== null;

  const isCasesCurrentDefault = useCallback(() => {
    const defaultStatuses = preferences.casesDefaultStatuses ?? SYSTEM_DEFAULT_STATUSES;
    if (casesCurrentStatuses.length !== defaultStatuses.length) return false;
    return casesCurrentStatuses.every(s => defaultStatuses.includes(s));
  }, [casesCurrentStatuses, preferences.casesDefaultStatuses]);

  const isTasksCurrentDefault = useCallback(() => {
    const defaultStatuses = preferences.tasksDefaultStatuses ?? SYSTEM_DEFAULT_STATUSES;
    if (tasksCurrentStatuses.length !== defaultStatuses.length) return false;
    return tasksCurrentStatuses.every(s => defaultStatuses.includes(s));
  }, [tasksCurrentStatuses, preferences.tasksDefaultStatuses]);

  const getCasesDefaultStatuses = useCallback(() => {
    return preferences.casesDefaultStatuses ?? SYSTEM_DEFAULT_STATUSES;
  }, [preferences.casesDefaultStatuses]);

  const getTasksDefaultStatuses = useCallback(() => {
    return preferences.tasksDefaultStatuses ?? SYSTEM_DEFAULT_STATUSES;
  }, [preferences.tasksDefaultStatuses]);

  return {
    // Cases
    casesCurrentStatuses,
    updateCasesStatus,
    toggleCasesStatus,
    setCasesDefaultStatus,
    resetCasesToDefault,
    resetCasesToSystemDefault,
    hasCasesUserDefault,
    isCasesCurrentDefault,
    getCasesDefaultStatuses,
    
    // Tasks
    tasksCurrentStatuses,
    updateTasksStatus,
    toggleTasksStatus,
    setTasksDefaultStatus,
    resetTasksToDefault,
    resetTasksToSystemDefault,
    hasTasksUserDefault,
    isTasksCurrentDefault,
    getTasksDefaultStatuses,
  };
};

// Status options for both tabs
export const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
] as const;

export const getStatusLabel = (statuses: string[]): string => {
  if (statuses.length === 0 || statuses.includes('all')) return 'All';
  if (statuses.length === 1) {
    const option = STATUS_OPTIONS.find(o => o.value === statuses[0]);
    return option?.label ?? statuses[0];
  }
  return `${statuses.length} selected`;
};

import { useState, useCallback, useMemo, useEffect } from 'react';

export interface PageActionBarState {
  searchQuery: string;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  viewMode: string;
  activeFilters: Record<string, any>;
  filterPanelOpen: boolean;
}

interface UsePageActionBarOptions {
  pageKey: string; // Unique key for localStorage persistence
  defaultSortField?: string;
  defaultSortDirection?: 'asc' | 'desc';
  defaultViewMode?: string;
  defaultFilters?: Record<string, any>;
  debounceMs?: number;
}

interface UsePageActionBarReturn {
  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  debouncedSearchQuery: string;
  clearSearch: () => void;
  
  // Sort
  sortField: string;
  sortDirection: 'asc' | 'desc';
  setSorting: (field: string, direction: 'asc' | 'desc') => void;
  clearSorting: () => void;
  
  // View Mode
  viewMode: string;
  setViewMode: (mode: string) => void;
  defaultViewMode: string | null;
  setDefaultViewMode: () => void;
  isCurrentDefault: boolean;
  
  // Filters
  activeFilters: Record<string, any>;
  setFilter: (key: string, value: any) => void;
  removeFilter: (key: string) => void;
  clearAllFilters: () => void;
  activeFilterCount: number;
  hasActiveFilters: boolean;
  filterPanelOpen: boolean;
  setFilterPanelOpen: (open: boolean) => void;
  
  // Persistence
  resetAllToDefaults: () => void;
}

const STORAGE_PREFIX = 'page_action_bar_';

export function usePageActionBar({
  pageKey,
  defaultSortField = '',
  defaultSortDirection = 'asc',
  defaultViewMode = 'list',
  defaultFilters = {},
  debounceMs = 300,
}: UsePageActionBarOptions): UsePageActionBarReturn {
  
  // Load persisted state from localStorage
  const loadPersistedState = useCallback((): Partial<PageActionBarState> => {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${pageKey}`);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }, [pageKey]);
  
  const persistedState = useMemo(() => loadPersistedState(), [loadPersistedState]);
  
  // Initialize state with persisted values or defaults
  const [searchQuery, setSearchQueryInternal] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [sortField, setSortField] = useState(persistedState.sortField || defaultSortField);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(
    persistedState.sortDirection || defaultSortDirection
  );
  const [viewMode, setViewModeInternal] = useState(persistedState.viewMode || defaultViewMode);
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>(
    persistedState.activeFilters || defaultFilters
  );
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  
  // Load default view mode
  const [storedDefaultViewMode, setStoredDefaultViewMode] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`${STORAGE_PREFIX}${pageKey}_default_view`);
    } catch {
      return null;
    }
  });
  
  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [searchQuery, debounceMs]);
  
  // Persist state changes
  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${pageKey}`, JSON.stringify({
        sortField,
        sortDirection,
        viewMode,
        activeFilters,
      }));
    } catch {
      // Ignore storage errors
    }
  }, [pageKey, sortField, sortDirection, viewMode, activeFilters]);
  
  // Search functions
  const setSearchQuery = useCallback((query: string) => {
    setSearchQueryInternal(query);
  }, []);
  
  const clearSearch = useCallback(() => {
    setSearchQueryInternal('');
    setDebouncedSearchQuery('');
  }, []);
  
  // Sort functions
  const setSorting = useCallback((field: string, direction: 'asc' | 'desc') => {
    setSortField(field);
    setSortDirection(direction);
  }, []);
  
  const clearSorting = useCallback(() => {
    setSortField(defaultSortField);
    setSortDirection(defaultSortDirection);
  }, [defaultSortField, defaultSortDirection]);
  
  // View mode functions
  const setViewMode = useCallback((mode: string) => {
    setViewModeInternal(mode);
  }, []);
  
  const setDefaultViewMode = useCallback(() => {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${pageKey}_default_view`, viewMode);
      setStoredDefaultViewMode(viewMode);
    } catch {
      // Ignore storage errors
    }
  }, [pageKey, viewMode]);
  
  const isCurrentDefault = viewMode === storedDefaultViewMode;
  
  // Filter functions
  const setFilter = useCallback((key: string, value: any) => {
    setActiveFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);
  
  const removeFilter = useCallback((key: string) => {
    setActiveFilters(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);
  
  const clearAllFilters = useCallback(() => {
    setActiveFilters(defaultFilters);
  }, [defaultFilters]);
  
  const activeFilterCount = useMemo(() => {
    return Object.values(activeFilters).filter(v => {
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'string') return v !== '' && v !== 'all';
      return v !== null && v !== undefined;
    }).length;
  }, [activeFilters]);
  
  const hasActiveFilters = activeFilterCount > 0;
  
  // Reset all to defaults
  const resetAllToDefaults = useCallback(() => {
    setSearchQueryInternal('');
    setDebouncedSearchQuery('');
    setSortField(defaultSortField);
    setSortDirection(defaultSortDirection);
    setViewModeInternal(storedDefaultViewMode || defaultViewMode);
    setActiveFilters(defaultFilters);
    setFilterPanelOpen(false);
  }, [defaultSortField, defaultSortDirection, defaultViewMode, storedDefaultViewMode, defaultFilters]);
  
  return {
    // Search
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    clearSearch,
    
    // Sort
    sortField,
    sortDirection,
    setSorting,
    clearSorting,
    
    // View Mode
    viewMode,
    setViewMode,
    defaultViewMode: storedDefaultViewMode,
    setDefaultViewMode,
    isCurrentDefault,
    
    // Filters
    activeFilters,
    setFilter,
    removeFilter,
    clearAllFilters,
    activeFilterCount,
    hasActiveFilters,
    filterPanelOpen,
    setFilterPanelOpen,
    
    // Persistence
    resetAllToDefaults,
  };
}

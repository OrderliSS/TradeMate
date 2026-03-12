import { useState, useEffect, useCallback } from 'react';
import { PAGE_KEYS } from '@/lib/storage-keys';

// ============================================================================
// View Mode Storage
// ============================================================================

export type StandardViewMode = 'list' | 'grid' | 'kanban' | 'calendar' | 'table' | 'cards';

interface UseViewModeStorageOptions {
  /** Unique identifier for the page */
  pageKey: string;
  /** Available view modes for this page */
  availableModes: StandardViewMode[];
  /** Default view mode */
  defaultMode: StandardViewMode;
  /** Different default for mobile (optional) */
  mobileDefaultMode?: StandardViewMode;
}

/**
 * Hook for managing view mode preference with localStorage persistence
 */
export function useViewModeStorage({
  pageKey,
  availableModes,
  defaultMode,
  mobileDefaultMode,
}: UseViewModeStorageOptions) {
  const storageKey = PAGE_KEYS.viewMode(pageKey);
  
  // Detect mobile on initial render
  const getEffectiveDefault = useCallback(() => {
    if (typeof window === 'undefined') return defaultMode;
    const isMobile = window.innerWidth < 768;
    return isMobile && mobileDefaultMode ? mobileDefaultMode : defaultMode;
  }, [defaultMode, mobileDefaultMode]);

  const [viewMode, setViewModeState] = useState<StandardViewMode>(() => {
    if (typeof window === 'undefined') return getEffectiveDefault();
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const mode = parsed?.value ?? parsed;
        if (availableModes.includes(mode)) {
          return mode;
        }
      }
    } catch (error) {
      console.error(`Error loading view mode for ${pageKey}:`, error);
    }
    
    return getEffectiveDefault();
  });

  useEffect(() => {
    try {
      const toStore = { value: viewMode, timestamp: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch (error) {
      console.error(`Error saving view mode for ${pageKey}:`, error);
    }
  }, [viewMode, storageKey, pageKey]);

  const setViewMode = useCallback((mode: StandardViewMode) => {
    if (availableModes.includes(mode)) {
      setViewModeState(mode);
    }
  }, [availableModes]);

  const resetToDefault = useCallback(() => {
    setViewModeState(getEffectiveDefault());
  }, [getEffectiveDefault]);

  return {
    viewMode,
    setViewMode,
    resetToDefault,
    availableModes,
    isDefault: viewMode === getEffectiveDefault(),
  };
}

// ============================================================================
// Sort Order Storage
// ============================================================================

interface UseSortStorageOptions {
  /** Unique identifier for the page */
  pageKey: string;
  /** Default sort value */
  defaultSort: string;
  /** Valid sort options */
  validSorts?: string[];
}

/**
 * Hook for managing sort preference with localStorage persistence
 */
export function useSortStorage({
  pageKey,
  defaultSort,
  validSorts,
}: UseSortStorageOptions) {
  const storageKey = PAGE_KEYS.sort(pageKey);

  const [currentSort, setCurrentSortState] = useState<string>(() => {
    if (typeof window === 'undefined') return defaultSort;
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const sort = parsed?.value ?? parsed;
        if (typeof sort === 'string' && (!validSorts || validSorts.includes(sort))) {
          return sort;
        }
      }
    } catch (error) {
      console.error(`Error loading sort for ${pageKey}:`, error);
    }
    
    return defaultSort;
  });

  useEffect(() => {
    try {
      const toStore = { value: currentSort, timestamp: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch (error) {
      console.error(`Error saving sort for ${pageKey}:`, error);
    }
  }, [currentSort, storageKey]);

  const setSort = useCallback((sort: string) => {
    if (!validSorts || validSorts.includes(sort)) {
      setCurrentSortState(sort);
    }
  }, [validSorts]);

  const resetSort = useCallback(() => {
    setCurrentSortState(defaultSort);
  }, [defaultSort]);

  return {
    currentSort,
    setSort,
    resetSort,
    isDefault: currentSort === defaultSort,
    defaultSort,
  };
}

/**
 * Hook for mobile-specific sort with persistence
 * Maintains backward compatibility with useMobilePageSort
 */
export function useMobileSortStorage(pageKey: string, defaultSort: string = 'newest') {
  const storageKey = PAGE_KEYS.mobileSort(pageKey);

  const [currentSort, setCurrentSort] = useState<string>(() => {
    if (typeof window === 'undefined') return defaultSort;
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.value ?? parsed ?? defaultSort;
      }
      
      // Check legacy key format
      const legacyKey = `${pageKey}_mobile_sort`;
      const legacy = localStorage.getItem(legacyKey);
      if (legacy) {
        return legacy;
      }
    } catch (error) {
      console.error(`Error loading mobile sort for ${pageKey}:`, error);
    }
    
    return defaultSort;
  });

  useEffect(() => {
    try {
      const toStore = { value: currentSort, timestamp: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch (error) {
      console.error(`Error saving mobile sort for ${pageKey}:`, error);
    }
  }, [currentSort, storageKey]);

  return {
    currentSort,
    setSort: setCurrentSort,
    isDefault: currentSort === defaultSort,
    resetSort: () => setCurrentSort(defaultSort),
    defaultSort,
  };
}

// ============================================================================
// Active Tab Storage
// ============================================================================

interface UseActiveTabStorageOptions {
  /** Unique identifier for the page/component */
  pageKey: string;
  /** Default tab value */
  defaultTab: string;
  /** Valid tab options */
  validTabs?: string[];
}

/**
 * Hook for managing active tab state with localStorage persistence
 */
export function useActiveTabStorage({
  pageKey,
  defaultTab,
  validTabs,
}: UseActiveTabStorageOptions) {
  const storageKey = PAGE_KEYS.activeTab(pageKey);

  const [activeTab, setActiveTabState] = useState<string>(() => {
    if (typeof window === 'undefined') return defaultTab;
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const tab = parsed?.value ?? parsed;
        if (typeof tab === 'string' && (!validTabs || validTabs.includes(tab))) {
          return tab;
        }
      }
    } catch (error) {
      console.error(`Error loading active tab for ${pageKey}:`, error);
    }
    
    return defaultTab;
  });

  useEffect(() => {
    try {
      const toStore = { value: activeTab, timestamp: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch (error) {
      console.error(`Error saving active tab for ${pageKey}:`, error);
    }
  }, [activeTab, storageKey]);

  const setActiveTab = useCallback((tab: string) => {
    if (!validTabs || validTabs.includes(tab)) {
      setActiveTabState(tab);
    }
  }, [validTabs]);

  const resetTab = useCallback(() => {
    setActiveTabState(defaultTab);
  }, [defaultTab]);

  return {
    activeTab,
    setActiveTab,
    resetTab,
    isDefault: activeTab === defaultTab,
  };
}

/**
 * Hook for managing subtab state within a parent tab
 */
export function useActiveSubtabStorage({
  pageKey,
  tabKey,
  defaultSubtab,
  validSubtabs,
}: {
  pageKey: string;
  tabKey: string;
  defaultSubtab: string;
  validSubtabs?: string[];
}) {
  const storageKey = PAGE_KEYS.activeSubtab(pageKey, tabKey);

  const [activeSubtab, setActiveSubtabState] = useState<string>(() => {
    if (typeof window === 'undefined') return defaultSubtab;
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const subtab = parsed?.value ?? parsed;
        if (typeof subtab === 'string' && (!validSubtabs || validSubtabs.includes(subtab))) {
          return subtab;
        }
      }
      
      // Check legacy key format
      const legacyKey = `${pageKey}-${tabKey}-subtab`;
      const legacy = localStorage.getItem(legacyKey);
      if (legacy && (!validSubtabs || validSubtabs.includes(legacy))) {
        return legacy;
      }
    } catch (error) {
      console.error(`Error loading subtab for ${pageKey}/${tabKey}:`, error);
    }
    
    return defaultSubtab;
  });

  useEffect(() => {
    try {
      const toStore = { value: activeSubtab, timestamp: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch (error) {
      console.error(`Error saving subtab for ${pageKey}/${tabKey}:`, error);
    }
  }, [activeSubtab, storageKey, pageKey, tabKey]);

  const setActiveSubtab = useCallback((subtab: string) => {
    if (!validSubtabs || validSubtabs.includes(subtab)) {
      setActiveSubtabState(subtab);
    }
  }, [validSubtabs]);

  const resetSubtab = useCallback(() => {
    setActiveSubtabState(defaultSubtab);
  }, [defaultSubtab]);

  return {
    activeSubtab,
    setActiveSubtab,
    resetSubtab,
    isDefault: activeSubtab === defaultSubtab,
  };
}

// ============================================================================
// Combined Page Preferences
// ============================================================================

interface UsePagePreferencesOptions {
  pageKey: string;
  viewMode?: {
    availableModes: StandardViewMode[];
    defaultMode: StandardViewMode;
    mobileDefaultMode?: StandardViewMode;
  };
  sort?: {
    defaultSort: string;
    validSorts?: string[];
  };
  tab?: {
    defaultTab: string;
    validTabs?: string[];
  };
}

/**
 * Combined hook for all page-level preferences
 */
export function usePagePreferences({
  pageKey,
  viewMode: viewModeConfig,
  sort: sortConfig,
  tab: tabConfig,
}: UsePagePreferencesOptions) {
  const viewModeResult = viewModeConfig
    ? useViewModeStorage({ pageKey, ...viewModeConfig })
    : null;

  const sortResult = sortConfig
    ? useSortStorage({ pageKey, ...sortConfig })
    : null;

  const tabResult = tabConfig
    ? useActiveTabStorage({ pageKey, ...tabConfig })
    : null;

  const resetAll = useCallback(() => {
    viewModeResult?.resetToDefault();
    sortResult?.resetSort();
    tabResult?.resetTab();
  }, [viewModeResult, sortResult, tabResult]);

  return {
    viewMode: viewModeResult,
    sort: sortResult,
    tab: tabResult,
    resetAll,
  };
}

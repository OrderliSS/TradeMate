import { useState, useCallback, useEffect } from 'react';
import { PAGE_KEYS } from '@/lib/storage-keys';

/**
 * useMobilePageSort - Generic hook for page-specific sort persistence
 * 
 * Features:
 * - Persists sort choice per page to localStorage
 * - Tracks if current sort differs from default
 * - Provides reset functionality
 */
export const useMobilePageSort = (
  pageKey: string,
  defaultSort: string = 'newest'
) => {
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
    } catch {
      return defaultSort;
    }
    
    return defaultSort;
  });

  // Persist to localStorage
  useEffect(() => {
    try {
      const toStore = { value: currentSort, timestamp: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch (error) {
      console.error(`Error saving mobile sort for ${pageKey}:`, error);
    }
  }, [currentSort, storageKey, pageKey]);

  const resetSort = useCallback(() => {
    setCurrentSort(defaultSort);
  }, [defaultSort]);

  return {
    currentSort,
    setSort: setCurrentSort,
    isDefault: currentSort === defaultSort,
    resetSort,
    defaultSort,
  };
};

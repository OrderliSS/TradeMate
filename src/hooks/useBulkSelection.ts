import { useState, useCallback, useEffect } from 'react';
import { FEATURE_KEYS } from '@/lib/storage-keys';

export const useBulkSelection = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const storageKey = FEATURE_KEYS.checkboxMode;
  
  const [isCheckboxModeEnabled, setIsCheckboxModeEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Handle both new format ({ value }) and legacy format (direct boolean or string 'true')
        if (typeof parsed === 'object' && parsed !== null && 'value' in parsed) {
          return Boolean(parsed.value);
        }
        return parsed === true || parsed === 'true';
      }
    } catch {}
    return false; // Default to false
  });

  // Persist checkbox mode preference
  useEffect(() => {
    try {
      const toStore = { value: isCheckboxModeEnabled, timestamp: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch (error) {
      console.error('Error saving checkbox mode:', error);
    }
  }, [isCheckboxModeEnabled, storageKey]);

  const toggleCheckboxMode = useCallback(() => {
    setIsCheckboxModeEnabled((prev) => !prev);
    // Clear selection when disabling checkbox mode
    setSelectedIds([]);
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  const toggleAll = useCallback((allIds: string[]) => {
    setSelectedIds((prev) =>
      prev.length === allIds.length ? [] : allIds
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.includes(id),
    [selectedIds]
  );

  const selectRange = useCallback((startId: string, endId: string, allIds: string[]) => {
    const startIndex = allIds.indexOf(startId);
    const endIndex = allIds.indexOf(endId);
    
    if (startIndex === -1 || endIndex === -1) return;
    
    const [start, end] = startIndex < endIndex 
      ? [startIndex, endIndex] 
      : [endIndex, startIndex];
    
    const rangeIds = allIds.slice(start, end + 1);
    
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      rangeIds.forEach((id) => newSet.add(id));
      return Array.from(newSet);
    });
  }, []);

  return {
    selectedIds,
    toggleSelection,
    toggleAll,
    clearSelection,
    isSelected,
    selectRange,
    isCheckboxModeEnabled,
    toggleCheckboxMode,
    setIsCheckboxModeEnabled,
  };
};

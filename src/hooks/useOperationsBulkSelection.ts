import { useState, useCallback, useEffect } from 'react';

export const useOperationsBulkSelection = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isCheckboxModeEnabled, setIsCheckboxModeEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('operationsCheckboxModeEnabled');
    return saved !== null ? saved === 'true' : false;
  });

  useEffect(() => {
    localStorage.setItem('operationsCheckboxModeEnabled', String(isCheckboxModeEnabled));
  }, [isCheckboxModeEnabled]);

  const toggleCheckboxMode = useCallback(() => {
    setIsCheckboxModeEnabled((prev) => !prev);
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

  return {
    selectedIds,
    toggleSelection,
    toggleAll,
    clearSelection,
    isSelected,
    isCheckboxModeEnabled,
    toggleCheckboxMode,
    setIsCheckboxModeEnabled,
  };
};

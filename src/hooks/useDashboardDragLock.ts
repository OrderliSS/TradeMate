import { useState, useCallback, useEffect } from 'react';

// Get environment helper
const getEnvironment = (): string => {
  if (typeof window === 'undefined') return 'production';
  return localStorage.getItem('system:data-environment') || 
         localStorage.getItem('data-environment') || 
         'production';
};

// Get storage key helper
const getStorageKey = (): string => {
  const env = getEnvironment();
  return `ui:dashboard:drag-locked:${env}`;
};

// Get stored value helper
const getStoredDragLock = (): boolean => {
  if (typeof window === 'undefined') return true;
  
  try {
    const storageKey = getStorageKey();
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed?.value ?? parsed;
    }
    
    // Check legacy key format
    const env = getEnvironment();
    const legacyKey = `dashboardDragLocked_${env}`;
    const legacy = localStorage.getItem(legacyKey);
    if (legacy) {
      return JSON.parse(legacy);
    }
  } catch {
    return true;
  }
  
  return true; // Default to locked for safety
};

// Store value helper
const storeDragLock = (value: boolean) => {
  try {
    const storageKey = getStorageKey();
    const toStore = { value, timestamp: Date.now() };
    localStorage.setItem(storageKey, JSON.stringify(toStore));
  } catch (error) {
    console.error('Error saving drag lock state:', error);
  }
};

export const useDashboardDragLock = () => {
  const [isDragLocked, setIsDragLockedState] = useState<boolean>(getStoredDragLock);

  // Persist to localStorage
  useEffect(() => {
    storeDragLock(isDragLocked);
  }, [isDragLocked]);

  const toggleDragLock = useCallback(() => {
    setIsDragLockedState(prev => !prev);
  }, []);

  const setDragLocked = useCallback((locked: boolean) => {
    setIsDragLockedState(locked);
  }, []);

  return { isDragLocked, toggleDragLock, setDragLocked };
};

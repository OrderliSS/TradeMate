import { useCallback, useEffect } from 'react';
import { FEATURE_KEYS } from '@/lib/storage-keys';

// Get stored value helper
const getStoredDemoMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  try {
    const storageKey = FEATURE_KEYS.demoMode;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      return (parsed?.value ?? parsed) === true || (parsed?.value ?? parsed) === 'true';
    }
    
    // Check legacy key
    const legacy = localStorage.getItem('demo-mode');
    if (legacy) {
      return legacy === 'true';
    }
  } catch {
    return false;
  }
  
  return false;
};

// Store value helper
const storeDemoMode = (value: boolean) => {
  try {
    const toStore = { value, timestamp: Date.now() };
    localStorage.setItem(FEATURE_KEYS.demoMode, JSON.stringify(toStore));
  } catch (error) {
    console.error('Error saving demo mode:', error);
  }
};

export const useDemoMode = () => {
  const [isDemoMode, setIsDemoModeState] = React.useState<boolean>(getStoredDemoMode);

  // Set DOM attribute for CSS styling
  useEffect(() => {
    if (isDemoMode) {
      document.documentElement.setAttribute('data-demo-mode', 'true');
    } else {
      document.documentElement.removeAttribute('data-demo-mode');
    }
  }, [isDemoMode]);

  // Persist to localStorage
  useEffect(() => {
    storeDemoMode(isDemoMode);
  }, [isDemoMode]);

  const toggleDemoMode = useCallback((enabled: boolean) => {
    setIsDemoModeState(enabled);
  }, []);

  return {
    isDemoMode,
    toggleDemoMode
  };
};

// Need to import React for useState
import React from 'react';

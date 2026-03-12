import { useState, useEffect, useCallback } from 'react';
import { FEATURE_KEYS, SYSTEM_KEYS } from '@/lib/storage-keys';

// ============================================================================
// Demo Mode
// ============================================================================

/**
 * Hook for managing demo mode state
 * Demo mode displays sample data while protecting real business information
 */
export function useDemoModeStorage() {
  const storageKey = FEATURE_KEYS.demoMode;

  const [isDemoMode, setIsDemoModeState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    
    try {
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
  });

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
    try {
      const toStore = { value: isDemoMode, timestamp: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch (error) {
      console.error('Error saving demo mode:', error);
    }
  }, [isDemoMode, storageKey]);

  const toggleDemoMode = useCallback((enabled: boolean) => {
    setIsDemoModeState(enabled);
  }, []);

  return {
    isDemoMode,
    toggleDemoMode,
    enableDemoMode: () => toggleDemoMode(true),
    disableDemoMode: () => toggleDemoMode(false),
  };
}

// ============================================================================
// Dashboard Drag Lock
// ============================================================================

/**
 * Hook for managing dashboard drag lock state (environment-aware)
 */
export function useDashboardDragLockStorage() {
  const getStorageKey = useCallback(() => {
    const env = localStorage.getItem('system:data-environment') || 
                localStorage.getItem('data-environment') || 
                'production';
    return `ui:dashboard:drag-locked:${env}`;
  }, []);

  const [isLocked, setIsLockedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true; // Default to locked
    
    try {
      const storageKey = getStorageKey();
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.value ?? parsed;
      }
      
      // Check legacy key format
      const env = localStorage.getItem('data-environment') || 'production';
      const legacyKey = `dashboardDragLocked_${env}`;
      const legacy = localStorage.getItem(legacyKey);
      if (legacy) {
        return JSON.parse(legacy);
      }
    } catch {
      return true;
    }
    
    return true; // Default to locked for safety
  });

  useEffect(() => {
    try {
      const storageKey = getStorageKey();
      const toStore = { value: isLocked, timestamp: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch (error) {
      console.error('Error saving drag lock state:', error);
    }
  }, [isLocked, getStorageKey]);

  const toggleLock = useCallback(() => {
    setIsLockedState(prev => !prev);
  }, []);

  const setLocked = useCallback((locked: boolean) => {
    setIsLockedState(locked);
  }, []);

  return {
    isLocked,
    toggleLock,
    setLocked,
    lock: () => setLocked(true),
    unlock: () => setLocked(false),
  };
}

// ============================================================================
// Performance Dashboard Toggle
// ============================================================================

/**
 * Hook for managing performance dashboard expanded state
 */
export function usePerformanceDashboardStorage() {
  const storageKey = 'ui:dashboard:performance-expanded';

  const [isExpanded, setIsExpandedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.value ?? parsed;
      }
    } catch {
      return false;
    }
    
    return false;
  });

  useEffect(() => {
    try {
      const toStore = { value: isExpanded, timestamp: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch (error) {
      console.error('Error saving performance dashboard state:', error);
    }
  }, [isExpanded, storageKey]);

  const toggle = useCallback(() => {
    setIsExpandedState(prev => !prev);
  }, []);

  return {
    isExpanded,
    setExpanded: setIsExpandedState,
    toggle,
    expand: () => setIsExpandedState(true),
    collapse: () => setIsExpandedState(false),
  };
}

// ============================================================================
// Accessibility Settings
// ============================================================================

interface AccessibilitySettings {
  reduceMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  focusIndicators: boolean;
}

const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  reduceMotion: false,
  highContrast: false,
  largeText: false,
  focusIndicators: true,
};

/**
 * Hook for managing accessibility preferences
 */
export function useAccessibilityStorage() {
  const storageKey = FEATURE_KEYS.accessibility;

  const [settings, setSettingsState] = useState<AccessibilitySettings>(() => {
    if (typeof window === 'undefined') return DEFAULT_ACCESSIBILITY_SETTINGS;
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_ACCESSIBILITY_SETTINGS, ...(parsed?.value ?? parsed) };
      }
      
      // Check for system preference for reduced motion
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) {
        return { ...DEFAULT_ACCESSIBILITY_SETTINGS, reduceMotion: true };
      }
    } catch {
      return DEFAULT_ACCESSIBILITY_SETTINGS;
    }
    
    return DEFAULT_ACCESSIBILITY_SETTINGS;
  });

  // Apply accessibility settings to document
  useEffect(() => {
    const root = document.documentElement;
    
    if (settings.reduceMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }
    
    if (settings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
    
    if (settings.largeText) {
      root.classList.add('large-text');
    } else {
      root.classList.remove('large-text');
    }
    
    if (settings.focusIndicators) {
      root.classList.add('focus-visible');
    } else {
      root.classList.remove('focus-visible');
    }
  }, [settings]);

  // Persist to localStorage
  useEffect(() => {
    try {
      const toStore = { value: settings, timestamp: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch (error) {
      console.error('Error saving accessibility settings:', error);
    }
  }, [settings, storageKey]);

  const updateSetting = useCallback(<K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => {
    setSettingsState(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettingsState(DEFAULT_ACCESSIBILITY_SETTINGS);
  }, []);

  return {
    settings,
    updateSetting,
    resetSettings,
    setSettings: setSettingsState,
  };
}

// ============================================================================
// Theme Storage
// ============================================================================

export type Theme = 'light' | 'dark' | 'system';

/**
 * Hook for managing theme preference
 * Note: This is typically used via ThemeContext, but available for direct use
 */
export function useThemeStorage() {
  const storageKey = SYSTEM_KEYS.theme;

  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const value = parsed?.value ?? parsed;
        if (['light', 'dark', 'system'].includes(value)) {
          return value as Theme;
        }
      }
      
      // Check legacy key
      const legacy = localStorage.getItem('theme');
      if (legacy && ['light', 'dark', 'system'].includes(legacy)) {
        return legacy as Theme;
      }
    } catch {
      return 'system';
    }
    
    return 'system';
  });

  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');

  // Determine effective theme based on setting and system preference
  useEffect(() => {
    const updateEffectiveTheme = () => {
      if (theme === 'system') {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setEffectiveTheme(systemPrefersDark ? 'dark' : 'light');
      } else {
        setEffectiveTheme(theme);
      }
    };

    updateEffectiveTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', updateEffectiveTheme);
      return () => mediaQuery.removeEventListener('change', updateEffectiveTheme);
    }
  }, [theme]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [effectiveTheme]);

  // Persist to localStorage
  useEffect(() => {
    try {
      const toStore = { value: theme, timestamp: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  }, [theme, storageKey]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  return {
    theme,
    setTheme,
    effectiveTheme,
    isDark: effectiveTheme === 'dark',
    isLight: effectiveTheme === 'light',
    isSystem: theme === 'system',
  };
}

// ============================================================================
// Generic Feature Toggle
// ============================================================================

/**
 * Generic hook for any boolean feature toggle
 */
export function useFeatureToggle(
  featureKey: string,
  defaultValue: boolean = false
) {
  const storageKey = `feature:${featureKey}`;

  const [isEnabled, setIsEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return defaultValue;
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.value ?? parsed;
      }
    } catch {
      return defaultValue;
    }
    
    return defaultValue;
  });

  useEffect(() => {
    try {
      const toStore = { value: isEnabled, timestamp: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch (error) {
      console.error(`Error saving feature toggle ${featureKey}:`, error);
    }
  }, [isEnabled, storageKey, featureKey]);

  const toggle = useCallback(() => {
    setIsEnabledState(prev => !prev);
  }, []);

  const enable = useCallback(() => {
    setIsEnabledState(true);
  }, []);

  const disable = useCallback(() => {
    setIsEnabledState(false);
  }, []);

  const reset = useCallback(() => {
    setIsEnabledState(defaultValue);
  }, [defaultValue]);

  return {
    isEnabled,
    setEnabled: setIsEnabledState,
    toggle,
    enable,
    disable,
    reset,
  };
}

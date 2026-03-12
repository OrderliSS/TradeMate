import { useCallback, useMemo } from 'react';
import { useUserPreferences } from './useUserPreferences';

export type StandardViewMode = 'list' | 'cards' | 'tiles' | 'table' | 'groups' | 'grid' | 'categories' | 'compact' | 'shipment_records' | 'individual' | 'stock_order_id_details';

interface UseViewModePreferencesOptions {
  /** Page identifier (e.g., 'purchases', 'products', 'vendors') */
  pageKey: string;
  /** Available view modes for this page */
  availableModes?: StandardViewMode[];
  /** Default view mode if none set */
  defaultMode?: StandardViewMode;
  /** Mobile default (falls back to first available if not specified) */
  mobileDefaultMode?: StandardViewMode;
}

interface UseViewModePreferencesReturn {
  /** Current view mode */
  viewMode: StandardViewMode;
  /** Update view mode */
  setViewMode: (mode: StandardViewMode) => void;
  /** Set current view mode as user default */
  setAsDefault: () => void;
  /** Reset to system default */
  resetToDefault: () => void;
  /** Whether user has set a custom default */
  hasUserDefault: boolean;
  /** Whether current mode matches user default */
  isCurrentDefault: boolean;
  /** Available modes for this page */
  availableModes: StandardViewMode[];
  /** Whether loading from database */
  isLoading: boolean;
  /** Whether synced to database */
  isSynced: boolean;
}

/**
 * Standardized view mode preferences with database sync
 * 
 * Replaces various page-specific view mode hooks with a consistent implementation:
 * - Database persistence for cross-device sync
 * - LocalStorage fallback for offline/fast initial load
 * - Consistent API across all pages
 * 
 * @example
 * const { viewMode, setViewMode, setAsDefault } = useViewModePreferences({
 *   pageKey: 'purchases',
 *   availableModes: ['list', 'cards', 'tiles'],
 *   defaultMode: 'list',
 * });
 */
export function useViewModePreferences({
  pageKey,
  availableModes = ['list', 'cards', 'tiles'],
  defaultMode = 'list',
  mobileDefaultMode,
}: UseViewModePreferencesOptions): UseViewModePreferencesReturn {
  
  // Current view mode
  const { 
    value: viewMode, 
    setValue: setViewModeRaw,
    isLoading,
    isSynced,
  } = useUserPreferences<StandardViewMode>({
    key: `${pageKey}_view_mode`,
    defaultValue: defaultMode,
  });

  // User's preferred default (separate from current selection)
  const {
    value: userDefault,
    setValue: setUserDefault,
    resetToDefault: clearUserDefault,
  } = useUserPreferences<StandardViewMode | null>({
    key: `${pageKey}_view_mode_default`,
    defaultValue: null,
  });

  // Validate mode is available
  const validatedMode = useMemo(() => {
    if (availableModes.includes(viewMode)) {
      return viewMode;
    }
    return userDefault && availableModes.includes(userDefault) 
      ? userDefault 
      : defaultMode;
  }, [viewMode, userDefault, availableModes, defaultMode]);

  // Set view mode
  const setViewMode = useCallback((mode: StandardViewMode) => {
    if (availableModes.includes(mode)) {
      setViewModeRaw(mode);
    }
  }, [availableModes, setViewModeRaw]);

  // Set current as default
  const setAsDefault = useCallback(() => {
    setUserDefault(validatedMode);
  }, [setUserDefault, validatedMode]);

  // Reset to system default
  const resetToDefault = useCallback(() => {
    clearUserDefault();
    setViewModeRaw(defaultMode);
  }, [clearUserDefault, setViewModeRaw, defaultMode]);

  const hasUserDefault = userDefault !== null;
  const isCurrentDefault = userDefault === validatedMode;

  return {
    viewMode: validatedMode,
    setViewMode,
    setAsDefault,
    resetToDefault,
    hasUserDefault,
    isCurrentDefault,
    availableModes,
    isLoading,
    isSynced,
  };
}

/**
 * Standardized filter preferences with database sync
 */
interface UseFilterPreferencesOptions {
  /** Page identifier */
  pageKey: string;
  /** Filter name (e.g., 'status', 'category') */
  filterKey: string;
  /** Default value */
  defaultValue: string;
  /** Available options (optional - if not provided, any string is valid) */
  options?: string[];
}

interface UseFilterPreferencesReturn {
  /** Current filter value */
  value: string;
  /** Update filter value */
  setValue: (value: string) => void;
  /** Set current as user default */
  setAsDefault: () => void;
  /** Reset to system default */
  resetToDefault: () => void;
  /** Whether user has custom default */
  hasUserDefault: boolean;
  /** Whether current matches user default */
  isCurrentDefault: boolean;
  /** Whether synced to database */
  isSynced: boolean;
}

export function useFilterPreferences({
  pageKey,
  filterKey,
  defaultValue,
  options,
}: UseFilterPreferencesOptions): UseFilterPreferencesReturn {
  
  const {
    value: currentValue,
    setValue: setValueRaw,
    isSynced,
  } = useUserPreferences<string>({
    key: `${pageKey}_filter_${filterKey}`,
    defaultValue,
  });

  const {
    value: userDefault,
    setValue: setUserDefault,
    resetToDefault: clearUserDefault,
  } = useUserPreferences<string | null>({
    key: `${pageKey}_filter_${filterKey}_default`,
    defaultValue: null,
  });

  // Validate value is in options if provided
  const validatedValue = useMemo(() => {
    if (!options) return currentValue;
    return options.includes(currentValue) ? currentValue : defaultValue;
  }, [currentValue, options, defaultValue]);

  const setValue = useCallback((value: string) => {
    if (!options || options.includes(value)) {
      setValueRaw(value);
    }
  }, [options, setValueRaw]);

  const setAsDefault = useCallback(() => {
    setUserDefault(validatedValue);
  }, [setUserDefault, validatedValue]);

  const resetToDefault = useCallback(() => {
    clearUserDefault();
    setValueRaw(defaultValue);
  }, [clearUserDefault, setValueRaw, defaultValue]);

  return {
    value: validatedValue,
    setValue,
    setAsDefault,
    resetToDefault,
    hasUserDefault: userDefault !== null,
    isCurrentDefault: userDefault === validatedValue,
    isSynced,
  };
}

/**
 * Combined page preferences hook for common patterns
 */
interface UsePagePreferencesOptions {
  pageKey: string;
  viewModes?: StandardViewMode[];
  defaultViewMode?: StandardViewMode;
  filters?: Array<{
    key: string;
    defaultValue: string;
    options?: string[];
  }>;
}

export function usePagePreferences({
  pageKey,
  viewModes = ['list', 'cards'],
  defaultViewMode = 'list',
  filters = [],
}: UsePagePreferencesOptions) {
  const viewModePrefs = useViewModePreferences({
    pageKey,
    availableModes: viewModes,
    defaultMode: defaultViewMode,
  });

  const filterPrefs = filters.reduce((acc, filter) => {
    // Note: This creates hooks dynamically which breaks rules of hooks
    // In practice, each page should call useFilterPreferences directly
    acc[filter.key] = {
      defaultValue: filter.defaultValue,
      options: filter.options,
    };
    return acc;
  }, {} as Record<string, { defaultValue: string; options?: string[] }>);

  return {
    viewMode: viewModePrefs,
    filterConfigs: filterPrefs,
  };
}

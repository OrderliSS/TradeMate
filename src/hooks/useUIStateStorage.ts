import { useState, useEffect, useCallback } from 'react';
import { UI_KEYS } from '@/lib/storage-keys';

// ============================================================================
// Column Visibility Storage
// ============================================================================

export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  required?: boolean;
  priority?: number;
}

interface UseColumnStorageOptions {
  /** Unique identifier for the table/page */
  tableKey: keyof typeof UI_KEYS.columns | string;
  /** Default column configuration */
  defaultColumns: ColumnConfig[];
}

/**
 * Hook for managing table column visibility with localStorage persistence
 */
export function useColumnStorage({ tableKey, defaultColumns }: UseColumnStorageOptions) {
  // Determine storage key
  const storageKey = tableKey in UI_KEYS.columns 
    ? UI_KEYS.columns[tableKey as keyof typeof UI_KEYS.columns]
    : `ui:columns:${tableKey}`;

  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    if (typeof window === 'undefined') return defaultColumns;
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Handle wrapped format
        const savedColumns = parsed?.value ?? parsed;
        
        if (Array.isArray(savedColumns)) {
          // Merge saved visibility with default columns (preserves new columns)
          return defaultColumns.map(defaultCol => {
            const savedCol = savedColumns.find((col: ColumnConfig) => col.key === defaultCol.key);
            return savedCol ? { ...defaultCol, visible: savedCol.visible } : defaultCol;
          });
        }
      }
    } catch (error) {
      console.error(`Error loading column config for ${storageKey}:`, error);
    }
    
    return defaultColumns;
  });

  // Persist to localStorage
  useEffect(() => {
    try {
      const toStore = {
        value: columns.map(({ key, visible }) => ({ key, visible })),
        timestamp: Date.now(),
      };
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch (error) {
      console.error(`Error saving column config for ${storageKey}:`, error);
    }
  }, [columns, storageKey]);

  const toggleColumn = useCallback((key: string, visible: boolean) => {
    setColumns(prev => prev.map(col =>
      col.key === key && !col.required ? { ...col, visible } : col
    ));
  }, []);

  const resetColumns = useCallback(() => {
    setColumns(defaultColumns);
  }, [defaultColumns]);

  const visibleColumns = columns.filter(col => col.visible).map(col => col.key);

  return {
    columns,
    visibleColumns,
    toggleColumn,
    resetColumns,
  };
}

// ============================================================================
// Card Order Storage
// ============================================================================

interface UseCardOrderOptions {
  /** Unique identifier for the dialog/component */
  dialogKey: string;
  /** Default card order */
  defaultOrder: string[];
}

/**
 * Hook for managing card/section ordering with localStorage persistence
 */
export function useCardOrderStorage({ dialogKey, defaultOrder }: UseCardOrderOptions) {
  const storageKey = UI_KEYS.cardOrder(dialogKey);

  const [cardOrder, setCardOrder] = useState<string[]>(() => {
    if (typeof window === 'undefined') return defaultOrder;
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const order = parsed?.value ?? parsed;
        if (Array.isArray(order)) {
          return order;
        }
      }
    } catch (error) {
      console.error(`Error loading card order for ${storageKey}:`, error);
    }
    
    return defaultOrder;
  });

  useEffect(() => {
    try {
      const toStore = { value: cardOrder, timestamp: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch (error) {
      console.error(`Error saving card order for ${storageKey}:`, error);
    }
  }, [cardOrder, storageKey]);

  const resetOrder = useCallback(() => {
    setCardOrder(defaultOrder);
  }, [defaultOrder]);

  return {
    cardOrder,
    setCardOrder,
    resetOrder,
  };
}

// ============================================================================
// Collapsed State Storage
// ============================================================================

interface UseCollapsedStateOptions {
  /** Unique identifier for the section */
  sectionId: string;
  /** Default collapsed state */
  defaultCollapsed?: boolean;
}

/**
 * Hook for managing collapsed/expanded state with localStorage persistence
 */
export function useCollapsedState({ sectionId, defaultCollapsed = false }: UseCollapsedStateOptions) {
  const storageKey = UI_KEYS.collapsed.section(sectionId);

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return defaultCollapsed;
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        return parsed?.value ?? parsed;
      }
    } catch (error) {
      console.error(`Error loading collapsed state for ${storageKey}:`, error);
    }
    
    return defaultCollapsed;
  });

  useEffect(() => {
    try {
      const toStore = { value: isCollapsed, timestamp: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch (error) {
      console.error(`Error saving collapsed state for ${storageKey}:`, error);
    }
  }, [isCollapsed, storageKey]);

  const toggle = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  const reset = useCallback(() => {
    setIsCollapsed(defaultCollapsed);
  }, [defaultCollapsed]);

  return {
    isCollapsed,
    setIsCollapsed,
    toggle,
    reset,
  };
}

// ============================================================================
// Dashboard Configuration Storage
// ============================================================================

interface DashboardSection {
  id: string;
  visible: boolean;
  order: number;
}

interface UseDashboardSectionsOptions {
  defaultSections: DashboardSection[];
  environmentAware?: boolean;
}

/**
 * Hook for managing dashboard section visibility and ordering
 */
export function useDashboardSectionsStorage({ 
  defaultSections, 
  environmentAware = true 
}: UseDashboardSectionsOptions) {
  const getStorageKey = useCallback(() => {
    if (environmentAware) {
      const env = localStorage.getItem('system:data-environment') || 
                  localStorage.getItem('data-environment') || 
                  'production';
      return `${UI_KEYS.dashboard.sections}:${env}`;
    }
    return UI_KEYS.dashboard.sections;
  }, [environmentAware]);

  const [sections, setSections] = useState<DashboardSection[]>(() => {
    if (typeof window === 'undefined') return defaultSections;
    
    const storageKey = getStorageKey();
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const savedSections = parsed?.value ?? parsed;
        if (Array.isArray(savedSections)) {
          return savedSections;
        }
      }
    } catch (error) {
      console.error(`Error loading dashboard sections:`, error);
    }
    
    return defaultSections;
  });

  useEffect(() => {
    const storageKey = getStorageKey();
    try {
      const toStore = { value: sections, timestamp: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch (error) {
      console.error(`Error saving dashboard sections:`, error);
    }
  }, [sections, getStorageKey]);

  const toggleSection = useCallback((sectionId: string, visible: boolean) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, visible } : s
    ));
  }, []);

  const reorderSections = useCallback((newOrder: DashboardSection[]) => {
    setSections(newOrder);
  }, []);

  const resetSections = useCallback(() => {
    setSections(defaultSections);
  }, [defaultSections]);

  return {
    sections,
    setSections,
    toggleSection,
    reorderSections,
    resetSections,
    visibleSections: sections.filter(s => s.visible).sort((a, b) => a.order - b.order),
  };
}

// ============================================================================
// Privacy Settings Storage
// ============================================================================

interface PrivacySettings {
  hideFinancialData: boolean;
  hideCustomerDetails: boolean;
  hideInventoryValues: boolean;
}

const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  hideFinancialData: false,
  hideCustomerDetails: false,
  hideInventoryValues: false,
};

/**
 * Hook for managing privacy/masking settings on dashboard
 */
export function usePrivacySettings() {
  const storageKey = UI_KEYS.dashboard.privacy;

  const [settings, setSettings] = useState<PrivacySettings>(() => {
    if (typeof window === 'undefined') return DEFAULT_PRIVACY_SETTINGS;
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_PRIVACY_SETTINGS, ...(parsed?.value ?? parsed) };
      }
    } catch (error) {
      console.error('Error loading privacy settings:', error);
    }
    
    return DEFAULT_PRIVACY_SETTINGS;
  });

  useEffect(() => {
    try {
      const toStore = { value: settings, timestamp: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch (error) {
      console.error('Error saving privacy settings:', error);
    }
  }, [settings, storageKey]);

  const updateSetting = useCallback(<K extends keyof PrivacySettings>(
    key: K,
    value: PrivacySettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_PRIVACY_SETTINGS);
  }, []);

  return {
    settings,
    updateSetting,
    resetSettings,
    isAnyPrivacyEnabled: Object.values(settings).some(Boolean),
  };
}

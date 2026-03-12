import { useState, useCallback, useMemo, useEffect } from 'react';
import { STORAGE_KEYS } from '@/lib/storage-keys';

export interface InventoryColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  priority: 'high' | 'medium' | 'low';
}

const SYSTEM_DEFAULT_COLUMNS: InventoryColumnConfig[] = [
  { key: 'product', label: 'Product', visible: true, priority: 'high' },
  { key: 'brand', label: 'Brand', visible: true, priority: 'high' },
  { key: 'category', label: 'Category', visible: true, priority: 'high' },
  { key: 'price', label: 'Price', visible: true, priority: 'high' },
  { key: 'available_stock', label: 'Available Stock', visible: true, priority: 'high' },
  { key: 'allocated', label: 'Allocated', visible: true, priority: 'high' },
  { key: 'in_transit', label: 'In Transit', visible: false, priority: 'medium' },
  { key: 'pending_transit', label: 'Pending Transit', visible: true, priority: 'medium' },
  { key: 'sold_units', label: 'Sold Units', visible: false, priority: 'medium' },
  { key: 'sku', label: 'SKU', visible: false, priority: 'low' },
  { key: 'status', label: 'Status', visible: true, priority: 'medium' },
  { key: 'actions', label: 'Actions', visible: true, priority: 'high' }
];

const STORAGE_KEY = STORAGE_KEYS.columns.inventory;
const USER_DEFAULT_KEY = STORAGE_KEYS.columns.inventoryUserDefault;

type DefaultType = 'system' | 'user' | 'current';

// Load saved columns helper
const loadSavedColumns = (): InventoryColumnConfig[] => {
  if (typeof window === 'undefined') return SYSTEM_DEFAULT_COLUMNS;
  
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const savedColumns = parsed?.value ?? parsed;
      if (Array.isArray(savedColumns)) {
        return savedColumns;
      }
    }
  } catch {
    return SYSTEM_DEFAULT_COLUMNS;
  }
  
  return SYSTEM_DEFAULT_COLUMNS;
};

// Save columns helper
const saveColumns = (columns: InventoryColumnConfig[]) => {
  try {
    const toStore = { value: columns, timestamp: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch (error) {
    console.error('Error saving inventory columns:', error);
  }
};

// Load user default helper
const loadUserDefault = (): InventoryColumnConfig[] | null => {
  if (typeof window === 'undefined') return null;
  
  try {
    const saved = localStorage.getItem(USER_DEFAULT_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const savedColumns = parsed?.value ?? parsed;
      if (Array.isArray(savedColumns)) {
        return savedColumns;
      }
    }
  } catch {
    return null;
  }
  
  return null;
};

// Save user default helper
const saveUserDefault = (columns: InventoryColumnConfig[]) => {
  try {
    const toStore = { value: columns, timestamp: Date.now() };
    localStorage.setItem(USER_DEFAULT_KEY, JSON.stringify(toStore));
  } catch (error) {
    console.error('Error saving user default columns:', error);
  }
};

export function useInventoryColumnVisibility() {
  const [columns, setColumns] = useState<InventoryColumnConfig[]>(loadSavedColumns);
  const [userDefault, setUserDefaultState] = useState<InventoryColumnConfig[] | null>(loadUserDefault);

  // Persist to localStorage
  useEffect(() => {
    saveColumns(columns);
  }, [columns]);

  const toggleColumn = useCallback((key: string, visible: boolean) => {
    setColumns(prev => prev.map(col => 
      col.key === key ? { ...col, visible } : col
    ));
  }, []);

  const resetToSystemDefault = useCallback(() => {
    setColumns(SYSTEM_DEFAULT_COLUMNS);
  }, []);

  const resetToUserDefault = useCallback(() => {
    if (userDefault) {
      setColumns(userDefault);
    } else {
      resetToSystemDefault();
    }
  }, [userDefault, resetToSystemDefault]);

  const setAsUserDefault = useCallback(() => {
    saveUserDefault(columns);
    setUserDefaultState(columns);
  }, [columns]);

  const hasUserDefault = userDefault !== null;

  const currentDefaultType = useMemo((): DefaultType => {
    if (!userDefault) return 'system';
    
    const columnsMatch = JSON.stringify(columns) === JSON.stringify(userDefault);
    const systemMatch = JSON.stringify(columns) === JSON.stringify(SYSTEM_DEFAULT_COLUMNS);
    
    if (systemMatch) return 'system';
    if (columnsMatch) return 'user';
    return 'current';
  }, [columns, userDefault]);

  const visibleColumns = useMemo(() => 
    columns.filter(col => col.visible),
    [columns]
  );

  return {
    columns,
    visibleColumns,
    toggleColumn,
    resetToSystemDefault,
    resetToUserDefault,
    setAsUserDefault,
    hasUserDefault,
    currentDefaultType,
    // Legacy support
    resetColumns: resetToSystemDefault
  };
}

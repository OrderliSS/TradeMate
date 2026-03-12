import { useState, useCallback, useMemo, useEffect } from 'react';
import { STORAGE_KEYS } from '@/lib/storage-keys';

interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  required?: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'asset_tag', label: 'Asset Tag', visible: true, required: true },
  { key: 'status', label: 'Status', visible: true, required: true },
  { key: 'available', label: 'Available', visible: true },
  { key: 'serial_number', label: 'Serial Number', visible: true },
  { key: 'location', label: 'Location', visible: true },
  { key: 'assigned_to', label: 'Assigned To', visible: true },
  { key: 'mac_address', label: 'MAC Address', visible: false },
  { key: 'ip_address', label: 'IP Address', visible: false },
  { key: 'created_at', label: 'Created Date', visible: false },
  { key: 'actions', label: 'Actions', visible: true, required: true }
];

const STORAGE_KEY = STORAGE_KEYS.columns.assets;

// Load saved columns helper
const loadSavedColumns = (): ColumnConfig[] => {
  if (typeof window === 'undefined') return DEFAULT_COLUMNS;
  
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const savedColumns = parsed?.value ?? parsed;
      if (Array.isArray(savedColumns)) {
        return DEFAULT_COLUMNS.map(defaultCol => {
          const savedCol = savedColumns.find((col: ColumnConfig) => col.key === defaultCol.key);
          return savedCol ? { ...defaultCol, visible: savedCol.visible } : defaultCol;
        });
      }
    }
  } catch {
    return DEFAULT_COLUMNS;
  }
  
  return DEFAULT_COLUMNS;
};

// Save columns helper
const saveColumns = (columns: ColumnConfig[]) => {
  try {
    const toStore = { value: columns, timestamp: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch (error) {
    console.error('Error saving asset columns:', error);
  }
};

export function useAssetColumns() {
  const [columns, setColumns] = useState<ColumnConfig[]>(loadSavedColumns);

  // Persist to localStorage
  useEffect(() => {
    saveColumns(columns);
  }, [columns]);

  const toggleColumn = useCallback((key: string, visible: boolean) => {
    setColumns(prev => prev.map(col => 
      col.key === key && !col.required ? { ...col, visible } : col
    ));
  }, []);

  const resetColumns = useCallback(() => {
    setColumns(DEFAULT_COLUMNS);
  }, []);

  const visibleColumns = useMemo(() => 
    columns.filter(col => col.visible).map(col => col.key),
    [columns]
  );

  return {
    columns,
    visibleColumns,
    toggleColumn,
    resetColumns
  };
}

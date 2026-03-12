import { useState, useCallback, useMemo, useEffect } from 'react';
import { STORAGE_KEYS } from '@/lib/storage-keys';
import type { ColumnConfig } from '@/components/StockOrderColumnToggle';

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'name', label: 'Name', visible: true, priority: 'high' },
  { key: 'quantity', label: 'QTY', visible: true, priority: 'high' },
  { key: 'category', label: 'Category', visible: true, priority: 'high' },
  { key: 'amount', label: 'Amount', visible: true, priority: 'high' },
  { key: 'delivery_status', label: 'Delivery Status', visible: true, priority: 'high' },
  { key: 'tracking', label: 'Tracking', visible: true, priority: 'medium' },
  { key: 'purchase_date', label: 'Purchase Date', visible: true, priority: 'medium' },
  { key: 'vendor', label: 'Vendor Platform', visible: true, priority: 'medium' },
  { key: 'store_name', label: 'Store', visible: false, priority: 'low' },
  { key: 'order_number', label: 'Order #', visible: false, priority: 'low' },
  { key: 'estimated_delivery', label: 'Est. Delivery', visible: false, priority: 'low' },
  { key: 'notes', label: 'Notes', visible: false, priority: 'low' },
  { key: 'actions', label: 'Actions', visible: false, priority: 'low' }
];

const STORAGE_KEY = STORAGE_KEYS.columns.stockOrders;

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
    console.error('Error saving stock order columns:', error);
  }
};

export function useColumnVisibility() {
  const [columns, setColumns] = useState<ColumnConfig[]>(loadSavedColumns);

  // Persist to localStorage
  useEffect(() => {
    saveColumns(columns);
  }, [columns]);

  const toggleColumn = useCallback((key: string, visible: boolean) => {
    setColumns(prev => prev.map(col => 
      col.key === key ? { ...col, visible } : col
    ));
  }, []);

  const resetColumns = useCallback(() => {
    setColumns(DEFAULT_COLUMNS);
  }, []);

  const visibleColumns = useMemo(() => 
    columns.filter(col => col.visible),
    [columns]
  );

  return {
    columns,
    visibleColumns,
    toggleColumn,
    resetColumns
  };
}

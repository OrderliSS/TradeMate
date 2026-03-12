import { useState, useEffect } from 'react';

interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  required?: boolean;
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'task_number', label: 'Task #', visible: true, required: true },
  { key: 'title', label: 'Title', visible: true, required: true },
  { key: 'customer', label: 'Customer', visible: true },
  { key: 'priority', label: 'Priority', visible: true },
  { key: 'status', label: 'Status', visible: true },
  { key: 'task_type', label: 'Type', visible: true },
  { key: 'due_date', label: 'Due Date', visible: true },
  { key: 'follow_up_date', label: 'Follow-up', visible: false },
  { key: 'linked_purchase', label: 'Linked Purchase', visible: false },
  { key: 'created_at', label: 'Created', visible: false },
  { key: 'actions', label: 'Actions', visible: true, required: true }
];

const STORAGE_KEY = 'task-table-columns-v1';

export function useTaskColumns() {
  const [columns, setColumns] = useState<ColumnConfig[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsedColumns = JSON.parse(saved);
        return DEFAULT_COLUMNS.map(defaultCol => {
          const savedCol = parsedColumns.find((col: ColumnConfig) => col.key === defaultCol.key);
          return savedCol ? { ...defaultCol, visible: savedCol.visible } : defaultCol;
        });
      } catch {
        return DEFAULT_COLUMNS;
      }
    }
    return DEFAULT_COLUMNS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
  }, [columns]);

  const toggleColumn = (key: string, visible: boolean) => {
    setColumns(prev => prev.map(col => 
      col.key === key && !col.required ? { ...col, visible } : col
    ));
  };

  const resetColumns = () => {
    setColumns(DEFAULT_COLUMNS);
  };

  const visibleColumns = columns.filter(col => col.visible).map(col => col.key);

  return {
    columns,
    visibleColumns,
    toggleColumn,
    resetColumns
  };
}

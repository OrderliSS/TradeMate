import { useLocalStorage } from './useLocalStorage';

export interface TaskSettings {
  // Display Settings
  defaultView: 'cards' | 'table' | 'compact';
  itemsPerPage: number;
  showCompletedInline: boolean;
  highlightOverdue: boolean;
  
  // Behavior Settings
  confirmBulkDelete: boolean;
  confirmStatusChange: boolean;
  autoArchiveCompleted: boolean;
  autoArchiveDays: number;
  
  // Performance Settings
  enableVirtualScrolling: boolean;
  enableAnimations: boolean;
  
  // Advanced Settings
  enableKeyboardShortcuts: boolean;
  enableSwipeGestures: boolean;
}

export const DEFAULT_TASK_SETTINGS: TaskSettings = {
  defaultView: 'cards',
  itemsPerPage: 20,
  showCompletedInline: false,
  highlightOverdue: true,
  confirmBulkDelete: true,
  confirmStatusChange: false,
  autoArchiveCompleted: false,
  autoArchiveDays: 30,
  enableVirtualScrolling: true,
  enableAnimations: true,
  enableKeyboardShortcuts: true,
  enableSwipeGestures: true,
};

export const useTaskSettings = () => {
  const [settings, setSettings] = useLocalStorage<TaskSettings>(
    'task_settings',
    DEFAULT_TASK_SETTINGS
  );
  
  const updateSetting = <K extends keyof TaskSettings>(
    key: K,
    value: TaskSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };
  
  const resetSettings = () => {
    setSettings(DEFAULT_TASK_SETTINGS);
  };
  
  return { settings, updateSetting, resetSettings };
};

import { useEffect } from 'react';

interface KeyboardShortcutsConfig {
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onClearSelection: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  hasSelection: boolean;
  selectedCount: number;
}

export const useTaskKeyboardShortcuts = ({
  onSelectAll,
  onDeselectAll,
  onClearSelection,
  onArchive,
  onDelete,
  hasSelection,
  selectedCount,
}: KeyboardShortcutsConfig) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd + A: Select all
      if (modKey && e.key === 'a') {
        e.preventDefault();
        onSelectAll();
      }

      // Ctrl/Cmd + D: Deselect all
      if (modKey && e.key === 'd') {
        e.preventDefault();
        onDeselectAll();
      }

      // Escape: Clear selection
      if (e.key === 'Escape' && hasSelection) {
        e.preventDefault();
        onClearSelection();
      }

      // Delete: Archive (only if tasks are selected)
      if (e.key === 'Delete' && hasSelection && !e.shiftKey && onArchive) {
        e.preventDefault();
        onArchive();
      }

      // Shift + Delete: Delete (only if tasks are selected)
      if (e.key === 'Delete' && e.shiftKey && hasSelection && onDelete) {
        e.preventDefault();
        onDelete();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    onSelectAll,
    onDeselectAll,
    onClearSelection,
    onArchive,
    onDelete,
    hasSelection,
    selectedCount,
  ]);
};

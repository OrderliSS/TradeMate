import { useEffect, useCallback } from "react";

interface UseKeyboardSaveOptions {
  onSave: () => void;
  onCancel: () => void;
  hasUnsavedChanges: boolean;
  enabled?: boolean;
  onEscapeWithChanges?: () => void;
}

/**
 * Hook for desktop keyboard shortcuts in editors
 * - Ctrl/Cmd + Enter → Save
 * - Esc → Close (if clean) or trigger unsaved changes handler
 */
export function useKeyboardSave({
  onSave,
  onCancel,
  hasUnsavedChanges,
  enabled = true,
  onEscapeWithChanges,
}: UseKeyboardSaveOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Ctrl/Cmd + Enter → Save
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        onSave();
        return;
      }

      // Escape key handling
      if (e.key === "Escape") {
        e.preventDefault();
        if (hasUnsavedChanges) {
          // If there's a custom handler for escape with changes, use it
          // Otherwise, trigger cancel which should show discard dialog
          if (onEscapeWithChanges) {
            onEscapeWithChanges();
          } else {
            onCancel();
          }
        } else {
          // Clean exit
          onCancel();
        }
        return;
      }
    },
    [enabled, onSave, onCancel, hasUnsavedChanges, onEscapeWithChanges]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}

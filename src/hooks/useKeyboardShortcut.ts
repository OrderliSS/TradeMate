import { useEffect } from 'react';

interface KeyboardShortcutOptions {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  callback: () => void;
  enabled?: boolean;
}

export const useKeyboardShortcut = ({
  key,
  ctrl = false,
  shift = false,
  alt = false,
  meta = false,
  callback,
  enabled = true,
}: KeyboardShortcutOptions) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const ctrlKey = event.ctrlKey || event.metaKey; // Support both Ctrl and Cmd
      
      if (
        event.key.toLowerCase() === key.toLowerCase() &&
        (ctrl ? ctrlKey : !ctrlKey) &&
        (shift ? event.shiftKey : !event.shiftKey) &&
        (alt ? event.altKey : !event.altKey) &&
        (meta ? event.metaKey : true)
      ) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key, ctrl, shift, alt, meta, callback, enabled]);
};

import { useEffect } from 'react';
import { useCommandPalette } from '@/contexts/CommandPaletteContext';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  callback: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl === undefined || shortcut.ctrl === event.ctrlKey;
        const shiftMatch = shortcut.shift === undefined || shortcut.shift === event.shiftKey;
        const altMatch = shortcut.alt === undefined || shortcut.alt === event.altKey;
        const metaMatch = shortcut.meta === undefined || shortcut.meta === event.metaKey;
        const keyMatch = shortcut.key?.toLowerCase() === event.key?.toLowerCase();

        if (ctrlMatch && shiftMatch && altMatch && metaMatch && keyMatch) {
          event.preventDefault();
          shortcut.callback();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}

export function useGlobalKeyboardShortcuts() {
  // Get command palette control from context
  let commandPalette;
  try {
    commandPalette = useCommandPalette();
  } catch (e) {
    // Context not available, skip command palette shortcut
    commandPalette = null;
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle Cmd/Ctrl+K for command palette
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        console.log('[Global Shortcuts] Cmd+K pressed, toggling command palette');
        commandPalette?.toggleCommandPalette();
        return;
      }

      // Handle / for search
      if (event.key === '/' && !event.metaKey && !event.ctrlKey) {
        const target = event.target as HTMLElement;
        // Don't trigger if already in an input
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        
        event.preventDefault();
        const searchInput = document.querySelector('[role="search"] input, [type="search"]') as HTMLInputElement;
        searchInput?.focus();
        return;
      }

      // Handle Escape
      if (event.key === 'Escape') {
        const activeElement = document.activeElement as HTMLElement;
        activeElement?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPalette]);
}

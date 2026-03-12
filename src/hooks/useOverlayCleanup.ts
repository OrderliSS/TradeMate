import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Force unlock all interaction by resetting pointer-events on common blocking elements
 */
function forceUnlockInteraction() {
  // Reset body and root
  document.body.style.pointerEvents = '';
  const root = document.getElementById('root');
  if (root) {
    root.style.pointerEvents = '';
  }

  // Reset Vaul drawer wrapper (common culprit)
  const vaulWrappers = document.querySelectorAll('[data-vaul-drawer-wrapper]');
  vaulWrappers.forEach((wrapper) => {
    (wrapper as HTMLElement).style.pointerEvents = '';
  });

  // Remove any stale overlays
  const staleOverlays = document.querySelectorAll(
    '[data-state="closed"][data-radix-dialog-overlay], ' +
    '[data-state="closed"][data-vaul-overlay]'
  );
  staleOverlays.forEach((overlay) => {
    (overlay as HTMLElement).style.pointerEvents = 'none';
    overlay.remove();
  });
}

/**
 * Check if any dialog/drawer is currently open
 */
function hasOpenDialogs(): boolean {
  const openDialogs = document.querySelectorAll(
    '[data-state="open"][data-radix-dialog-overlay], ' +
    '[data-state="open"][role="dialog"], ' +
    '[data-state="open"][data-vaul-drawer]'
  );
  return openDialogs.length > 0;
}

/**
 * Safety hook to monitor and clean up orphaned dialog/drawer overlays
 * that may not have been properly unmounted due to React state issues
 */
export function useOverlayCleanup() {
  const location = useLocation();

  // Route-change safety valve: unlock interaction on every navigation
  useEffect(() => {
    // Small delay to let React finish unmounting
    const timeoutId = setTimeout(() => {
      if (!hasOpenDialogs()) {
        forceUnlockInteraction();
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [location.pathname]);

  useEffect(() => {
    // Enhanced cleanup with more aggressive detection
    const checkInterval = setInterval(() => {
      // If no dialogs are open, force unlock interaction
      if (!hasOpenDialogs()) {
        // Check if body or root is blocked
        const bodyStyle = window.getComputedStyle(document.body);
        const root = document.getElementById('root');
        const rootStyle = root ? window.getComputedStyle(root) : null;
        
        if (bodyStyle.pointerEvents === 'none' || rootStyle?.pointerEvents === 'none') {
          console.warn('[Overlay Cleanup] Body/root blocked with no open dialogs, force unlocking');
          forceUnlockInteraction();
        }

        // Check Vaul wrapper
        const vaulWrappers = document.querySelectorAll('[data-vaul-drawer-wrapper]');
        vaulWrappers.forEach((wrapper) => {
          const style = window.getComputedStyle(wrapper as HTMLElement);
          if (style.pointerEvents === 'none') {
            console.warn('[Overlay Cleanup] Vaul wrapper blocked with no open dialogs, force unlocking');
            (wrapper as HTMLElement).style.pointerEvents = '';
          }
        });
      }

      // Find only genuine overlay elements (not dialog content or portals)
      const overlays = document.querySelectorAll(
        '[data-radix-dialog-overlay], ' +
        '[data-vaul-overlay]'
      );
      
      overlays.forEach((overlay) => {
        const parent = overlay.parentElement;
        const state = overlay.getAttribute('data-state');
        
        // NEVER touch open elements - they're supposed to be interactive
        if (state === 'open') {
          return;
        }
        
        // Check if the overlay is orphaned (parent is not in body or has been removed)
        if (!parent || !document.body.contains(parent)) {
          console.warn('[Overlay Cleanup] Removing orphaned overlay:', overlay);
          overlay.remove();
          return;
        }
        
        // If overlay is visible but should be hidden (has closed state)
        const computedStyle = window.getComputedStyle(overlay as HTMLElement);
        const hasPointerEvents = computedStyle.pointerEvents !== 'none';
        
        if (hasPointerEvents && state === 'closed') {
          console.warn('[Overlay Cleanup] Forcing pointer-events: none on closed overlay:', overlay);
          (overlay as HTMLElement).style.pointerEvents = 'none';
        }
        
        // Remove stale overlays that have been closed for more than 1 second
        if (state === 'closed') {
          const closedTime = parseInt(overlay.getAttribute('data-closed-time') || '0');
          const now = Date.now();
          
          if (closedTime && now - closedTime > 1000) {
            console.warn('[Overlay Cleanup] Removing stale closed overlay after 1s:', overlay);
            overlay.remove();
          } else if (!closedTime) {
            overlay.setAttribute('data-closed-time', now.toString());
          }
        }
      });
    }, 500); // Check every 500ms

    // Add escape key listener as safety valve
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        console.log('[Overlay Cleanup] Escape pressed, force unlocking interaction');
        forceUnlockInteraction();
      }
    };
    
    document.addEventListener('keydown', handleEscape);

    return () => {
      clearInterval(checkInterval);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);
}

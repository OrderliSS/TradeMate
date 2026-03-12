import { useCallback } from 'react';

/**
 * Hook that provides safe dialog/drawer closing with proper cleanup
 * Ensures overlays are properly unmounted and pointer-events are disabled
 */
export const useDialogSafeClose = (onOpenChange?: (open: boolean) => void) => {
  const safeClose = useCallback(() => {
    console.log('[SafeClose] Initiating safe close sequence');
    
    // First, trigger the close via onOpenChange
    onOpenChange?.(false);
    
    // Add a small delay to ensure animations complete and Radix properly unmounts
    setTimeout(() => {
      // Force remove pointer-events from any lingering overlays
      const overlays = document.querySelectorAll(
        '[data-radix-dialog-overlay][data-state="closed"], ' +
        '[data-vaul-drawer-wrapper][data-state="closed"]'
      );
      
      overlays.forEach(overlay => {
        console.log('[SafeClose] Forcing pointer-events: none on overlay:', overlay);
        (overlay as HTMLElement).style.pointerEvents = 'none';
        
        // Schedule removal after a brief delay
        setTimeout(() => {
          if (overlay.parentElement && overlay.getAttribute('data-state') === 'closed') {
            console.log('[SafeClose] Removing stale overlay:', overlay);
            overlay.remove();
          }
        }, 500);
      });
    }, 100);
  }, [onOpenChange]);

  return safeClose;
};

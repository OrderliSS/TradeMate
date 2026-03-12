import { useEffect, useCallback, useRef } from "react";

interface UseAndroidBackHandlerOptions {
  /** Whether the handler is active */
  enabled: boolean;
  /** Whether keyboard is currently open */
  isKeyboardOpen: boolean;
  /** Callback to dismiss keyboard */
  onDismissKeyboard: () => void;
  /** Callback to exit focus mode */
  onExitFocusMode: () => void;
}

/**
 * Hook to handle Android back button behavior in Input Focus Mode
 * 
 * Behavior per canonical pattern:
 * - First back press: dismiss keyboard if open
 * - Second back press: exit focus mode
 * - Third back press: allow normal navigation
 */
export function useAndroidBackHandler({
  enabled,
  isKeyboardOpen,
  onDismissKeyboard,
  onExitFocusMode,
}: UseAndroidBackHandlerOptions) {
  const backPressCountRef = useRef(0);
  const lastBackPressRef = useRef(0);

  // Reset counter when keyboard state changes or mode changes
  useEffect(() => {
    if (isKeyboardOpen) {
      backPressCountRef.current = 0;
    }
  }, [isKeyboardOpen]);

  // Reset counter when disabled
  useEffect(() => {
    if (!enabled) {
      backPressCountRef.current = 0;
    }
  }, [enabled]);

  const handlePopState = useCallback((event: PopStateEvent) => {
    if (!enabled) return;

    const now = Date.now();
    
    // Reset counter if more than 2 seconds since last back press
    if (now - lastBackPressRef.current > 2000) {
      backPressCountRef.current = 0;
    }
    lastBackPressRef.current = now;

    if (isKeyboardOpen) {
      // First back press with keyboard open: dismiss keyboard
      event.preventDefault();
      // Push state back to prevent actual navigation
      window.history.pushState(null, "", window.location.href);
      onDismissKeyboard();
      backPressCountRef.current = 1;
    } else if (backPressCountRef.current < 2) {
      // Second back press (keyboard closed): exit focus mode
      event.preventDefault();
      window.history.pushState(null, "", window.location.href);
      onExitFocusMode();
      backPressCountRef.current = 2;
    }
    // Third press: allow normal navigation (don't prevent)
  }, [enabled, isKeyboardOpen, onDismissKeyboard, onExitFocusMode]);

  useEffect(() => {
    if (!enabled) return;

    // Push initial state to create back button entry
    window.history.pushState(null, "", window.location.href);
    
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [enabled, handlePopState]);
}

export default useAndroidBackHandler;

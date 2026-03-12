import { useState, useEffect, useCallback, useRef } from "react";

export interface KeyboardInfo {
  visible: boolean;
  height: number;
  safeAreaBottom: number;
  animationDurationMs: number;
  animationCurve: string;
}

export interface KeyboardState extends KeyboardInfo {
  isOpen: boolean;
  animating: boolean;
  layoutSettled: boolean;
  viewportHeight: number;
  effectiveBottomInset: number;
}

const DEFAULT_ANIMATION_DURATION = 250;
const DEFAULT_ANIMATION_CURVE = "cubic-bezier(0.4, 0, 0.2, 1)";
const LAYOUT_SETTLE_DELAY = 50;

/**
 * Hook to detect keyboard visibility and height using Visual Viewport API
 * Provides comprehensive keyboard state including safe area and animation info
 */
export function useKeyboardState(extraBottomPadding: number = 0) {
  const [state, setState] = useState<KeyboardState>({
    isOpen: false,
    visible: false,
    height: 0,
    safeAreaBottom: 0,
    animating: false,
    layoutSettled: true,
    viewportHeight: typeof window !== "undefined" ? window.innerHeight : 0,
    animationDurationMs: DEFAULT_ANIMATION_DURATION,
    animationCurve: DEFAULT_ANIMATION_CURVE,
    effectiveBottomInset: 0,
  });

  const previousHeightRef = useRef(0);
  const settleTimeoutRef = useRef<NodeJS.Timeout>();
  const animationFrameRef = useRef<number>();

  // Get safe area bottom inset
  const getSafeAreaBottom = useCallback(() => {
    if (typeof window === "undefined") return 0;
    const style = getComputedStyle(document.documentElement);
    const safeArea = style.getPropertyValue("--safe-area-inset-bottom");
    if (safeArea) {
      return parseFloat(safeArea) || 0;
    }
    // Fallback: try to get from env()
    const testEl = document.createElement("div");
    testEl.style.paddingBottom = "env(safe-area-inset-bottom, 0px)";
    document.body.appendChild(testEl);
    const computed = parseFloat(getComputedStyle(testEl).paddingBottom) || 0;
    document.body.removeChild(testEl);
    return computed;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    const updateKeyboardState = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      animationFrameRef.current = requestAnimationFrame(() => {
        const windowHeight = window.innerHeight;
        const viewportHeight = visualViewport.height;
        const keyboardHeight = Math.max(0, windowHeight - viewportHeight - visualViewport.offsetTop);
        const safeAreaBottom = getSafeAreaBottom();
        
        const isKeyboardVisible = keyboardHeight > 150;
        const heightChanged = Math.abs(keyboardHeight - previousHeightRef.current) > 10;
        
        // Clear previous settle timeout
        if (settleTimeoutRef.current) {
          clearTimeout(settleTimeoutRef.current);
        }

        // Set animating state if height is changing
        if (heightChanged) {
          setState(prev => ({
            ...prev,
            animating: true,
            layoutSettled: false,
          }));
        }

        const effectiveBottomInset = isKeyboardVisible 
          ? keyboardHeight + extraBottomPadding 
          : safeAreaBottom + extraBottomPadding;

        setState(prev => ({
          ...prev,
          isOpen: isKeyboardVisible,
          visible: isKeyboardVisible,
          height: keyboardHeight,
          safeAreaBottom,
          viewportHeight,
          effectiveBottomInset,
        }));

        // Update CSS variables
        document.documentElement.style.setProperty(
          "--keyboard-height",
          `${keyboardHeight}px`
        );
        document.documentElement.style.setProperty(
          "--visual-viewport-height",
          `${viewportHeight}px`
        );
        document.documentElement.style.setProperty(
          "--effective-bottom-inset",
          `${effectiveBottomInset}px`
        );

        previousHeightRef.current = keyboardHeight;

        // Set layout settled after animation completes
        settleTimeoutRef.current = setTimeout(() => {
          setState(prev => ({
            ...prev,
            animating: false,
            layoutSettled: true,
          }));
        }, DEFAULT_ANIMATION_DURATION + LAYOUT_SETTLE_DELAY);
      });
    };

    // Initial update
    updateKeyboardState();

    // Listen to viewport changes
    visualViewport.addEventListener("resize", updateKeyboardState);
    visualViewport.addEventListener("scroll", updateKeyboardState);
    window.addEventListener("resize", updateKeyboardState);

    return () => {
      visualViewport.removeEventListener("resize", updateKeyboardState);
      visualViewport.removeEventListener("scroll", updateKeyboardState);
      window.removeEventListener("resize", updateKeyboardState);
      if (settleTimeoutRef.current) {
        clearTimeout(settleTimeoutRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [getSafeAreaBottom, extraBottomPadding]);

  const dismissKeyboard = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, []);

  const getKeyboardInfo = useCallback((): KeyboardInfo => ({
    visible: state.visible,
    height: state.height,
    safeAreaBottom: state.safeAreaBottom,
    animationDurationMs: state.animationDurationMs,
    animationCurve: state.animationCurve,
  }), [state]);

  return {
    ...state,
    dismissKeyboard,
    getKeyboardInfo,
  };
}

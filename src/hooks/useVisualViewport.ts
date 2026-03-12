import { useState, useEffect } from "react";

/**
 * Hook to track the visual viewport height and detect keyboard visibility
 * Uses the Visual Viewport API for accurate keyboard detection on mobile
 */
export function useVisualViewport() {
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== "undefined" 
      ? (window.visualViewport?.height ?? window.innerHeight)
      : 800
  );
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const updateViewport = () => {
      const height = viewport.height;
      setViewportHeight(height);
      
      // Keyboard is likely open if viewport is significantly smaller than window
      // Using 75% threshold to account for toolbars and other UI elements
      const isKeyboardOpen = height < window.innerHeight * 0.75;
      setKeyboardOpen(isKeyboardOpen);
      
      // Update CSS variable for use in styles
      document.documentElement.style.setProperty(
        '--visual-viewport-height',
        `${height}px`
      );
    };

    viewport.addEventListener('resize', updateViewport);
    viewport.addEventListener('scroll', updateViewport);
    
    // Initial update
    updateViewport();

    return () => {
      viewport.removeEventListener('resize', updateViewport);
      viewport.removeEventListener('scroll', updateViewport);
    };
  }, []);

  return { viewportHeight, keyboardOpen };
}

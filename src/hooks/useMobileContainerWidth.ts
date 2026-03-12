import { useRef, useEffect, useState } from 'react';

/**
 * Hook to safely constrain mobile container widths
 * Prevents horizontal overflow on mobile devices
 */
export const useMobileContainerWidth = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const parent = containerRef.current.parentElement;
        if (parent) {
          setContainerWidth(parent.clientWidth);
        }
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  return { containerRef, containerWidth };
};

/**
 * CSS classes for mobile-safe horizontal scrolling containers
 * Use these for elements that need to scroll horizontally on mobile
 */
export const mobileScrollContainerClasses = {
  // Full-bleed scroll container with hidden scrollbar
  fullBleed: "overflow-x-auto scrollbar-hide -mx-4 px-4",
  // Contained scroll with visible scrollbar for discoverability
  contained: "overflow-x-auto",
  // Snap scroll for card carousels
  snapScroll: "overflow-x-auto scrollbar-hide snap-x snap-mandatory",
};

/**
 * Utility classes for preventing overflow on mobile
 */
export const mobileWidthClasses = {
  // Prevents any child from overflowing
  constrainChildren: "max-w-full overflow-hidden",
  // For text that should truncate
  truncate: "truncate max-w-full",
  // For flexible containers that should shrink
  flexShrink: "min-w-0 flex-shrink",
};

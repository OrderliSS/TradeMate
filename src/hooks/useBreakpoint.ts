import { useState, useEffect, useCallback } from 'react';
import { throttle } from '@/lib/performance-utils';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide';

export interface BreakpointState {
  current: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isWide: boolean;
  width: number;
}

const BREAKPOINTS = {
  mobile: 767,     // < 768px
  tablet: 1023,    // 768px - 1023px
  desktop: 1439,   // 1024px - 1439px
  wide: 1440       // >= 1440px
} as const;

function getBreakpoint(width: number): Breakpoint {
  if (width <= BREAKPOINTS.mobile) return 'mobile';
  if (width <= BREAKPOINTS.tablet) return 'tablet';
  if (width <= BREAKPOINTS.desktop) return 'desktop';
  return 'wide';
}

export function useBreakpoint(): BreakpointState {
  const [state, setState] = useState<BreakpointState>(() => {
    if (typeof window === 'undefined') {
      return {
        current: 'desktop',
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isWide: false,
        width: 1024
      };
    }

    const width = window.innerWidth;
    const current = getBreakpoint(width);
    
    return {
      current,
      isMobile: current === 'mobile',
      isTablet: current === 'tablet',
      isDesktop: current === 'desktop',
      isWide: current === 'wide',
      width
    };
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const current = getBreakpoint(width);
      
      setState({
        current,
        isMobile: current === 'mobile',
        isTablet: current === 'tablet',
        isDesktop: current === 'desktop',
        isWide: current === 'wide',
        width
      });
    };

    // Throttle resize handler to 100ms to prevent excessive recalculations
    const throttledResize = throttle(handleResize, 100);

    window.addEventListener('resize', throttledResize);
    handleResize(); // Set initial state immediately

    return () => window.removeEventListener('resize', throttledResize);
  }, []);

  return state;
}
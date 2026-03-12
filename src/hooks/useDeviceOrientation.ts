import { useState, useEffect } from 'react';

export type Orientation = 'portrait' | 'landscape';

export interface OrientationState {
  orientation: Orientation;
  isPortrait: boolean;
  isLandscape: boolean;
  aspectRatio: number;
}

export function useDeviceOrientation(): OrientationState {
  const [state, setState] = useState<OrientationState>(() => {
    if (typeof window === 'undefined') {
      return {
        orientation: 'landscape',
        isPortrait: false,
        isLandscape: true,
        aspectRatio: 16/9
      };
    }

    const { innerWidth: width, innerHeight: height } = window;
    const aspectRatio = width / height;
    const orientation: Orientation = width > height ? 'landscape' : 'portrait';
    
    return {
      orientation,
      isPortrait: orientation === 'portrait',
      isLandscape: orientation === 'landscape',
      aspectRatio
    };
  });

  useEffect(() => {
    const handleResize = () => {
      const { innerWidth: width, innerHeight: height } = window;
      const aspectRatio = width / height;
      const orientation: Orientation = width > height ? 'landscape' : 'portrait';
      
      setState({
        orientation,
        isPortrait: orientation === 'portrait',
        isLandscape: orientation === 'landscape',
        aspectRatio
      });
    };

    const handleOrientationChange = () => {
      // Small delay to ensure window dimensions are updated
      setTimeout(handleResize, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    
    handleResize(); // Set initial state

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return state;
}
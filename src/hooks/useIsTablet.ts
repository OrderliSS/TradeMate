import { useState, useEffect } from 'react';

const TABLET_MIN_WIDTH = 768;
const TABLET_MAX_WIDTH = 1023;

export function useIsTablet(): boolean {
  const [isTablet, setIsTablet] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const width = window.innerWidth;
    return width >= TABLET_MIN_WIDTH && width <= TABLET_MAX_WIDTH;
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsTablet(width >= TABLET_MIN_WIDTH && width <= TABLET_MAX_WIDTH);
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Set initial state

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isTablet;
}
import { useState, useEffect } from 'react';

/**
 * Hook to detect viewport height and apply scaling classes 
 * to maintain the 'Zero-Scroll' mandate on smaller screens.
 */
export function useViewportDensity() {
    const [viewportHeight, setViewportHeight] = useState(
        typeof window !== 'undefined' ? window.innerHeight : 1000
    );

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleResize = () => {
            setViewportHeight(window.innerHeight);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Threshold for reduced gap/padding (e.g., laptop screens < 900px vertical)
    const isCompactHeight = viewportHeight < 900;

    return {
        viewportHeight,
        isCompactHeight,
        densityClass: isCompactHeight ? 'density-viewport-sm' : ''
    };
}

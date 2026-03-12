import { useEffect, useState } from "react";

/**
 * Custom hook for managing staggered animations
 */
export const useStaggeredAnimation = (itemCount: number, delay: number = 50) => {
  const [animatedItems, setAnimatedItems] = useState<Set<number>>(new Set());

  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = [];
    
    for (let i = 0; i < itemCount; i++) {
      const timeout = setTimeout(() => {
        setAnimatedItems(prev => new Set(prev).add(i));
      }, i * delay);
      
      timeouts.push(timeout);
    }

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [itemCount, delay]);

  const isAnimated = (index: number) => animatedItems.has(index);
  
  const getStaggerClass = (index: number) => {
    const staggerIndex = Math.min(index + 1, 6);
    return `stagger-${staggerIndex}`;
  };

  const reset = () => setAnimatedItems(new Set());

  return {
    isAnimated,
    getStaggerClass,
    reset,
    animatedCount: animatedItems.size
  };
};

/**
 * Hook for managing reduced motion preferences
 */
export const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return prefersReducedMotion;
};

/**
 * Hook for intersection-based animations
 */
export const useIntersectionAnimation = (
  threshold: number = 0.1,
  rootMargin: string = "0px"
) => {
  const [isVisible, setIsVisible] = useState(false);
  const [ref, setRef] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!ref) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(ref);

    return () => {
      if (ref) observer.unobserve(ref);
    };
  }, [ref, threshold, rootMargin]);

  return { ref: setRef, isVisible };
};
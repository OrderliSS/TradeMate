import React from "react";
import { cn } from "@/lib/utils";

/**
 * Enhanced Performance Components
 * Provides optimized rendering, lazy loading, and performance monitoring
 */

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallback?: string;
  loadingClassName?: string;
  errorClassName?: string;
}

export const LazyImage = ({ 
  src, 
  alt, 
  fallback, 
  className, 
  loadingClassName, 
  errorClassName,
  ...props 
}: LazyImageProps) => {
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState(false);
  const [shouldLoad, setShouldLoad] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {isLoading && (
        <div className={cn("absolute inset-0 loading-shimmer", loadingClassName)} />
      )}
      
      <img
        ref={imgRef}
        src={shouldLoad ? (hasError && fallback ? fallback : src) : undefined}
        alt={alt}
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          "transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100",
          hasError && errorClassName
        )}
        loading="lazy"
        decoding="async"
        {...props}
      />
    </div>
  );
};

interface VirtualizedListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
}

export function VirtualizedList<T>({ 
  items, 
  itemHeight, 
  containerHeight, 
  renderItem, 
  className 
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  );

  const visibleItems = items.slice(visibleStart, visibleEnd);
  const offsetY = visibleStart * itemHeight;

  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("overflow-auto", className)}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <div key={visibleStart + index} style={{ height: itemHeight }}>
              {renderItem(item, visibleStart + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface MemoizedComponentProps {
  children: React.ReactNode;
  dependencies: any[];
  className?: string;
}

export const MemoizedWrapper = React.memo(({ children, className }: MemoizedComponentProps) => {
  return <div className={className}>{children}</div>;
});

MemoizedWrapper.displayName = "MemoizedWrapper";

// Performance monitoring hook
export const usePerformanceMonitor = (componentName: string) => {
  const renderStart = React.useRef(0);
  const [renderTime, setRenderTime] = React.useState(0);

  React.useLayoutEffect(() => {
    renderStart.current = performance.now();
  });

  React.useEffect(() => {
    const renderEnd = performance.now();
    const duration = renderEnd - renderStart.current;
    setRenderTime(duration);

    if (process.env.NODE_ENV === 'development' && duration > 16) {
      console.warn(`${componentName} render took ${duration.toFixed(2)}ms (target: <16ms)`);
    }
  });

  return renderTime;
};

// Debounced value hook for performance
export const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Throttled callback hook
export const useThrottle = (callback: (...args: any[]) => void, delay: number) => {
  const lastCall = React.useRef(0);
  
  return React.useCallback((...args: any[]) => {
    const now = Date.now();
    if (now - lastCall.current >= delay) {
      lastCall.current = now;
      callback(...args);
    }
  }, [callback, delay]);
};

interface LazyComponentProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  threshold?: number;
  className?: string;
}

export const LazyComponent = ({ 
  children, 
  fallback, 
  threshold = 0.1, 
  className 
}: LazyComponentProps) => {
  const [shouldRender, setShouldRender] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  return (
    <div ref={ref} className={className}>
      {shouldRender ? children : fallback}
    </div>
  );
};

// Resource preloader hook
export const usePreloadResources = (resources: string[]) => {
  React.useEffect(() => {
    const links: HTMLLinkElement[] = [];

    resources.forEach((resource) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = resource;
      
      if (resource.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
        link.as = 'image';
      } else if (resource.match(/\.(woff|woff2|ttf|otf)$/i)) {
        link.as = 'font';
        link.crossOrigin = 'anonymous';
      } else if (resource.match(/\.(css)$/i)) {
        link.as = 'style';
      } else if (resource.match(/\.(js)$/i)) {
        link.as = 'script';
      }

      document.head.appendChild(link);
      links.push(link);
    });

    return () => {
      links.forEach(link => {
        if (document.head.contains(link)) {
          document.head.removeChild(link);
        }
      });
    };
  }, [resources]);
};

// GPU acceleration utility
export const GPUAccelerated = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <div className={cn("gpu-accelerated", className)}>
      {children}
    </div>
  );
};
/**
 * Performance monitoring hooks and utilities
 * Provides real-time insights into application performance
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '@/lib/logger';

interface PerformanceMetrics {
  renderTime: number;
  isSlowRender: boolean;
  memoryUsage?: number;
  componentName: string;
}

interface WebVitalsMetrics {
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
}

/**
 * Hook to monitor component render performance
 */
export const useRenderPerformance = (componentName: string, threshold: number = 16) => {
  const renderStartTime = useRef<number>(0);
  const renderCount = useRef<number>(0);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

  useEffect(() => {
    renderStartTime.current = performance.now();
    renderCount.current += 1;

    return () => {
      const renderTime = performance.now() - renderStartTime.current;
      const isSlowRender = renderTime > threshold;

      const newMetrics: PerformanceMetrics = {
        renderTime,
        isSlowRender,
        componentName,
        memoryUsage: (performance as any).memory?.usedJSHeapSize
      };

      setMetrics(newMetrics);

      if (isSlowRender) {
        logger.warn(`Slow render detected in ${componentName}`, {
          renderTime: `${renderTime.toFixed(2)}ms`,
          threshold: `${threshold}ms`,
          renderCount: renderCount.current
        });
      }
    };
  });

  return {
    metrics,
    renderCount: renderCount.current
  };
};

/**
 * Hook to monitor Web Vitals performance metrics
 */
export const useWebVitals = () => {
  const [vitals, setVitals] = useState<WebVitalsMetrics>({});

  useEffect(() => {
    // Observe performance entries
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        switch (entry.entryType) {
          case 'paint':
            if (entry.name === 'first-contentful-paint') {
              setVitals(prev => ({ ...prev, fcp: entry.startTime }));
            }
            break;
          case 'largest-contentful-paint':
            setVitals(prev => ({ ...prev, lcp: entry.startTime }));
            break;
          case 'first-input':
            setVitals(prev => ({ ...prev, fid: (entry as any).processingStart - entry.startTime }));
            break;
          case 'layout-shift':
            if (!(entry as any).hadRecentInput) {
              setVitals(prev => ({ 
                ...prev, 
                cls: (prev.cls || 0) + (entry as any).value 
              }));
            }
            break;
          case 'navigation':
            const navEntry = entry as PerformanceNavigationTiming;
            setVitals(prev => ({ 
              ...prev, 
              ttfb: navEntry.responseStart - navEntry.requestStart 
            }));
            break;
        }
      }
    });

    try {
      observer.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'first-input', 'layout-shift', 'navigation'] });
    } catch (error) {
      logger.warn('Performance observer not supported', { error });
    }

    return () => observer.disconnect();
  }, []);

  return vitals;
};

/**
 * Hook to monitor memory usage and detect memory leaks
 */
export const useMemoryMonitoring = (intervalMs: number = 30000) => {
  const [memoryInfo, setMemoryInfo] = useState<{
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  } | null>(null);

  const previousUsage = useRef<number>(0);

  useEffect(() => {
    const checkMemory = () => {
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        const currentUsage = memory.usedJSHeapSize;
        
        let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
        if (previousUsage.current > 0) {
          const diff = currentUsage - previousUsage.current;
          const threshold = previousUsage.current * 0.1; // 10% threshold
          
          if (diff > threshold) trend = 'increasing';
          else if (diff < -threshold) trend = 'decreasing';
        }

        setMemoryInfo({
          usedJSHeapSize: currentUsage,
          totalJSHeapSize: memory.totalJSHeapSize,
          jsHeapSizeLimit: memory.jsHeapSizeLimit,
          trend
        });

        // Warn if memory usage is high
        const usagePercent = (currentUsage / memory.jsHeapSizeLimit) * 100;
        if (usagePercent > 80) {
          logger.warn('High memory usage detected', {
            usagePercent: `${usagePercent.toFixed(1)}%`,
            usedMB: `${(currentUsage / 1024 / 1024).toFixed(1)}MB`,
            limitMB: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(1)}MB`
          });
        }

        previousUsage.current = currentUsage;
      }
    };

    checkMemory();
    const interval = setInterval(checkMemory, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs]);

  return memoryInfo;
};

/**
 * Hook to track long tasks that block the main thread
 */
export const useLongTaskMonitoring = () => {
  const [longTasks, setLongTasks] = useState<Array<{
    duration: number;
    startTime: number;
    name: string;
  }>>([]);

  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      const tasks = list.getEntries().map(entry => ({
        duration: entry.duration,
        startTime: entry.startTime,
        name: entry.name
      }));

      setLongTasks(prev => [...prev.slice(-10), ...tasks]); // Keep last 10 tasks

      // Log long tasks
      tasks.forEach(task => {
        logger.warn('Long task detected', {
          duration: `${task.duration.toFixed(2)}ms`,
          startTime: task.startTime,
          name: task.name
        });
      });
    });

    try {
      observer.observe({ entryTypes: ['longtask'] });
    } catch (error) {
      logger.warn('Long task observer not supported', { error });
    }

    return () => observer.disconnect();
  }, []);

  return longTasks;
};

/**
 * Hook to track bundle size and loading performance
 */
export const useBundlePerformance = () => {
  const [bundleMetrics, setBundleMetrics] = useState<{
    totalSize: number;
    loadTime: number;
    chunkCount: number;
  } | null>(null);

  useEffect(() => {
    // Track resource loading
    const observer = new PerformanceObserver((list) => {
      const resources = list.getEntries().filter(entry => 
        entry.name.includes('.js') || entry.name.includes('.css')
      ) as PerformanceResourceTiming[];

      if (resources.length > 0) {
        const totalSize = resources.reduce((sum, resource) => {
          return sum + (resource.transferSize || 0);
        }, 0);

        const totalLoadTime = resources.reduce((sum, resource) => {
          return sum + (resource.responseEnd - resource.responseStart);
        }, 0);

        setBundleMetrics({
          totalSize,
          loadTime: totalLoadTime,
          chunkCount: resources.length
        });

        logger.info('Bundle performance metrics', {
          totalSizeKB: `${(totalSize / 1024).toFixed(1)}KB`,
          avgLoadTime: `${(totalLoadTime / resources.length).toFixed(2)}ms`,
          chunkCount: resources.length
        });
      }
    });

    try {
      observer.observe({ entryTypes: ['resource'] });
    } catch (error) {
      logger.warn('Resource observer not supported', { error });
    }

    return () => observer.disconnect();
  }, []);

  return bundleMetrics;
};

/**
 * Comprehensive performance monitoring hook
 */
export const usePerformanceMonitoring = (componentName?: string) => {
  const renderMetrics = useRenderPerformance(componentName || 'Unknown');
  const webVitals = useWebVitals();
  const memoryInfo = useMemoryMonitoring();
  const longTasks = useLongTaskMonitoring();
  const bundleMetrics = useBundlePerformance();

  const getPerformanceScore = useCallback(() => {
    let score = 100;

    // Deduct for poor web vitals
    if (webVitals.lcp && webVitals.lcp > 2500) score -= 20;
    if (webVitals.fid && webVitals.fid > 100) score -= 15;
    if (webVitals.cls && webVitals.cls > 0.1) score -= 15;
    if (webVitals.fcp && webVitals.fcp > 1800) score -= 10;

    // Deduct for memory issues
    if (memoryInfo?.trend === 'increasing') score -= 10;

    // Deduct for long tasks
    if (longTasks.length > 5) score -= 10;

    // Deduct for slow renders
    if (renderMetrics.metrics?.isSlowRender) score -= 5;

    return Math.max(0, score);
  }, [webVitals, memoryInfo, longTasks, renderMetrics]);

  return {
    renderMetrics,
    webVitals,
    memoryInfo,
    longTasks,
    bundleMetrics,
    performanceScore: getPerformanceScore()
  };
};
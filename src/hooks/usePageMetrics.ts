import { useState, useCallback, useMemo, useEffect } from 'react';
import { STORAGE_KEYS } from '@/lib/storage-keys';

interface MetricConfig {
  key: string;
  label: string;
  enabled: boolean;
}

interface UsePageMetricsOptions {
  pageKey: string;
  defaultVisible?: boolean;
  defaultMetrics?: MetricConfig[];
}

interface UsePageMetricsReturn {
  showMetrics: boolean;
  setShowMetrics: (show: boolean) => void;
  toggleMetrics: () => void;
  selectedMetrics: MetricConfig[];
  setSelectedMetrics: (metrics: MetricConfig[]) => void;
  toggleMetric: (key: string) => void;
  resetMetrics: () => void;
}

interface MetricsState {
  visible: boolean;
  selected: MetricConfig[];
}

export function usePageMetrics({
  pageKey,
  defaultVisible = false,
  defaultMetrics = [],
}: UsePageMetricsOptions): UsePageMetricsReturn {
  const storageKey = STORAGE_KEYS.page.metrics(pageKey);
  
  const defaultState: MetricsState = {
    visible: defaultVisible,
    selected: defaultMetrics,
  };

  // Load state helper
  const loadState = (): MetricsState => {
    if (typeof window === 'undefined') return defaultState;
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const state = parsed?.value ?? parsed;
        return {
          visible: state?.visible ?? defaultVisible,
          selected: state?.selected ?? defaultMetrics,
        };
      }
    } catch {
      return defaultState;
    }
    
    return defaultState;
  };

  const [state, setState] = useState<MetricsState>(loadState);

  // Persist to localStorage
  useEffect(() => {
    try {
      const toStore = { value: state, timestamp: Date.now() };
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch (error) {
      console.error(`Error saving metrics for ${pageKey}:`, error);
    }
  }, [state, storageKey, pageKey]);

  // Merge saved metrics with defaults to handle schema changes
  const selectedMetrics = useMemo(() => {
    return defaultMetrics.map(defaultMetric => {
      const savedMetric = state.selected.find(m => m.key === defaultMetric.key);
      return savedMetric ? { ...defaultMetric, enabled: savedMetric.enabled } : defaultMetric;
    });
  }, [state.selected, defaultMetrics]);

  const setShowMetrics = useCallback((show: boolean) => {
    setState(prev => ({ ...prev, visible: show }));
  }, []);

  const toggleMetrics = useCallback(() => {
    setState(prev => ({ ...prev, visible: !prev.visible }));
  }, []);

  const setSelectedMetrics = useCallback((metrics: MetricConfig[]) => {
    setState(prev => ({ ...prev, selected: metrics }));
  }, []);

  const toggleMetric = useCallback((key: string) => {
    setState(prev => ({
      ...prev,
      selected: prev.selected.map(metric => 
        metric.key === key ? { ...metric, enabled: !metric.enabled } : metric
      ),
    }));
  }, []);

  const resetMetrics = useCallback(() => {
    setState(defaultState);
  }, [defaultState]);

  return {
    showMetrics: state.visible,
    setShowMetrics,
    toggleMetrics,
    selectedMetrics,
    setSelectedMetrics,
    toggleMetric,
    resetMetrics,
  };
}

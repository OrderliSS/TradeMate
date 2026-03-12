import { useState, useEffect, useCallback } from "react";
import { getCurrentEnvironment } from "@/lib/environment-utils";

export interface MetricConfig {
  key: string;
  label: string;
  value: number | string;
}

interface UseMobileMetricsOptions {
  /** Page key for localStorage persistence */
  pageKey: string;
  /** Default to show metrics? (Default: false for workflow pages) */
  defaultShowMetrics?: boolean;
  /** Maximum number of selectable metrics */
  maxMetrics?: number;
  /** Available metrics for this page */
  availableMetrics: MetricConfig[];
  /** Default selected metric keys */
  defaultSelectedKeys?: string[];
}

interface UseMobileMetricsResult {
  /** Whether to show the metrics strip */
  showMetrics: boolean;
  /** Toggle metrics visibility */
  setShowMetrics: (show: boolean) => void;
  /** Currently selected metric keys (max 3) */
  selectedMetricKeys: string[];
  /** Update selected metrics */
  setSelectedMetricKeys: (keys: string[]) => void;
  /** Available metrics for this page */
  availableMetrics: MetricConfig[];
  /** Selected metrics with their current values */
  selectedMetrics: MetricConfig[];
  /** Maximum metrics allowed */
  maxMetrics: number;
  /** Whether selection is at max */
  isAtMaxSelection: boolean;
  /** Toggle a metric selection */
  toggleMetric: (key: string) => void;
  /** Reset to defaults */
  resetToDefaults: () => void;
}

/**
 * useMobileMetrics - Hook for page-specific metrics display on mobile
 * 
 * Features:
 * - Persists show/hide state per page
 * - Persists selected metrics per page
 * - Enforces max 3 metrics
 * - Off by default for workflow pages
 */
export function useMobileMetrics({
  pageKey,
  defaultShowMetrics = false,
  maxMetrics = 3,
  availableMetrics,
  defaultSelectedKeys,
}: UseMobileMetricsOptions): UseMobileMetricsResult {
  const env = getCurrentEnvironment();
  const storageKeyShow = `${pageKey}_showMetrics_${env}`;
  const storageKeySelected = `${pageKey}_selectedMetrics_${env}`;

  // Default keys: first 3 available metrics if not specified
  const defaultKeys = defaultSelectedKeys || availableMetrics.slice(0, maxMetrics).map(m => m.key);

  // Show metrics state
  const [showMetrics, setShowMetricsState] = useState<boolean>(() => {
    const stored = localStorage.getItem(storageKeyShow);
    return stored !== null ? JSON.parse(stored) : defaultShowMetrics;
  });

  // Selected metric keys
  const [selectedMetricKeys, setSelectedMetricKeysState] = useState<string[]>(() => {
    const stored = localStorage.getItem(storageKeySelected);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Validate that stored keys still exist in available metrics
        return parsed.filter((key: string) => 
          availableMetrics.some(m => m.key === key)
        ).slice(0, maxMetrics);
      } catch {
        return defaultKeys;
      }
    }
    return defaultKeys;
  });

  // Persist show state
  useEffect(() => {
    localStorage.setItem(storageKeyShow, JSON.stringify(showMetrics));
  }, [showMetrics, storageKeyShow]);

  // Persist selected keys
  useEffect(() => {
    localStorage.setItem(storageKeySelected, JSON.stringify(selectedMetricKeys));
  }, [selectedMetricKeys, storageKeySelected]);

  // Wrapped setters
  const setShowMetrics = useCallback((show: boolean) => {
    setShowMetricsState(show);
  }, []);

  const setSelectedMetricKeys = useCallback((keys: string[]) => {
    // Enforce max and validate keys
    const validKeys = keys
      .filter(key => availableMetrics.some(m => m.key === key))
      .slice(0, maxMetrics);
    setSelectedMetricKeysState(validKeys);
  }, [availableMetrics, maxMetrics]);

  // Toggle a single metric
  const toggleMetric = useCallback((key: string) => {
    setSelectedMetricKeysState(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key);
      }
      if (prev.length >= maxMetrics) {
        // At max, don't add
        return prev;
      }
      return [...prev, key];
    });
  }, [maxMetrics]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setShowMetricsState(defaultShowMetrics);
    setSelectedMetricKeysState(defaultKeys);
  }, [defaultShowMetrics, defaultKeys]);

  // Compute selected metrics with current values
  const selectedMetrics = selectedMetricKeys
    .map(key => availableMetrics.find(m => m.key === key))
    .filter((m): m is MetricConfig => m !== undefined);

  return {
    showMetrics,
    setShowMetrics,
    selectedMetricKeys,
    setSelectedMetricKeys,
    availableMetrics,
    selectedMetrics,
    maxMetrics,
    isAtMaxSelection: selectedMetricKeys.length >= maxMetrics,
    toggleMetric,
    resetToDefaults,
  };
}

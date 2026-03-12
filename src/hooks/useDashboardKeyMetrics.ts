/**
 * Hook to manage the visual Key Metrics charts visibility and order
 * Controls: Order Status donut, Monthly Target gauge, Revenue Trend sparkline, Customers comparison
 * Also includes stat-style cards migrated from the legacy system
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PieChart, Target, TrendingUp, Users, ShoppingCart, Package, Building2, Boxes, LucideIcon } from 'lucide-react';
import { getCurrentEnvironment } from '@/lib/environment-utils';
import { DASHBOARD_DEFAULTS } from '@/lib/dashboard-defaults';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useTierStore } from './useTierStore';

// ============================================
// TYPES
// ============================================
export interface KeyMetricConfig {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  requiredTier?: 'basic' | 'service-ops';
}

// Stat-capable card IDs (cards that have detailed stats to toggle)
export const STAT_CAPABLE_CARD_IDS = ['total_customers', 'monthly_orders', 'total_products', 'total_vendors', 'units_in_stock'] as const;
export type StatCapableCardId = typeof STAT_CAPABLE_CARD_IDS[number];

// Human-readable labels for stat-capable cards
export const STAT_CARD_LABELS: Record<StatCapableCardId, string> = {
  total_customers: 'Customers',
  monthly_orders: 'Orders Tracking',
  total_products: 'Product Catalog',
  total_vendors: 'Total Vendors',
  units_in_stock: 'Units in Stock',
};

// ============================================
// AVAILABLE KEY METRICS
// ============================================
export const AVAILABLE_KEY_METRICS: KeyMetricConfig[] = [
  {
    id: 'units_in_stock',
    title: 'Units in Stock',
    description: 'Inventory levels, product status, and total units sold',
    icon: Boxes
  },
  {
    id: 'total_sales',
    title: 'Total Sales',
    description: 'Donut chart showing order status distribution',
    icon: PieChart,
    requiredTier: 'service-ops'
  },
  {
    id: 'total_customers',
    title: 'Total Customers',
    description: 'Month-over-month customer comparison',
    icon: Users
  },
  {
    id: 'monthly_orders',
    title: 'Monthly Orders',
    description: 'Total sales orders created this month',
    icon: ShoppingCart
  },
  {
    id: 'total_products',
    title: 'Product Catalog',
    description: 'Count of all products in catalog',
    icon: Package
  },
  {
    id: 'total_vendors',
    title: 'Total Vendors',
    description: 'Count of active suppliers',
    icon: Building2
  },
];

// ============================================
// STORAGE HELPERS
// ============================================
function getStorageKey() {
  const env = getCurrentEnvironment();
  return `ui:dashboard:key-metrics:${env}`;
}

function loadSavedKeyMetrics(): string[] {
  try {
    const storageKey = getStorageKey();
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      const value = parsed?.value ?? parsed;
      if (Array.isArray(value) && value.length > 0) {
        const validIds = value.filter((id: string) =>
          AVAILABLE_KEY_METRICS.some(m => m.id === id)
        );
        if (validIds.length > 0) return validIds;
      }
    }
  } catch (e) {
    console.error('[useDashboardKeyMetrics] Failed to load saved key metrics:', e);
  }
  return [...DASHBOARD_DEFAULTS.keyMetrics];
}

function saveKeyMetrics(metricIds: string[]) {
  try {
    const toStore = { value: metricIds, timestamp: Date.now() };
    queueMicrotask(() => {
      localStorage.setItem(getStorageKey(), JSON.stringify(toStore));
      window.dispatchEvent(new CustomEvent('dashboardKeyMetricsChanged', {
        detail: { keyMetrics: metricIds, env: getCurrentEnvironment() }
      }));
    });
  } catch (e) {
    console.error('[useDashboardKeyMetrics] Failed to save key metrics:', e);
  }
}

// ============================================
// STATS VISIBILITY HELPERS (per-card map)
// ============================================
type StatsVisibilityMap = Record<string, boolean>;

function getStatsStorageKey() {
  const env = getCurrentEnvironment();
  return `ui:dashboard:key-metrics-stats:${env}`;
}

function getDefaultStatsMap(): StatsVisibilityMap {
  const map: StatsVisibilityMap = {};
  STAT_CAPABLE_CARD_IDS.forEach(id => { map[id] = true; });
  return map;
}

function loadStatsVisibility(): StatsVisibilityMap {
  try {
    const saved = localStorage.getItem(getStatsStorageKey());
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      const value = parsed?.value ?? parsed;
      // Backward compat: old format was a single boolean
      if (typeof value === 'boolean') {
        const map: StatsVisibilityMap = {};
        STAT_CAPABLE_CARD_IDS.forEach(id => { map[id] = value; });
        return map;
      }
      // New format: per-card map
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return value as StatsVisibilityMap;
      }
    }
  } catch (e) {
    console.error('[useDashboardKeyMetrics] Failed to load stats visibility:', e);
  }
  return getDefaultStatsMap();
}

function saveStatsVisibility(map: StatsVisibilityMap) {
  try {
    const toStore = { value: map, timestamp: Date.now() };
    queueMicrotask(() => {
      localStorage.setItem(getStatsStorageKey(), JSON.stringify(toStore));
      window.dispatchEvent(new CustomEvent('dashboardStatsVisibilityChanged', {
        detail: { statsMap: map, env: getCurrentEnvironment() }
      }));
    });
  } catch (e) {
    console.error('[useDashboardKeyMetrics] Failed to save stats visibility:', e);
  }
}

// ============================================
// HOOK
// ============================================
export function useDashboardKeyMetrics() {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => loadSavedKeyMetrics());
  const [statsVisibility, setStatsVisibility] = useState<StatsVisibilityMap>(() => loadStatsVisibility());

  // Listen for changes from other sources (e.g., modal)
  useEffect(() => {
    const handleChange = (e: CustomEvent<{ keyMetrics: string[]; env: string }>) => {
      const currentEnv = getCurrentEnvironment();
      if (e.detail.env === currentEnv) {
        setSelectedIds(e.detail.keyMetrics);
      }
    };

    const handleStatsChange = (e: CustomEvent<{ statsMap: StatsVisibilityMap; env: string }>) => {
      const currentEnv = getCurrentEnvironment();
      if (e.detail.env === currentEnv) {
        setStatsVisibility(e.detail.statsMap);
      }
    };

    window.addEventListener('dashboardKeyMetricsChanged', handleChange as EventListener);
    window.addEventListener('dashboardStatsVisibilityChanged', handleStatsChange as EventListener);
    return () => {
      window.removeEventListener('dashboardKeyMetricsChanged', handleChange as EventListener);
      window.removeEventListener('dashboardStatsVisibilityChanged', handleStatsChange as EventListener);
    };
  }, []);

  const { currentOrganization } = useOrganization();

  const permissions = useTierStore((state) => state.permissions);

  const selectedKeyMetrics = useMemo(() => {
    return selectedIds
      .map(id => AVAILABLE_KEY_METRICS.find(m => m.id === id))
      .filter(Boolean)
      .filter(m => {
        if (m!.requiredTier === 'service-ops' && !permissions.service_ops_tools) return false;
        return true;
      }) as KeyMetricConfig[];
  }, [selectedIds, permissions]);

  const availableKeyMetrics = useMemo(() => {
    return AVAILABLE_KEY_METRICS.filter(m => {
      const isSelected = selectedIds.includes(m.id);
      const isRestricted = m.requiredTier === 'service-ops' && !permissions.service_ops_tools;
      if (isSelected && !isRestricted) return false;
      return true;
    });
  }, [selectedIds, permissions]);

  const addKeyMetric = useCallback((id: string) => {
    setSelectedIds(prev => {
      // Clean out orphaned IDs that no longer exist in AVAILABLE_KEY_METRICS
      const validIds = prev.filter(pid => AVAILABLE_KEY_METRICS.some(m => m.id === pid));
      if (validIds.includes(id) || validIds.length >= DASHBOARD_DEFAULTS.maxKeyMetrics) return validIds.length !== prev.length ? validIds : prev;
      const next = [...validIds, id];
      saveKeyMetrics(next);
      return next;
    });
  }, []);

  const removeKeyMetric = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = prev.filter(mid => mid !== id);
      saveKeyMetrics(next);
      return next;
    });
  }, []);

  const moveKeyMetricUp = useCallback((id: string) => {
    setSelectedIds(prev => {
      const idx = prev.indexOf(id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      saveKeyMetrics(next);
      return next;
    });
  }, []);

  const moveKeyMetricDown = useCallback((id: string) => {
    setSelectedIds(prev => {
      const idx = prev.indexOf(id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      saveKeyMetrics(next);
      return next;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    const defaults = [...DASHBOARD_DEFAULTS.keyMetrics];
    setSelectedIds(defaults);
    saveKeyMetrics(defaults);
    const defaultStats = getDefaultStatsMap();
    setStatsVisibility(defaultStats);
    saveStatsVisibility(defaultStats);
  }, []);

  // Per-card stats visibility
  const getCardStatsVisible = useCallback((cardId: string): boolean => {
    return statsVisibility[cardId] ?? true;
  }, [statsVisibility]);

  const toggleCardStats = useCallback((cardId: string) => {
    setStatsVisibility(prev => {
      const next = { ...prev, [cardId]: !(prev[cardId] ?? true) };
      saveStatsVisibility(next);
      return next;
    });
  }, []);

  const toggleAllStats = useCallback((show: boolean) => {
    setStatsVisibility(() => {
      const next: StatsVisibilityMap = {};
      STAT_CAPABLE_CARD_IDS.forEach(id => { next[id] = show; });
      saveStatsVisibility(next);
      return next;
    });
  }, []);

  // Computed: are all stats visible?
  const allStatsVisible = useMemo(() => {
    return STAT_CAPABLE_CARD_IDS.every(id => statsVisibility[id] !== false);
  }, [statsVisibility]);

  return {
    selectedIds,
    selectedKeyMetrics,
    availableKeyMetrics,
    addKeyMetric,
    removeKeyMetric,
    moveKeyMetricUp,
    moveKeyMetricDown,
    resetToDefaults,
    getCardStatsVisible,
    toggleCardStats,
    toggleAllStats,
    allStatsVisible,
    statsVisibility,
    maxKeyMetrics: DASHBOARD_DEFAULTS.maxKeyMetrics,
  };
}

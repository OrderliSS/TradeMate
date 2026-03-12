import { useState, useCallback, useEffect, useMemo } from 'react';
import { UI_KEYS } from '@/lib/storage-keys';

export interface DashboardSection {
  id: 'quickActions' | 'metrics' | 'analytics' | 'widgets' | 'intelligence';
  label: string;
  description: string;
  visible: boolean;
  order: number;
  canHide: boolean;
}

const DEFAULT_SECTIONS: DashboardSection[] = [
  {
    id: 'quickActions',
    label: 'Quick Actions',
    description: 'Quick action buttons for creating customers, orders, stock, etc.',
    visible: true,
    order: 0,
    canHide: true
  },
  {
    id: 'metrics',
    label: 'Metric Index',
    description: 'Visual charts: Order Status donut, Monthly Target gauge, Revenue Trend sparkline, and Customer growth comparison',
    visible: true,
    order: 1,
    canHide: true
  },
  {
    id: 'widgets',
    label: 'Workflow Center',
    description: 'Calendar, Sales Queue, Workspace Operations, and other workspace cards',
    visible: true,
    order: 2,
    canHide: false // Always show at least widgets section
  },
  {
    id: 'analytics',
    label: 'Status Feed',
    description: 'Activity, Recents, and Intelligence widgets',
    visible: true,
    order: 3,
    canHide: true
  },
  {
    id: 'intelligence',
    label: 'Intelligence Hub',
    description: 'Top Products, Top Customers, Monthly Target, Revenue Trend — Under Construction',
    visible: false,
    order: 4,
    canHide: true
  },
];

// Get environment helper
const getEnvironment = (): string => {
  if (typeof window === 'undefined') return 'production';
  return localStorage.getItem('system:data-environment') ||
    localStorage.getItem('data-environment') ||
    'production';
};

// Get storage key helper
const getStorageKey = (): string => {
  return `${UI_KEYS.dashboard.sections}:${getEnvironment()}`;
};

// Load sections helper
const loadSavedSections = (): DashboardSection[] => {
  if (typeof window === 'undefined') return DEFAULT_SECTIONS;

  try {
    const saved = localStorage.getItem(getStorageKey());
    if (saved) {
      const parsed = JSON.parse(saved);
      const savedSections = parsed?.value ?? parsed;
      if (Array.isArray(savedSections) && savedSections.length > 0) {
        // Merge with defaults to handle new sections or updated labels
        return DEFAULT_SECTIONS.map(defaultSection => {
          const savedSection = savedSections.find((s: DashboardSection) => s.id === defaultSection.id);
          return savedSection
            ? {
              ...defaultSection,
              visible: savedSection.visible,
              order: savedSection.order
            }
            : defaultSection;
        });
      }
    }
  } catch (e) {
    console.error('[DashboardSections] Failed to load:', e);
  }
  return DEFAULT_SECTIONS;
};

// Save sections helper
const saveSections = (sections: DashboardSection[]) => {
  try {
    const toStore = { value: sections, timestamp: Date.now() };
    localStorage.setItem(getStorageKey(), JSON.stringify(toStore));
    window.dispatchEvent(new CustomEvent('dashboardSectionsChanged', {
      detail: { sections, env: getEnvironment() }
    }));
  } catch (error) {
    console.error('[DashboardSections] Failed to save:', error);
  }
};

export function useDashboardSections() {
  const [sections, setSections] = useState<DashboardSection[]>(loadSavedSections);

  // Listen for changes from other components
  useEffect(() => {
    const handleChange = (event: CustomEvent) => {
      if (event.detail.env === getEnvironment()) {
        setSections(event.detail.sections);
      }
    };

    window.addEventListener('dashboardSectionsChanged', handleChange as EventListener);
    return () => window.removeEventListener('dashboardSectionsChanged', handleChange as EventListener);
  }, []);

  const toggleSection = useCallback((sectionId: DashboardSection['id']) => {
    setSections(prev => {
      const updated = prev.map(section => {
        if (section.id === sectionId && section.canHide) {
          return { ...section, visible: !section.visible };
        }
        return section;
      });
      queueMicrotask(() => saveSections(updated));
      return updated;
    });
  }, []);

  const setSectionVisibility = useCallback((sectionId: DashboardSection['id'], visible: boolean) => {
    setSections(prev => {
      const updated = prev.map(section => {
        if (section.id === sectionId) {
          // Can only hide if canHide is true, can always show
          if (!visible && !section.canHide) return section;
          return { ...section, visible };
        }
        return section;
      });
      queueMicrotask(() => saveSections(updated));
      return updated;
    });
  }, []);

  const reorderSections = useCallback((orderedIds: DashboardSection['id'][]) => {
    setSections(prev => {
      const updated = orderedIds.map((id, index) => {
        const section = prev.find(s => s.id === id);
        return section ? { ...section, order: index } : null;
      }).filter(Boolean) as DashboardSection[];

      queueMicrotask(() => saveSections(updated));
      return updated;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    saveSections(DEFAULT_SECTIONS);
    setSections(DEFAULT_SECTIONS);
  }, []);

  const isSectionVisible = useCallback((sectionId: DashboardSection['id']): boolean => {
    const section = sections.find(s => s.id === sectionId);
    return section?.visible ?? true;
  }, [sections]);

  const visibleSections = useMemo(() =>
    sections
      .filter(s => s.visible)
      .sort((a, b) => a.order - b.order),
    [sections]
  );

  return {
    sections,
    visibleSections,
    toggleSection,
    setSectionVisibility,
    reorderSections,
    resetToDefaults,
    isSectionVisible,
  };
}

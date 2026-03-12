import { useState, useEffect, useCallback } from 'react';
import { UI_KEYS } from '@/lib/storage-keys';

export interface AdminSectionConfig {
  sectionKey: string;
  label: string;
  tab: 'system' | 'security' | 'users' | 'data' | 'developer';
  tabLabel: string;
  defaultOpen: boolean;
}

// Master list of all collapsible sections in Admin Console
// Keys MUST match the storageKey props used in the actual components
const ALL_SECTIONS: AdminSectionConfig[] = [
  // System Tab (3 sections)
  { sectionKey: 'admin-system-config-open', label: 'System Configuration', tab: 'system', tabLabel: 'System', defaultOpen: true },
  { sectionKey: 'admin-system-monitoring-open', label: 'System Monitoring', tab: 'system', tabLabel: 'System', defaultOpen: true },
  { sectionKey: 'admin-system-maintenance-open', label: 'System Maintenance', tab: 'system', tabLabel: 'System', defaultOpen: false },
  
  // Security Tab (2 sections)
  { sectionKey: 'admin-security-dashboard-open', label: 'Security Dashboard', tab: 'security', tabLabel: 'Security', defaultOpen: true },
  { sectionKey: 'admin-security-settings-open', label: 'Security Settings', tab: 'security', tabLabel: 'Security', defaultOpen: false },
  
  // Users Tab (3 sections)
  { sectionKey: 'admin-users-capacity-open', label: 'Team Capacity', tab: 'users', tabLabel: 'Users', defaultOpen: true },
  { sectionKey: 'admin-users-management-open', label: 'User Management', tab: 'users', tabLabel: 'Users', defaultOpen: true },
  { sectionKey: 'admin-users-activity-open', label: 'Recent Activity', tab: 'users', tabLabel: 'Users', defaultOpen: false },
  
  // Data Tab (5 sections)
  { sectionKey: 'admin-data-backup-open', label: 'Backup & Export', tab: 'data', tabLabel: 'Data', defaultOpen: true },
  { sectionKey: 'admin-data-database-open', label: 'Database Management', tab: 'data', tabLabel: 'Data', defaultOpen: false },
  { sectionKey: 'admin-data-reconciliation-open', label: 'Data Reconciliation', tab: 'data', tabLabel: 'Data', defaultOpen: false },
  { sectionKey: 'admin-data-assets-open', label: 'Asset Management Data', tab: 'data', tabLabel: 'Data', defaultOpen: false },
  { sectionKey: 'admin-data-cleanup-open', label: 'Mock Data Cleanup', tab: 'data', tabLabel: 'Data', defaultOpen: false },
  
  // Developer Tab (6 sections)
  { sectionKey: 'admin-dev-test-seeder-open', label: 'Admin Test Data Seeder', tab: 'developer', tabLabel: 'Developer', defaultOpen: true },
  { sectionKey: 'admin-dev-console-open', label: 'Developer Console', tab: 'developer', tabLabel: 'Developer', defaultOpen: true },
  { sectionKey: 'admin-dev-seeders-open', label: 'Data Seeders', tab: 'developer', tabLabel: 'Developer', defaultOpen: false },
  { sectionKey: 'admin-dev-tools-open', label: 'Development Data Tools', tab: 'developer', tabLabel: 'Developer', defaultOpen: true },
  { sectionKey: 'admin-dev-settings-open', label: 'Development Settings', tab: 'developer', tabLabel: 'Developer', defaultOpen: false },
  { sectionKey: 'admin-dev-environment-open', label: 'Environment Management', tab: 'developer', tabLabel: 'Developer', defaultOpen: false },
];

const PREFERENCES_KEY = 'orderli_admin_console_preferences';

interface StoredPreferences {
  sectionDefaults: Record<string, boolean>;
  version: number;
  timestamp: number;
}

export function useAdminConsolePreferences() {
  const [preferences, setPreferences] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(PREFERENCES_KEY);
      if (saved) {
        const parsed: StoredPreferences = JSON.parse(saved);
        return parsed.sectionDefaults || {};
      }
    } catch {}
    return {};
  });

  // Get sections with current preference or default
  const getSections = useCallback((): (AdminSectionConfig & { currentDefault: boolean })[] => {
    return ALL_SECTIONS.map(section => ({
      ...section,
      currentDefault: preferences[section.sectionKey] ?? section.defaultOpen,
    }));
  }, [preferences]);

  // Get sections grouped by tab
  const getSectionsByTab = useCallback(() => {
    const sections = getSections();
    const grouped: Record<string, typeof sections> = {};
    
    sections.forEach(section => {
      if (!grouped[section.tab]) {
        grouped[section.tab] = [];
      }
      grouped[section.tab].push(section);
    });
    
    return grouped;
  }, [getSections]);

  // Save preferences to localStorage
  const savePreferences = useCallback((newPrefs: Record<string, boolean>) => {
    try {
      const toStore: StoredPreferences = {
        sectionDefaults: newPrefs,
        version: 1,
        timestamp: Date.now(),
      };
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(toStore));
      setPreferences(newPrefs);
    } catch (error) {
      console.error('Error saving admin console preferences:', error);
    }
  }, []);

  // Set default open state for a single section
  const setDefaultOpen = useCallback((sectionKey: string, open: boolean) => {
    const newPrefs = { ...preferences, [sectionKey]: open };
    savePreferences(newPrefs);
  }, [preferences, savePreferences]);

  // Expand all sections (set all to true)
  const expandAll = useCallback(() => {
    const newPrefs: Record<string, boolean> = {};
    ALL_SECTIONS.forEach(section => {
      newPrefs[section.sectionKey] = true;
    });
    savePreferences(newPrefs);
  }, [savePreferences]);

  // Collapse all sections (set all to false)
  const collapseAll = useCallback(() => {
    const newPrefs: Record<string, boolean> = {};
    ALL_SECTIONS.forEach(section => {
      newPrefs[section.sectionKey] = false;
    });
    savePreferences(newPrefs);
  }, [savePreferences]);

  // Reset to default values
  const resetToDefaults = useCallback(() => {
    localStorage.removeItem(PREFERENCES_KEY);
    setPreferences({});
    
    // Clear individual section states
    ALL_SECTIONS.forEach(section => {
      const prefixedKey = UI_KEYS.collapsedState(section.sectionKey);
      localStorage.removeItem(prefixedKey);
      localStorage.removeItem(section.sectionKey); // Legacy key
    });
  }, []);

  // Apply preferences to current section states
  const applyPreferences = useCallback(() => {
    const sections = getSections();
    sections.forEach(section => {
      const prefixedKey = UI_KEYS.collapsedState(section.sectionKey);
      const toStore = { value: section.currentDefault, timestamp: Date.now() };
      localStorage.setItem(prefixedKey, JSON.stringify(toStore));
    });
    
    // Trigger page reload to apply changes
    window.location.reload();
  }, [getSections]);

  // Get breadcrumb path for a section
  const getBreadcrumb = useCallback((sectionKey: string): string => {
    const section = ALL_SECTIONS.find(s => s.sectionKey === sectionKey);
    if (!section) return '';
    return `${section.tabLabel} > ${section.label}`;
  }, []);

  return {
    sections: getSections(),
    sectionsByTab: getSectionsByTab(),
    setDefaultOpen,
    expandAll,
    collapseAll,
    resetToDefaults,
    applyPreferences,
    getBreadcrumb,
  };
}

// Export section list for command palette
export const ADMIN_SECTIONS = ALL_SECTIONS;

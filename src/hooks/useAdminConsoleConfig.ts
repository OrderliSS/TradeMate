import { useState, useEffect, useCallback } from 'react';
import { useUserRoles } from '@/hooks/useUserRoles';
import { isDevelopmentMode, isTestMode } from '@/lib/environment-utils';

export type AdminTab = 'system' | 'security' | 'users' | 'data' | 'developer';

export interface AdminTabConfig {
  id: AdminTab;
  label: string;
  description: string;
  icon: string;
  visible: boolean;
  requiresAdmin: boolean;
  requiresDevMode: boolean;
}

const BASE_TABS: AdminTabConfig[] = [
  {
    id: 'system',
    label: 'System',
    description: 'Configuration and monitoring',
    icon: 'Server',
    visible: true,
    requiresAdmin: false,
    requiresDevMode: false,
  },
  {
    id: 'security',
    label: 'Security',
    description: 'Access control and audit',
    icon: 'Shield',
    visible: true,
    requiresAdmin: false,
    requiresDevMode: false,
  },
  {
    id: 'users',
    label: 'Users',
    description: 'User and team management',
    icon: 'Users',
    visible: true,
    requiresAdmin: false,
    requiresDevMode: false,
  },
  {
    id: 'data',
    label: 'Data',
    description: 'Backup, export, and reconciliation',
    icon: 'Database',
    visible: true,
    requiresAdmin: false,
    requiresDevMode: false,
  },
  {
    id: 'developer',
    label: 'Developer',
    description: 'Development and testing tools',
    icon: 'Code',
    visible: false, // Hidden by default, shown based on conditions
    requiresAdmin: true,
    requiresDevMode: true,
  },
];

export function useAdminConsoleConfig() {
  const { isAdmin } = useUserRoles();
  const isDevEnvironment = isDevelopmentMode() || isTestMode();

  const getVisibleTabs = useCallback((): AdminTabConfig[] => {
    return BASE_TABS.filter(tab => {
      // Always visible tabs
      if (!tab.requiresAdmin && !tab.requiresDevMode) {
        return true;
      }
      
      // Developer tab visibility logic
      if (tab.id === 'developer') {
        // Show if in dev/test environment OR if admin
        return isDevEnvironment || isAdmin;
      }
      
      // Check role requirements
      if (tab.requiresAdmin && !isAdmin) {
        return false;
      }
      
      return true;
    });
  }, [isDevEnvironment, isAdmin]);

  const [visibleTabs, setVisibleTabs] = useState<AdminTabConfig[]>(getVisibleTabs);

  useEffect(() => {
    setVisibleTabs(getVisibleTabs());
  }, [getVisibleTabs]);

  const isTabVisible = useCallback((tabId: AdminTab): boolean => {
    return visibleTabs.some(tab => tab.id === tabId);
  }, [visibleTabs]);

  return {
    tabs: visibleTabs,
    isTabVisible,
    isDevEnvironment,
    isAdmin,
  };
}

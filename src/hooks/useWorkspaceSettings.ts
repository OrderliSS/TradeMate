import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

/**
 * Workspace Setting Structure
 */
export interface WorkspaceSetting {
  id: string;
  organization_id: string;
  setting_key: string;
  setting_value: Json;
  enforced: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Common workspace setting keys with their default values
 */
export const WORKSPACE_SETTING_KEYS = {
  // Display & UI
  DEFAULT_TIMEZONE: 'default_timezone',
  DEFAULT_DATE_FORMAT: 'default_date_format',
  DEFAULT_CURRENCY: 'default_currency',
  COMPACT_VIEW: 'compact_view',
  
  // Access & Security
  REQUIRE_2FA: 'require_2fa',
  SESSION_TIMEOUT_MINUTES: 'session_timeout_minutes',
  MAX_OFFLINE_DAYS: 'max_offline_days',
  
  // Collaboration
  ROSTER_VISIBILITY_MODE: 'roster_visibility_mode', // 'all' | 'team' | 'self'
  TASK_DEFAULT_VISIBILITY: 'task_default_visibility', // 'team' | 'private'
  ALLOW_MEMBER_INVITES: 'allow_member_invites',
  
  // Notifications
  EMAIL_NOTIFICATIONS_ENABLED: 'email_notifications_enabled',
  SLACK_INTEGRATION_ENABLED: 'slack_integration_enabled',
  
  // Sync & Offline
  SYNC_INTERVAL_MS: 'sync_interval_ms',
  ENABLE_OFFLINE_MODE: 'enable_offline_mode',
  MAX_OFFLINE_QUEUE_SIZE: 'max_offline_queue_size',
} as const;

export type WorkspaceSettingKey = typeof WORKSPACE_SETTING_KEYS[keyof typeof WORKSPACE_SETTING_KEYS];

/**
 * Default workspace settings values
 */
export const WORKSPACE_SETTING_DEFAULTS: Record<WorkspaceSettingKey, Json> = {
  [WORKSPACE_SETTING_KEYS.DEFAULT_TIMEZONE]: 'Australia/Sydney',
  [WORKSPACE_SETTING_KEYS.DEFAULT_DATE_FORMAT]: 'dd/MM/yyyy',
  [WORKSPACE_SETTING_KEYS.DEFAULT_CURRENCY]: 'AUD',
  [WORKSPACE_SETTING_KEYS.COMPACT_VIEW]: false,
  [WORKSPACE_SETTING_KEYS.REQUIRE_2FA]: false,
  [WORKSPACE_SETTING_KEYS.SESSION_TIMEOUT_MINUTES]: 480, // 8 hours
  [WORKSPACE_SETTING_KEYS.MAX_OFFLINE_DAYS]: 7,
  [WORKSPACE_SETTING_KEYS.ROSTER_VISIBILITY_MODE]: 'all',
  [WORKSPACE_SETTING_KEYS.TASK_DEFAULT_VISIBILITY]: 'team',
  [WORKSPACE_SETTING_KEYS.ALLOW_MEMBER_INVITES]: false,
  [WORKSPACE_SETTING_KEYS.EMAIL_NOTIFICATIONS_ENABLED]: true,
  [WORKSPACE_SETTING_KEYS.SLACK_INTEGRATION_ENABLED]: false,
  [WORKSPACE_SETTING_KEYS.SYNC_INTERVAL_MS]: 30000, // 30 seconds
  [WORKSPACE_SETTING_KEYS.ENABLE_OFFLINE_MODE]: true,
  [WORKSPACE_SETTING_KEYS.MAX_OFFLINE_QUEUE_SIZE]: 100,
};

interface UseWorkspaceSettingsReturn {
  /** All workspace settings for the current organization */
  settings: WorkspaceSetting[];
  /** Map of setting_key to setting value for quick lookup */
  settingsMap: Map<string, { value: Json; enforced: boolean }>;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Get a specific setting value with fallback to default */
  getSetting: <T extends Json>(key: WorkspaceSettingKey, defaultValue?: T) => T;
  /** Check if a setting is enforced (cannot be overridden by user) */
  isEnforced: (key: WorkspaceSettingKey) => boolean;
  /** Update a setting (admin only) */
  updateSetting: (key: WorkspaceSettingKey, value: Json, enforced?: boolean, description?: string) => Promise<boolean>;
  /** Delete a setting (admin only) */
  deleteSetting: (key: WorkspaceSettingKey) => Promise<boolean>;
  /** Refresh settings from database */
  refetch: () => void;
}

/**
 * Hook for managing workspace-level settings
 * 
 * These settings are organization-scoped and can optionally override user preferences
 * when the `enforced` flag is set to true.
 * 
 * @example
 * ```typescript
 * const { getSetting, isEnforced, updateSetting } = useWorkspaceSettings();
 * 
 * // Get a setting value
 * const timezone = getSetting('default_timezone', 'UTC');
 * 
 * // Check if user can override
 * if (!isEnforced('compact_view')) {
 *   // User can set their own preference
 * }
 * 
 * // Update a setting (admin only)
 * await updateSetting('default_timezone', 'America/New_York', true);
 * ```
 */
export function useWorkspaceSettings(): UseWorkspaceSettingsReturn {
  const { currentOrganization, isAdmin, isOwner } = useOrganization();
  const queryClient = useQueryClient();
  const canEdit = isAdmin || isOwner;
  
  // Fetch all settings for the organization
  const { data: settings = [], isLoading, error, refetch } = useQuery({
    queryKey: ['workspace-settings', currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      
      const { data, error: fetchError } = await supabase
        .from('workspace_settings')
        .select('*')
        .eq('organization_id', currentOrganization.id);
      
      if (fetchError) {
        console.error('Failed to fetch workspace settings:', fetchError);
        throw new Error(fetchError.message);
      }
      
      return (data || []) as WorkspaceSetting[];
    },
    enabled: !!currentOrganization?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Build a map for quick lookup
  const settingsMap = new Map<string, { value: Json; enforced: boolean }>();
  settings.forEach(s => {
    settingsMap.set(s.setting_key, { value: s.setting_value, enforced: s.enforced });
  });
  
  // Get a specific setting with fallback
  const getSetting = useCallback(<T extends Json>(
    key: WorkspaceSettingKey, 
    defaultValue?: T
  ): T => {
    const setting = settingsMap.get(key);
    if (setting) {
      return setting.value as T;
    }
    // Return provided default or global default
    return (defaultValue ?? WORKSPACE_SETTING_DEFAULTS[key]) as T;
  }, [settingsMap]);
  
  // Check if a setting is enforced
  const isEnforced = useCallback((key: WorkspaceSettingKey): boolean => {
    const setting = settingsMap.get(key);
    return setting?.enforced ?? false;
  }, [settingsMap]);
  
  // Mutation for updating settings
  const updateMutation = useMutation({
    mutationFn: async ({ 
      key, 
      value, 
      enforced = false, 
      description 
    }: { 
      key: WorkspaceSettingKey; 
      value: Json; 
      enforced?: boolean; 
      description?: string; 
    }) => {
      if (!currentOrganization?.id) throw new Error('No organization selected');
      if (!canEdit) throw new Error('Insufficient permissions');
      
      const { error: upsertError } = await supabase
        .from('workspace_settings')
        .upsert({
          organization_id: currentOrganization.id,
          setting_key: key,
          setting_value: value,
          enforced,
          description,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'organization_id,setting_key',
        });
      
      if (upsertError) throw new Error(upsertError.message);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-settings', currentOrganization?.id] });
      toast.success('Setting updated');
    },
    onError: (err) => {
      console.error('Failed to update workspace setting:', err);
      toast.error('Failed to update setting');
    },
  });
  
  // Mutation for deleting settings
  const deleteMutation = useMutation({
    mutationFn: async (key: WorkspaceSettingKey) => {
      if (!currentOrganization?.id) throw new Error('No organization selected');
      if (!canEdit) throw new Error('Insufficient permissions');
      
      const { error: deleteError } = await supabase
        .from('workspace_settings')
        .delete()
        .eq('organization_id', currentOrganization.id)
        .eq('setting_key', key);
      
      if (deleteError) throw new Error(deleteError.message);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-settings', currentOrganization?.id] });
      toast.success('Setting removed');
    },
    onError: (err) => {
      console.error('Failed to delete workspace setting:', err);
      toast.error('Failed to remove setting');
    },
  });
  
  // Wrapper functions
  const updateSetting = useCallback(async (
    key: WorkspaceSettingKey, 
    value: Json, 
    enforced?: boolean, 
    description?: string
  ): Promise<boolean> => {
    try {
      await updateMutation.mutateAsync({ key, value, enforced, description });
      return true;
    } catch {
      return false;
    }
  }, [updateMutation]);
  
  const deleteSetting = useCallback(async (key: WorkspaceSettingKey): Promise<boolean> => {
    try {
      await deleteMutation.mutateAsync(key);
      return true;
    } catch {
      return false;
    }
  }, [deleteMutation]);
  
  return {
    settings,
    settingsMap,
    isLoading,
    error: error as Error | null,
    getSetting,
    isEnforced,
    updateSetting,
    deleteSetting,
    refetch,
  };
}

/**
 * Hook for getting a single workspace setting with user preference fallback
 * 
 * Priority: Workspace (enforced) > User preference > Workspace (default) > App default
 * 
 * @example
 * ```typescript
 * const { value, canOverride, source } = useEffectiveSetting('compact_view', false);
 * // value: current effective value
 * // canOverride: whether the user can set their own preference
 * // source: 'workspace-enforced' | 'user' | 'workspace-default' | 'app-default'
 * ```
 */
export function useEffectiveSetting<T extends Json>(
  key: WorkspaceSettingKey,
  appDefault: T,
  userPreference?: T
): {
  value: T;
  canOverride: boolean;
  source: 'workspace-enforced' | 'user' | 'workspace-default' | 'app-default';
} {
  const { getSetting, isEnforced, isLoading } = useWorkspaceSettings();
  
  // Get workspace setting
  const workspaceSetting = getSetting(key, appDefault);
  const enforced = isEnforced(key);
  
  // Determine effective value and source
  if (enforced) {
    return {
      value: workspaceSetting as T,
      canOverride: false,
      source: 'workspace-enforced',
    };
  }
  
  if (userPreference !== undefined) {
    return {
      value: userPreference,
      canOverride: true,
      source: 'user',
    };
  }
  
  // Check if workspace has a non-default setting
  const hasWorkspaceSetting = workspaceSetting !== WORKSPACE_SETTING_DEFAULTS[key];
  if (hasWorkspaceSetting) {
    return {
      value: workspaceSetting as T,
      canOverride: true,
      source: 'workspace-default',
    };
  }
  
  return {
    value: appDefault,
    canOverride: true,
    source: 'app-default',
  };
}

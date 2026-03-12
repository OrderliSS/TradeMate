/**
 * Workspace Preferences Hook - Phase 7
 * Manages workspace-scoped user preferences with cloud sync
 */

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

export interface WorkspacePreferences {
  // View mode preferences
  defaultViewModes?: Record<string, string>;
  // Saved filters
  savedFilters?: Record<string, Record<string, unknown>>;
  // UI preferences
  uiDensity?: 'compact' | 'comfortable' | 'spacious';
  // Dashboard preferences
  dashboardWidgets?: string[];
  dashboardLayout?: Record<string, unknown>;
  // Notification preferences
  notifications?: {
    email?: boolean;
    push?: boolean;
    inApp?: boolean;
    digest?: 'realtime' | 'hourly' | 'daily' | 'weekly';
  };
  // Custom preferences
  [key: string]: unknown;
}

interface UseWorkspacePreferencesOptions {
  /** Sync changes immediately or batch them */
  autoSync?: boolean;
  /** Debounce delay for auto-sync in ms */
  syncDebounce?: number;
}

export function useWorkspacePreferences(options: UseWorkspacePreferencesOptions = {}) {
  const { autoSync = true, syncDebounce = 1000 } = options;
  
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  
  const workspaceId = currentOrganization?.id;
  const queryKey = ['workspace-preferences', workspaceId, user?.id];
  
  // Local state for immediate updates
  const [localPreferences, setLocalPreferences] = useState<WorkspacePreferences>({});
  const [isDirty, setIsDirty] = useState(false);
  
  // Fetch preferences from server
  const { 
    data: serverPreferences,
    isLoading,
    error,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!workspaceId || !user?.id) return {};
      
      const { data, error } = await supabase
        .from('user_workspace_preferences')
        .select('preferences')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      return (data?.preferences || {}) as WorkspacePreferences;
    },
    enabled: !!workspaceId && !!user?.id,
    staleTime: 60 * 1000, // 1 minute
  });
  
  // Sync local state with server on load
  useEffect(() => {
    if (serverPreferences && !isDirty) {
      setLocalPreferences(serverPreferences);
    }
  }, [serverPreferences, isDirty]);
  
  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (preferences: WorkspacePreferences) => {
      if (!workspaceId) throw new Error('No workspace selected');
      
       
      const { error } = await supabase.rpc('set_user_workspace_preferences', {
        p_workspace_id: workspaceId,
        p_preferences: JSON.parse(JSON.stringify(preferences)),
      } as any);
      
      if (error) throw error;
      return preferences;
    },
    onSuccess: (preferences) => {
      queryClient.setQueryData(queryKey, preferences);
      setIsDirty(false);
    },
    onError: (error) => {
      console.error('Failed to save preferences:', error);
      toast.error('Failed to save preferences');
    },
  });
  
  // Auto-sync with debounce
  useEffect(() => {
    if (!autoSync || !isDirty) return;
    
    const timer = setTimeout(() => {
      saveMutation.mutate(localPreferences);
    }, syncDebounce);
    
    return () => clearTimeout(timer);
  }, [localPreferences, autoSync, isDirty, syncDebounce]);
  
  // Get a specific preference
  const getPreference = useCallback(<T>(key: string, defaultValue: T): T => {
    return (localPreferences[key] as T) ?? defaultValue;
  }, [localPreferences]);
  
  // Set a specific preference
  const setPreference = useCallback(<T>(key: string, value: T) => {
    setLocalPreferences(prev => ({
      ...prev,
      [key]: value,
    }));
    setIsDirty(true);
  }, []);
  
  // Merge preferences
  const mergePreferences = useCallback((updates: Partial<WorkspacePreferences>) => {
    setLocalPreferences(prev => ({
      ...prev,
      ...updates,
    }));
    setIsDirty(true);
  }, []);
  
  // Reset to server state
  const resetPreferences = useCallback(() => {
    if (serverPreferences) {
      setLocalPreferences(serverPreferences);
      setIsDirty(false);
    }
  }, [serverPreferences]);
  
  // Force save now
  const saveNow = useCallback(() => {
    if (isDirty) {
      saveMutation.mutate(localPreferences);
    }
  }, [isDirty, localPreferences]);
  
  // View mode helpers
  const getViewMode = useCallback((page: string, defaultMode = 'list'): string => {
    return localPreferences.defaultViewModes?.[page] ?? defaultMode;
  }, [localPreferences]);
  
  const setViewMode = useCallback((page: string, mode: string) => {
    setLocalPreferences(prev => ({
      ...prev,
      defaultViewModes: {
        ...prev.defaultViewModes,
        [page]: mode,
      },
    }));
    setIsDirty(true);
  }, []);
  
  // Saved filters helpers
  const getSavedFilter = useCallback((page: string): Record<string, unknown> | undefined => {
    return localPreferences.savedFilters?.[page];
  }, [localPreferences]);
  
  const setSavedFilter = useCallback((page: string, filter: Record<string, unknown>) => {
    setLocalPreferences(prev => ({
      ...prev,
      savedFilters: {
        ...prev.savedFilters,
        [page]: filter,
      },
    }));
    setIsDirty(true);
  }, []);
  
  const clearSavedFilter = useCallback((page: string) => {
    setLocalPreferences(prev => {
      const { [page]: _, ...rest } = prev.savedFilters || {};
      return {
        ...prev,
        savedFilters: rest,
      };
    });
    setIsDirty(true);
  }, []);
  
  return {
    preferences: localPreferences,
    isLoading,
    isSaving: saveMutation.isPending,
    isDirty,
    error,
    
    // Generic preference access
    getPreference,
    setPreference,
    mergePreferences,
    resetPreferences,
    saveNow,
    
    // View mode helpers
    getViewMode,
    setViewMode,
    
    // Filter helpers
    getSavedFilter,
    setSavedFilter,
    clearSavedFilter,
    
    // UI density helper
    uiDensity: localPreferences.uiDensity || 'comfortable',
    setUiDensity: (density: 'compact' | 'comfortable' | 'spacious') => 
      setPreference('uiDensity', density),
  };
}

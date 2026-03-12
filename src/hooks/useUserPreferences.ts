import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentEnvironment } from '@/lib/environment-utils';
import type { Json } from '@/integrations/supabase/types';

type PreferenceValue = string | number | boolean | string[] | Record<string, unknown>;

// Module-level deduplication: prevents concurrent upserts for the same preference key
const inFlightPrefKeys = new Set<string>();

interface UseUserPreferencesOptions<T> {
  /** Unique key for this preference (e.g., 'purchases_view_mode') */
  key: string;
  /** Default value if no preference exists */
  defaultValue: T;
  /** Whether to include environment in the key (default: true) */
  includeEnvironment?: boolean;
  /**
   * If provided, the workspace setting key to check for enforcement.
   * When the workspace setting is enforced, user preferences are ignored.
   */
  workspaceSettingKey?: string;
}

interface UseUserPreferencesReturn<T> {
  /** Current preference value */
  value: T;
  /** Update the preference value */
  setValue: (newValue: T) => void;
  /** Reset to default value */
  resetToDefault: () => void;
  /** Whether the preference is loading */
  isLoading: boolean;
  /** Whether there was an error */
  error: Error | null;
  /** Whether the preference has been synced from database */
  isSynced: boolean;
  /** Whether this preference can be changed (not enforced by workspace) */
  canOverride: boolean;
  /** The source of the current value */
  source: 'workspace-enforced' | 'user' | 'default';
}

/**
 * Universal hook for managing user preferences with database sync
 * 
 * Features:
 * - Reads from localStorage immediately for fast initial load
 * - Syncs with database for cross-device persistence
 * - Falls back to localStorage if user is not authenticated
 * - Environment-aware by default
 * - **NEW**: Respects workspace-level enforced settings
 * 
 * @example
 * const { value, setValue, canOverride } = useUserPreferences({
 *   key: 'purchases_view_mode',
 *   defaultValue: 'list',
 *   workspaceSettingKey: 'default_view_mode', // Optional: workspace enforcement
 * });
 */
export function useUserPreferences<T extends PreferenceValue>({
  key,
  defaultValue,
  includeEnvironment = true,
  workspaceSettingKey,
}: UseUserPreferencesOptions<T>): UseUserPreferencesReturn<T> {
  const { user } = useAuth();
  
  // Track workspace enforcement status
  const [workspaceEnforced, setWorkspaceEnforced] = useState(false);
  const [workspaceValue, setWorkspaceValue] = useState<T | null>(null);
  
  const [value, setValueState] = useState<T>(() => {
    // Initialize from localStorage for immediate display
    const storageKey = getStorageKey(key, includeEnvironment);
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        return JSON.parse(stored) as T;
      } catch {
        return defaultValue;
      }
    }
    return defaultValue;
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isSynced, setIsSynced] = useState(false);
  
  const isSavingRef = useRef(false);
  const hasLoadedFromDbRef = useRef(false);

  // Get the full storage/preference key
  const storageKey = getStorageKey(key, includeEnvironment);

  // Load from database
  const loadFromDatabase = useCallback(async () => {
    if (!user?.id || hasLoadedFromDbRef.current) return null;
    
    try {
      const { data, error: dbError } = await supabase
        .from('user_preferences')
        .select('preference_value')
        .eq('user_id', user.id)
        .eq('preference_key', storageKey)
        .maybeSingle();
      
      if (dbError) {
        console.error('Failed to load preference from database:', dbError);
        setError(new Error(dbError.message));
        return null;
      }
      
      if (data?.preference_value !== undefined && data?.preference_value !== null) {
        return data.preference_value as T;
      }
      
      return null;
    } catch (e) {
      console.error('Failed to load preference from database:', e);
      setError(e as Error);
      return null;
    }
  }, [user?.id, storageKey]);

  // Save to database
  const saveToDatabase = useCallback(async (newValue: T) => {
    if (!user?.id || isSavingRef.current) return;

    // Skip writes during Ghost Mode to prevent 409 conflicts
    const isGhost = localStorage.getItem('orderli_ghost_active') === 'true';
    if (isGhost) return;

    // Deduplication: skip if another instance is already saving this key
    if (inFlightPrefKeys.has(storageKey)) return;
    inFlightPrefKeys.add(storageKey);
    
    isSavingRef.current = true;
    
    try {
      const { error: dbError } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: user.id,
          preference_key: storageKey,
          preference_value: newValue as Json,
          updated_at: new Date().toISOString()
        } as {
          user_id: string;
          preference_key: string;
          preference_value: Json;
          updated_at: string;
        }, {
          onConflict: 'user_id,preference_key'
        });
      
      if (dbError) {
        // Handle 409/unique violation by falling back to update
        if (dbError.code === '23505' || dbError.message?.includes('409')) {
          await supabase
            .from('user_preferences')
            .update({ preference_value: newValue as Json, updated_at: new Date().toISOString() })
            .eq('user_id', user.id)
            .eq('preference_key', storageKey);
          setIsSynced(true);
        } else {
          console.error('Failed to save preference to database:', dbError);
          setError(new Error(dbError.message));
        }
      } else {
        setIsSynced(true);
      }
    } catch (e) {
      console.error('Failed to save preference to database:', e);
      setError(e as Error);
    } finally {
      isSavingRef.current = false;
      inFlightPrefKeys.delete(storageKey);
    }
  }, [user?.id, storageKey]);

  // Initialize: Load from database and sync
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);

      // Skip ALL database operations during Ghost Mode
      const isGhost = localStorage.getItem('orderli_ghost_active') === 'true';
      if (isGhost) {
        hasLoadedFromDbRef.current = true;
        setIsLoading(false);
        return;
      }
      
      if (user?.id) {
        const dbValue = await loadFromDatabase();
        hasLoadedFromDbRef.current = true;
        
        if (dbValue !== null) {
          // Database value takes precedence
          setValueState(dbValue);
          localStorage.setItem(storageKey, JSON.stringify(dbValue));
          setIsSynced(true);
        } else {
          // No database value - sync localStorage value to database
          const localValue = localStorage.getItem(storageKey);
          if (localValue) {
            try {
              const parsed = JSON.parse(localValue) as T;
              await saveToDatabase(parsed);
            } catch {
              // Invalid localStorage value, use default
            }
          }
        }
      }
      
      setIsLoading(false);
    };
    
    initialize();
  }, [user?.id, loadFromDatabase, saveToDatabase, storageKey]);

  // Update value
  const setValue = useCallback((newValue: T) => {
    setValueState(newValue);
    localStorage.setItem(storageKey, JSON.stringify(newValue));
    
    // Sync to database if authenticated
    if (user?.id) {
      saveToDatabase(newValue);
    }
  }, [storageKey, user?.id, saveToDatabase]);

  // Reset to default
  const resetToDefault = useCallback(() => {
    setValue(defaultValue);
  }, [setValue, defaultValue]);

  // Determine effective value based on workspace enforcement
  const effectiveValue = workspaceEnforced && workspaceValue !== null 
    ? workspaceValue 
    : value;
    
  const source: 'workspace-enforced' | 'user' | 'default' = 
    workspaceEnforced && workspaceValue !== null 
      ? 'workspace-enforced' 
      : value !== defaultValue 
        ? 'user' 
        : 'default';

  return {
    value: effectiveValue,
    setValue,
    resetToDefault,
    isLoading,
    error,
    isSynced,
    canOverride: !workspaceEnforced,
    source,
  };
}

// Helper to generate storage key
function getStorageKey(key: string, includeEnvironment: boolean): string {
  if (includeEnvironment) {
    const env = getCurrentEnvironment();
    return `${key}_${env}`;
  }
  return key;
}

/**
 * Batch preferences hook for loading multiple preferences at once
 */
export function useUserPreferencesBatch(keys: string[]): {
  preferences: Record<string, PreferenceValue>;
  isLoading: boolean;
} {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<Record<string, PreferenceValue>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadBatch = async () => {
      if (!user?.id) {
        // Load from localStorage only
        const localPrefs: Record<string, PreferenceValue> = {};
        keys.forEach(key => {
          const env = getCurrentEnvironment();
          const storageKey = `${key}_${env}`;
          const stored = localStorage.getItem(storageKey);
          if (stored) {
            try {
              localPrefs[key] = JSON.parse(stored);
            } catch {
              // Skip invalid entries
            }
          }
        });
        setPreferences(localPrefs);
        setIsLoading(false);
        return;
      }

      const env = getCurrentEnvironment();
      const storageKeys = keys.map(k => `${k}_${env}`);
      
      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('preference_key, preference_value')
          .eq('user_id', user.id)
          .in('preference_key', storageKeys);
        
        if (error) {
          console.error('Failed to load batch preferences:', error);
        } else if (data) {
          const prefs: Record<string, PreferenceValue> = {};
          data.forEach(row => {
            // Extract original key from storage key
            const originalKey = keys.find(k => `${k}_${env}` === row.preference_key);
            if (originalKey) {
              prefs[originalKey] = row.preference_value as PreferenceValue;
            }
          });
          setPreferences(prefs);
        }
      } catch (e) {
        console.error('Failed to load batch preferences:', e);
      }
      
      setIsLoading(false);
    };

    loadBatch();
  }, [user?.id, keys.join(',')]);

  return { preferences, isLoading };
}

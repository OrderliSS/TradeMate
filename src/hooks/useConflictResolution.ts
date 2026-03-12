import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';
import {
  ConflictInfo,
  ConflictResolutionStrategy,
  createConflictInfo,
  hasVersionConflict,
  canAutoResolve,
  autoResolve,
  resolveConflict,
} from '@/lib/conflict-resolution';
import { useSyncMode } from '@/contexts/SyncModeContext';

interface UseConflictResolutionOptions {
  entityType: string;
  onConflictDetected?: (conflict: ConflictInfo) => void;
  onConflictResolved?: (resolvedData: Record<string, unknown>) => void;
  autoResolveNonConflicting?: boolean;
}

export function useConflictResolution<T extends Record<string, unknown>>({
  entityType,
  onConflictDetected,
  onConflictResolved,
  autoResolveNonConflicting = true,
}: UseConflictResolutionOptions) {
  const [pendingConflict, setPendingConflict] = useState<ConflictInfo<T> | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const { deviceId } = useSyncMode();

  /**
   * Check for conflicts before updating
   */
  const checkForConflict = useCallback(async (
    entityId: string,
    localData: T,
    expectedServerVersion: number
  ): Promise<ConflictInfo<T> | null> => {
    // Fetch current server data
    const { data: serverData, error } = await supabase
      .from(entityType as 'customers' | 'purchases' | 'tasks' | 'stock_orders' | 'products')
      .select('*')
      .eq('id', entityId)
      .single();

    if (error) {
      console.error('Error fetching server data for conflict check:', error);
      return null;
    }

    if (!serverData) return null;

    const serverRecord = serverData as unknown as Record<string, unknown>;
    const serverVersion = serverRecord.server_version as number;
    
    if (!hasVersionConflict(expectedServerVersion, serverVersion, expectedServerVersion)) {
      return null; // No conflict
    }

    // Create conflict info
    const conflict = createConflictInfo(
      entityType,
      entityId,
      localData,
      serverRecord as T,
      expectedServerVersion,
      serverVersion,
      undefined, // baseData not available in simple case
      deviceId
    );

    return conflict;
  }, [entityType, deviceId]);

  /**
   * Attempt to update with conflict detection
   */
  const updateWithConflictDetection = useCallback(async (
    entityId: string,
    localData: T,
    expectedServerVersion: number
  ): Promise<{ success: boolean; conflict?: ConflictInfo<T> }> => {
    const conflict = await checkForConflict(entityId, localData, expectedServerVersion);

    if (!conflict) {
      // No conflict, proceed with update
      return { success: true };
    }

    // Check if we can auto-resolve
    if (autoResolveNonConflicting && canAutoResolve(conflict)) {
      const resolution = autoResolve(conflict);
      await applyResolution(entityId, resolution.resolvedData, conflict, resolution.strategy);
      return { success: true };
    }

    // Set pending conflict for user resolution
    setPendingConflict(conflict);
    onConflictDetected?.(conflict);
    
    return { success: false, conflict };
  }, [checkForConflict, autoResolveNonConflicting, onConflictDetected]);

  /**
   * Apply a resolution to the database
   */
  const applyResolution = useCallback(async (
    entityId: string,
    resolvedData: T,
    conflict: ConflictInfo<T>,
    strategy: ConflictResolutionStrategy
  ) => {
    setIsResolving(true);

    try {
      // Update the entity with resolved data
      const { error: updateError } = await supabase
        .from(entityType as 'customers' | 'purchases' | 'tasks' | 'stock_orders' | 'products')
        .update({
          ...resolvedData,
          local_version: conflict.serverVersion + 1, // Increment past server version
        })
        .eq('id', entityId);

      if (updateError) throw updateError;

      // Log the conflict resolution
      await supabase.from('conflict_log').insert([{
        entity_type: entityType,
        entity_id: entityId,
        local_version: conflict.localVersion,
        server_version: conflict.serverVersion,
        local_data: JSON.parse(JSON.stringify(conflict.localData)) as Json,
        server_data: JSON.parse(JSON.stringify(conflict.serverData)) as Json,
        resolution_strategy: strategy,
        resolved_data: JSON.parse(JSON.stringify(resolvedData)) as Json,
        device_id: deviceId,
      }]);

      setPendingConflict(null);
      onConflictResolved?.(resolvedData);
      toast.success('Conflict resolved successfully');
    } catch (error) {
      console.error('Error applying conflict resolution:', error);
      toast.error('Failed to resolve conflict');
      throw error;
    } finally {
      setIsResolving(false);
    }
  }, [entityType, deviceId, onConflictResolved]);

  /**
   * Resolve the pending conflict with user's choice
   */
  const resolveConflictWithStrategy = useCallback(async (
    strategy: ConflictResolutionStrategy,
    manualResolutions?: Record<string, unknown>
  ) => {
    if (!pendingConflict) {
      console.warn('No pending conflict to resolve');
      return;
    }

    const resolution = resolveConflict(pendingConflict, strategy, manualResolutions);
    await applyResolution(
      pendingConflict.entityId,
      resolution.resolvedData,
      pendingConflict,
      strategy
    );
  }, [pendingConflict, applyResolution]);

  /**
   * Dismiss the pending conflict without resolving
   */
  const dismissConflict = useCallback(() => {
    setPendingConflict(null);
  }, []);

  return {
    pendingConflict,
    isResolving,
    checkForConflict,
    updateWithConflictDetection,
    resolveConflictWithStrategy,
    dismissConflict,
    applyResolution,
  };
}

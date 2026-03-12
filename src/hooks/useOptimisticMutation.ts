/**
 * Optimistic Mutation Factory
 * 
 * A standardized approach for creating mutations with optimistic updates,
 * automatic rollback on error, and event emission.
 */

import { useMutation, useQueryClient, QueryKey } from '@tanstack/react-query';
import { eventBus, EntityEventType, EventPayload } from '@/lib/event-bus';
import { toast } from 'sonner';

interface OptimisticMutationConfig<TData, TVariables, TContext = unknown> {
  // The mutation function that calls the API
  mutationFn: (variables: TVariables) => Promise<TData>;
  
  // Query key(s) to update optimistically
  queryKey: QueryKey | QueryKey[];
  
  // Function to update the cache optimistically
  updateCache: (
    queryClient: ReturnType<typeof useQueryClient>,
    variables: TVariables
  ) => void;
  
  // Optional: Event to emit on mutation start (optimistic)
  eventOnMutate?: EntityEventType;
  
  // Optional: Event to emit on success
  eventOnSuccess?: EntityEventType;
  
  // Optional: Event to emit on error
  eventOnError?: EntityEventType;
  
  // Optional: Create event payload from variables
  createEventPayload?: (variables: TVariables, data?: TData) => EventPayload;
  
  // Optional: Show toast on error
  showErrorToast?: boolean;
  
  // Optional: Error toast message
  errorMessage?: string;
  
  // Optional: Show toast on success
  showSuccessToast?: boolean;
  
  // Optional: Success toast message
  successMessage?: string;
  
  // Optional: Additional query keys to invalidate on settle
  additionalInvalidateKeys?: QueryKey[];
  
  // Optional: Custom onSuccess handler
  onSuccess?: (data: TData, variables: TVariables) => void;
  
  // Optional: Custom onError handler
  onError?: (error: Error, variables: TVariables) => void;
}

export function useOptimisticMutation<TData, TVariables, TContext = unknown>({
  mutationFn,
  queryKey,
  updateCache,
  eventOnMutate,
  eventOnSuccess,
  eventOnError,
  createEventPayload,
  showErrorToast = true,
  errorMessage = 'Action failed, changes reverted',
  showSuccessToast = false,
  successMessage = 'Changes saved',
  additionalInvalidateKeys = [],
  onSuccess,
  onError,
}: OptimisticMutationConfig<TData, TVariables, TContext>) {
  const queryClient = useQueryClient();

  const queryKeys = Array.isArray(queryKey[0]) ? (queryKey as QueryKey[]) : [queryKey];

  return useMutation({
    mutationFn,
    
    onMutate: async (variables: TVariables) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await Promise.all(
        queryKeys.map((key) => queryClient.cancelQueries({ queryKey: key }))
      );

      // Snapshot previous values for rollback
      const previousData = new Map<string, unknown>();
      queryKeys.forEach((key) => {
        previousData.set(JSON.stringify(key), queryClient.getQueryData(key));
      });

      // Apply optimistic update
      updateCache(queryClient, variables);

      // Emit event for immediate UI sync
      if (eventOnMutate) {
        const payload = createEventPayload?.(variables) || {};
        eventBus.emit(eventOnMutate, payload);
      }

      return { previousData };
    },

    onError: (error: Error, variables: TVariables, context: { previousData?: Map<string, unknown> } | undefined) => {
      // Rollback to previous values
      if (context?.previousData) {
        context.previousData.forEach((data, key) => {
          queryClient.setQueryData(JSON.parse(key), data);
        });
      }

      // Emit error event
      if (eventOnError) {
        const payload = createEventPayload?.(variables) || {};
        eventBus.emit(eventOnError, { ...payload, error: error.message });
      }

      // Show error toast
      if (showErrorToast) {
        toast.error(errorMessage);
      }

      // Call custom error handler
      onError?.(error, variables);
    },

    onSuccess: (data: TData, variables: TVariables) => {
      // Emit success event
      if (eventOnSuccess) {
        const payload = createEventPayload?.(variables, data) || {};
        eventBus.emit(eventOnSuccess, payload);
      }

      // Show success toast
      if (showSuccessToast) {
        toast.success(successMessage);
      }

      // Call custom success handler
      onSuccess?.(data, variables);
    },

    onSettled: () => {
      // Invalidate queries to ensure data consistency
      queryKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });

      // Invalidate additional keys
      additionalInvalidateKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
  });
}

// Helper to create a simple list update function
export function createListUpdateCache<T extends { id: string }>(
  queryKey: QueryKey,
  updateFn: (items: T[], variables: any) => T[]
) {
  return (queryClient: ReturnType<typeof useQueryClient>, variables: any) => {
    queryClient.setQueryData(queryKey, (old: T[] | undefined) => {
      if (!old) return old;
      return updateFn(old, variables);
    });
  };
}

// Helper to update a single item in a list
export function updateItemInList<T extends { id: string }>(
  items: T[],
  id: string,
  updates: Partial<T>
): T[] {
  return items.map((item) =>
    item.id === id ? { ...item, ...updates } : item
  );
}

// Helper to add an item to a list
export function addItemToList<T>(items: T[], newItem: T): T[] {
  return [newItem, ...items];
}

// Helper to remove an item from a list
export function removeItemFromList<T extends { id: string }>(
  items: T[],
  id: string
): T[] {
  return items.filter((item) => item.id !== id);
}

// Generic counter update helper
export function updateCounter(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: QueryKey,
  field: string,
  delta: number
) {
  queryClient.setQueryData(queryKey, (old: any) => {
    if (!old) return old;
    return {
      ...old,
      [field]: Math.max(0, (old[field] || 0) + delta),
    };
  });
}

export default useOptimisticMutation;

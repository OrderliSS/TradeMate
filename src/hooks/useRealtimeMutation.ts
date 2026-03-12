/**
 * Realtime Mutation Hook
 * 
 * Wraps mutations with correlation ID tracking for proper
 * echo deduplication when the server broadcasts back our changes.
 * 
 * Usage:
 *   const { mutate, correlationId } = useRealtimeMutation({
 *     mutationFn: async (data) => { ... },
 *     entityType: 'purchase',
 *   });
 */

import { useMutation, UseMutationOptions, UseMutationResult } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { generateCorrelationId, correlationTracker } from '@/lib/realtime';

type RealtimeMutationOptions<TData, TError, TVariables, TContext> = 
  Omit<UseMutationOptions<TData, TError, TVariables, TContext>, 'mutationFn'> & {
  mutationFn: (variables: TVariables, correlationId: string) => Promise<TData>;
  entityType: string;
  getEntityId?: (variables: TVariables) => string;
  getVersion?: (variables: TVariables) => number;
};

type RealtimeMutationResult<TData, TError, TVariables, TContext> = 
  UseMutationResult<TData, TError, TVariables, TContext> & {
  currentCorrelationId: string | null;
};

export function useRealtimeMutation<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown
>(
  options: RealtimeMutationOptions<TData, TError, TVariables, TContext>
): RealtimeMutationResult<TData, TError, TVariables, TContext> {
  const { 
    mutationFn, 
    entityType, 
    getEntityId, 
    getVersion,
    onMutate,
    onSuccess,
    onError,
    ...restOptions 
  } = options;

  const correlationIdRef = useRef<string | null>(null);

  const wrappedMutationFn = useCallback(async (variables: TVariables): Promise<TData> => {
    // Generate correlation ID for tracking
    const entityId = getEntityId?.(variables) || 'new';
    const version = getVersion?.(variables);
    const correlationId = generateCorrelationId(entityType, entityId, version);
    correlationIdRef.current = correlationId;

    // Call original mutation with correlation ID
    return mutationFn(variables, correlationId);
  }, [mutationFn, entityType, getEntityId, getVersion]);

  const wrappedOnMutate = useCallback(async (variables: TVariables) => {
    // Call original onMutate if provided
    if (onMutate) {
      return onMutate(variables);
    }
    return undefined;
  }, [onMutate]);

  const wrappedOnSuccess = useCallback((data: TData, variables: TVariables, context: TContext) => {
    // Mark correlation as complete on success
    if (correlationIdRef.current) {
      correlationTracker.complete(correlationIdRef.current);
    }
    
    // Call original onSuccess if provided
    if (onSuccess) {
      onSuccess(data, variables, context);
    }
  }, [onSuccess]);

  const wrappedOnError = useCallback((error: TError, variables: TVariables, context: TContext | undefined) => {
    // Clear correlation on error (optimistic update will be rolled back)
    if (correlationIdRef.current) {
      correlationTracker.complete(correlationIdRef.current);
      correlationIdRef.current = null;
    }
    
    // Call original onError if provided
    if (onError) {
      onError(error, variables, context);
    }
  }, [onError]);

  const mutation = useMutation({
    ...restOptions,
    mutationFn: wrappedMutationFn,
    onMutate: wrappedOnMutate,
    onSuccess: wrappedOnSuccess,
    onError: wrappedOnError,
  });

  return {
    ...mutation,
    currentCorrelationId: correlationIdRef.current,
  };
}

/**
 * Simple helper to track a manual mutation (not using React Query)
 */
export function trackMutation(entityType: string, entityId: string): string {
  return generateCorrelationId(entityType, entityId);
}

/**
 * Mark a tracked mutation as complete
 */
export function completeMutation(correlationId: string): void {
  correlationTracker.complete(correlationId);
}

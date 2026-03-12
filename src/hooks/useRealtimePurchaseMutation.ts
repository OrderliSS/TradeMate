/**
 * Realtime Purchase Mutation Hooks
 * 
 * Enhanced purchase mutations with correlation tracking for proper
 * echo deduplication in the realtime system.
 */

import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Purchase } from '@/types/database';
import { toast } from '@/hooks/use-toast';
import { useRealtimeMutation } from './useRealtimeMutation';
import { SecureEnvironment } from '@/lib/secure-environment';

export const useRealtimeUpdatePurchaseStatus = () => {
  const queryClient = useQueryClient();

  return useRealtimeMutation({
    mutationFn: async (
      { id, status, notes }: { id: string; status: string; notes?: string },
      correlationId: string
    ) => {
      console.log('[RealtimePurchase] Updating status with correlation:', correlationId);
      
      const updateData: Record<string, any> = { order_status: status };
      if (notes !== undefined) {
        updateData.notes = notes;
      }
      
      const { data, error } = await supabase
        .from('purchases')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    entityType: 'purchase',
    getEntityId: (variables) => variables.id,
    onSuccess: (data) => {
      // Update specific purchase cache for responsive UI
      queryClient.setQueryData(['purchase', data.id], (old: any) => ({
        ...old,
        ...data,
      }));
      toast({
        title: 'Status Updated',
        description: `Purchase status changed to ${data.order_status}`,
      });
    },
    onError: (error) => {
      SecureEnvironment.error('Purchase status update error:', error);
      toast({
        title: 'Error',
        description: 'Failed to update purchase status',
        variant: 'destructive',
      });
    },
  });
};

export const useRealtimeUpdatePurchase = () => {
  const queryClient = useQueryClient();

  return useRealtimeMutation({
    mutationFn: async (
      { id, ...updates }: Partial<Purchase> & { id: string },
      correlationId: string
    ) => {
      console.log('[RealtimePurchase] Updating purchase with correlation:', correlationId);
      
      const { data, error } = await supabase
        .from('purchases')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    entityType: 'purchase',
    getEntityId: (variables) => variables.id,
    onSuccess: (data) => {
      queryClient.setQueryData(['purchase', data.id], (old: any) => ({
        ...old,
        ...data,
      }));
      toast({
        title: 'Success',
        description: 'Purchase updated successfully',
      });
    },
    onError: (error) => {
      SecureEnvironment.error('Purchase update error:', error);
      toast({
        title: 'Error',
        description: 'Failed to update purchase',
        variant: 'destructive',
      });
    },
  });
};

export const useRealtimeCompletePurchase = () => {
  const queryClient = useQueryClient();

  return useRealtimeMutation({
    mutationFn: async (
      { id, pickupDate }: { id: string; pickupDate?: string },
      correlationId: string
    ) => {
      console.log('[RealtimePurchase] Completing purchase with correlation:', correlationId);
      
      const { data, error } = await supabase
        .from('purchases')
        .update({
          order_status: 'complete',
          pickup_date: pickupDate || new Date().toISOString(),
          completion_method: 'manual',
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    entityType: 'purchase',
    getEntityId: (variables) => variables.id,
    onSuccess: (data) => {
      queryClient.setQueryData(['purchase', data.id], (old: any) => ({
        ...old,
        ...data,
      }));
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      toast({
        title: 'Purchase Completed',
        description: 'Purchase marked as picked up',
      });
    },
    onError: (error) => {
      SecureEnvironment.error('Purchase completion error:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete purchase',
        variant: 'destructive',
      });
    },
  });
};

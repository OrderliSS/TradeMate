/**
 * Realtime Customer Mutation Hooks
 * 
 * Enhanced customer/contact mutations with correlation tracking for proper
 * echo deduplication in the realtime system.
 */

import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Contact } from '@/types/database';
import { enhancedToast } from '@/components/ui/enhanced-toast';
import { useRealtimeMutation } from './useRealtimeMutation';
import { useDataEnvironment } from './useSandbox';

export const useRealtimeCreateCustomer = () => {
  const queryClient = useQueryClient();
  const dataEnvironment = useDataEnvironment();

  return useRealtimeMutation({
    mutationFn: async (
      contact: Omit<Contact, 'id' | 'created_at' | 'updated_at'>,
      correlationId: string
    ) => {
      console.log('[RealtimeCustomer] Creating customer with correlation:', correlationId);
      
      const { data, error } = await supabase
        .from('customers')
        .insert({ ...contact, data_environment: dataEnvironment })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    entityType: 'customer',
    getEntityId: () => 'new',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      enhancedToast.success('Success', 'Customer created successfully');
    },
    onError: (error) => {
      console.error('Create customer error:', error);
      enhancedToast.error('Error', 'Failed to create customer');
    },
  });
};

export const useRealtimeUpdateCustomer = () => {
  const queryClient = useQueryClient();

  return useRealtimeMutation({
    mutationFn: async (
      { id, ...contact }: Partial<Contact> & { id: string },
      correlationId: string
    ) => {
      console.log('[RealtimeCustomer] Updating customer with correlation:', correlationId);
      
      const { data, error } = await supabase
        .from('customers')
        .update(contact)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    entityType: 'customer',
    getEntityId: (variables) => variables.id,
    onSuccess: (data) => {
      // Update specific customer cache
      queryClient.setQueryData(['contact', data.id], (old: any) => ({
        ...old,
        ...data,
      }));
      enhancedToast.success('Success', 'Customer updated successfully');
    },
    onError: () => {
      enhancedToast.error('Error', 'Failed to update customer');
    },
  });
};

export const useRealtimeUpdateCustomerTier = () => {
  const queryClient = useQueryClient();

  return useRealtimeMutation({
    mutationFn: async (
      { id, tier, notes }: { id: string; tier: 'standard' | 'frequent_buyer' | 'vip'; notes?: string },
      correlationId: string
    ) => {
      console.log('[RealtimeCustomer] Updating tier with correlation:', correlationId);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('customers')
        .update({
          customer_tier: tier as 'standard' | 'frequent_buyer' | 'vip',
          tier_notes: notes,
          tier_override: true,
          tier_assigned_by: user?.id,
          tier_assigned_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    entityType: 'customer',
    getEntityId: (variables) => variables.id,
    onSuccess: (data) => {
      queryClient.setQueryData(['contact', data.id], (old: any) => ({
        ...old,
        ...data,
      }));
      enhancedToast.success('Tier Updated', `Customer tier updated`);
    },
    onError: () => {
      enhancedToast.error('Error', 'Failed to update customer tier');
    },
  });
};

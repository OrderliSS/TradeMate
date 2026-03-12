import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Customer, CustomerTier } from '@/types/database';

// Optimistic update for customer status changes
export const useOptimisticCustomerStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: 'active' | 'blacklisted'; reason?: string }) => {
      const updateData: any = { status };
      
      if (status === 'blacklisted') {
        updateData.blacklist_reason = reason;
        updateData.blacklisted_at = new Date().toISOString();
      } else {
        updateData.blacklist_reason = null;
        updateData.blacklisted_at = null;
        updateData.blacklisted_by = null;
      }

      const { data, error } = await supabase
        .from('customers')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, status, reason }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['customers'] });

      // Snapshot previous value
      const previousCustomers = queryClient.getQueryData(['customers']);

      // Optimistically update
      queryClient.setQueryData(['customers'], (old: Customer[] | undefined) => {
        if (!old) return old;
        
        return old.map(customer => 
          customer.id === id 
            ? { 
                ...customer, 
                status,
                ...(status === 'blacklisted' && {
                  blacklist_reason: reason,
                  blacklisted_at: new Date().toISOString()
                }),
                ...(status === 'active' && {
                  blacklist_reason: null,
                  blacklisted_at: null,
                  blacklisted_by: null
                })
              }
            : customer
        );
      });

      return { previousCustomers };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousCustomers) {
        queryClient.setQueryData(['customers'], context.previousCustomers);
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

// Optimistic update for customer tier changes
export const useOptimisticCustomerTier = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, tier, notes }: { id: string; tier: CustomerTier; notes?: string }) => {
      const { data, error } = await supabase
        .from('customers')
        .update({
          customer_tier: tier,
          tier_notes: notes,
          tier_assigned_at: new Date().toISOString(),
          tier_override: true
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, tier, notes }) => {
      await queryClient.cancelQueries({ queryKey: ['customers'] });
      
      const previousCustomers = queryClient.getQueryData(['customers']);

      queryClient.setQueryData(['customers'], (old: Customer[] | undefined) => {
        if (!old) return old;
        
        return old.map(customer => 
          customer.id === id 
            ? { 
                ...customer, 
                customer_tier: tier,
                tier_notes: notes,
                tier_assigned_at: new Date().toISOString(),
                tier_override: true
              }
            : customer
        );
      });

      return { previousCustomers };
    },
    onError: (err, variables, context) => {
      if (context?.previousCustomers) {
        queryClient.setQueryData(['customers'], context.previousCustomers);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};
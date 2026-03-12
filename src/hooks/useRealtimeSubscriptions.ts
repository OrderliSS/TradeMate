import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { enhancedToast } from '@/components/ui/enhanced-toast';

export const useRealtimeCustomers = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to customer changes
    const channel = supabase
      .channel('customers-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customers'
        },
        (payload) => {
          console.log('Customer change detected:', payload);
          
          // Invalidate customers queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['customers'] });
          queryClient.invalidateQueries({ queryKey: ['customers-with-stats'] });
          
          // Show toast for specific events
          if (payload.eventType === 'INSERT') {
            enhancedToast.success('New customer added', '', {
              duration: 3000,
              action: {
                label: 'View',
                onClick: () => window.open(`/contacts/${payload.new.id}`, '_blank')
              }
            });
          } else if (payload.eventType === 'UPDATE') {
            // Only show toast for status changes
            const oldStatus = payload.old?.status;
            const newStatus = payload.new?.status;
            
            if (oldStatus !== newStatus) {
              if (newStatus === 'blacklisted') {
                enhancedToast.warning('Customer blacklisted', `${payload.new.name} has been blacklisted`);
              } else if (oldStatus === 'blacklisted' && newStatus === 'active') {
                enhancedToast.success('Customer restored', `${payload.new.name} has been restored`);
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};

export const useRealtimePurchases = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('purchases-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'purchases'
        },
        (payload) => {
          console.log('Purchase change detected:', payload);
          
          // Invalidate related queries
          queryClient.invalidateQueries({ queryKey: ['purchases'] });
          queryClient.invalidateQueries({ queryKey: ['customers-with-stats'] });
          
          // Show notifications for new purchases
          if (payload.eventType === 'INSERT') {
            enhancedToast.success('New purchase created', '', {
              duration: 4000,
              action: {
                label: 'View',
                onClick: () => window.open(`/purchases/${payload.new.id}`, '_blank')
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};

export const useRealtimeInventory = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('inventory-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products'
        },
        (payload) => {
          console.log('Product change detected:', payload);
          
          // Invalidate product queries
          queryClient.invalidateQueries({ queryKey: ['products'] });
          
          // Check for low stock alerts
          if (payload.eventType === 'UPDATE') {
            const product = payload.new;
            if (product.stock_quantity <= (product.reorder_level || 10) && product.stock_quantity > 0) {
              enhancedToast.warning('Low stock alert', `${product.name} is running low (${product.stock_quantity} remaining)`);
            } else if (product.stock_quantity === 0) {
              enhancedToast.error('Out of stock', `${product.name} is now out of stock`);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};

// Combined hook for all real-time subscriptions
export const useRealtimeSubscriptions = () => {
  useRealtimeCustomers();
  useRealtimePurchases();
  useRealtimeInventory();
};
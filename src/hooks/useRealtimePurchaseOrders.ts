import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePurchaseOrders } from './usePurchaseOrders';
import { enhancedToast } from '@/components/ui/enhanced-toast';

export function useRealtimePurchaseOrders(statusFilter?: string[]) {
  const queryClient = useQueryClient();
  const query = usePurchaseOrders(statusFilter);

  useEffect(() => {
    const channel = supabase
      .channel('purchase-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'purchase_orders',
        },
        (payload) => {
          // Invalidate and refetch purchase orders
          queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
          
          // Show notification based on event type
          if (payload.eventType === 'INSERT') {
            enhancedToast.success('New purchase order created');
          } else if (payload.eventType === 'UPDATE') {
            enhancedToast.info('Purchase order updated');
          } else if (payload.eventType === 'DELETE') {
            enhancedToast.warning('Purchase order deleted');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, statusFilter]);

  return query;
}

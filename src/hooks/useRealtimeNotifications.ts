import { useEffect } from 'react';
import { useNotifications } from './useNotifications';
import { supabase } from '@/integrations/supabase/client';
import { navigateWithEnvironment } from '@/lib/environment-url-helper';

export function useRealtimeNotifications() {
  const notifications = useNotifications();

  useEffect(() => {
    // Listen for purchase order status changes
    const poChannel = supabase
      .channel('po-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'purchase_orders',
        },
        (payload) => {
          const oldStatus = (payload.old as any)?.status;
          const newStatus = (payload.new as any)?.status;
          const poNumber = (payload.new as any)?.po_number;

          if (oldStatus !== newStatus) {
            notifications.addNotification({
              title: 'Purchase Order Updated',
              message: `PO ${poNumber} status changed from ${oldStatus} to ${newStatus}`,
              type: 'info',
              action: {
                label: 'View',
                onClick: () => {
                  navigateWithEnvironment(`/purchase-orders`);
                },
              },
            });
          }
        }
      )
      .subscribe();

    // Listen for package record consolidation (auto-delivered)
    const pkgChannel = supabase
      .channel('pkg-consolidation-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shipment_records',
        },
        (payload) => {
          const oldStatus = (payload.old as any)?.consolidated_status;
          const newStatus = (payload.new as any)?.consolidated_status;
          const pkgNumber = (payload.new as any)?.package_record_number;

          if (oldStatus !== 'delivered' && newStatus === 'delivered' && pkgNumber) {
            notifications.addNotification({
              title: 'Package Delivered',
              message: `${pkgNumber} - All shipments delivered. Package marked as complete.`,
              type: 'success',
              action: {
                label: 'View',
                onClick: () => {
                  navigateWithEnvironment('/tracking');
                },
              },
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(poChannel);
      supabase.removeChannel(pkgChannel);
    };
  }, [notifications]);

  return notifications;
}

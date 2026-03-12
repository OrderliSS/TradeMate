import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

/**
 * Enhanced real-time inventory subscription hook
 * Listens to all inventory-affecting tables and invalidates relevant queries
 */
export const useRealtimeInventory = (productId?: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to products table changes
    const productsChannel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: productId ? `id=eq.${productId}` : undefined
        },
        (payload) => {
          
          
          // Invalidate all product-related queries
          queryClient.invalidateQueries({ queryKey: ['products'] });
          queryClient.invalidateQueries({ queryKey: ['sot-metrics'] });
          queryClient.invalidateQueries({ queryKey: ['product-stock-summary'] });
          
          if (payload.eventType !== 'DELETE') {
            toast({
              title: "Product Updated",
              description: `Product "${(payload.new as any)?.name || 'Unknown'}" has been updated`,
              duration: 3000,
            });
          }
        }
      )
      .subscribe();

    // Subscribe to asset_management changes
    const assetsChannel = supabase
      .channel('assets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'asset_management',
          filter: productId ? `product_id=eq.${productId}` : undefined
        },
        (payload) => {
          
          
          // Invalidate asset and inventory queries
          queryClient.invalidateQueries({ queryKey: ['asset-management'] });
          queryClient.invalidateQueries({ queryKey: ['sot-metrics'] });
          queryClient.invalidateQueries({ queryKey: ['product-stock-summary'] });
          queryClient.invalidateQueries({ queryKey: ['unified-asset-metrics'] });
          
          if (payload.eventType === 'INSERT') {
            toast({
              title: "Asset Created",
              description: "New asset has been added to inventory",
              duration: 2000,
            });
          }
        }
      )
      .subscribe();

    // Subscribe to allocations_v2 changes  
    const allocationsChannel = supabase
      .channel('allocations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'allocations_v2',
          filter: productId ? `product_id=eq.${productId}` : undefined
        },
        (payload) => {
          
          
          // Invalidate allocation and stock queries
          queryClient.invalidateQueries({ queryKey: ['allocations'] });
          queryClient.invalidateQueries({ queryKey: ['sot-metrics'] });
          queryClient.invalidateQueries({ queryKey: ['product-stock-summary'] });
          
          if (payload.eventType === 'INSERT') {
            toast({
              title: "Allocation Created",
              description: `${(payload.new as any)?.quantity || 0} units allocated`,
              duration: 2000,
            });
          }
        }
      )
      .subscribe();

    // Subscribe to stock orders changes (affects stock through deliveries)
    const stockOrdersChannel = supabase
      .channel('stock-orders-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'stock_orders',
          filter: productId ? `product_id=eq.${productId}` : undefined
        },
        (payload) => {
          // Only care about delivery status changes
          if ((payload.old as any)?.delivery_status !== (payload.new as any)?.delivery_status) {
            
            
            queryClient.invalidateQueries({ queryKey: ['stock-orders'] });
            queryClient.invalidateQueries({ queryKey: ['sot-metrics'] });
            queryClient.invalidateQueries({ queryKey: ['product-stock-summary'] });
            
            if ((payload.new as any)?.delivery_status === 'delivered') {
              toast({
                title: "Stock Received",
                description: `${(payload.new as any)?.quantity_needed || 0} units delivered`,
                duration: 3000,
              });
            }
          }
        }
      )
      .subscribe();

    // Subscribe to purchases changes (affects allocations and sales)
    const purchasesChannel = supabase
      .channel('purchases-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'purchases',
          filter: productId ? `product_id=eq.${productId}` : undefined
        },
        (payload) => {
          
          
          queryClient.invalidateQueries({ queryKey: ['purchases'] });
          queryClient.invalidateQueries({ queryKey: ['sot-metrics'] });
          queryClient.invalidateQueries({ queryKey: ['product-stock-summary'] });
          
          if ((payload.old as any)?.pickup_date === null && (payload.new as any)?.pickup_date !== null) {
            toast({
              title: "Sale Completed",
              description: `${(payload.new as any)?.quantity || 0} units sold`,
              duration: 3000,
            });
          }
        }
      )
      .subscribe();

    // Cleanup function
    return () => {
      productsChannel.unsubscribe();
      assetsChannel.unsubscribe();
      allocationsChannel.unsubscribe();
      stockOrdersChannel.unsubscribe();
      purchasesChannel.unsubscribe();
    };
  }, [queryClient, productId]);
};
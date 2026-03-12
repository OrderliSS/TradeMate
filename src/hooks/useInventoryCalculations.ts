import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface InventoryAvailability {
  product_id: string;
  sku?: string;
  total_assets: number;
  available: number;
  allocated: number;
  outbound_transit: number;
  being_configured: number;
  on_order: number;
  sold: number;
  inbound_transit: number;
  true_available: number;
}

export const useInventoryAvailability = (productId?: string) => {
  const queryClient = useQueryClient();
  
  // Set up real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('inventory-availability-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'products' 
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["inventory-availability"] });
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'asset_management' 
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["inventory-availability"] });
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'allocations' 
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["inventory-availability"] });
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'stock_allocations' 
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["inventory-availability"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["inventory-availability", productId],
    queryFn: async (): Promise<InventoryAvailability[]> => {
      // Use SoT metrics exclusively - no legacy fallbacks
      if (productId) {
        const { data: sotData, error } = await supabase
          .rpc('calculate_sot_metrics_state_graph', { p_product_id: productId });

        if (error) throw error;

        if (!sotData?.[0]) return [];

        const metrics = sotData[0];
        return [{
          product_id: productId,
          sku: undefined, // Will be fetched separately if needed
          total_assets: metrics.total_assets,
          available: metrics.available,
          allocated: metrics.allocated,
          outbound_transit: metrics.outbound_transit,
          being_configured: metrics.being_configured,
          on_order: metrics.on_order,
          sold: metrics.sold,
          inbound_transit: metrics.inbound_transit,
          true_available: metrics.available // Available units ready for allocation
        }];
      }

      // For all products, get SoT metrics via products table
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          id, sku,
          sot_s0_on_order,
          sot_s1_inbound_transit,
          sot_s2_being_configured,
          sot_s3_available,
          sot_s5_outbound_transit,
          sot_s6_sold,
          sot_safety_stock
        `)
        .eq('status', 'active');

      if (error) throw error;

      return (products || []).map(product => ({
        product_id: product.id,
        sku: product.sku,
        total_assets: 
          (product.sot_s2_being_configured || 0) +
          Math.max(0, (product.sot_s3_available || 0) - (product.sot_safety_stock || 0)) +
          (product.sot_s5_outbound_transit || 0),
        available: Math.max(0, (product.sot_s3_available || 0) - (product.sot_safety_stock || 0)),
        allocated: 0, // Will need allocations_v2 join for accurate data
        outbound_transit: product.sot_s5_outbound_transit || 0,
        being_configured: product.sot_s2_being_configured || 0,
        on_order: product.sot_s0_on_order || 0,
        sold: product.sot_s6_sold || 0,
        inbound_transit: product.sot_s1_inbound_transit || 0,
        true_available: Math.max(0, (product.sot_s3_available || 0) - (product.sot_safety_stock || 0))
      }));
    },
    enabled: true,
    staleTime: 5000,
    refetchOnWindowFocus: true,
  });
};

export const useProductAvailability = (productId: string) => {
  const { data: availabilities = [], ...query } = useInventoryAvailability(productId);
  
  return {
    ...query,
    data: availabilities.find(a => a.product_id === productId) || {
      product_id: productId,
      total_assets: 0,
      available: 0,
      allocated: 0,
      outbound_transit: 0,
      being_configured: 0,
      on_order: 0,
      sold: 0,
      inbound_transit: 0,
      true_available: 0
    }
  };
};
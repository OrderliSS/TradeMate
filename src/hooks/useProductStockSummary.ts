import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProductStockSummary {
  product_id: string;
  total_assets: number;
  available: number;
  allocated: number;
  outbound_transit: number;
  being_configured: number;
  on_order: number;
  sold: number;
  inbound_transit: number;
  safety_stock: number;
  true_available: number;
  sku?: string;
}

// New hook that uses ONLY SoT metrics - no legacy fallbacks
export const useProductStockSummary = (productId: string) => {
  return useQuery({
    queryKey: ["product-stock-summary", productId],
    queryFn: async (): Promise<ProductStockSummary> => {
      if (!productId) {
        throw new Error("Product ID is required");
      }

      // Use SoT metrics exclusively
      const { data: sotData, error } = await supabase
        .rpc('calculate_sot_metrics_state_graph', { p_product_id: productId });

      if (error) throw error;

      if (!sotData?.[0]) {
        // Return empty metrics if no data found
        return {
          product_id: productId,
          total_assets: 0,
          available: 0,
          allocated: 0,
          outbound_transit: 0,
          being_configured: 0,
          on_order: 0,
          sold: 0,
          inbound_transit: 0,
          safety_stock: 0,
          true_available: 0
        };
      }

      const metrics = sotData[0];
      
      return {
        product_id: productId,
        total_assets: metrics.total_assets,
        available: metrics.available,
        allocated: metrics.allocated,
        outbound_transit: metrics.outbound_transit,
        being_configured: metrics.being_configured,
        on_order: metrics.on_order,
        sold: metrics.sold,
        inbound_transit: metrics.inbound_transit,
        safety_stock: metrics.safety_stock,
        true_available: metrics.available, // Available units ready for allocation
        sku: undefined // Will be set if needed
      };
    },
    enabled: !!productId,
    staleTime: 30000, // 30 seconds - prevent aggressive refetching
    refetchOnWindowFocus: false, // Prevent flicker on tab switch
  });
};
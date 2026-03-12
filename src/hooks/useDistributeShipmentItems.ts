import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface DistributionItem {
  shipmentId: string;
  quantity: number;
}

interface DistributeItemsParams {
  stockOrderId: string;
  distribution: DistributionItem[];
}

export const useDistributeShipmentItems = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ stockOrderId, distribution }: DistributeItemsParams) => {
      // Update stock_order_shipments.units_expected for each shipment
      // This is the source of truth that useShipmentItemCounts reads from
      for (const item of distribution) {
        const { error: updateError } = await supabase
          .from("stock_order_shipments")
          .update({
            units_expected: item.quantity,
          })
          .eq("id", item.shipmentId);

        if (updateError) throw updateError;
      }

      return { stockOrderId, distribution };
    },
    onSuccess: (data) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["shipment-item-counts"] });
      queryClient.invalidateQueries({ queryKey: ["stock-order-shipments"] });
      
      const totalDistributed = data.distribution.reduce((sum, d) => sum + d.quantity, 0);
      toast({
        title: "Distribution saved",
        description: `Successfully distributed ${totalDistributed} items across ${data.distribution.filter(d => d.quantity > 0).length} packages`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save distribution",
      });
    },
  });
};

// Hook to update a single shipment's item count
export const useUpdateShipmentItemCount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      shipmentId, 
      productId, 
      quantity 
    }: { 
      shipmentId: string; 
      productId: string; 
      quantity: number;
    }) => {
      // Update stock_order_shipments.units_expected directly
      const { error } = await supabase
        .from("stock_order_shipments")
        .update({ units_expected: quantity })
        .eq("id", shipmentId);

      if (error) throw error;

      return { shipmentId, quantity };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["shipment-item-counts"] });
      queryClient.invalidateQueries({ queryKey: ["stock-order-shipments"] });
      toast({
        title: "Updated",
        description: `Shipment item count updated to ${data.quantity}`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update item count",
      });
    },
  });
};

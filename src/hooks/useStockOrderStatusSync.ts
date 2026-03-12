import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface StatusInconsistency {
  hasInconsistency: boolean;
  parentStatus: string;
  inconsistentShipments: any[];
}

export const useStockOrderStatusSync = () => {
  const queryClient = useQueryClient();

  const detectStatusInconsistencies = async (stockOrderId: string): Promise<StatusInconsistency> => {
    console.log("useStockOrderStatusSync - Detecting inconsistencies for:", stockOrderId);

    // Get parent stock order status
    const { data: stockOrder, error: stockOrderError } = await supabase
      .from("stock_orders")
      .select("delivery_status")
      .eq("id", stockOrderId)
      .single();

    if (stockOrderError) {
      console.error("Error fetching stock order:", stockOrderError);
      throw stockOrderError;
    }

    // Get all shipments for this stock order
    const { data: shipments, error: shipmentsError } = await supabase
      .from("stock_order_shipments")
      .select("id, delivery_status, shipment_number")
      .eq("stock_order_id", stockOrderId);

    if (shipmentsError) {
      console.error("Error fetching shipments:", shipmentsError);
      throw shipmentsError;
    }

    const parentStatus = stockOrder.delivery_status;
    const inconsistentShipments = shipments?.filter(
      shipment => shipment.delivery_status !== parentStatus
    ) || [];

    return {
      hasInconsistency: inconsistentShipments.length > 0,
      parentStatus,
      inconsistentShipments
    };
  };

  const fixStatusInconsistencies = useMutation({
    mutationFn: async (stockOrderId: string) => {
      console.log("useStockOrderStatusSync - Fixing inconsistencies for:", stockOrderId);

      // First detect the inconsistencies
      const { parentStatus, hasInconsistency } = await detectStatusInconsistencies(stockOrderId);

      if (!hasInconsistency) {
        return { message: "No inconsistencies found", updated: 0 };
      }

      // Update all child shipments to match parent status
      const { data, error } = await supabase
        .from("stock_order_shipments")
        .update({ delivery_status: parentStatus })
        .eq("stock_order_id", stockOrderId);

      if (error) {
        console.error("Error updating shipment statuses:", error);
        throw error;
      }

      return { message: "Status inconsistencies fixed", updated: 0, parentStatus };
    },
    onSuccess: (result, stockOrderId) => {
      console.log("useStockOrderStatusSync - Success:", result);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["stock-orders", stockOrderId] });
      queryClient.invalidateQueries({ queryKey: ["stock-order-shipments", stockOrderId] });

      toast({
        title: "Status Sync Complete",
        description: `Updated shipment statuses to match parent status: ${result.parentStatus}`,
      });
    },
    onError: (error) => {
      console.error("useStockOrderStatusSync - Error:", error);
      toast({
        title: "Sync Failed",
        description: "Failed to synchronize shipment statuses. Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    detectStatusInconsistencies,
    fixStatusInconsistencies,
    isFixing: fixStatusInconsistencies.isPending,
  };
};
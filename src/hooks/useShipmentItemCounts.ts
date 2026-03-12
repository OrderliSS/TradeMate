import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ShipmentItemCount {
  shipmentId: string;
  expectedCount: number;
  confirmedCount: number;
}

export const useShipmentItemCounts = (shipmentIds: string[]) => {
  return useQuery({
    queryKey: ["shipment-item-counts", shipmentIds],
    queryFn: async () => {
      if (!shipmentIds.length) return {};

      // Query from stock_order_shipments where the actual distribution data is stored
      const { data, error } = await supabase
        .from("stock_order_shipments")
        .select("id, units_expected, units_received")
        .in("id", shipmentIds);

      if (error) throw error;

      // Map shipment data to counts
      const counts: Record<string, { expected: number; confirmed: number }> = {};
      
      data?.forEach((item) => {
        counts[item.id] = {
          expected: item.units_expected || 0,
          confirmed: item.units_received || 0,
        };
      });

      return counts;
    },
    enabled: shipmentIds.length > 0,
    staleTime: 30000, // Cache for 30 seconds
  });
};

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShipmentRecord } from "./useShipmentRecords";

export const useShipmentRecordsByStockOrder = (stockOrderId?: string) => {
  return useQuery({
    queryKey: ["shipment-records", "by-stock-order", stockOrderId],
    queryFn: async (): Promise<ShipmentRecord[]> => {
      if (!stockOrderId) return [];
      
      const { data, error } = await supabase
        .from("shipment_records")
        .select(`
          *,
          source_stock_order:stock_orders (
            id,
            name,
            stock_record_number
          )
        `)
        .eq("source_stock_order_id", stockOrderId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!stockOrderId,
  });
};
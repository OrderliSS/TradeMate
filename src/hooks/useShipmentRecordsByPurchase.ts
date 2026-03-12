import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ShipmentRecord } from "./useShipmentRecords";

export const useShipmentRecordsByPurchase = (purchaseId?: string) => {
  return useQuery({
    queryKey: ["shipment-records", "by-purchase", purchaseId],
    queryFn: async (): Promise<ShipmentRecord[]> => {
      if (!purchaseId) return [];
      
      // Get shipment records linked to this purchase via stock allocations
      const { data, error } = await supabase
        .from("shipment_records")
        .select(`
          *,
          source_stock_order:stock_orders (
            id,
            name,
            stock_record_number,
            stock_allocations!inner (
              purchase_id
            )
          )
        `)
        .eq("source_stock_order.stock_allocations.purchase_id", purchaseId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Filter out incomplete records (records without source_stock_order_shipment_id or tracking info)
      const filteredData = (data || []).filter(record => 
        record.source_stock_order_shipment_id && 
        (record.tracking_number || record.vendor_tracking_number || record.carrier || record.vendor_carrier)
      );
      
      return filteredData;
    },
    enabled: !!purchaseId,
  });
};
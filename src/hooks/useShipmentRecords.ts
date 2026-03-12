import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useStockOrderAssetGeneration } from "@/hooks/useStockOrderAssetGeneration";
import { useDataEnvironment } from "@/hooks/useSandbox";

export interface ShipmentRecordInsert {
  source_stock_order_id?: string;
  source_stock_order_shipment_id?: string;
  tracking_number?: string;
  vendor_tracking_number?: string;
  carrier?: string;
  vendor_carrier?: string;
  delivery_status: string;
  estimated_delivery_date?: string;
  actual_delivery_date?: string;
  notes?: string;
}

export interface StockOrderShipment {
  id: string;
  stock_order_id: string;
  shipment_number: number;
  delivery_status: string;
  tracking_number?: string;
  vendor_tracking_number?: string;
  carrier?: string;
  vendor_carrier?: string;
  estimated_delivery_date?: string;
  actual_delivery_date?: string;
  passed_to_local_date?: string;
  local_handover_status?: string;
  notes?: string;
  proof_of_delivery_url?: string;
  created_at: string;
  updated_at: string;
}

export interface ShipmentRecord extends ShipmentRecordInsert {
  id: string;
  shipment_record_number: string;
  assignment_date: string;
  assigned_by?: string;
  proof_of_delivery_url?: string;
  created_at: string;
  updated_at: string;
  // Join fields
  source_stock_order?: {
    id: string;
    name: string;
    stock_record_number?: string;
  };
  stock_order_shipments?: StockOrderShipment[];
}

export const useShipmentRecords = () => {
  const dataEnvironment = useDataEnvironment();
  
  return useQuery({
    queryKey: ["shipment-records", dataEnvironment],
    queryFn: async (): Promise<ShipmentRecord[]> => {
      // First get shipment records with stock order data
      const { data: shipmentRecords, error: shipmentError } = await supabase
        .from("shipment_records")
        .select(`
          *,
          source_stock_order:stock_orders (
            id,
            name,
            stock_record_number
          )
        `)
        .eq("data_environment", dataEnvironment)
        .order("created_at", { ascending: false });

      if (shipmentError) throw shipmentError;

      // Then get related stock order shipments separately
      const stockOrderIds = shipmentRecords
        ?.map(record => record.source_stock_order_id)
        .filter(Boolean) || [];

      let stockOrderShipments: any[] = [];
      if (stockOrderIds.length > 0) {
        const { data: shipmentData, error: shipmentDataError } = await supabase
          .from("stock_order_shipments")
          .select("*")
          .in("stock_order_id", stockOrderIds);
        
        if (shipmentDataError) throw shipmentDataError;
        stockOrderShipments = shipmentData || [];
      }

      // Manually join the data
      const enrichedRecords = shipmentRecords?.map(record => ({
        ...record,
        stock_order_shipments: stockOrderShipments.filter(
          shipment => shipment.stock_order_id === record.source_stock_order_id
        )
      })) || [];

      return enrichedRecords;
    },
  });
};

export const useCreateShipmentRecord = () => {
  const queryClient = useQueryClient();
  const dataEnvironment = useDataEnvironment();

  return useMutation({
    mutationFn: async (data: ShipmentRecordInsert) => {
      const { data: record, error } = await supabase
        .from("shipment_records")
        .insert({ ...data, data_environment: dataEnvironment } as any)
        .select()
        .single();

      if (error) throw error;
      
      // Phase 2: Auto-generate assets on shipment creation
      let assetsGenerated = false;
      let assetCount = 0;
      
      if (record.source_stock_order_id) {
        try {
          // Get stock order details to check if product exists
          const { data: stockOrder } = await supabase
            .from("stock_orders")
            .select("product_id, quantity_needed")
            .eq("id", record.source_stock_order_id)
            .single();
          
          if (stockOrder?.product_id && stockOrder?.quantity_needed) {
            // ROBUST CHECK: Look for existing assets linked to this stock order via multiple fields
            // Check 1: Assets with stock order ID in notes
            const { data: assetsInNotes } = await supabase
              .from("asset_management")
              .select("id")
              .eq("product_id", stockOrder.product_id)
              .ilike("notes", `%${record.source_stock_order_id}%`);
            
            // Check 2: Assets linked via purchase_order_id field (stock order link)
            const { data: assetsViaPurchaseOrder } = await supabase
              .from("asset_management")
              .select("id")
              .eq("product_id", stockOrder.product_id)
              .eq("purchase_order_id", record.source_stock_order_id);
            
            // Check 3: Assets linked to this shipment record
            const { data: assetsViaShipment } = await supabase
              .from("asset_management")
              .select("id")
              .eq("shipment_record_id", record.id);
            
            const totalExistingAssets = new Set([
              ...(assetsInNotes || []).map(a => a.id),
              ...(assetsViaPurchaseOrder || []).map(a => a.id),
              ...(assetsViaShipment || []).map(a => a.id)
            ]).size;
            
            // Only auto-generate if no assets exist yet for this order
            if (totalExistingAssets === 0) {
              const { data: generationResult, error: genError } = await supabase.rpc(
                'generate_assets_from_stock_order',
                {
                  p_stock_order_id: record.source_stock_order_id,
                  p_product_id: stockOrder.product_id,
                  p_quantity: stockOrder.quantity_needed,
                  p_status: 'in_transit',
                  p_shipment_id: record.id
                }
              );
              
              if (!genError && generationResult && generationResult[0]) {
                assetsGenerated = true;
                assetCount = generationResult[0].created_count || 0;
              }
            } else {
              console.log(`Skipping asset generation: ${totalExistingAssets} assets already exist for stock order ${record.source_stock_order_id}`);
            }
          }
        } catch (error) {
          console.error("Auto-generation of assets failed:", error);
          // Don't throw - shipment was created successfully, asset generation is bonus
        }
      }
      
      return { record, assetsGenerated, assetCount };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["shipment-records"] });
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["all-assets"] });
      
      const baseMessage = "Shipment record created successfully";
      const assetMessage = result.assetsGenerated 
        ? ` and ${result.assetCount} assets auto-generated in "in transit" status`
        : "";
      
      toast({
        title: "Success",
        description: baseMessage + assetMessage,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create shipment record",
      });
    },
  });
};

export const useUpdateShipmentRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ShipmentRecord> & { id: string }) => {
      const { data: record, error } = await supabase
        .from("shipment_records")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return record;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipment-records"] });
      toast({
        title: "Success",
        description: "Shipment record updated successfully",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update shipment record",
      });
    },
  });
};

export const useDeleteShipmentRecord = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("shipment_records")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipment-records"] });
      toast({
        title: "Success",
        description: "Shipment record deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete shipment record",
      });
    },
  });
};
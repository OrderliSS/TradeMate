import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ShipmentAsset {
  id: string;
  stock_order_shipment_id: string;
  asset_id: string;
  expected_quantity: number;
  confirmed_quantity: number;
  status: string;
  notes?: string;
  added_at: string;
  confirmed_at?: string;
  confirmed_by?: string;
  created_at: string;
  updated_at: string;
  asset?: {
    id: string;
    asset_tag?: string;
    status: string;
    product_id?: string;
  };
}

export interface ShipmentAssetInsert {
  stock_order_shipment_id: string;
  asset_id: string;
  expected_quantity?: number;
  confirmed_quantity?: number;
  status?: string;
  notes?: string;
}

// Fetch shipment assets for a specific stock order shipment
export const useShipmentAssets = (stockOrderShipmentId?: string) => {
  return useQuery({
    queryKey: ["shipment-assets", stockOrderShipmentId],
    queryFn: async (): Promise<ShipmentAsset[]> => {
      if (!stockOrderShipmentId) return [];
      
      const { data, error } = await supabase
        .from("shipment_assets")
        .select(`
          *,
          asset:asset_management (
            id,
            asset_tag,
            status,
            product_id
          )
        `)
        .eq("stock_order_shipment_id", stockOrderShipmentId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!stockOrderShipmentId,
  });
};

// Fetch assets linked to shipments by stock order ID
export const useAssetsByStockOrderShipments = (stockOrderId?: string) => {
  return useQuery({
    queryKey: ["assets-by-stock-order-shipments", stockOrderId],
    queryFn: async () => {
      if (!stockOrderId) return [];
      
      const { data, error } = await supabase
        .from("asset_management")
        .select(`
          *,
          stock_order_shipment:stock_order_shipments!stock_order_shipment_id (
            id,
            shipment_number,
            delivery_status,
            tracking_number,
            vendor_tracking_number
          )
        `)
        .eq("stock_order_shipment_id", stockOrderId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!stockOrderId,
  });
};

// Create shipment asset relationship
export const useCreateShipmentAsset = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ShipmentAssetInsert) => {
      const { data: record, error } = await supabase
        .from("shipment_assets")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return record;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["shipment-assets", data.stock_order_shipment_id] });
      queryClient.invalidateQueries({ queryKey: ["assets-by-stock-order-shipments"] });
      toast({
        title: "Success",
        description: "Asset linked to shipment successfully",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to link asset to shipment",
      });
    },
  });
};

// Update shipment asset
export const useUpdateShipmentAsset = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ShipmentAsset> & { id: string }) => {
      const { data: record, error } = await supabase
        .from("shipment_assets")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return record;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["shipment-assets", data.stock_order_shipment_id] });
      queryClient.invalidateQueries({ queryKey: ["assets-by-stock-order-shipments"] });
      toast({
        title: "Success",
        description: "Shipment asset updated successfully",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update shipment asset",
      });
    },
  });
};

// Delete shipment asset relationship
export const useDeleteShipmentAsset = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("shipment_assets")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipment-assets"] });
      queryClient.invalidateQueries({ queryKey: ["assets-by-stock-order-shipments"] });
      toast({
        title: "Success",
        description: "Asset unlinked from shipment",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to unlink asset from shipment",
      });
    },
  });
};

// Pre-allocate assets for shipment (when creating assets in transit)
export const usePreAllocateAssetsToShipment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      stockOrderShipmentId, 
      assetIds, 
      productId 
    }: { 
      stockOrderShipmentId: string; 
      assetIds: string[]; 
      productId: string;
    }) => {
      // Update assets to link them to the shipment
      const { error: assetError } = await supabase
        .from("asset_management")
        .update({
          stock_order_shipment_id: stockOrderShipmentId,
          pre_allocated_in_transit: true,
          status: 'in_transit'
        })
        .in("id", assetIds);

      if (assetError) throw assetError;

      // Create shipment asset records
      const shipmentAssets = assetIds.map(assetId => ({
        stock_order_shipment_id: stockOrderShipmentId,
        asset_id: assetId,
        status: 'in_transit',
        expected_quantity: 1
      }));

      const { error: shipmentError } = await supabase
        .from("shipment_assets")
        .insert(shipmentAssets);

      if (shipmentError) throw shipmentError;

      return { assetIds, stockOrderShipmentId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["shipment-assets", data.stockOrderShipmentId] });
      queryClient.invalidateQueries({ queryKey: ["assets-by-stock-order-shipments"] });
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      toast({
        title: "Success",
        description: `Pre-allocated ${data.assetIds.length} assets to shipment`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to pre-allocate assets to shipment",
      });
    },
  });
};

// Confirm shipment arrival and finalize asset statuses
export const useConfirmShipmentArrival = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      stockOrderShipmentId, 
      confirmedAssets 
    }: { 
      stockOrderShipmentId: string; 
      confirmedAssets: { assetId: string; confirmed: boolean; notes?: string }[];
    }) => {
      // Update shipment assets based on confirmations
      for (const { assetId, confirmed, notes } of confirmedAssets) {
        // Update shipment asset record
        await supabase
          .from("shipment_assets")
          .update({
            status: confirmed ? 'confirmed' : 'missing',
            confirmed_quantity: confirmed ? 1 : 0,
            confirmed_at: new Date().toISOString(),
            confirmed_by: (await supabase.auth.getUser()).data.user?.id,
            notes
          })
          .eq("stock_order_shipment_id", stockOrderShipmentId)
          .eq("asset_id", assetId);

        // Update asset status
        await supabase
          .from("asset_management")
          .update({
            status: confirmed ? 'available' : 'missing',
            shipment_arrival_confirmed: true,
            pre_allocated_in_transit: false
          })
          .eq("id", assetId);
      }

      return { stockOrderShipmentId, confirmedCount: confirmedAssets.filter(a => a.confirmed).length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["shipment-assets", data.stockOrderShipmentId] });
      queryClient.invalidateQueries({ queryKey: ["assets-by-stock-order-shipments"] });
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      toast({
        title: "Success",
        description: `Confirmed arrival of ${data.confirmedCount} assets`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to confirm shipment arrival",
      });
    },
  });
};
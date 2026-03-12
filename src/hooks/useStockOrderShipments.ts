import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useCurrentOrganizationId } from "@/hooks/useOrganization";

export interface StockOrderShipment {
  id: string;
  stock_order_id: string;
  shipment_number: number;
  delivery_status?: string;
  tracking_number?: string;
  carrier?: string;
  estimated_delivery_date?: string;
  actual_delivery_date?: string;
  vendor_tracking_number?: string;
  vendor_carrier?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  organization_id?: string;
}

// Fetching shipments for a stock order
export const useStockOrderShipments = (stockOrderId?: string) => {
  return useQuery({
    queryKey: ["stock-order-shipments", stockOrderId],
    queryFn: async (): Promise<StockOrderShipment[]> => {
      if (!stockOrderId) return [];
      
      console.log("useStockOrderShipments - Starting query for stock order:", stockOrderId);
      
      const { data, error } = await supabase
        .from("stock_order_shipments")
        .select("*")
        .eq("stock_order_id", stockOrderId)
        .order("shipment_number", { ascending: true });

      if (error) {
        console.error("useStockOrderShipments - Error:", error);
        throw error;
      }

      console.log("useStockOrderShipments - Success, count:", data?.length);
      return data || [];
    },
    enabled: !!stockOrderId,
    staleTime: 30 * 1000, // 30 seconds - data doesn't change that often
    gcTime: 5 * 60 * 1000, // 5 minutes in cache
    refetchOnWindowFocus: false, // Prevent unnecessary refetches
  });
};

// Create a new shipment
export const useCreateStockOrderShipment = () => {
  const queryClient = useQueryClient();
  const orgId = useCurrentOrganizationId();

  return useMutation({
    mutationFn: async (shipmentData: Omit<StockOrderShipment, 'id' | 'created_at' | 'updated_at'>) => {
      console.log("useCreateStockOrderShipment - Starting mutation with data:", shipmentData);
      
      // Include organization_id for RLS policy compliance
      const dataWithOrg = {
        ...shipmentData,
        organization_id: orgId,
      };
      
      const { data, error } = await supabase
        .from("stock_order_shipments")
        .insert(dataWithOrg)
        .select()
        .single();

      if (error) {
        console.error("useCreateStockOrderShipment - Error:", error);
        throw error;
      }

      console.log("useCreateStockOrderShipment - Success:", data);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["stock-order-shipments", data.stock_order_id] });
      toast({
        title: "Shipment Created",
        description: "Stock order shipment created successfully",
      });
    },
    onError: (error: any) => {
      console.error("useCreateStockOrderShipment - Error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to create stock order shipment",
        variant: "destructive",
      });
    },
  });
};

// Update a shipment
export const useUpdateStockOrderShipment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<StockOrderShipment>) => {
      console.log("useUpdateStockOrderShipment - Starting mutation", { id, updates });
      
      const { data, error } = await supabase
        .from("stock_order_shipments")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("useUpdateStockOrderShipment - Error:", error);
        throw error;
      }

      console.log("useUpdateStockOrderShipment - Success:", data);
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["stock-order-shipments", data.stock_order_id] });

      // Auto-consolidate package record if all shipments are now delivered
      if (data.delivery_status === 'delivered') {
        const { data: allShipments } = await supabase
          .from("stock_order_shipments")
          .select("delivery_status")
          .eq("stock_order_id", data.stock_order_id);

        const allDelivered = allShipments?.every(s => s.delivery_status === 'delivered');

        if (allDelivered) {
          const { error: pkgError } = await supabase
            .from("shipment_records")
            .update({ consolidated_status: 'delivered' })
            .eq("source_stock_order_id", data.stock_order_id)
            .eq("is_package_parent", true);

          if (pkgError) {
            console.error("Failed to consolidate package record:", pkgError);
          }

          queryClient.invalidateQueries({ queryKey: ["package-records"] });
          queryClient.invalidateQueries({ queryKey: ["package-records", data.stock_order_id] });
        }
      }
    },
    onError: (error) => {
      console.error("useUpdateStockOrderShipment - Error:", error);
      toast({
        title: "Error",
        description: "Failed to update stock order shipment",
        variant: "destructive",
      });
    },
  });
};

// Delete a shipment
export const useDeleteStockOrderShipment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, stockOrderId }: { id: string; stockOrderId: string }) => {
      console.log("useDeleteStockOrderShipment - Starting deletion for ID:", id);
      
      const { error } = await supabase
        .from("stock_order_shipments")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("useDeleteStockOrderShipment - Error:", error);
        throw error;
      }

      console.log("useDeleteStockOrderShipment - Success");
      return { id, stockOrderId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["stock-order-shipments", result.stockOrderId] });
      toast({
        title: "Shipment Deleted",
        description: "Stock order shipment deleted successfully",
      });
    },
    onError: (error) => {
      console.error("useDeleteStockOrderShipment - Error:", error);
      toast({
        title: "Error",
        description: "Failed to delete stock order shipment",
        variant: "destructive",
      });
    },
  });
};

// Get next shipment number  
export const useGetNextShipmentNumber = (stockOrderId?: string) => {
  const { data: shipments = [] } = useStockOrderShipments(stockOrderId);
  
  return shipments.length > 0 
    ? Math.max(...shipments.map(s => s.shipment_number)) + 1 
    : 1;
};

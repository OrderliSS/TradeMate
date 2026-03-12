import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StockOrderShipment {
  id: string;
  stock_order_id: string;
  shipment_number: number;
  delivery_status?: string;
  estimated_delivery_date?: string;
  actual_delivery_date?: string;
  vendor_tracking_number?: string;
  vendor_carrier?: string;
  tracking_number?: string;
  carrier?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export const useShipmentOperations = (stockOrderId: string) => {
  const queryClient = useQueryClient();

  const updateFieldOptimistic = useMutation({
    mutationFn: async ({ 
      shipmentId, 
      field, 
      value 
    }: { 
      shipmentId: string; 
      field: string; 
      value: any;
    }) => {
      const updateData = { [field]: field.includes('date') ? (value || null) : value };
      
      const { data, error } = await supabase
        .from("stock_order_shipments")
        .update(updateData)
        .eq("id", shipmentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async ({ shipmentId, field, value }) => {
      // Cancel outgoing queries to avoid race conditions
      await queryClient.cancelQueries({ 
        queryKey: ["stock-order-shipments", stockOrderId] 
      });

      // Snapshot previous value
      const previousShipments = queryClient.getQueryData<StockOrderShipment[]>([
        "stock-order-shipments",
        stockOrderId
      ]);

      // Optimistically update the cache
      if (previousShipments) {
        queryClient.setQueryData<StockOrderShipment[]>(
          ["stock-order-shipments", stockOrderId],
          previousShipments.map(s => 
            s.id === shipmentId 
              ? { ...s, [field]: value } 
              : s
          )
        );
      }

      // Return context with previous data for rollback
      return { previousShipments };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousShipments) {
        queryClient.setQueryData(
          ["stock-order-shipments", stockOrderId],
          context.previousShipments
        );
      }
      console.error("Update error:", error);
      toast.error("Failed to update shipment");
    },
    onSuccess: async (data, variables) => {
      // Invalidate to ensure we have the latest server data
      queryClient.invalidateQueries({ 
        queryKey: ["stock-order-shipments", stockOrderId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["stock-order-details", stockOrderId] 
      });
      // Also invalidate package-records so the tracking table updates
      queryClient.invalidateQueries({ 
        queryKey: ["package-records"] 
      });
      
      // If updating delivery_status, check if we should sync parent stock order
      if (variables.field === 'delivery_status') {
        try {
          const { data: allShipments } = await supabase
            .from("stock_order_shipments")
            .select("id, delivery_status")
            .eq("stock_order_id", stockOrderId);
          
          if (allShipments?.length === 1) {
            // Single shipment - sync parent stock order to match
            const { error } = await supabase
              .from("stock_orders")
              .update({ delivery_status: variables.value })
              .eq("id", stockOrderId);
            
            if (!error) {
              queryClient.invalidateQueries({ queryKey: ["stock-orders", stockOrderId] });
              queryClient.invalidateQueries({ queryKey: ["stock-orders"] });
              console.log("Parent stock order synced to:", variables.value);
            }
          }

          // Auto-consolidate package record if all shipments are now delivered
          const allDelivered = allShipments?.every(s => s.delivery_status === 'delivered');
          if (allDelivered) {
            const { error: pkgError } = await supabase
              .from("shipment_records")
              .update({ consolidated_status: 'delivered' })
              .eq("source_stock_order_id", stockOrderId)
              .eq("is_package_parent", true);

            if (pkgError) {
              console.error("Failed to consolidate package record:", pkgError);
            }

            queryClient.invalidateQueries({ queryKey: ["package-records"] });
            queryClient.invalidateQueries({ queryKey: ["package-records", stockOrderId] });
          }
        } catch (err) {
          console.error("Failed to sync parent status:", err);
        }
      }
    },
  });

  const deleteShipmentOptimistic = useMutation({
    mutationFn: async (shipmentId: string) => {
      const { error } = await supabase
        .from("stock_order_shipments")
        .delete()
        .eq("id", shipmentId);

      if (error) throw error;
      return shipmentId;
    },
    onMutate: async (shipmentId) => {
      await queryClient.cancelQueries({ 
        queryKey: ["stock-order-shipments", stockOrderId] 
      });

      const previousShipments = queryClient.getQueryData<StockOrderShipment[]>([
        "stock-order-shipments",
        stockOrderId
      ]);

      // Optimistically remove from cache
      if (previousShipments) {
        queryClient.setQueryData<StockOrderShipment[]>(
          ["stock-order-shipments", stockOrderId],
          previousShipments.filter(s => s.id !== shipmentId)
        );
      }

      return { previousShipments };
    },
    onError: (error, variables, context) => {
      if (context?.previousShipments) {
        queryClient.setQueryData(
          ["stock-order-shipments", stockOrderId],
          context.previousShipments
        );
      }
      console.error("Delete error:", error);
      toast.error("Failed to delete shipment");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ["stock-order-shipments", stockOrderId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["stock-order-details", stockOrderId] 
      });
      toast.success("Shipment deleted");
    },
  });

  return {
    updateField: updateFieldOptimistic.mutateAsync,
    deleteShipment: deleteShipmentOptimistic.mutateAsync,
    isUpdating: updateFieldOptimistic.isPending,
    isDeleting: deleteShipmentOptimistic.isPending,
  };
};

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StockOrderShipment {
  id: string;
  stock_order_id: string;
  shipment_number: number;
  delivery_status?: string;
  [key: string]: any;
}

export const useShipmentBulkOperations = (stockOrderId: string) => {
  const queryClient = useQueryClient();

  const bulkUpdateStatus = useMutation({
    mutationFn: async ({ 
      shipmentIds, 
      status 
    }: { 
      shipmentIds: string[]; 
      status: string;
    }) => {
      const { data, error } = await supabase
        .from("stock_order_shipments")
        .update({ delivery_status: status })
        .in("id", shipmentIds)
        .eq("stock_order_id", stockOrderId)
        .select();

      if (error) throw error;
      return data;
    },
    onMutate: async ({ shipmentIds, status }) => {
      await queryClient.cancelQueries({ 
        queryKey: ["stock-order-shipments", stockOrderId] 
      });

      const previousShipments = queryClient.getQueryData<StockOrderShipment[]>([
        "stock-order-shipments",
        stockOrderId
      ]);

      // Optimistically update selected shipments
      if (previousShipments) {
        queryClient.setQueryData<StockOrderShipment[]>(
          ["stock-order-shipments", stockOrderId],
          previousShipments.map(s => 
            shipmentIds.includes(s.id)
              ? { ...s, delivery_status: status }
              : s
          )
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
      console.error("Bulk update error:", error);
      toast.error("Failed to update shipments");
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: ["stock-order-shipments", stockOrderId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["stock-order-details", stockOrderId] 
      });
      toast.success(`Updated ${data?.length || 0} shipment(s)`);
    },
  });

  const bulkDelete = useMutation({
    mutationFn: async (shipmentIds: string[]) => {
      const { error } = await supabase
        .from("stock_order_shipments")
        .delete()
        .in("id", shipmentIds)
        .eq("stock_order_id", stockOrderId);

      if (error) throw error;
      return shipmentIds;
    },
    onMutate: async (shipmentIds) => {
      await queryClient.cancelQueries({ 
        queryKey: ["stock-order-shipments", stockOrderId] 
      });

      const previousShipments = queryClient.getQueryData<StockOrderShipment[]>([
        "stock-order-shipments",
        stockOrderId
      ]);

      // Optimistically remove deleted shipments
      if (previousShipments) {
        queryClient.setQueryData<StockOrderShipment[]>(
          ["stock-order-shipments", stockOrderId],
          previousShipments.filter(s => !shipmentIds.includes(s.id))
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
      console.error("Bulk delete error:", error);
      toast.error("Failed to delete shipments");
    },
    onSuccess: (shipmentIds) => {
      queryClient.invalidateQueries({ 
        queryKey: ["stock-order-shipments", stockOrderId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ["stock-order-details", stockOrderId] 
      });
      toast.success(`Deleted ${shipmentIds.length} shipment(s)`);
    },
  });

  return {
    bulkUpdateStatus,
    bulkDelete,
  };
};

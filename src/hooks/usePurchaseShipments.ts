import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface PurchaseShipment {
  id: string;
  purchase_id: string;
  shipment_number: number;
  tracking_number?: string;
  vendor_tracking_number?: string;
  carrier?: string;
  vendor_carrier?: string;
  delivery_status?: string;
  estimated_delivery_date?: string;
  actual_delivery_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  stock_order_name?: string; // Added to show which stock order this shipment belongs to
  stock_order_id?: string;
}

export const usePurchaseShipments = (purchaseId: string) => {
  return useQuery({
    queryKey: ["purchase-shipments", purchaseId],
    queryFn: async (): Promise<PurchaseShipment[]> => {
      if (!purchaseId) return [];

      // First, get all allocations for this purchase
      const { data: allocations, error: allocationsError } = await supabase
        .from("allocations")
        .select(`
          stock_order_id,
          stock_order:stock_orders (
            id,
            name
          )
        `)
        .eq("purchase_order_id", purchaseId);

      if (allocationsError) throw allocationsError;
      if (!allocations || allocations.length === 0) return [];

      // Get all stock order IDs (filter out nulls)
      const stockOrderIds = allocations
        .map(a => a.stock_order_id)
        .filter((id): id is string => id !== null);
      
      if (stockOrderIds.length === 0) return [];

      // Get all stock order shipments for these stock orders
      const { data: stockOrderShipments, error: shipmentsError } = await supabase
        .from("stock_order_shipments")
        .select("*")
        .in("stock_order_id", stockOrderIds)
        .order("shipment_number");

      if (shipmentsError) throw shipmentsError;
      if (!stockOrderShipments) return [];

      // Transform stock order shipments to purchase shipments format
      const purchaseShipments: PurchaseShipment[] = stockOrderShipments.map(shipment => {
        const allocation = allocations.find(a => a.stock_order_id === shipment.stock_order_id);
        const stockOrder = allocation?.stock_order as any;

        return {
          id: shipment.id,
          purchase_id: purchaseId,
          shipment_number: shipment.shipment_number,
          tracking_number: shipment.tracking_number,
          vendor_tracking_number: shipment.vendor_tracking_number,
          carrier: shipment.carrier,
          vendor_carrier: shipment.vendor_carrier,
          delivery_status: shipment.delivery_status,
          estimated_delivery_date: shipment.estimated_delivery_date,
          actual_delivery_date: shipment.actual_delivery_date,
          notes: shipment.notes,
          created_at: shipment.created_at,
          updated_at: shipment.updated_at,
          stock_order_name: stockOrder?.name,
          stock_order_id: shipment.stock_order_id,
        };
      });

      return purchaseShipments;
    },
    enabled: !!purchaseId,
  });
};

export const useCreatePurchaseShipment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shipment: Omit<PurchaseShipment, "id" | "created_at" | "updated_at">) => {
      // Placeholder implementation
      throw new Error("Purchase shipment creation not yet implemented");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["purchase-shipments", variables.purchase_id] });
      toast({
        title: "Success",
        description: "Shipment created successfully",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create shipment",
      });
    },
  });
};
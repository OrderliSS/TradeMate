import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { syncShipmentsFromStockOrderStatus } from "./useSyncStockOrderShipmentStatuses";
import { mapDeliveryToInternalStatus, isDeliveredStatus } from "@/lib/vendor-status-mapping";

export const useUpdateStockOrderDeliveryStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      field, 
      status 
    }: { 
      id: string; 
      field: 'delivery_status' | 'delivery_status_2'; 
      status: string;
    }) => {
      console.log("useUpdateStockOrderDeliveryStatus - Starting mutation", { id, field, status });

      // First, try the RPC call
      const { data, error } = await supabase.rpc('update_stock_order_delivery_status', {
        p_id: id,
        p_field: field,
        p_status: status
      });

      // If RPC fails with schema cache error, fallback to direct UPDATE
      if (error && error.message.includes('schema cache')) {
        console.warn("useUpdateStockOrderDeliveryStatus - RPC function not in cache, using direct update fallback");
        
      const updateData: Record<string, any> = {
        [field]: status,
        updated_at: new Date().toISOString()
      };
      // Auto-sync vendor_internal_status from delivery status mapping
      if (field === 'delivery_status') {
        const mappedInternal = mapDeliveryToInternalStatus(status);
        if (mappedInternal) {
          updateData.vendor_internal_status = mappedInternal;
        }
      }
      // Auto-set actual_delivery_date when marking as delivered
      const dateField = field === 'delivery_status' ? 'actual_delivery_date' : 'actual_delivery_date_2';
      if (isDeliveredStatus(status)) {
        updateData[dateField] = new Date().toISOString();
      }
        
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("stock_orders")
          .update(updateData)
          .eq("id", id)
          .select()
          .single();
        
        if (fallbackError) {
          console.error("useUpdateStockOrderDeliveryStatus - Fallback update also failed:", fallbackError);
          throw fallbackError;
        }
        
        console.log("useUpdateStockOrderDeliveryStatus - Fallback update successful:", fallbackData);
        return { success: true, fallback: true };
      }

      if (error) {
        console.error("useUpdateStockOrderDeliveryStatus - RPC call failed:", error);
        throw error;
      }

      console.log("useUpdateStockOrderDeliveryStatus - RPC response:", data);

      // After RPC success, sync vendor_internal_status for all transitions
      const postRpcUpdates: Record<string, any> = {};
      if (field === 'delivery_status') {
        const mappedInternal = mapDeliveryToInternalStatus(status);
        if (mappedInternal) {
          postRpcUpdates.vendor_internal_status = mappedInternal;
        }
      }
      if (isDeliveredStatus(status)) {
        const dateField = field === 'delivery_status' ? 'actual_delivery_date' : 'actual_delivery_date_2';
        postRpcUpdates[dateField] = new Date().toISOString();
      }

      if (Object.keys(postRpcUpdates).length > 0) {
        const { error: syncError } = await supabase
          .from("stock_orders")
          .update(postRpcUpdates)
          .eq("id", id);

        if (syncError) {
          console.error("Failed to sync vendor status fields:", syncError);
        } else {
          console.log("Vendor status fields synced in mutationFn:", postRpcUpdates);
        }
      }

      // Auto-consolidate package records when delivered
      if (isDeliveredStatus(status)) {
        const { error: pkgError } = await supabase
          .from("shipment_records")
          .update({ consolidated_status: 'delivered' })
          .eq("source_stock_order_id", id);

        if (pkgError) {
          console.error("Failed to consolidate package records:", pkgError);
        } else {
          console.log("Package records consolidated to delivered in mutationFn");
        }
      }

      return data;
    },
    onMutate: async ({ id, field, status }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["stock-orders", id] });
      await queryClient.cancelQueries({ queryKey: ["stock-orders"] });

      // Snapshot the previous value
      const previousStockOrder = queryClient.getQueryData(["stock-orders", id]);
      const previousStockOrders = queryClient.getQueryData(["stock-orders"]);

      // Build optimistic fields
      const dateField = field === 'delivery_status' ? 'actual_delivery_date' : 'actual_delivery_date_2';
      const optimisticFields: Record<string, any> = {
        [field]: status,
        updated_at: new Date().toISOString()
      };
      if (field === 'delivery_status') {
        const mappedInternal = mapDeliveryToInternalStatus(status);
        if (mappedInternal) {
          optimisticFields.vendor_internal_status = mappedInternal;
        }
      }
      if (isDeliveredStatus(status)) {
        optimisticFields[dateField] = new Date().toISOString();
      }

      // Optimistically update the single stock order
      queryClient.setQueryData(["stock-orders", id], (old: any) => {
        if (!old) return old;
        return { ...old, ...optimisticFields };
      });

      // Optimistically update the stock orders list
      queryClient.setQueryData(["stock-orders"], (old: any[]) => {
        if (!old) return old;
        return old.map(stockOrder => 
          stockOrder.id === id ? { ...stockOrder, ...optimisticFields } : stockOrder
        );
      });

      // Return a context object with the snapshotted value
      return { previousStockOrder, previousStockOrders, id, field, status };
    },
    onError: (err, variables, context) => {
      console.error("useUpdateStockOrderDeliveryStatus - Mutation error:", err);
      
      // Revert optimistic updates on error
      if (context?.previousStockOrder) {
        queryClient.setQueryData(["stock-orders", context.id], context.previousStockOrder);
      }
      if (context?.previousStockOrders) {
        queryClient.setQueryData(["stock-orders"], context.previousStockOrders);
      }

      toast({
        title: "Error Updating Status",
        description: err.message || "Failed to update delivery status",
        variant: "destructive",
      });
    },
    onSuccess: async (data, variables) => {
      console.log("useUpdateStockOrderDeliveryStatus - Success:", data);
      
      // Check shipment count to determine sync behavior
      try {
        const { data: shipments } = await supabase
          .from("stock_order_shipments")
          .select("id")
          .eq("stock_order_id", variables.id);
        
        const shipmentCount = shipments?.length || 0;
        
        if (shipmentCount === 1) {
          // Single shipment - sync to match parent status
          await syncShipmentsFromStockOrderStatus(variables.id, variables.status, queryClient);
          console.log("Single shipment synchronized to:", variables.status);
        } else if (shipmentCount > 1) {
          // Multiple shipments - don't auto-sync, inform user
          console.log("Multiple shipments detected, skipping auto-sync");
          toast({
            title: "Status Updated",
            description: "Multiple shipments detected. Update each shipment's status individually in the Individual Shipments section.",
          });
        }
        // If shipmentCount === 0, no sync needed
      } catch (syncError) {
        console.error("Failed to check/sync shipments:", syncError);
        toast({
          title: "Warning",
          description: "Status updated but shipments may need manual sync",
          variant: "destructive",
        });
      }

      // Auto-update stock_on_hand for linked purchases when status changes to 'delivered'
      if (isDeliveredStatus(variables.status)) {
        try {
          const { data: linkedPurchases } = await supabase
            .from("purchases")
            .select("id, stock_on_hand, linked_stock_order_ids")
            .contains("linked_stock_order_ids", [variables.id]);

          if (linkedPurchases && linkedPurchases.length > 0) {
            const purchasesToUpdate = linkedPurchases.filter(p => !p.stock_on_hand);
            
            for (const purchase of purchasesToUpdate) {
              await supabase
                .from("purchases")
                .update({ stock_on_hand: true })
                .eq("id", purchase.id);
            }

            if (purchasesToUpdate.length > 0) {
              queryClient.invalidateQueries({ queryKey: ["purchases"] });
              console.log(`Auto-updated stock_on_hand for ${purchasesToUpdate.length} linked purchase(s)`);
            }
          }
        } catch (error) {
          console.error("Failed to auto-update linked purchases stock_on_hand:", error);
        }
      }
      
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: ["stock-orders", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["stock-orders"] });
      queryClient.invalidateQueries({ queryKey: ["stock-order-shipments", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["all-tracking-data"] });
      
      // Invalidate package records if delivered
      if (isDeliveredStatus(variables.status)) {
        queryClient.invalidateQueries({ queryKey: ["package-records"] });
        queryClient.invalidateQueries({ queryKey: ["package-records", variables.id] });
        queryClient.invalidateQueries({ queryKey: ["shipment-records"] });

        // Auto-sync asset statuses when delivered
        try {
          const { data: syncResult, error: syncError } = await supabase
            .rpc('manual_sync_asset_status', { p_expense_id: variables.id });

          if (syncError) {
            console.error("Asset sync RPC error:", syncError);
          } else {
            const result = syncResult?.[0];
            const assetsUpdated = result?.assets_updated || 0;
            const ordersAllocated = result?.orders_allocated || 0;
            console.log(`Asset sync complete: ${assetsUpdated} assets updated, ${ordersAllocated} orders allocated`);
            
            if (assetsUpdated > 0) {
              toast({
                title: "Assets Synced",
                description: `${assetsUpdated} asset(s) updated to available`,
              });
            }
          }

          // Invalidate asset-related queries
          queryClient.invalidateQueries({ queryKey: ["asset-management"] });
          queryClient.invalidateQueries({ queryKey: ["all-assets"] });
          queryClient.invalidateQueries({ queryKey: ["products"] });
          queryClient.invalidateQueries({ queryKey: ["allocations"] });
          queryClient.invalidateQueries({ queryKey: ["inventory-availability"] });
        } catch (assetSyncError) {
          console.error("Failed to auto-sync asset statuses:", assetSyncError);
        }
      }

      // Show success message
      const wasAllocationsSync = (data as any)?.allocations_synced > 0;
      const message = wasAllocationsSync 
        ? `Status updated to ${variables.status}. ${(data as any)?.allocations_synced} allocation(s) and all shipments synchronized`
        : `Status updated to ${variables.status}. All shipments synchronized`;

      toast({
        title: "Status Updated",
        description: message,
      });
    },
  });
};
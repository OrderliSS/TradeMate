import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const useLinkedStockOrders = () => {
  const queryClient = useQueryClient();

  // Get linked stock orders for a purchase
  const useLinkedStockOrdersForPurchase = (purchaseId: string) => {
    return useQuery({
      queryKey: ["linked-stock-orders", purchaseId],
      queryFn: async () => {
        const { data: purchase, error: purchaseError } = await supabase
          .from("purchases")
          .select("linked_stock_order_ids")
          .eq("id", purchaseId)
          .single();

        if (purchaseError) throw purchaseError;

        const linkedIds = Array.isArray(purchase.linked_stock_order_ids) 
          ? purchase.linked_stock_order_ids.filter((id): id is string => typeof id === 'string')
          : [];

        if (linkedIds.length === 0) return [];

        const { data: stockOrders, error: stockOrdersError } = await supabase
          .from("stock_orders")
          .select("*")
          .in("id", linkedIds);

        if (stockOrdersError) throw stockOrdersError;
        return stockOrders || [];
      },
      enabled: !!purchaseId,
    });
  };

  // Link stock orders to purchase
  const linkStockOrdersMutation = useMutation({
    mutationFn: async ({ purchaseId, stockOrderIds }: { purchaseId: string; stockOrderIds: string[] }) => {
      try {
        // Get current linked stock orders and purchase details
        const { data: purchase, error: fetchError } = await supabase
          .from("purchases")
          .select("linked_stock_order_ids, quantity, product_id")
          .eq("id", purchaseId)
          .single();

        if (fetchError) {
          console.error("Failed to fetch purchase:", fetchError);
          throw new Error(`Failed to fetch purchase: ${fetchError.message}`);
        }

        const currentLinked = Array.isArray(purchase.linked_stock_order_ids) 
          ? purchase.linked_stock_order_ids.filter((id): id is string => typeof id === 'string')
          : [];

        // Add new stock order IDs (avoid duplicates)
        const newStockOrderIds = stockOrderIds.filter(id => !currentLinked.includes(id));
        const updatedLinked = [...currentLinked, ...newStockOrderIds];

        // First, create allocations entries (fail fast if this doesn't work)
        const allocationPromises = newStockOrderIds.map(async (stockOrderId) => {
          // Check if allocation already exists
          const { data: existingAllocation } = await supabase
            .from("allocations")
            .select("id")
            .eq("purchase_order_id", purchaseId)
            .eq("stock_order_id", stockOrderId)
            .maybeSingle();

          if (existingAllocation) {
            console.log("Allocation already exists for", stockOrderId);
            return stockOrderId;
          }

          // Create new allocation
          const { error: allocationError } = await supabase
            .from("allocations")
            .insert({
              purchase_order_id: purchaseId,
              stock_order_id: stockOrderId,
              product_id: purchase.product_id,
              asset_id: null,
              status: 'allocated',
              allocated_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (allocationError) {
            console.error("Failed to create allocation for", stockOrderId, ":", allocationError);
            throw new Error(`Failed to link stock order ${stockOrderId}: ${allocationError.message}`);
          }
          return stockOrderId;
        });

        // Wait for all allocations to be created successfully
        await Promise.all(allocationPromises);

        // Only update purchases table if all allocations were created successfully
        const { error: updateError } = await supabase
          .from("purchases")
          .update({
            linked_stock_order_ids: updatedLinked,
          })
          .eq("id", purchaseId);

        if (updateError) {
          console.error("Failed to update purchase:", updateError);
          // Rollback: Remove the allocations we just created
          for (const stockOrderId of newStockOrderIds) {
            await supabase
              .from("allocations")
              .delete()
              .eq("purchase_order_id", purchaseId)
              .eq("stock_order_id", stockOrderId);
          }
          throw new Error(`Failed to update purchase: ${updateError.message}`);
        }

        return updatedLinked;
      } catch (error) {
        console.error("Link stock orders error:", error);
        throw error;
      }
    },
    onSuccess: async (_, { purchaseId, stockOrderIds }) => {
      // Check if any linked stock order is delivered - auto-set stock_on_hand
      try {
        const { data: linkedStockOrders } = await supabase
          .from("stock_orders")
          .select("id, delivery_status")
          .in("id", stockOrderIds);

        const hasDeliveredStock = linkedStockOrders?.some(
          so => so.delivery_status === 'delivered'
        );

        if (hasDeliveredStock) {
          // Auto-set stock_on_hand = true
          await supabase
            .from("purchases")
            .update({ stock_on_hand: true })
            .eq("id", purchaseId);

          toast({
            title: "Stock orders linked & inventory updated",
            description: "Linked stock order is delivered - stock marked as in inventory.",
          });
        } else {
          toast({
            title: "Stock orders linked successfully",
            description: "The selected stock orders have been linked to this purchase.",
          });
        }
      } catch (error) {
        console.error("Failed to check/update stock_on_hand:", error);
        toast({
          title: "Stock orders linked successfully",
          description: "The selected stock orders have been linked to this purchase.",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["purchase", purchaseId] });
      queryClient.invalidateQueries({ queryKey: ["linked-stock-orders", purchaseId] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["stock-allocations", purchaseId] });
      
      // Force refetch of stock order allocations to ensure display updates
      queryClient.refetchQueries({ queryKey: ["stock-allocations", purchaseId] });
    },
    onError: (error) => {
      console.error("Failed to link stock orders:", error);
      toast({
        title: "Failed to link stock orders",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });

  // Unlink stock orders from purchase
  const unlinkStockOrdersMutation = useMutation({
    mutationFn: async ({ purchaseId, stockOrderIds }: { purchaseId: string; stockOrderIds: string[] }) => {
      try {
        // Get current linked stock order IDs
        const { data: purchase, error: fetchError } = await supabase
          .from("purchases")
          .select("linked_stock_order_ids, product_id")
          .eq("id", purchaseId)
          .single();

        if (fetchError) {
          console.error("Failed to fetch purchase:", fetchError);
          throw new Error(`Failed to fetch purchase: ${fetchError.message}`);
        }

        const currentLinked = Array.isArray(purchase.linked_stock_order_ids) 
          ? purchase.linked_stock_order_ids.filter((id): id is string => typeof id === 'string')
          : [];

        // Remove specified stock order IDs
        const updatedLinked = currentLinked.filter(id => !stockOrderIds.includes(id));

        // First remove allocations entries
        const { error: deleteError } = await supabase
          .from("allocations")
          .delete()
          .eq("purchase_order_id", purchaseId)
          .in("stock_order_id", stockOrderIds);

        if (deleteError) {
          console.error("Failed to remove allocations:", deleteError);
          throw new Error(`Failed to remove allocations: ${deleteError.message}`);
        }

        // Then update purchases table
        const { error: updateError } = await supabase
          .from("purchases")
          .update({
            linked_stock_order_ids: updatedLinked,
          })
          .eq("id", purchaseId);

        if (updateError) {
          console.error("Failed to update purchase:", updateError);
          // Rollback: Re-create the allocations we just deleted
          for (const stockOrderId of stockOrderIds) {
            await supabase
              .from("allocations")
              .insert({
                purchase_order_id: purchaseId,
                stock_order_id: stockOrderId,
                product_id: purchase.product_id,
                asset_id: null,
                status: 'allocated',
                allocated_at: new Date().toISOString(),
              });
          }
          throw new Error(`Failed to update purchase: ${updateError.message}`);
        }

        return updatedLinked;
      } catch (error) {
        console.error("Unlink stock orders error:", error);
        throw error;
      }
    },
    onSuccess: (_, { purchaseId }) => {
      queryClient.invalidateQueries({ queryKey: ["purchase", purchaseId] });
      queryClient.invalidateQueries({ queryKey: ["linked-stock-orders", purchaseId] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["stock-allocations", purchaseId] });
      
      // Force refetch of stock order allocations to ensure display updates
      queryClient.refetchQueries({ queryKey: ["stock-allocations", purchaseId] });
      
      toast({
        title: "Stock orders unlinked successfully",
        description: "The selected stock orders have been unlinked from this purchase.",
      });
    },
    onError: (error) => {
      console.error("Failed to unlink stock orders:", error);
      toast({
        title: "Failed to unlink stock orders",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });

  return {
    useLinkedStockOrdersForPurchase,
    linkStockOrders: linkStockOrdersMutation,
    unlinkStockOrders: unlinkStockOrdersMutation,
    isLinking: linkStockOrdersMutation.isPending || unlinkStockOrdersMutation.isPending,
  };
};
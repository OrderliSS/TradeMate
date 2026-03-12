import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ReopenPurchaseParams {
  purchaseId: string;
  reason: string;
  currentStatus: string;
}

export const useReopenPurchase = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ purchaseId, reason, currentStatus }: ReopenPurchaseParams) => {
      // Get current purchase data
      const { data: purchase, error: purchaseError } = await supabase
        .from("purchases")
        .select("*")
        .eq("id", purchaseId)
        .single();

      if (purchaseError) throw purchaseError;
      if (!purchase) throw new Error("Purchase not found");

      // Only allow reopening purchases that are actually completed
      // Check for completion indicators (completed_at or pickup_date) rather than just order_status
      const isCompleted = purchase.completed_at || purchase.pickup_date || purchase.order_status === "complete";
      
      if (!isCompleted) {
        throw new Error("Only completed purchases can be re-opened");
      }

      // Update purchase status - revert to previous logical status
      const { error: updateError } = await supabase
        .from("purchases")
        .update({
          order_status: "ready_for_pickup_delivery", // Safe previous state
          completed_at: null,
          completion_method: null,
          pickup_date: null, // Clear pickup date so status is manageable
        })
        .eq("id", purchaseId);

      if (updateError) throw updateError;

      // Revert asset allocations from "fulfilled" back to "allocated"
      const { error: allocationError } = await supabase
        .from("allocations")
        .update({
          status: "allocated",
          updated_at: new Date().toISOString()
        })
        .eq("purchase_order_id", purchaseId)
        .eq("status", "fulfilled");

      if (allocationError) throw allocationError;

      // Revert asset management status from "sold" back to "allocated"
      const { error: assetError } = await supabase
        .from("asset_management")
        .update({
          status: "allocated",
          updated_at: new Date().toISOString()
        })
        .eq("purchase_id", purchaseId)
        .eq("status", "sold");

      if (assetError) throw assetError;

      // Log the reopening event
      const { error: eventError } = await supabase
        .from("purchase_events")
        .insert({
          purchase_id: purchaseId,
          event_type: "edit",
          description: `Purchase re-opened: ${reason}`,
          old_values: { 
            order_status: "complete",
            completed_at: purchase.completed_at,
            completion_method: purchase.completion_method
          },
          new_values: { 
            order_status: "ready_for_pickup_delivery",
            completed_at: null,
            completion_method: null,
            reopen_reason: reason
          },
        });

      if (eventError) throw eventError;

      return { success: true };
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchase"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-events"] });
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      
      toast({
        title: "Purchase Re-opened",
        description: "The purchase has been successfully re-opened and is now ready for pickup/delivery.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Re-open",
        description: error?.message || "Failed to re-open the purchase. Please try again.",
        variant: "destructive",
      });
    },
  });
};
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ModifyPurchaseQuantityParams {
  purchaseId: string;
  additionalQuantity: number;
  notes?: string;
  newTotalAmount: number;
  newSecondaryItems?: Array<{
    name: string;
    quantity: number;
    category?: string;
  }>;
}

export const useModifyPurchaseQuantity = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: ModifyPurchaseQuantityParams) => {
      const { purchaseId, additionalQuantity, notes, newTotalAmount, newSecondaryItems } = params;
      
      // First, get the current purchase data
      const { data: currentPurchase, error: fetchError } = await supabase
        .from("purchases")
        .select("*")
        .eq("id", purchaseId)
        .single();
      
      if (fetchError) throw fetchError;
      if (!currentPurchase) throw new Error("Purchase not found");
      
      const oldQuantity = currentPurchase.quantity || 0;
      const newQuantity = oldQuantity + additionalQuantity;
      
      // Validate the modification
      if (additionalQuantity <= 0) {
        throw new Error("Additional quantity must be greater than 0");
      }
      
      const qtyFulfilled = currentPurchase.qty_fulfilled || 0;
      if (newQuantity < qtyFulfilled) {
        throw new Error("Cannot reduce quantity below fulfilled amount");
      }
      
      // Update the purchase record
      const updateData: any = {
        quantity: newQuantity,
        total_amount: newTotalAmount,
        updated_at: new Date().toISOString(),
      };
      
      // Update secondary items if provided
      if (newSecondaryItems) {
        updateData.secondary_items = newSecondaryItems;
      }
      
      const { error: updateError } = await supabase
        .from("purchases")
        .update(updateData)
        .eq("id", purchaseId);
      
      if (updateError) throw updateError;
      
      // Create a purchase event log
      const eventDescription = `Order quantity increased by ${additionalQuantity} (${oldQuantity} → ${newQuantity})`;
      const eventNotes = notes ? `${eventDescription}. Notes: ${notes}` : eventDescription;
      
      const { error: eventError } = await supabase
        .from("purchase_events")
        .insert({
          purchase_id: purchaseId,
          event_type: "edit",
          description: eventNotes,
          old_values: {
            quantity: oldQuantity,
            total_amount: currentPurchase.total_amount,
            secondary_items: currentPurchase.secondary_items
          },
          new_values: {
            quantity: newQuantity,
            total_amount: newTotalAmount,
            secondary_items: newSecondaryItems || currentPurchase.secondary_items
          }
        });
      
      if (eventError) {
        console.warn("Failed to create purchase event:", eventError);
      }
      
      return {
        oldQuantity,
        newQuantity,
        additionalQuantity,
        newTotalAmount
      };
    },
    onSuccess: (data) => {
      toast.success(
        `Order quantity increased by ${data.additionalQuantity} items. New total: ${data.newQuantity} items.`,
        {
          description: `Updated total amount: $${data.newTotalAmount.toFixed(2)}`
        }
      );
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["purchase"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-events"] });
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      queryClient.invalidateQueries({ queryKey: ["stock-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["unified-inventory"] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to modify order: ${error.message}`);
    },
  });
};
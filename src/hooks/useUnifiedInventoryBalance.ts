import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface UnifiedInventoryBalance {
  product_id: string;
  sku: string;
  name: string;
  available_units: number;
  allocated_units: number;
  sold_units: number;
  pending_transit_units: number;
  on_order_units: number;
}

export const useUnifiedInventoryBalance = (productId: string) => {
  return useQuery({
    queryKey: ["unified-inventory-balance", productId],
    queryFn: async () => {
      if (!productId) return null;
      
      const { data, error } = await supabase
        .rpc('calculate_unified_inventory_balance', { p_product_id: productId });
      
      if (error) {
        console.error('Error fetching unified inventory balance:', error);
        throw error;
      }
      
      return data?.[0] as UnifiedInventoryBalance | null;
    },
    enabled: !!productId,
    staleTime: 30000, // Cache for 30 seconds
    retry: 2,
  });
};

export const usePurchaseStatusTransition = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      purchaseId, 
      newStatus, 
      qtyFulfilled 
    }: { 
      purchaseId: string; 
      newStatus: 'draft' | 'open' | 'allocated' | 'fulfilled' | 'cancelled';
      qtyFulfilled?: number;
    }) => {
      const { data, error } = await supabase
        .rpc('transition_purchase_status', {
          p_purchase_id: purchaseId,
          p_new_status: newStatus,
          p_qty_fulfilled: qtyFulfilled
        });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Purchase status updated successfully");
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["unified-inventory-balance"] });
      queryClient.invalidateQueries({ queryKey: ["unified-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
    },
    onError: (error) => {
      toast.error(`Failed to update purchase status: ${error.message}`);
    },
  });
};

export const useAllocationValidation = () => {
  return useMutation({
    mutationFn: async ({ 
      productId, 
      requestedQty 
    }: { 
      productId: string; 
      requestedQty: number;
    }) => {
      const { data, error } = await supabase
        .rpc('validate_allocation', {
          p_product_id: productId,
          p_requested_qty: requestedQty
        });
      
      if (error) throw error;
      return data as boolean;
    },
  });
};
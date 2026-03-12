import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enhancedToast } from "@/components/ui/enhanced-toast";
import { getCurrentEnvironment } from "@/lib/environment-utils";

interface CreateStockOrderAllocationParams {
  stock_order_id: string;
  purchase_id: string;
  quantity_allocated: number;
  notes?: string;
}

export const useCreateStockOrderAllocation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateStockOrderAllocationParams) => {
      // Validate required fields
      if (!params.stock_order_id) {
        throw new Error("Stock order ID is required");
      }
      if (!params.purchase_id) {
        throw new Error("Purchase ID is required");
      }
      if (!params.quantity_allocated || params.quantity_allocated <= 0) {
        throw new Error("Quantity allocated must be greater than 0");
      }
      
      const { data, error } = await supabase
        .from("stock_order_allocations")
        .insert({
          stock_order_id: params.stock_order_id,
          purchase_id: params.purchase_id,
          quantity_allocated: params.quantity_allocated,
          notes: params.notes,
          environment: getCurrentEnvironment()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-order-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      enhancedToast.success("Allocation Created", "Stock order allocation created successfully");
    },
    onError: (error) => {
      console.error("Failed to create stock order allocation:", error);
      enhancedToast.error("Error", "Failed to create stock order allocation");
    },
  });
};
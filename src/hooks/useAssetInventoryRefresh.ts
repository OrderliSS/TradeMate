import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface InventoryValidationResult {
  product_id: string;
  product_name: string;
  old_stock: number;
  new_stock: number;
  asset_count: number;
  correction_applied: boolean;
}

export const useAssetInventoryRefresh = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      // Simply invalidate all inventory-related cache without RPC calls
      return Promise.resolve([]);
    },
    onSuccess: () => {
      // Invalidate all relevant inventory and asset queries
      queryClient.invalidateQueries({ queryKey: ["true-inventory-calculations"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      queryClient.invalidateQueries({ queryKey: ["asset-summary"] });
      queryClient.invalidateQueries({ queryKey: ["unified-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-availability"] });
      queryClient.invalidateQueries({ queryKey: ["asset-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["stock-summaries"] });
      queryClient.invalidateQueries({ queryKey: ["unified-inventory-balance"] });
      
      toast.success("Inventory refreshed successfully");
    },
    onError: (error) => {
      toast.error(`Failed to refresh inventory: ${error.message}`);
    },
  });
};
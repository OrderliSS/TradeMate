import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enhancedToast } from "@/components/ui/enhanced-toast";

interface AllocateSecondaryAssetParams {
  purchaseOrderId: string;
  productId: string;
  assetIds: string[];
  notes?: string;
}

export const useAllocateSecondaryAssetToPurchase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AllocateSecondaryAssetParams) => {
      const { purchaseOrderId, productId, assetIds, notes } = params;

      // Create allocation records for each selected secondary asset
      const allocationPromises = assetIds.map(async (assetId) => {
        // Create allocation record
        const { data: allocation, error: allocationError } = await supabase
          .from("allocations")
          .insert({
            asset_id: assetId,
            product_id: productId,
            purchase_order_id: purchaseOrderId,
            status: "allocated",
            notes: notes || `Secondary asset allocated for purchase`,
            allocated_by: (await supabase.auth.getUser()).data.user?.id,
          })
          .select()
          .single();

        if (allocationError) throw allocationError;

        // Update asset status to allocated
        const { error: assetError } = await supabase
          .from("asset_management")
          .update({ 
            status: "allocated",
            purchase_id: purchaseOrderId,
            updated_at: new Date().toISOString()
          })
          .eq("id", assetId);

        if (assetError) throw assetError;

        return allocation;
      });

      const results = await Promise.all(allocationPromises);
      return results;
    },
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["purchase-asset-status", variables.purchaseOrderId] });
      queryClient.invalidateQueries({ queryKey: ["available-assets-for-pre-allocation", variables.productId] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      
      enhancedToast.success(
        "Secondary Assets Allocated", 
        `Successfully allocated ${variables.assetIds.length} secondary asset(s)`
      );
    },
    onError: (error) => {
      console.error("Failed to allocate secondary assets:", error);
      enhancedToast.error("Allocation Failed", "Failed to allocate secondary assets");
    },
  });
};
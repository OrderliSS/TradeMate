import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ProductConfigurability {
  isConfigurable: boolean;
  reason: string;
}

// Determine if a product requires configuration using the explicit database flag
const isProductConfigurable = async (productId: string): Promise<ProductConfigurability> => {
  const { data: product, error } = await supabase
    .from("products")
    .select("name, requires_configuration")
    .eq("id", productId)
    .single();

  if (error || !product) {
    return { isConfigurable: false, reason: "Product not found" };
  }

  if (product.requires_configuration === true) {
    return { 
      isConfigurable: true, 
      reason: `Product "${product.name}" is marked as requiring configuration` 
    };
  }

  return { 
    isConfigurable: false, 
    reason: `Product "${product.name}" does not require configuration` 
  };
};

export const usePurchaseAssetStatusSync = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      purchaseId, 
      newStatus 
    }: { 
      purchaseId: string; 
      newStatus: string;
    }) => {
      // Only process if status is changing to 'configuring'
      if (newStatus !== 'configuring') {
        return { assetsUpdated: 0, message: "No asset updates needed for this status" };
      }

      // Get all allocated assets for this purchase order
      const { data: allocations, error: allocError } = await supabase
        .from("allocations")
        .select(`
          id,
          asset_id,
          product_id,
          product:products!allocations_product_id_fkey(name, category),
          asset:asset_management(id, asset_tag, status)
        `)
        .eq("purchase_order_id", purchaseId)
        .eq("status", "allocated");

      if (allocError) throw allocError;

      if (!allocations || allocations.length === 0) {
        return { assetsUpdated: 0, message: "No allocated assets found for this purchase" };
      }

      let assetsUpdated = 0;
      const updateResults = [];

      // Process each allocation
      for (const allocation of allocations) {
        if (!allocation.product_id || !allocation.asset_id) continue;

        // Check if product is configurable
        const configurability = await isProductConfigurable(allocation.product_id);
        
        let newAssetStatus: string;
        let notes: string;

        if (configurability.isConfigurable) {
          newAssetStatus = "being_configured";
          notes = `Status updated to 'being_configured' - ${configurability.reason}`;
        } else {
          newAssetStatus = "ready"; // Non-configurable assets go directly to ready
          notes = `Status updated to 'ready' - ${configurability.reason} (bypasses configuration)`;
        }

        // Update the asset status
        const { error: updateError } = await supabase
          .from("asset_management")
          .update({ 
            status: newAssetStatus,
            // Only update transit_status for shipping-related status changes, not configuration
            transit_status: 'available', // Reset to available since this is about configuration, not shipping
            notes: notes,
            updated_at: new Date().toISOString()
          })
          .eq("id", allocation.asset_id);

        if (!updateError) {
          assetsUpdated++;
          updateResults.push({
            assetId: allocation.asset_id,
            assetTag: (allocation.asset as any)?.asset_tag,
            productName: (allocation.product as any)?.name,
            newStatus: newAssetStatus,
            reason: configurability.reason
          });
        }
      }

      // Log the update activity
      await supabase
        .from("purchase_events")
        .insert([{
          purchase_id: purchaseId,
          event_type: "asset_status_sync",
          description: `Auto-updated ${assetsUpdated} asset statuses for 'configuring' status`,
          new_values: { 
            asset_updates: updateResults,
            sync_triggered_by: "purchase_status_change"
          }
        }]);

      return { 
        assetsUpdated, 
        updateResults,
        message: `Updated ${assetsUpdated} asset(s) based on configurability` 
      };
    },
    onSuccess: (result) => {
      // Invalidate all relevant caches to ensure UI updates
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["all-assets"] });
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      queryClient.invalidateQueries({ queryKey: ["unified-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["asset-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-availability"] });
      queryClient.invalidateQueries({ queryKey: ["unified-asset-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["asset-summary"] });
      queryClient.invalidateQueries({ queryKey: ["true-inventory-calculations"] });
      
      if (result.assetsUpdated > 0) {
        toast({
          title: "Asset Statuses Updated",
          description: result.message,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Asset Status Update Failed",
        description: error?.message || "Failed to update asset statuses",
        variant: "destructive",
      });
    },
  });
};
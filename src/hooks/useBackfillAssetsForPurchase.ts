import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enhancedToast } from "@/components/ui/enhanced-toast";

interface BackfillAssetsParams {
  purchaseOrderId: string;
  productId: string;
  quantity: number;
  totalAmount: number;
}

export const useBackfillAssetsForPurchase = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ purchaseOrderId, productId, quantity, totalAmount }: BackfillAssetsParams) => {
      // Check existing assets for this purchase order
      const { data: existingAssets, error: checkError } = await supabase
        .from('asset_management')
        .select('id')
        .eq('purchase_order_id', purchaseOrderId)
        .eq('product_id', productId);

      if (checkError) throw new Error(`Failed to check existing assets: ${checkError.message}`);

      const existingCount = existingAssets?.length || 0;
      const assetsToCreate = quantity - existingCount;

      if (assetsToCreate <= 0) {
        throw new Error(`Assets already exist for this order. Found ${existingCount} assets, expected ${quantity}.`);
      }

      const pricePerAsset = totalAmount / quantity;
      const createdAssets = [];
      const createdAllocations = [];

      // Create only the missing assets sequentially to avoid duplicate tag generation
      for (let i = 0; i < assetsToCreate; i++) {
        // Generate unique asset tag
        const { data: assetTag, error: tagError } = await supabase
          .rpc('generate_asset_tag', { prefix: 'AST' });

        if (tagError) throw new Error(`Failed to generate asset tag: ${tagError.message}`);

        // Create asset record
        const { data: asset, error: assetError } = await supabase
          .from('asset_management')
          .insert({
            product_id: productId,
            asset_tag: assetTag,
            status: 'allocated',
            purchase_order_id: purchaseOrderId,
            sold_price: pricePerAsset,
            pricing_notes: 'Backfilled - allocated to purchase order',
            notes: `Backfilled asset for purchase order`,
            asset_type: 'device',
            category: 'device',
            is_consumable: false
          })
          .select()
          .single();

        if (assetError) throw new Error(`Failed to create asset: ${assetError.message}`);
        createdAssets.push(asset);

        // Create allocation record
        const { data: allocation, error: allocationError } = await supabase
          .from('allocations')
          .insert({
            purchase_order_id: purchaseOrderId,
            product_id: productId,
            asset_id: asset.id,
            status: 'allocated',
            notes: 'Backfilled allocation for existing purchase order'
          })
          .select()
          .single();

        if (allocationError) throw new Error(`Failed to create allocation: ${allocationError.message}`);
        createdAllocations.push(allocation);
      }

      return { createdAssets, createdAllocations };
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      queryClient.invalidateQueries({ queryKey: ["all-assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });

      enhancedToast.success("Assets Backfilled Successfully", `Created ${data.createdAssets.length} new asset records and allocations for the purchase order.`);
    },
    onError: (error) => {
      console.error("Backfill assets error:", error);
      enhancedToast.error("Error Backfilling Assets", error instanceof Error ? error.message : "Failed to create asset records.");
    },
  });
};
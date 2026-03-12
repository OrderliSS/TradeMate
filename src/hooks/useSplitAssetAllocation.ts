import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SplitAssetAllocationData {
  purchaseId: string;
  productId: string;
  totalQuantity: number;
  allocatedQuantity: number;
  notes?: string;
}

interface SplitAllocationResult {
  success: boolean;
  totalAssetsCreated: number;
  assetsAllocatedToOrder: number;
  assetsAddedToInventory: number;
  errors: string[];
  assetTags: string[];
}

export const useSplitAssetAllocation = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: SplitAssetAllocationData): Promise<SplitAllocationResult> => {
      const { purchaseId, productId, totalQuantity, allocatedQuantity, notes } = data;
      
      console.log('useSplitAssetAllocation: Starting split allocation', { 
        purchaseId, 
        productId, 
        totalQuantity, 
        allocatedQuantity 
      });
      
      const result: SplitAllocationResult = {
        success: false,
        totalAssetsCreated: 0,
        assetsAllocatedToOrder: 0,
        assetsAddedToInventory: 0,
        errors: [],
        assetTags: []
      };

      try {
        // Get product details to determine if it's multi-unit
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('name, is_multi_unit, quantity_per_pack')
          .eq('id', productId)
          .single();

        if (productError) {
          throw new Error(`Failed to fetch product: ${productError.message}`);
        }

        // Create all assets first
        const assetsToCreate = [];
        const createdAssetIds = [];
        
        for (let i = 0; i < totalQuantity; i++) {
          // Generate asset tag using the database function
          const { data: assetTag, error: tagError } = await supabase
            .rpc('generate_asset_tag', { prefix: 'AST' });
          
          if (tagError) {
            console.error('Error generating asset tag:', tagError);
            // Try again with a fallback
            const fallbackTag = `AST-${Date.now()}-${i.toString().padStart(3, '0')}`;
            assetsToCreate.push({
              product_id: productId,
              asset_tag: fallbackTag,
              status: 'available',
              category: 'device',
              notes: notes ? `Split allocation: ${notes}` : 'Created via split allocation'
            });
            result.assetTags.push(fallbackTag);
          } else {
            assetsToCreate.push({
              product_id: productId,
              asset_tag: assetTag,
              status: 'available', 
              category: 'device',
              notes: notes ? `Split allocation: ${notes}` : 'Created via split allocation'
            });
            result.assetTags.push(assetTag);
          }
        }

        // Insert all assets
        const { data: createdAssets, error: createError } = await supabase
          .from('asset_management')
          .insert(assetsToCreate)
          .select('id, asset_tag');

        if (createError) {
          throw new Error(`Failed to create assets: ${createError.message}`);
        }

        if (!createdAssets || createdAssets.length === 0) {
          throw new Error('No assets were created');
        }

        result.totalAssetsCreated = createdAssets.length;
        console.log(`Created ${createdAssets.length} assets`);

        // Handle multi-unit products - create child assets if needed
        if (product.is_multi_unit && product.quantity_per_pack) {
          for (const parentAsset of createdAssets) {
            const childAssets = [];
            
            for (let j = 1; j <= product.quantity_per_pack; j++) {
              const { data: childTag, error: childTagError } = await supabase
                .rpc('generate_asset_tag', { prefix: 'UNIT' });
              
              const childAssetTag = childTagError ? 
                `UNIT-${parentAsset.asset_tag}-${j}` : 
                childTag;

              childAssets.push({
                product_id: productId,
                parent_asset_id: parentAsset.id,
                pack_position: j,
                asset_tag: childAssetTag,
                status: 'available',
                category: 'unit',
                notes: `Unit ${j} of ${product.quantity_per_pack} from pack ${parentAsset.asset_tag}`
              });
            }

            if (childAssets.length > 0) {
              const { error: childCreateError } = await supabase
                .from('asset_management')
                .insert(childAssets);

              if (childCreateError) {
                console.error('Error creating child assets:', childCreateError);
                result.errors.push(`Failed to create child assets for ${parentAsset.asset_tag}`);
              }
            }
          }
        }

        // Allocate the specified quantity to the purchase order
        if (allocatedQuantity > 0) {
          const assetsToAllocate = createdAssets.slice(0, allocatedQuantity);
          
          const allocations = assetsToAllocate.map(asset => ({
            purchase_order_id: purchaseId,
            product_id: productId,
            asset_id: asset.id,
            status: 'allocated',
            notes: notes ? `Split allocation: ${notes}` : 'Allocated via split allocation'
          }));

          const { error: allocationError } = await supabase
            .from('allocations')
            .insert(allocations);

          if (allocationError) {
            console.error('Error creating allocations:', allocationError);
            result.errors.push(`Failed to allocate assets: ${allocationError.message}`);
          } else {
            result.assetsAllocatedToOrder = allocatedQuantity;
            console.log(`Allocated ${allocatedQuantity} assets to purchase order`);

            // Update asset status to allocated
            const { error: statusUpdateError } = await supabase
              .from('asset_management')
              .update({ status: 'allocated' })
              .in('id', assetsToAllocate.map(a => a.id));

            if (statusUpdateError) {
              console.error('Error updating asset status:', statusUpdateError);
              result.errors.push('Failed to update allocated asset status');
            }
          }
        }

        // The remaining assets stay as 'available' in general inventory
        result.assetsAddedToInventory = totalQuantity - allocatedQuantity;
        result.success = result.errors.length === 0;

        console.log('Split allocation completed:', result);
        return result;

      } catch (error: any) {
        console.error('Split allocation error:', error);
        result.errors.push(error.message || 'Unknown error occurred');
        return result;
      }
    },

    onSuccess: (result) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });

      if (result.success) {
        toast({
          title: "Split Allocation Complete",
          description: `Created ${result.totalAssetsCreated} assets. ${result.assetsAllocatedToOrder} allocated to order, ${result.assetsAddedToInventory} added to inventory.`,
        });
      } else {
        toast({
          title: "Split Allocation Completed with Issues",
          description: `Created ${result.totalAssetsCreated} assets but encountered some errors. Check the console for details.`,
          variant: "destructive",
        });
      }
    },

    onError: (error: any) => {
      console.error('Split allocation mutation error:', error);
      toast({
        title: "Split Allocation Failed",
        description: error.message || "Failed to create and allocate assets",
        variant: "destructive",
      });
    },
  });
};
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enhancedToast } from "@/components/ui/enhanced-toast";

interface BundleComponent {
  product_id: string;
  quantity: number;
}

interface AutoAllocateParams {
  purchaseOrderId: string;
  bundleProductId: string;
  bundleComponents: BundleComponent[];
  bundlePrimaryProductId?: string;
}

interface AllocationResult {
  productId: string;
  productName: string;
  allocated: number;
  needed: number;
  assetTags: string[];
  assetIds: string[];
}

// Client-side mutex to prevent double-click race conditions
const ongoingAllocations = new Set<string>();

/**
 * Hook to auto-allocate available assets to a bundle purchase order.
 * This finds instock or available assets for each bundle component
 * and links them to the purchase order.
 */
export const useAutoAllocateBundleAssets = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      purchaseOrderId,
      bundleProductId,
      bundleComponents,
      bundlePrimaryProductId
    }: AutoAllocateParams) => {
      if (!purchaseOrderId || bundleComponents.length === 0) {
        throw new Error("Invalid parameters for auto-allocation");
      }

      const results: AllocationResult[] = [];
      let totalAllocated = 0;

      // Fetch product names for components
      const productIds = bundleComponents.map(c => c.product_id);
      const { data: products } = await supabase
        .from("products")
        .select("id, name")
        .in("id", productIds);

      const productNameMap = new Map(products?.map(p => [p.id, p.name]) || []);

      // Process each component
      for (const component of bundleComponents) {
        const productName = productNameMap.get(component.product_id) || 'Unknown';

        // Find assets already allocated to this purchase for this component
        const { data: existingAllocations } = await supabase
          .from("asset_management")
          .select("id")
          .eq("purchase_order_id", purchaseOrderId)
          .eq("product_id", component.product_id)
          .in("status", ["allocated", "pre_allocated", "reserved", "sold", "fulfilled"]);

        const alreadyAllocated = existingAllocations?.length || 0;
        const stillNeeded = component.quantity - alreadyAllocated;

        if (stillNeeded <= 0) {
          results.push({
            productId: component.product_id,
            productName,
            allocated: 0,
            needed: component.quantity,
            assetTags: [],
            assetIds: []
          });
          continue;
        }

        // Find available assets (instock or available)
        const { data: availableAssets, error } = await supabase
          .from("asset_management")
          .select("id, asset_tag, status")
          .eq("product_id", component.product_id)
          .in("status", ["available", "instock"])
          .or(`purchase_order_id.is.null,purchase_order_id.eq.${purchaseOrderId}`)
          .limit(stillNeeded);

        if (error) {
          console.error(`Error fetching assets for ${productName}:`, error);
          continue;
        }

        if (!availableAssets || availableAssets.length === 0) {
          results.push({
            productId: component.product_id,
            productName,
            allocated: 0,
            needed: stillNeeded,
            assetTags: [],
            assetIds: []
          });
          continue;
        }

        // Allocate each available asset
        const assetTags: string[] = [];
        const assetIds: string[] = [];

        for (const asset of availableAssets) {
          // Update asset to allocated status
          const { error: updateError } = await supabase
            .from("asset_management")
            .update({
              status: 'allocated',
              purchase_order_id: purchaseOrderId,
              pricing_notes: `Auto-allocated to bundle purchase`
            })
            .eq("id", asset.id);

          if (updateError) {
            console.error(`Failed to allocate asset ${asset.asset_tag}:`, updateError);
            continue;
          }

          // Create allocation record with parent_bundle_id to track bundle attribution
          await supabase
            .from("allocations")
            .insert({
              asset_id: asset.id,
              purchase_order_id: purchaseOrderId,
              product_id: component.product_id,
              parent_bundle_id: bundleProductId, // Track that this allocation is for a bundle
              status: 'allocated',
              notes: `Auto-allocated as bundle component`
            });

          assetTags.push(asset.asset_tag || asset.id.slice(0, 8));
          assetIds.push(asset.id);
          totalAllocated++;
        }

        results.push({
          productId: component.product_id,
          productName,
          allocated: assetIds.length,
          needed: stillNeeded,
          assetTags,
          assetIds
        });
      }

      return {
        success: true,
        totalAllocated,
        componentResults: results
      };
    },
    onSuccess: (result) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["all-assets"] });
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      queryClient.invalidateQueries({ queryKey: ["bundle-component-assets"] });
      queryClient.invalidateQueries({ queryKey: ["primary-assets"] });
      queryClient.invalidateQueries({ queryKey: ["secondary-assets"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });

      if (result.totalAllocated > 0) {
        enhancedToast.success(
          "Assets Auto-Allocated",
          `${result.totalAllocated} assets allocated to bundle components`
        );
      } else {
        enhancedToast.info(
          "No Assets to Allocate",
          "All available assets are already allocated or none are available"
        );
      }
    },
    onError: (error) => {
      console.error("Auto-allocation error:", error);
      enhancedToast.error(
        "Auto-Allocation Failed",
        error.message || "Failed to auto-allocate assets"
      );
    }
  });
};

/**
 * Hook to allocate a single component's available assets to a purchase order
 */
export const useAllocateSingleComponentAssets = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      purchaseOrderId,
      productId,
      quantityNeeded,
      parentBundleId // Optional: if allocating for a bundle component
    }: {
      purchaseOrderId: string;
      productId: string;
      quantityNeeded: number;
      parentBundleId?: string;
    }) => {
      // Prevent race condition from double-clicks
      const lockKey = `${purchaseOrderId}-${productId}`;
      if (ongoingAllocations.has(lockKey)) {
        return { allocated: 0, message: "Allocation already in progress" };
      }
      ongoingAllocations.add(lockKey);

      try {
        // Find how many are already allocated
        const { data: existingAllocations } = await supabase
          .from("asset_management")
          .select("id")
          .eq("purchase_order_id", purchaseOrderId)
          .eq("product_id", productId)
          .in("status", ["allocated", "pre_allocated", "reserved", "sold", "fulfilled"]);

        const alreadyAllocated = existingAllocations?.length || 0;
        const stillNeeded = quantityNeeded - alreadyAllocated;

        if (stillNeeded <= 0) {
          return { allocated: 0, message: "Already fully allocated" };
        }

        // Find available assets
        const { data: availableAssets, error } = await supabase
          .from("asset_management")
          .select("id, asset_tag")
          .eq("product_id", productId)
          .in("status", ["available", "instock"])
          .or(`purchase_order_id.is.null,purchase_order_id.eq.${purchaseOrderId}`)
          .limit(stillNeeded);

        if (error) throw error;

        if (!availableAssets || availableAssets.length === 0) {
          return { allocated: 0, message: "No available assets found" };
        }

        // Allocate each asset
        let allocated = 0;
        for (const asset of availableAssets) {
          const { error: updateError } = await supabase
            .from("asset_management")
            .update({
              status: 'allocated',
              purchase_order_id: purchaseOrderId,
              pricing_notes: `Allocated to purchase`
            })
            .eq("id", asset.id);

          if (updateError) continue;

          await supabase
            .from("allocations")
            .insert({
              asset_id: asset.id,
              purchase_order_id: purchaseOrderId,
              product_id: productId,
              parent_bundle_id: parentBundleId || null, // Track bundle attribution
              status: 'allocated',
              notes: parentBundleId ? 'Allocated as bundle component' : 'Manual allocation from available assets'
            });

          allocated++;
        }

        return { allocated, message: `Allocated ${allocated} assets` };
      } finally {
        ongoingAllocations.delete(lockKey);
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["all-assets"] });
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      queryClient.invalidateQueries({ queryKey: ["bundle-component-assets"] });
      queryClient.invalidateQueries({ queryKey: ["primary-assets"] });

      if (result.allocated > 0) {
        enhancedToast.success("Assets Allocated", result.message);
      } else {
        enhancedToast.info("No Changes", result.message);
      }
    },
    onError: (error) => {
      enhancedToast.error("Allocation Failed", error.message);
    }
  });
};

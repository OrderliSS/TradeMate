import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enhancedToast } from "@/components/ui/enhanced-toast";

export interface BundleComponent {
  product_id: string;
  quantity: number;
}

export interface ComponentAllocationResult {
  productId: string;
  productName: string;
  assetTags: string[];
  assetIds: string[];
  quantity: number;
  isPrimary: boolean;
}

export interface BundleAllocationResult {
  success: boolean;
  purchaseOrderId: string;
  bundleProductName: string;
  componentAllocations: ComponentAllocationResult[];
  totalAssetsAllocated: number;
  error?: string;
}

interface AllocateBundleParams {
  purchaseOrderId: string;
  bundleProductId: string;
  notes?: string;
}

interface ReserveBundleParams {
  purchaseOrderId: string;
  bundleProductId: string;
  bundleComponents: BundleComponent[];
  bundlePrimaryProductId?: string;
}

/**
 * Hook to allocate all component assets for a bundle product
 * When a bundle is allocated, this pulls assets from each component product
 */
export const useAllocateBundleAssets = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      purchaseOrderId, 
      bundleProductId, 
      notes 
    }: AllocateBundleParams): Promise<BundleAllocationResult> => {
      // 1. Fetch bundle product details including components
      const { data: bundleProduct, error: bundleError } = await supabase
        .from("products")
        .select("id, name, is_bundle, bundle_components, bundle_primary_product_id")
        .eq("id", bundleProductId)
        .single();

      if (bundleError || !bundleProduct) {
        throw new Error("Failed to fetch bundle product");
      }

      if (!bundleProduct.is_bundle) {
        throw new Error("Product is not a bundle");
      }

      const components = (bundleProduct.bundle_components as unknown as BundleComponent[]) || [];
      if (components.length === 0) {
        throw new Error("Bundle has no components defined");
      }

      // 2. Fetch product names for all components
      const productIds = components.map(c => c.product_id);
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name")
        .in("id", productIds);

      if (productsError) {
        throw new Error("Failed to fetch component products");
      }

      const productNameMap = new Map(products?.map(p => [p.id, p.name]) || []);

      // 3. Get purchase order details for pricing
      const { data: purchaseOrder, error: orderError } = await supabase
        .from("purchases")
        .select("total_amount, quantity")
        .eq("id", purchaseOrderId)
        .single();

      if (orderError) {
        throw new Error("Failed to fetch purchase order");
      }

      // Calculate price per bundle unit
      const pricePerBundle = purchaseOrder.total_amount / purchaseOrder.quantity;

      // 4. For each component, find and allocate available assets
      const componentAllocations: ComponentAllocationResult[] = [];
      const allocatedAssetIds: string[] = [];

      for (const component of components) {
        // Find available assets for this component product
        const { data: availableAssets, error: assetsError } = await supabase
          .from("asset_management")
          .select("id, asset_tag, product_id")
          .eq("product_id", component.product_id)
          .in("status", ["available", "instock"])
          .limit(component.quantity);

        if (assetsError) {
          // Rollback previous allocations
          await rollbackAllocations(allocatedAssetIds);
          throw new Error(`Failed to fetch assets for ${productNameMap.get(component.product_id)}`);
        }

        if (!availableAssets || availableAssets.length < component.quantity) {
          // Rollback previous allocations
          await rollbackAllocations(allocatedAssetIds);
          throw new Error(
            `Insufficient assets for ${productNameMap.get(component.product_id)}: ` +
            `need ${component.quantity}, found ${availableAssets?.length || 0}`
          );
        }

        // Allocate each asset
        const assetTags: string[] = [];
        const assetIds: string[] = [];

        for (const asset of availableAssets.slice(0, component.quantity)) {
          // Create allocation record
          const { error: allocError } = await supabase
            .from("allocations")
            .insert({
              asset_id: asset.id,
              purchase_order_id: purchaseOrderId,
              product_id: component.product_id,
              status: 'allocated',
              notes: notes || `Bundle allocation: ${bundleProduct.name}`
            });

          if (allocError) {
            await rollbackAllocations(allocatedAssetIds);
            throw new Error(`Failed to create allocation: ${allocError.message}`);
          }

          // Update asset status
          const { error: updateError } = await supabase
            .from("asset_management")
            .update({
              status: 'allocated',
              purchase_order_id: purchaseOrderId,
              sold_price: pricePerBundle / components.reduce((sum, c) => sum + c.quantity, 0),
              pricing_notes: `Bundle component: ${bundleProduct.name}`
            })
            .eq("id", asset.id);

          if (updateError) {
            await rollbackAllocations(allocatedAssetIds);
            throw new Error(`Failed to update asset status: ${updateError.message}`);
          }

          allocatedAssetIds.push(asset.id);
          assetIds.push(asset.id);
          assetTags.push(asset.asset_tag || asset.id.slice(0, 8));
        }

        componentAllocations.push({
          productId: component.product_id,
          productName: productNameMap.get(component.product_id) || 'Unknown',
          assetTags,
          assetIds,
          quantity: component.quantity,
          isPrimary: component.product_id === bundleProduct.bundle_primary_product_id
        });
      }

      // Auto-set stock_on_hand since bundle assets came from existing inventory
      await supabase
        .from("purchases")
        .update({ stock_on_hand: true })
        .eq("id", purchaseOrderId);
      console.log('✅ [BUNDLE-ALLOCATE] Set stock_on_hand = true for bundle allocation');

      return {
        success: true,
        purchaseOrderId,
        bundleProductName: bundleProduct.name,
        componentAllocations,
        totalAssetsAllocated: allocatedAssetIds.length
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["all-assets"] });
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      queryClient.invalidateQueries({ queryKey: ["available-assets"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });

      const primaryComponent = result.componentAllocations.find(c => c.isPrimary);
      const primaryTag = primaryComponent?.assetTags[0] || 'N/A';

      enhancedToast.success(
        "Bundle Assets Allocated",
        `${result.totalAssetsAllocated} assets allocated for ${result.bundleProductName}. Primary: ${primaryTag}`
      );
    },
    onError: (error) => {
      console.error("Bundle allocation error:", error);
      enhancedToast.error(
        "Bundle Allocation Failed",
        error.message || "Failed to allocate bundle assets"
      );
    }
  });
};

/**
 * Check if all bundle components have sufficient available assets
 */
export const useCheckBundleAvailability = () => {
  return useMutation({
    mutationFn: async (bundleProductId: string) => {
      // Fetch bundle components
      const { data: bundleProduct, error: bundleError } = await supabase
        .from("products")
        .select("id, name, bundle_components, bundle_primary_product_id")
        .eq("id", bundleProductId)
        .single();

      if (bundleError || !bundleProduct) {
        throw new Error("Failed to fetch bundle product");
      }

      const components = (bundleProduct.bundle_components as unknown as BundleComponent[]) || [];
      if (components.length === 0) {
        return { available: false, components: [] };
      }

      // Check availability for each component
      const availability = await Promise.all(
        components.map(async (component) => {
          const { data: assets, error } = await supabase
            .from("asset_management")
            .select("id, asset_tag")
            .eq("product_id", component.product_id)
            .in("status", ["available", "instock"]);

          const { data: product } = await supabase
            .from("products")
            .select("name")
            .eq("id", component.product_id)
            .single();

          return {
            productId: component.product_id,
            productName: product?.name || 'Unknown',
            required: component.quantity,
            available: assets?.length || 0,
            isPrimary: component.product_id === bundleProduct.bundle_primary_product_id,
            hasEnough: (assets?.length || 0) >= component.quantity,
            availableAssets: assets || []
          };
        })
      );

      return {
        available: availability.every(c => c.hasEnough),
        bundleName: bundleProduct.name,
        components: availability
      };
    }
  });
};

/**
 * Rollback allocated assets in case of failure
 */
async function rollbackAllocations(assetIds: string[]) {
  if (assetIds.length === 0) return;

  // Delete allocation records
  await supabase
    .from("allocations")
    .delete()
    .in("asset_id", assetIds);

  // Reset asset statuses
  await supabase
    .from("asset_management")
    .update({
      status: 'available',
      purchase_order_id: null,
      sold_price: null,
      pricing_notes: null
    })
    .in("id", assetIds);
}

/**
 * Hook to reserve/pre-allocate available assets for bundle components
 * This links assets without changing them to "allocated" - they remain in "reserved" state
 */
export const useReserveBundleAssets = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      purchaseOrderId,
      bundleProductId,
      bundleComponents,
      bundlePrimaryProductId
    }: ReserveBundleParams) => {
      if (!purchaseOrderId || bundleComponents.length === 0) {
        throw new Error("Invalid parameters for reservation");
      }

      // Fetch product names
      const productIds = bundleComponents.map(c => c.product_id);
      const { data: products } = await supabase
        .from("products")
        .select("id, name")
        .in("id", productIds);

      const productNameMap = new Map(products?.map(p => [p.id, p.name]) || []);
      const reservedAssetIds: string[] = [];
      const componentResults: Array<{
        productId: string;
        productName: string;
        reserved: number;
        needed: number;
        assetTags: string[];
      }> = [];

      for (const component of bundleComponents) {
        const productName = productNameMap.get(component.product_id) || 'Unknown';

        // Check existing reservations/allocations
        const { data: existing } = await supabase
          .from("asset_management")
          .select("id")
          .eq("purchase_order_id", purchaseOrderId)
          .eq("product_id", component.product_id)
          .in("status", ["allocated", "pre_allocated", "reserved"]);

        const alreadyReserved = existing?.length || 0;
        const stillNeeded = component.quantity - alreadyReserved;

        if (stillNeeded <= 0) {
          componentResults.push({
            productId: component.product_id,
            productName,
            reserved: 0,
            needed: component.quantity,
            assetTags: []
          });
          continue;
        }

        // Find available assets (instock or available)
        const { data: availableAssets, error } = await supabase
          .from("asset_management")
          .select("id, asset_tag")
          .eq("product_id", component.product_id)
          .in("status", ["available", "instock"])
          .is("purchase_order_id", null)
          .limit(stillNeeded);

        if (error || !availableAssets) {
          componentResults.push({
            productId: component.product_id,
            productName,
            reserved: 0,
            needed: stillNeeded,
            assetTags: []
          });
          continue;
        }

        const assetTags: string[] = [];

        for (const asset of availableAssets) {
          // Update asset to reserved/pre_allocated status
          const { error: updateError } = await supabase
            .from("asset_management")
            .update({
              status: 'pre_allocated',
              purchase_order_id: purchaseOrderId,
              pricing_notes: `Reserved for bundle: ${productNameMap.get(bundleProductId) || bundleProductId}`
            })
            .eq("id", asset.id);

          if (updateError) continue;

          // Create allocation record
          await supabase
            .from("allocations")
            .insert({
              asset_id: asset.id,
              purchase_order_id: purchaseOrderId,
              product_id: component.product_id,
              status: 'pre_allocated',
              notes: `Reserved for bundle component`
            });

          reservedAssetIds.push(asset.id);
          assetTags.push(asset.asset_tag || asset.id.slice(0, 8));
        }

        componentResults.push({
          productId: component.product_id,
          productName,
          reserved: assetTags.length,
          needed: stillNeeded,
          assetTags
        });
      }

      return {
        success: true,
        totalReserved: reservedAssetIds.length,
        componentResults
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["asset-management"] });
      queryClient.invalidateQueries({ queryKey: ["all-assets"] });
      queryClient.invalidateQueries({ queryKey: ["allocations"] });
      queryClient.invalidateQueries({ queryKey: ["bundle-component-assets"] });
      queryClient.invalidateQueries({ queryKey: ["primary-assets"] });
      queryClient.invalidateQueries({ queryKey: ["purchases"] });

      if (result.totalReserved > 0) {
        enhancedToast.success(
          "Assets Reserved",
          `${result.totalReserved} assets reserved for bundle components`
        );
      } else {
        enhancedToast.info(
          "No Assets Reserved",
          "No available assets found or all already reserved"
        );
      }
    },
    onError: (error) => {
      console.error("Reservation error:", error);
      enhancedToast.error(
        "Reservation Failed",
        error.message || "Failed to reserve bundle assets"
      );
    }
  });
};

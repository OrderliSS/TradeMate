import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllAssets } from "@/hooks/useAssetManagement";
import { getCurrentEnvironment } from "@/lib/environment-utils";

export interface AssetCalculation {
  productId: string;
  productName: string;
  stockQuantity: number;
  totalAssets: number;
  availableAssets: number;
  allocatedAssets: number;
  soldAssets: number;           // Total physical sold (for inventory)
  soldAssetsStandalone: number; // Sold via standalone orders only (for display)
  soldAssetsViaBundle: number;  // Sold as bundle components
  excessAssets: number;
  missingAssets: number;
  isInSync: boolean;
  hasDiscrepancy: boolean;
}

export interface PurchaseAssetStatus {
  purchaseId: string;
  productId: string;
  requestedQuantity: number;
  allocatedCount: number;
  isOverAllocated: boolean;
  isComplete: boolean;
  remainingNeeded: number;
  excessAllocated: number;
}

/**
 * Unified hook for calculating asset metrics across all products
 * This ensures all components use the same calculation logic
 */
export const useUnifiedAssetCalculations = () => {
  const { data: assets = [] } = useAllAssets();

  return useQuery({
    queryKey: ["unified-asset-calculations", assets.length],
    queryFn: async (): Promise<AssetCalculation[]> => {
      // Get all products with stock information
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, stock_quantity')
        .eq('status', 'active');

      if (error) throw error;

      // Get all allocations with bundle info to calculate accurate sold counts
      const { data: allocations } = await supabase
        .from('allocations')
        .select('product_id, parent_bundle_id, status')
        .in('status', ['fulfilled', 'allocated']);

      // Build a map of bundle-aware sold counts
      const soldCountsByProduct = new Map<string, { standalone: number; bundle: number }>();
      for (const allocation of allocations || []) {
        if (!soldCountsByProduct.has(allocation.product_id)) {
          soldCountsByProduct.set(allocation.product_id, { standalone: 0, bundle: 0 });
        }
        const counts = soldCountsByProduct.get(allocation.product_id)!;
        if (allocation.parent_bundle_id) {
          counts.bundle++;
        } else {
          counts.standalone++;
        }
      }

      return products.map(product => {
        const productAssets = assets.filter(asset => asset.product_id === product.id);

        const totalAssets = productAssets.length;
        const availableAssets = productAssets.filter(asset => asset.status === 'available').length;
        const allocatedAssets = productAssets.filter(asset => asset.status === 'allocated').length;
        const soldAssets = productAssets.filter(asset => asset.status === 'sold').length;

        // Get bundle-aware sold counts from allocations
        const soldCounts = soldCountsByProduct.get(product.id) || { standalone: 0, bundle: 0 };
        const soldAssetsStandalone = soldCounts.standalone;
        const soldAssetsViaBundle = soldCounts.bundle;

        const stockQuantity = product.stock_quantity || 0;
        const activeAssets = availableAssets + allocatedAssets;

        const discrepancy = stockQuantity - activeAssets;
        const missingAssets = Math.max(0, discrepancy);
        const excessAssets = Math.max(0, -discrepancy);
        const isInSync = Math.abs(discrepancy) === 0;
        const hasDiscrepancy = !isInSync;

        return {
          productId: product.id,
          productName: product.name,
          stockQuantity,
          totalAssets,
          availableAssets,
          allocatedAssets,
          soldAssets: soldAssetsStandalone + soldAssetsViaBundle, // Total physical sold
          soldAssetsStandalone,    // Standalone only (from allocations)
          soldAssetsViaBundle,     // Bundle components (from allocations)
          excessAssets,
          missingAssets,
          isInSync,
          hasDiscrepancy
        };
      });
    },
    staleTime: 10000, // 10 seconds
  });
};

/**
 * Hook for calculating purchase-specific asset allocation status
 * This helps detect over-allocations for specific purchases
 */
export const usePurchaseAssetStatus = (purchaseId?: string) => {
  return useQuery({
    queryKey: ["purchase-asset-status", purchaseId],
    queryFn: async (): Promise<PurchaseAssetStatus | null> => {
      if (!purchaseId) return null;

      // Get purchase details
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .select('id, product_id, quantity')
        .eq('id', purchaseId)
        .single();

      if (purchaseError || !purchase) return null;

      // Get asset allocations for the PRIMARY product of this purchase
      const { data: allocations, error: allocError } = await supabase
        .from('allocations')
        .select('id, asset_id, status')
        .eq('purchase_order_id', purchaseId)
        .eq('product_id', purchase.product_id)
        .in('status', ['allocated', 'fulfilled', 'pre_allocated']);

      if (allocError) throw allocError;

      const allocatedCount = allocations?.length || 0;
      const requestedQuantity = purchase.quantity;
      const isOverAllocated = allocatedCount > requestedQuantity;
      const isComplete = allocatedCount >= requestedQuantity;
      const remainingNeeded = Math.max(0, requestedQuantity - allocatedCount);
      const excessAllocated = Math.max(0, allocatedCount - requestedQuantity);

      return {
        purchaseId,
        productId: purchase.product_id,
        requestedQuantity,
        allocatedCount,
        isOverAllocated,
        isComplete,
        remainingNeeded,
        excessAllocated
      };
    },
    enabled: !!purchaseId,
    staleTime: 5000, // 5 seconds
  });
};

/**
 * Hook to get asset calculation for a specific product
 */
export const useProductAssetCalculation = (productId: string) => {
  const { data: calculations = [] } = useUnifiedAssetCalculations();
  return calculations.find(calc => calc.productId === productId) || null;
};
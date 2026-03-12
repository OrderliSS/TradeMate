import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BundleAwareSoldCount {
  productId: string;
  standaloneSold: number;      // Sold directly (not as part of a bundle)
  bundleSold: number;          // Sold as a component of bundles
  totalPhysicalSold: number;   // Total physical units sold (for inventory)
}

/**
 * Hook to get accurate sold counts that differentiate between
 * standalone sales and bundle-derived sales.
 * 
 * This prevents bundle component allocations from inflating
 * standalone product sales counts.
 */
export const useBundleAwareSoldCount = (productId: string) => {
  return useQuery({
    queryKey: ["bundle-aware-sold-count", productId],
    queryFn: async (): Promise<BundleAwareSoldCount> => {
      if (!productId) {
        return { productId: '', standaloneSold: 0, bundleSold: 0, totalPhysicalSold: 0 };
      }

      // Count assets sold standalone (no parent_bundle_id in allocation)
      const { count: standaloneCount, error: standaloneError } = await supabase
        .from('allocations')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', productId)
        .is('parent_bundle_id', null)
        .in('status', ['fulfilled', 'allocated']);

      if (standaloneError) {
        console.error('Error counting standalone allocations:', standaloneError);
      }

      // Count assets sold via bundles (has parent_bundle_id)
      const { count: bundleCount, error: bundleError } = await supabase
        .from('allocations')
        .select('id', { count: 'exact', head: true })
        .eq('product_id', productId)
        .not('parent_bundle_id', 'is', null)
        .in('status', ['fulfilled', 'allocated']);

      if (bundleError) {
        console.error('Error counting bundle allocations:', bundleError);
      }

      const standaloneSold = standaloneCount || 0;
      const bundleSold = bundleCount || 0;

      return {
        productId,
        standaloneSold,
        bundleSold,
        totalPhysicalSold: standaloneSold + bundleSold
      };
    },
    enabled: !!productId,
    staleTime: 10000, // 10 seconds
  });
};

/**
 * Hook to get bundle-aware sold counts for all products at once.
 * Useful for inventory overview pages.
 */
export const useAllBundleAwareSoldCounts = () => {
  return useQuery({
    queryKey: ["all-bundle-aware-sold-counts"],
    queryFn: async (): Promise<Map<string, BundleAwareSoldCount>> => {
      // Get all allocations with bundle info
      const { data: allocations, error } = await supabase
        .from('allocations')
        .select('product_id, parent_bundle_id, status')
        .in('status', ['fulfilled', 'allocated']);

      if (error) {
        console.error('Error fetching allocations:', error);
        return new Map();
      }

      // Group by product and calculate counts
      const countsByProduct = new Map<string, BundleAwareSoldCount>();

      for (const allocation of allocations || []) {
        const productId = allocation.product_id;
        
        if (!countsByProduct.has(productId)) {
          countsByProduct.set(productId, {
            productId,
            standaloneSold: 0,
            bundleSold: 0,
            totalPhysicalSold: 0
          });
        }

        const counts = countsByProduct.get(productId)!;
        
        if (allocation.parent_bundle_id) {
          counts.bundleSold++;
        } else {
          counts.standaloneSold++;
        }
        counts.totalPhysicalSold++;
      }

      return countsByProduct;
    },
    staleTime: 10000, // 10 seconds
  });
};

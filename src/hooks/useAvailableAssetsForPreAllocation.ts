import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface BundleComponent {
  product_id: string;
  quantity: number;
}

export const useAvailableAssetsForPreAllocation = (productId: string, includeInTransit = false) => {
  return useQuery({
    queryKey: ["available-assets-preallocation", productId, includeInTransit],
    queryFn: async () => {
      if (!includeInTransit) {
        // Use the existing function for regular assets
        const { data, error } = await supabase
          .rpc('get_available_assets_for_allocation', {
            p_product_id: productId,
            p_include_in_transit: false
          });
        
        if (error) throw error;
        return data || [];
      } else {
        // Include in-transit assets for pre-allocation
        const { data, error } = await supabase
          .rpc('get_available_assets_for_allocation', {
            p_product_id: productId,
            p_include_in_transit: true
          });
        
        if (error) throw error;
        return data || [];
      }
    },
    enabled: !!productId,
  });
};

export const useAvailableAssetsByCategoryForPreAllocation = (productId: string, includeInTransit = false) => {
  return useQuery({
    queryKey: ["available-assets-by-category-preallocation", productId, includeInTransit],
    queryFn: async () => {
      const { data: assets, error } = await supabase
        .rpc('get_available_assets_for_allocation', {
          p_product_id: productId,
          p_include_in_transit: includeInTransit
        });

      if (error) throw error;

      // Group assets by priority using the actual asset_priority field from database
      const categorizedAssets = {
        primary: [] as any[],
        secondary: [] as any[],
        uncategorized: [] as any[]
      };

      (assets || []).forEach(asset => {
        const enhancedAsset = {
          ...asset,
          is_in_transit: asset.is_in_transit || false,
          category: asset.category || 'device' // Ensure category is always present
        };
        
        // Use the actual asset_priority from the database instead of deriving from category
        const priority = asset.asset_priority || 'primary';
        
        if (priority === 'primary') {
          categorizedAssets.primary.push(enhancedAsset);
        } else if (priority === 'secondary') {
          categorizedAssets.secondary.push(enhancedAsset);
        } else {
          categorizedAssets.uncategorized.push(enhancedAsset);
        }
      });

      return {
        primary: categorizedAssets.primary,
        secondary: categorizedAssets.secondary,
        uncategorized: categorizedAssets.uncategorized,
        all: assets || []
      };
    },
    enabled: !!productId,
  });
};

// New hook for bundle pre-allocation - queries assets from all component products
export const useAvailableAssetsByCategoryForBundlePreAllocation = (
  bundleComponents: BundleComponent[] | null | undefined, 
  includeInTransit = false
) => {
  const productIds = bundleComponents?.map(c => c.product_id) || [];
  
  return useQuery({
    queryKey: ["available-assets-by-category-bundle-preallocation", productIds, includeInTransit],
    queryFn: async () => {
      if (productIds.length === 0) {
        return {
          primary: [],
          secondary: [],
          uncategorized: [],
          all: [],
          byProduct: {} as Record<string, any[]>
        };
      }

      // Query assets for each component product
      const assetsByProduct: Record<string, any[]> = {};
      const allAssets: any[] = [];

      for (const productId of productIds) {
        const { data: assets, error } = await supabase
          .rpc('get_available_assets_for_allocation', {
            p_product_id: productId,
            p_include_in_transit: includeInTransit
          });

        if (error) {
          console.error(`Error fetching assets for product ${productId}:`, error);
          continue;
        }

        // Ensure each asset has product_id set explicitly (in case RPC doesn't return it)
        const assetsWithProductId = (assets || []).map(a => ({
          ...a,
          product_id: a.product_id || productId
        }));

        assetsByProduct[productId] = assetsWithProductId;
        allAssets.push(...assetsWithProductId);
      }

      // Group all assets by priority
      const categorizedAssets = {
        primary: [] as any[],
        secondary: [] as any[],
        uncategorized: [] as any[]
      };

      allAssets.forEach(asset => {
        const enhancedAsset = {
          ...asset,
          is_in_transit: asset.is_in_transit || false,
          category: asset.category || 'device'
        };
        
        const priority = asset.asset_priority || 'primary';
        
        if (priority === 'primary') {
          categorizedAssets.primary.push(enhancedAsset);
        } else if (priority === 'secondary') {
          categorizedAssets.secondary.push(enhancedAsset);
        } else {
          categorizedAssets.uncategorized.push(enhancedAsset);
        }
      });

      return {
        primary: categorizedAssets.primary,
        secondary: categorizedAssets.secondary,
        uncategorized: categorizedAssets.uncategorized,
        all: allAssets,
        byProduct: assetsByProduct
      };
    },
    enabled: productIds.length > 0,
  });
};

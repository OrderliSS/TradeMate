import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AssetValidationResult {
  isValid: boolean;
  errors: string[];
  availableAssets: Array<{
    id: string;
    asset_tag?: string;
    status: string;
  }>;
  conflictingAssets: Array<{
    id: string;
    asset_tag?: string;
    status: string;
    conflictReason: string;
  }>;
}

export const useAssetValidation = (assetIds: string[], enabled = false) => {
  return useQuery({
    queryKey: ["asset-validation", assetIds],
    queryFn: async (): Promise<AssetValidationResult> => {
      if (!assetIds || assetIds.length === 0) {
        return {
          isValid: false,
          errors: ["No assets provided for validation"],
          availableAssets: [],
          conflictingAssets: []
        };
      }

      const result: AssetValidationResult = {
        isValid: true,
        errors: [],
        availableAssets: [],
        conflictingAssets: []
      };

      // Check if assets exist and get their current status
      const { data: assets, error: assetError } = await supabase
        .from("asset_management")
        .select("id, asset_tag, status")
        .in("id", assetIds);

      if (assetError) {
        result.isValid = false;
        result.errors.push(`Failed to verify assets: ${assetError.message}`);
        return result;
      }

      if (!assets || assets.length !== assetIds.length) {
        const foundIds = assets?.map(a => a.id) || [];
        const missingIds = assetIds.filter(id => !foundIds.includes(id));
        result.isValid = false;
        result.errors.push(`Assets not found: ${missingIds.join(', ')}`);
        return result;
      }

      // Check for existing allocations
      const { data: allocations, error: allocError } = await supabase
        .from("allocations")
        .select("asset_id, status, purchase_order_id, created_at")
        .in("asset_id", assetIds)
        .in("status", ["allocated", "pre_allocated"]);

      if (allocError) {
        result.isValid = false;
        result.errors.push(`Failed to check allocations: ${allocError.message}`);
        return result;
      }

      // Process each asset
      for (const asset of assets) {
        const allocation = allocations?.find(a => a.asset_id === asset.id);
        
        if (allocation) {
          result.isValid = false;
          result.conflictingAssets.push({
            ...asset,
            conflictReason: `Already ${allocation.status} (since ${new Date(allocation.created_at).toLocaleDateString()})`
          });
        } else if (!['available', 'instock', 'in_transit'].includes(asset.status)) {
          result.isValid = false;
          result.conflictingAssets.push({
            ...asset,
            conflictReason: `Invalid status: ${asset.status}`
          });
        } else {
          result.availableAssets.push(asset);
        }
      }

      if (result.conflictingAssets.length > 0) {
        result.errors.push(
          `${result.conflictingAssets.length} asset(s) cannot be allocated: ${
            result.conflictingAssets.map(a => `${a.asset_tag || a.id} (${a.conflictReason})`).join(', ')
          }`
        );
      }

      return result;
    },
    enabled: enabled && assetIds && assetIds.length > 0,
    staleTime: 5000, // Refresh validation every 5 seconds
    refetchOnWindowFocus: true,
  });
};

export const useRetryableAllocation = () => {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1 second

  const retryAllocation = async (
    allocationFn: () => Promise<any>,
    retryCount = 0
  ): Promise<any> => {
    try {
      return await allocationFn();
    } catch (error: any) {
      const errorMessage = error.message || error.toString();
      
      // Only retry on transient errors
      const isRetriableError = 
        errorMessage.includes('violates') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('connection') ||
        errorMessage.includes('network');

      if (isRetriableError && retryCount < MAX_RETRIES) {
        console.warn(`Allocation failed (attempt ${retryCount + 1}/${MAX_RETRIES + 1}), retrying in ${RETRY_DELAY}ms...`, error);
        
        // Wait before retry with exponential backoff
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
        
        return retryAllocation(allocationFn, retryCount + 1);
      }
      
      // If not retriable or max retries reached, throw the original error
      throw error;
    }
  };

  return { retryAllocation };
};